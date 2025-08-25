// src/app/directeur-des-etudes/components/ProfessorsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  DocumentData,
  doc,
  getDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import Toast from "../../admin/components/ui/Toast";

// ✅ formulaire modale (création & édition)
import ProfesseurForm from "../../admin/pages/users/professeurForm";

/* ------------------------------------------------------------------ */
const ROLE_PROF_KEY = "prof";
const PER_PAGE = 10;

type SectionKey = "Gestion" | "Informatique";

/* ------------------------------------------------------------------ */
// Référentiels
type TRole = { id: string | number; libelle: string };

type TFiliere = {
  id: string;
  libelle: string;
  section?: SectionKey;
  academic_year_id?: string;
};

type TClasse = {
  id: string;
  libelle: string;
  filiere_id?: string;
  filiere_libelle?: string;
  academic_year_id?: string;
};

type TMatiere = { id: string; libelle: string; class_id?: string };

// Années
type TAnnee = { id: string; libelle: string; active?: boolean };

/* -------------------- Professeur: champs complets ------------------- */
type TProfessor = {
  docId: string;
  id?: number;
  // base
  nom: string;
  prenom: string;
  email?: string;
  login?: string;
  specialite?: string;
  role_id?: string;
  role_libelle?: string;
  role_key?: string;
  telephone?: string;
  adresse?: string;
  specialite_detaillee?: string;

  // identité / état civil
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;
  sexe?: string;
  situation_matrimoniale?: string;
  cni_passeport?: string;

  // statut / fonction
  statut?: string;
  fonction_principale?: string;

  // disponibilités
  disponibilites?: { jour: string; debut: string; fin: string }[];

  // éléments constitutifs / expériences
  elements_constitutifs?: string[];
  experience_enseignement?: { annees: number; etablissements: string[] };

  // diplômes / niveaux / compétences
  diplomes?: { intitule: string; niveau: string; annee: string; etablissement: string }[];
  niveaux_enseignement?: string[];
  competences?: { outils: string[]; langues: string[]; publications: string[] };

  // RIB / documents
  rib?: string | null;
  documents?: {
    cv?: string | null;
    diplomes?: string | null;
    piece_identite?: string | null;
    rib?: string | null;
  };

  // compat
  auth_uid?: string;
};

type TUserRow = {
  id?: number;
  docId: string;
  nom: string;
  prenom: string;
  specialite?: string;
  role_id?: string;
  role_libelle?: string;
  role_key?: string;
};

/* ------------------------------------------------------------------ */
// ✅ Types locaux pour caster le composant externe ProfesseurForm
type ProfesseurFormMode = "create" | "edit";
type ProfesseurFormProps = {
  mode: ProfesseurFormMode;
  docId?: string;
  roles?: TRole[];
  onClose: () => void;
  onSaved?: () => void;
};
const ProfesseurFormTyped = ProfesseurForm as unknown as React.ComponentType<ProfesseurFormProps>;

/* ------------------------------------------------------------------ */

export default function ProfessorsPage() {
  /* === Référentiels === */
  const [roles, setRoles] = useState<TRole[]>([]);
  const [filieres, setFilieres] = useState<TFiliere[]>([]);
  const [classes, setClasses] = useState<TClasse[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);
  const [annees, setAnnees] = useState<TAnnee[]>([]);

  const filiereById = useMemo(() => Object.fromEntries(filieres.map(f => [f.id, f])), [filieres]);
  const classesByFiliere = useMemo(() => {
    const m: Record<string, TClasse[]> = {};
    classes.forEach(c => {
      const fid = c.filiere_id || "";
      if (!m[fid]) m[fid] = [];
      m[fid].push(c);
    });
    return m;
  }, [classes]);
  const matieresByClass = useMemo(() => {
    const m: Record<string, TMatiere[]> = {};
    matieres.forEach(x => {
      const cid = x.class_id || "";
      if (!m[cid]) m[cid] = [];
      m[cid].push(x);
    });
    return m;
  }, [matieres]);

  /* === Liste (client) === */
  const [all, setAll] = useState<TUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // recherche / tri / pagination (côté client)
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const sortRows = (rows: TUserRow[]) =>
    [...rows].sort((a, b) => {
      const n = (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" });
      if (n !== 0) return n;
      return (a.prenom || "").localeCompare(b.prenom || "", "fr", { sensitivity: "base" });
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortRows(all);
    return sortRows(
      all.filter(u => `${u.nom} ${u.prenom} ${u.specialite || ""}`.toLowerCase().includes(q))
    );
  }, [all, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1); // reset page quand la recherche change
  }, [search]);

  /* === Toasts === */
  const [toast, setToast] = useState("");
  const [okShow, setOkShow] = useState(false);
  const [errShow, setErrShow] = useState(false);
  const ok = (m: string) => { setToast(m); setOkShow(true); };
  const ko = (m: string) => { setToast(m); setErrShow(true); };

  /* === Modales === */
  const [showCreate, setShowCreate] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);

  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<TProfessor | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // === Assignation (Section -> Filière -> Classe -> Matières) ===
  type TDraft = {
    section?: SectionKey;
    filiere_id?: string;
    classe_id?: string;
    matieres_ids: string[];
  };

  const [showAssign, setShowAssign] = useState(false);
  const [assignForDocId, setAssignForDocId] = useState<string | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignErr, setAssignErr] = useState("");
  const [assignOk, setAssignOk] = useState("");

  const [anneeId, setAnneeId] = useState<string>("");

  // building block sélection
  const [draft, setDraft] = useState<TDraft>({ matieres_ids: [] });
  // liste d’affectations en mémoire avant Save
  const [draftList, setDraftList] = useState<
    { section: SectionKey; filiere_id: string; classe_id: string; matieres_ids: string[] }[]
  >([]);

  /* ---------------------- fetch référentiels ------------------------ */
  const fetchRoles = async () => {
    const snap = await getDocs(collection(db, "roles"));
    const rs: TRole[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      rs.push({ id: data.id ?? d.id, libelle: data.libelle });
    });
    setRoles(rs);
  };

  const fetchFilieres = async () => {
    const snap = await getDocs(collection(db, "filieres"));
    const rows: TFiliere[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      rows.push({
        id: d.id,
        libelle: String(v.libelle || d.id),
        section: (v.section === "Gestion" || v.section === "Informatique") ? v.section : undefined,
        academic_year_id: String(v.academic_year_id || ""),
      });
    });
    rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
    setFilieres(rows);
  };

  const fetchClasses = async () => {
    const snap = await getDocs(collection(db, "classes"));
    const cs: TClasse[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      cs.push({
        id: d.id,
        libelle: String(v.libelle || d.id),
        filiere_id: String(v.filiere_id || ""),
        filiere_libelle: String(v.filiere_libelle || ""),
        academic_year_id: String(v.academic_year_id || ""),
      });
    });
    cs.sort((a, b) => a.libelle.localeCompare(b.libelle));
    setClasses(cs);
  };

  const fetchMatieres = async () => {
    const snap = await getDocs(collection(db, "matieres"));
    const ms: TMatiere[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      ms.push({ id: d.id, libelle: String(v.libelle || d.id), class_id: String(v.class_id || "") });
    });
    ms.sort((a, b) => a.libelle.localeCompare(b.libelle));
    setMatieres(ms);
  };

  const fetchAnnees = async () => {
    const snap = await getDocs(collection(db, "annees_scolaires"));
    const ys: TAnnee[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      ys.push({ id: d.id, libelle: data.libelle ?? d.id, active: !!data.active });
    });
    setAnnees(ys);
  };

  // Liste des profs (sans orderBy) → tri & pagination côté client
  const fetchProfs = async () => {
    setLoading(true);
    try {
      const qy = query(collection(db, "users"), where("role_key", "==", ROLE_PROF_KEY));
      const snap = await getDocs(qy);
      const rows: TUserRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as DocumentData;
        rows.push({
          docId: d.id,
          id: v.id,
          nom: v.nom || "",
          prenom: v.prenom || "",
          specialite: v.specialite || v.specialty || "",
          role_id: v.role_id !== undefined && v.role_id !== null ? String(v.role_id) : undefined,
          role_libelle: v.role_libelle,
          role_key: v.role_key,
        });
      });
      setAll(rows);
    } catch (e) {
      console.error(e);
      ko("Erreur lors du chargement des professeurs.");
    } finally {
      setLoading(false);
    }
  };

  const bootstrap = async () => {
    await Promise.all([fetchRoles(), fetchFilieres(), fetchClasses(), fetchMatieres(), fetchAnnees()]);
    await fetchProfs();
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAnneeId = useMemo(() => {
    const a = annees.find((x) => x.active);
    return a?.id || annees[0]?.id || "";
  }, [annees]);

  /* ---------------------- Détails: open / load ---------------------- */
  const openDetails = async (docId: string) => {
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const ref = doc(db, "users", docId);
      const d = await getDoc(ref);
      if (!d.exists()) {
        setDetails(null);
        return;
      }
      const v = d.data() as any;
      const prof: TProfessor = {
        docId: d.id,
        id: v.id,
        // base
        nom: v.nom ?? "",
        prenom: v.prenom ?? "",
        email: v.email ?? "",
        login: v.login ?? "",
        specialite: v.specialite ?? v.specialty ?? "",
        role_id: v.role_id !== undefined && v.role_id !== null ? String(v.role_id) : undefined,
        role_libelle: v.role_libelle,
        role_key: v.role_key,
        telephone: v.telephone ?? "",
        adresse: v.adresse ?? "",
        specialite_detaillee: v.specialite_detaillee ?? "",
        // identité
        date_naissance: v.date_naissance ?? "",
        lieu_naissance: v.lieu_naissance ?? "",
        nationalite: v.nationalite ?? "",
        sexe: v.sexe ?? "",
        situation_matrimoniale: v.situation_matrimoniale ?? "",
        cni_passeport: v.cni_passeport ?? "",
        // statut/fonction
        statut: v.statut ?? "",
        fonction_principale: v.fonction_principale ?? "",
        // dispo / éléments / expériences
        disponibilites: Array.isArray(v.disponibilites) ? v.disponibilites : [],
        elements_constitutifs: Array.isArray(v.elements_constitutifs) ? v.elements_constitutifs : [],
        experience_enseignement: v.experience_enseignement ?? { annees: 0, etablissements: [] },
        // diplômes / niveaux / compétences
        diplomes: Array.isArray(v.diplomes) ? v.diplomes : [],
        niveaux_enseignement: Array.isArray(v.niveaux_enseignement) ? v.niveaux_enseignement : [],
        competences: v.competences ?? { outils: [], langues: [], publications: [] },
        // rib / docs
        rib: v.rib ?? null,
        documents: v.documents ?? {},
        // compat
        auth_uid: v.auth_uid,
      };
      setDetails(prof);
    } catch (e) {
      console.error(e);
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  /* ---------------------- Supprimer (modale danger) ----------------- */
  const askDelete = (docId: string) => {
    setDeleteDocId(docId);
    setDeleteError("");
    setShowDelete(true);
  };

  const doDelete = async () => {
    if (!deleteDocId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteDoc(doc(db, "users", deleteDocId));
      setShowDelete(false);
      setDeleteDocId(null);
      await fetchProfs();
      ok("Professeur supprimé.");
    } catch (e: any) {
      console.error(e);
      setDeleteError("Suppression impossible. Réessayez.");
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------------- Assignation ------------------------------- */
  const openAssign = async (docId: string) => {
    setAssignForDocId(docId);
    setAssignErr("");
    setAssignOk("");
    setAnneeId(activeAnneeId);
    setDraft({ matieres_ids: [] });
    setDraftList([]);

    try {
      // précharger si déjà affecté (ancien ou nouveau format)
      if (activeAnneeId) {
        const ref = doc(db, "affectations_professeurs", `${activeAnneeId}__${docId}`);
        const d = await getDoc(ref);
        if (d.exists()) {
          const data = d.data() as any;
          const existing: typeof draftList = [];
          (data.classes || []).forEach((c: any) => {
            const cls = classes.find(x => x.id === c.classe_id);
            const filiereId = c.filiere_id || cls?.filiere_id || "";
            const filiere = filiereById[filiereId];
            const sec = (filiere?.section === "Gestion" || filiere?.section === "Informatique")
              ? filiere.section : undefined;
            if (!filiereId || !sec || !c.classe_id) return;
            existing.push({
              section: sec,
              filiere_id: filiereId,
              classe_id: c.classe_id,
              matieres_ids: Array.isArray(c.matieres_ids) ? c.matieres_ids : [],
            });
          });
          setDraftList(existing);
          setAnneeId(data.annee_id || activeAnneeId);
        }
      }
    } catch (e) {
      console.error(e);
    }

    setShowAssign(true);
  };

  const addDraft = () => {
    setAssignErr("");
    if (!draft.section) return setAssignErr("Sélectionnez une section.");
    if (!draft.filiere_id) return setAssignErr("Sélectionnez une filière.");
    if (!draft.classe_id) return setAssignErr("Sélectionnez une classe.");
    const matList = draft.matieres_ids || [];
    // autoriser zéro matière ? → mieux d’exiger au moins une
    if (matList.length === 0) return setAssignErr("Cochez au moins une matière.");

    // éviter doublons classe
    if (draftList.some(d => d.classe_id === draft.classe_id)) {
      return setAssignErr("Cette classe est déjà dans la liste d’affectations.");
    }

    setDraftList(prev => [
      ...prev,
      {
        section: draft.section!,
        filiere_id: draft.filiere_id!,
        classe_id: draft.classe_id!,
        matieres_ids: [...matList],
      },
    ]);

    // reset sélecteurs pour ajouter une autre affectation
    setDraft({ matieres_ids: [] });
  };

  const removeDraft = (classe_id: string) => {
    setDraftList(prev => prev.filter(d => d.classe_id !== classe_id));
  };

  const saveAssign = async () => {
    setAssignBusy(true);
    setAssignErr("");
    setAssignOk("");

    try {
      const year = anneeId || activeAnneeId;
      if (!year) {
        setAssignBusy(false);
        return setAssignErr("Choisissez une année scolaire.");
      }
      if (draftList.length === 0) {
        setAssignBusy(false);
        return setAssignErr("Ajoutez au moins une affectation.");
      }

      const classesPayload = draftList.map(it => {
        const c = classes.find(x => x.id === it.classe_id);
        const mats = (matieresByClass[it.classe_id] || []) as TMatiere[];
        const labels = it.matieres_ids
          .map(id => mats.find(m => m.id === id)?.libelle)
          .filter(Boolean) as string[];
        return {
          filiere_id: it.filiere_id,
          filiere_libelle: filiereById[it.filiere_id]?.libelle || "",
          classe_id: it.classe_id,
          classe_libelle: c?.libelle || it.classe_id,
          matieres_ids: it.matieres_ids,
          matieres_libelles: labels,
        };
      });

      await setDoc(
        doc(db, "affectations_professeurs", `${year}__${assignForDocId}`),
        {
          annee_id: year,
          prof_doc_id: assignForDocId,
          classes: classesPayload,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        }
      );

      setAssignOk("Affectations enregistrées.");
      setTimeout(() => {
        setShowAssign(false);
        setAssignForDocId(null);
        setAssignOk("");
      }, 700);
    } catch (e) {
      console.error(e);
      setAssignErr("Enregistrement impossible.");
    } finally {
      setAssignBusy(false);
    }
  };

  /* ---------------------- Render ----------------------------------- */
  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Professeurs</h3>
          <div className="text-muted">Gestion des comptes et affectations par année scolaire.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <i className="bi bi-plus-lg me-2" />
            Ajouter Professeur
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 position-sticky top-0" style={{ zIndex: 5 }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <h5 className="mb-0 fw-semibold">
              <i className="bi bi-people me-2" />
              Liste des professeurs
            </h5>
            <div className="d-flex gap-2 align-items-center">
              <div className="input-group input-group-sm" style={{ minWidth: 320 }}>
                <span className="input-group-text bg-light border-0">
                  <i className="bi bi-search" />
                </span>
                <input
                  className="form-control border-0"
                  placeholder="Rechercher (nom, prénom, spécialité)…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                />
                <button className="btn btn-primary" type="button" title="Rechercher">
                  <i className="bi bi-search me-1" /> Rechercher
                </button>
              </div>
              <span className="badge bg-light text-dark">
                {loading && all.length === 0 ? "Chargement…" : `${filtered.length} résultat(s)`}
              </span>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          {loading && all.length === 0 ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
              <div className="text-muted mt-2">Chargement…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-person-exclamation" style={{ fontSize: 32 }} />
              <div className="mt-2">Aucun professeur ne correspond à votre recherche.</div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 4 }}>
                    <tr>
                      <th className="text-nowrap">Nom</th>
                      <th className="text-nowrap">Prénom</th>
                      <th className="text-nowrap">Spécialité</th>
                      <th className="text-end text-nowrap" style={{ width: 320 }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((u) => (
                      <tr key={u.docId}>
                        <td className="fw-semibold">{u.nom}</td>
                        <td>{u.prenom}</td>
                        <td>
                          {u.specialite ? (
                            <span className="badge bg-secondary-subtle text-secondary-emphasis">{u.specialite}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-toolbar justify-content-end" role="toolbar">
                            <div className="btn-group me-2" role="group">
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Détails"
                                onClick={() => openDetails(u.docId)}
                              >
                                <i className="bi bi-eye" />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Modifier"
                                onClick={() => setEditDocId(u.docId)}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                title="Supprimer"
                                onClick={() => askDelete(u.docId)}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                            <button className="btn btn-sm btn-primary" onClick={() => openAssign(u.docId)}>
                              <i className="bi bi-diagram-3 me-1" />
                              Assigner
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination (client) */}
              <div className="p-3 d-flex justify-content-between align-items-center">
                <div className="small text-muted">
                  Page {page} / {totalPages} — {filtered.length} prof(s), {PER_PAGE} par page
                </div>
                <div className="btn-group">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <i className="bi bi-chevron-left" /> Précédent
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Suivant <i className="bi bi-chevron-right" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- Modales ---------- */}

      {/* Créer */}
      {showCreate && (
        <>
          <ProfesseurFormTyped
            mode="create"
            roles={roles}
            onClose={() => setShowCreate(false)}
            onSaved={async () => {
              setShowCreate(false);
              await fetchProfs();
            }}
          />
          <div className="modal-backdrop fade show" onClick={() => setShowCreate(false)} />
        </>
      )}

      {/* Modifier */}
      {editDocId && (
        <>
          <ProfesseurFormTyped
            mode="edit"
            docId={editDocId}
            roles={roles}
            onClose={() => setEditDocId(null)}
            onSaved={async () => {
              setEditDocId(null);
              await fetchProfs();
            }}
          />
          <div className="modal-backdrop fade show" onClick={() => setEditDocId(null)} />
        </>
      )}

      {/* Détails — affiche TOUT */}
      {showDetails && (
        <>
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-eye me-2" />
                    Détails du professeur
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowDetails(false)} />
                </div>

                <div className="modal-body">
                  {detailsLoading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border" role="status" />
                      <div className="text-muted mt-2">Chargement…</div>
                    </div>
                  ) : !details ? (
                    <div className="alert alert-warning">Professeur introuvable.</div>
                  ) : (
                    <>
                      <h6 className="fw-bold">Informations de base</h6><hr className="mt-1"/>
                      <div className="row small">
                        <div className="col-md-3"><strong>Nom & Prénom</strong><div>{details.nom} {details.prenom}</div></div>
                        <div className="col-md-3"><strong>Email</strong><div>{details.email || "—"}</div></div>
                        <div className="col-md-3"><strong>Téléphone</strong><div>{details.telephone || "—"}</div></div>
                        <div className="col-md-3"><strong>Login</strong><div>{details.login || "—"}</div></div>
                        <div className="col-md-3"><strong>Rôle</strong><div>{details.role_libelle || "—"}</div></div>
                        <div className="col-md-3"><strong>Spécialité</strong><div>{details.specialite || "—"}</div></div>
                        <div className="col-md-6"><strong>Adresse</strong><div>{details.adresse || "—"}</div></div>
                        {details.specialite_detaillee && (
                          <div className="col-12"><strong>Spécialité détaillée</strong><div>{details.specialite_detaillee}</div></div>
                        )}
                      </div>

                      <h6 className="fw-bold mt-3">Identité</h6><hr className="mt-1"/>
                      <div className="row small">
                        <div className="col-md-3"><strong>Sexe</strong><div>{details.sexe || "—"}</div></div>
                        <div className="col-md-3"><strong>Date de naissance</strong><div>{details.date_naissance || "—"}</div></div>
                        <div className="col-md-3"><strong>Lieu de naissance</strong><div>{details.lieu_naissance || "—"}</div></div>
                        <div className="col-md-3"><strong>Nationalité</strong><div>{details.nationalite || "—"}</div></div>
                        <div className="col-md-3"><strong>Situation matrimoniale</strong><div>{details.situation_matrimoniale || "—"}</div></div>
                        <div className="col-md-3"><strong>CNI / Passeport</strong><div>{details.cni_passeport || "—"}</div></div>
                      </div>

                      <h6 className="fw-bold mt-3">Statut & Fonction</h6><hr className="mt-1"/>
                      <div className="row small">
                        <div className="col-md-3"><strong>Statut</strong><div>{details.statut || "—"}</div></div>
                        <div className="col-md-9"><strong>Fonction principale</strong><div>{details.fonction_principale || "—"}</div></div>
                      </div>

                      <h6 className="fw-bold mt-3">Disponibilités</h6><hr className="mt-1"/>
                      <div className="small">
                        {details.disponibilites?.length ? (
                          <ul className="mb-2">
                            {details.disponibilites.map((d, i) => (
                              <li key={i}>{d.jour} — {d.debut} → {d.fin}</li>
                            ))}
                          </ul>
                        ) : "—"}
                      </div>

                      <h6 className="fw-bold mt-3">Éléments constitutifs & Expérience</h6><hr className="mt-1"/>
                      <div className="row small">
                        <div className="col-md-6">
                          <strong>Éléments constitutifs</strong>
                          <div>{details.elements_constitutifs?.length ? details.elements_constitutifs.join(", ") : "—"}</div>
                        </div>
                        <div className="col-md-6">
                          <strong>Exp. enseignement</strong>
                          <div>{details.experience_enseignement?.annees ?? 0} année(s)</div>
                          <div className="small text-muted">
                            {(details.experience_enseignement?.etablissements || []).join(", ") || "—"}
                          </div>
                        </div>
                      </div>

                      <h6 className="fw-bold mt-3">Diplômes</h6><hr className="mt-1"/>
                      <div className="small">
                        {details.diplomes?.length ? (
                          <ul className="mb-2">
                            {details.diplomes.map((d, i) => (
                              <li key={i}><b>{d.intitule}</b> — {d.niveau} — {d.annee} — {d.etablissement}</li>
                            ))}
                          </ul>
                        ) : "—"}
                      </div>

                      <h6 className="fw-bold mt-3">Niveaux & Compétences</h6><hr className="mt-1"/>
                      <div className="row small">
                        <div className="col-md-4">
                          <strong>Niveaux enseignement</strong>
                          <div>{details.niveaux_enseignement?.length ? details.niveaux_enseignement.join(", ") : "—"}</div>
                        </div>
                        <div className="col-md-4">
                          <strong>Outils</strong>
                          <div>{details.competences?.outils?.length ? details.competences.outils.join(", ") : "—"}</div>
                        </div>
                        <div className="col-md-4">
                          <strong>Langues</strong>
                          <div>{details.competences?.langues?.length ? details.competences.langues.join(", ") : "—"}</div>
                        </div>
                        <div className="col-12 mt-2">
                          <strong>Publications</strong>
                          <div className="small">{details.competences?.publications?.length ? details.competences.publications.join(", ") : "—"}</div>
                        </div>
                      </div>

                      <h6 className="fw-bold mt-3">Documents & RIB</h6><hr className="mt-1"/>
                      <div className="small">
                        <div>CV : {details.documents?.cv ? <a href={details.documents.cv} target="_blank" rel="noreferrer">Ouvrir</a> : "—"}</div>
                        <div>Diplômes : {details.documents?.diplomes ? <a href={details.documents.diplomes} target="_blank" rel="noreferrer">Ouvrir</a> : "—"}</div>
                        <div>Pièce d’identité : {details.documents?.piece_identite ? <a href={details.documents.piece_identite} target="_blank" rel="noreferrer">Ouvrir</a> : "—"}</div>
                        <div>RIB : {details.documents?.rib ? <a href={details.documents.rib} target="_blank" rel="noreferrer">Ouvrir</a> : "—"}</div>
                        <div className="mt-2"><strong>RIB (texte)</strong> : {details.rib || "—"}</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowDetails(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDetails(false)} />
        </>
      )}

      {/* Supprimer (danger) */}
      {showDelete && (
        <>
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-md modal-dialog-centered">
              <div className="modal-content border-0" style={{ boxShadow: "0 0 0 2px rgba(220,53,69,.25)" }}>
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-exclamation-triangle me-2" />
                    Suppression définitive
                  </h5>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setShowDelete(false)} />
                </div>
                <div className="modal-body">
                  <p className="mb-2">Cette action est <b>dangereuse</b>, <b>définitive</b> et <b>irréversible</b>.</p>
                  <p className="mb-0">Les données de ce professeur seront supprimées.</p>
                  {deleteError && <div className="alert alert-danger mt-3 mb-0">{deleteError}</div>}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowDelete(false)} disabled={deleting}>
                    Annuler
                  </button>
                  <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                    {deleting ? (<><span className="spinner-border spinner-border-sm me-2" />Suppression…</>) : "Supprimer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDelete(false)} />
        </>
      )}

      {/* Assigner (Section → Filière → Classe → Matières) */}
      {showAssign && (
        <>
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-diagram-3 me-2" />
                    Assigner classes & matières (par année)
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowAssign(false)} />
                </div>
                <div className="modal-body">
                  {assignErr && <div className="alert alert-danger">{assignErr}</div>}
                  {assignOk && <div className="alert alert-success">{assignOk}</div>}

                  {/* Année */}
                  <div className="mb-3">
                    <label className="form-label">Année scolaire</label>
                    <select className="form-select" value={anneeId} onChange={(e) => setAnneeId(e.target.value)}>
                      {annees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.libelle} {a.active ? "(en cours)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sélecteurs en cascade */}
                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label">Section</label>
                      <select
                        className="form-select"
                        value={draft.section || ""}
                        onChange={(e) => {
                          const s = (e.target.value || "") as SectionKey | "";
                          setDraft({ section: (s || undefined) as SectionKey | undefined, filiere_id: undefined, classe_id: undefined, matieres_ids: [] });
                        }}
                      >
                        <option value="">—</option>
                        <option value="Gestion">Gestion</option>
                        <option value="Informatique">Informatique</option>
                      </select>
                    </div>

                    <div className="col-md-5">
                      <label className="form-label">Filière</label>
                      <select
                        className="form-select"
                        value={draft.filiere_id || ""}
                        onChange={(e) => {
                          const fid = e.target.value || "";
                          setDraft((d) => ({ ...d, filiere_id: fid || undefined, classe_id: undefined, matieres_ids: [] }));
                        }}
                        disabled={!draft.section}
                      >
                        <option value="">—</option>
                        {filieres
                          .filter((f) => f.section === draft.section)
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.libelle}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Classe</label>
                      <select
                        className="form-select"
                        value={draft.classe_id || ""}
                        onChange={(e) => {
                          const cid = e.target.value || "";
                          setDraft((d) => ({ ...d, classe_id: cid || undefined, matieres_ids: [] }));
                        }}
                        disabled={!draft.filiere_id}
                      >
                        <option value="">—</option>
                        {(draft.filiere_id ? (classesByFiliere[draft.filiere_id] || []) : []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.libelle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Matières de la classe */}
                  {draft.classe_id && (
                    <div className="mt-3">
                      <div className="text-muted small mb-1">Matières de la classe</div>
                      <div className="row">
                        {(matieresByClass[draft.classe_id] || []).map((m) => {
                          const checked = draft.matieres_ids.includes(m.id);
                          return (
                            <div key={m.id} className="col-6 col-lg-4">
                              <div className="form-check">
                                <input
                                  id={`mat-${m.id}`}
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setDraft((d) => {
                                      const set = new Set(d.matieres_ids);
                                      if (on) set.add(m.id); else set.delete(m.id);
                                      return { ...d, matieres_ids: Array.from(set) };
                                    });
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`mat-${m.id}`}>{m.libelle}</label>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3">
                        <button className="btn btn-outline-primary" onClick={addDraft}>
                          <i className="bi bi-plus-lg me-1" />
                          Ajouter cette affectation à la liste
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Liste des affectations en cours */}
                  <hr className="my-3" />
                  <h6 className="fw-semibold">Affectations en attente d’enregistrement</h6>
                  {draftList.length === 0 ? (
                    <div className="text-muted">Aucune affectation pour l’instant.</div>
                  ) : (
                    <div className="table-responsive mt-2">
                      <table className="table table-sm align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Section</th>
                            <th>Filière</th>
                            <th>Classe</th>
                            <th>Matières</th>
                            <th className="text-end" style={{ width: 80 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftList.map((it) => {
                            const f = filiereById[it.filiere_id];
                            const c = classes.find((x) => x.id === it.classe_id);
                            const mats = (matieresByClass[it.classe_id] || []) as TMatiere[];
                            const labels = it.matieres_ids
                              .map((id) => mats.find((m) => m.id === id)?.libelle)
                              .filter(Boolean)
                              .join(", ");
                            return (
                              <tr key={it.classe_id}>
                                <td>{it.section}</td>
                                <td>{f?.libelle || it.filiere_id}</td>
                                <td>{c?.libelle || it.classe_id}</td>
                                <td>{labels || <span className="text-muted">—</span>}</td>
                                <td className="text-end">
                                  <button className="btn btn-outline-danger btn-sm" onClick={() => removeDraft(it.classe_id)}>
                                    <i className="bi bi-x-lg" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAssign(false)} disabled={assignBusy}>
                    Fermer
                  </button>
                  <button className="btn btn-primary" onClick={saveAssign} disabled={assignBusy}>
                    {assignBusy ? (<><span className="spinner-border spinner-border-sm me-2" />Enregistrement…</>) : "Enregistrer l’affectation"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAssign(false)} />
        </>
      )}

      {/* Toasts */}
      <Toast message={toast} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toast} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}
