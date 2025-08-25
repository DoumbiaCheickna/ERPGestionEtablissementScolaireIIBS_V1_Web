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
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import Toast from "../../admin/components/ui/Toast";

/* =============================== Constantes =============================== */

const ROLE_PROF_KEY = "prof";
const PAGE_SIZE = 10;

type SectionKey = "Gestion" | "Informatique";

/* =============================== Types =============================== */

type TRole = { id: string | number; libelle: string };

type TFiliere = {
  id: string;
  libelle: string;
  section: SectionKey;
  academic_year_id?: string;
};

type TClasse = {
  id: string;
  libelle: string;
  filiere_id: string;
  filiere_libelle?: string;
  academic_year_id?: string;
};

type TMatiere = { id: string; libelle: string; class_id: string };

type TAnnee = { id: string; libelle: string; active?: boolean };

type TProfessor = {
  docId: string;
  id?: number;
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

  // champs “gros formulaire”
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;
  sexe?: string;
  situation_matrimoniale?: string;
  cni_passeport?: string;
  statut?: string;
  fonction_principale?: string;
  disponibilites?: { jour: string; debut: string; fin: string }[];
  elements_constitutifs?: string[];
  experience_enseignement?: { annees: number; etablissements: string[] };
  diplomes?: { intitule: string; niveau: string; annee: string; etablissement: string }[];
  niveaux_enseignement?: string[];
  competences?: { outils: string[]; langues: string[]; publications: string[] };
  rib?: string | null;
  documents?: {
    cv?: string | null;
    diplomes?: string | null;
    piece_identite?: string | null;
    rib?: string | null;
  };
  auth_uid?: string;

  // éventuels liens classe simple
  classe_id?: string | null;
  classe_libelle?: string | null;
};

type TUserRow = {
  docId: string;
  id?: number;
  nom: string;
  prenom: string;
  specialite?: string;
  classe_libelle?: string | null;
};

/* =============================== Utils =============================== */

const clsx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const compareNomPrenom = (a: TUserRow, b: TUserRow) => {
  const na = normalize(a.nom);
  const nb = normalize(b.nom);
  if (na < nb) return -1;
  if (na > nb) return 1;
  const pa = normalize(a.prenom);
  const pb = normalize(b.prenom);
  if (pa < pb) return -1;
  if (pa > pb) return 1;
  return 0;
};

/* =============================== Page =============================== */

export default function ProfessorsPage() {
  /* -------- Meta -------- */
  const [roles, setRoles] = useState<TRole[]>([]);
  const [annees, setAnnees] = useState<TAnnee[]>([]);

  /* -------- Listing Profs -------- */
  const [all, setAll] = useState<TUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // recherche & pagination (client)
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // UI toasts
  const [toastMsg, setToastMsg] = useState("");
  const [okShow, setOkShow] = useState(false);
  const [errShow, setErrShow] = useState(false);
  const ok = (m: string) => {
    setToastMsg(m);
    setOkShow(true);
  };
  const ko = (m: string) => {
    setToastMsg(m);
    setErrShow(true);
  };

  // Détails
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [details, setDetails] = useState<TProfessor | null>(null);

  // CRUD (modales rapides)
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<null | string>(null);
  const [deleteOpen, setDeleteOpen] = useState<null | { id: string; nom: string; prenom: string }>(null);

  // Assignation
  const [showAssign, setShowAssign] = useState(false);
  const [assignForDocId, setAssignForDocId] = useState<string | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignErr, setAssignErr] = useState("");
  const [assignOk, setAssignOk] = useState("");

  // Année sélectionnée par défaut
  const activeAnneeId = useMemo(() => {
    const a = annees.find((x) => x.active);
    return a?.id || annees[0]?.id || "";
  }, [annees]);

  /* -------- Assignation: sélections cascade -------- */
  const [selAnneeId, setSelAnneeId] = useState<string>("");
  const [selSection, setSelSection] = useState<SectionKey | "">("");
  const [selFiliereId, setSelFiliereId] = useState<string>("");
  const [selClasseId, setSelClasseId] = useState<string>("");
  const [selectedMatieres, setSelectedMatieres] = useState<Set<string>>(new Set());

  // Data pour cascade
  const [filieres, setFilieres] = useState<TFiliere[]>([]);
  const [classes, setClasses] = useState<TClasse[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);

  // Brouillon d’affectations (table en bas)
  type TDraft = {
    section: SectionKey;
    filiere_id: string;
    filiere_libelle: string;
    classe_id: string;
    classe_libelle: string;
    matieres_ids: string[];
    matieres_libelles: string[];
  };
  const [draftList, setDraftList] = useState<TDraft[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [initialDraftJson, setInitialDraftJson] = useState<string>("");

  // Orchestrateur de préremplissage pour l’édition d’une ligne
  const [pendingPrefill, setPendingPrefill] = useState<TDraft | null>(null);

  const hasChanges = useMemo(
    () => JSON.stringify(draftList) !== (initialDraftJson || "[]"),
    [draftList, initialDraftJson]
  );

  /* =============================== Fetch META =============================== */

  const fetchRoles = async () => {
    const snap = await getDocs(collection(db, "roles"));
    const rs: TRole[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      rs.push({ id: data.id ?? d.id, libelle: data.libelle });
    });
    setRoles(rs);
  };

  const fetchAnnees = async () => {
    const snap = await getDocs(collection(db, "annees_scolaires"));
    const ys: TAnnee[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      ys.push({ id: d.id, libelle: v.libelle ?? d.id, active: !!v.active });
    });
    ys.sort((a, b) => (a.active === b.active ? a.libelle.localeCompare(b.libelle) : a.active ? -1 : 1));
    setAnnees(ys);
  };

  /* =============================== Fetch LIST =============================== */

  const fetchProfessors = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("role_key", "==", ROLE_PROF_KEY)));
      const rows: TUserRow[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        rows.push({
          docId: d.id,
          id: v.id,
          nom: String(v.nom || ""),
          prenom: String(v.prenom || ""),
          specialite: String(v.specialite || v.specialty || ""),
          classe_libelle: v.classe_libelle ?? null,
        });
      });
      rows.sort(compareNomPrenom);
      setAll(rows);
      setPage(1);
    } catch (e) {
      console.error(e);
      ko("Erreur lors du chargement des professeurs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([fetchRoles(), fetchAnnees()]);
      await fetchProfessors();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =============================== Recherche + Pagination =============================== */

  const filtered = useMemo(() => {
    const k = normalize(q);
    if (!k) return all;
    return all.filter((r) => {
      const nom = normalize(r.nom);
      const prenom = normalize(r.prenom);
      const sp = normalize(r.specialite || "");
      return nom.includes(k) || prenom.includes(k) || sp.includes(k);
    });
  }, [all, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  /* =============================== Détails =============================== */

  const openDetails = async (docId: string) => {
    setShowDetails(true);
    setDetailsLoading(true);
    try {
      const ref = doc(db, "users", docId);
      const d = await getDoc(ref);
      if (!d.exists()) {
        setDetails(null);
      } else {
        const data = d.data() as DocumentData;
        setDetails({
          docId,
          id: data.id,
          nom: data.nom ?? "",
          prenom: data.prenom ?? "",
          email: data.email ?? "",
          login: data.login ?? "",
          specialite: data.specialite ?? data.specialty ?? "",
          role_id: data.role_id !== undefined && data.role_id !== null ? String(data.role_id) : undefined,
          role_libelle: data.role_libelle,
          role_key: data.role_key,
          telephone: data.telephone ?? "",
          adresse: data.adresse ?? "",
          specialite_detaillee: data.specialite_detaillee ?? "",
          date_naissance: data.date_naissance ?? "",
          lieu_naissance: data.lieu_naissance ?? "",
          nationalite: data.nationalite ?? "",
          sexe: data.sexe ?? "",
          situation_matrimoniale: data.situation_matrimoniale ?? "",
          cni_passeport: data.cni_passeport ?? "",
          statut: data.statut ?? "",
          fonction_principale: data.fonction_principale ?? "",
          disponibilites: data.disponibilites ?? [],
          elements_constitutifs: data.elements_constitutifs ?? [],
          experience_enseignement: data.experience_enseignement ?? { annees: 0, etablissements: [] },
          diplomes: data.diplomes ?? [],
          niveaux_enseignement: data.niveaux_enseignement ?? [],
          competences: data.competences ?? { outils: [], langues: [], publications: [] },
          rib: data.rib ?? null,
          documents: data.documents ?? {},
          auth_uid: data.auth_uid,
          classe_id: data.classe_id ?? null,
          classe_libelle: data.classe_libelle ?? null,
        });
      }
    } catch (e) {
      console.error(e);
      setDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  /* =============================== CRUD helpers =============================== */

  const profRoleId = useMemo(() => {
    const prof = roles.find((r) => r.libelle?.toLowerCase().trim() === "professeur");
    return prof ? String(prof.id) : "";
  }, [roles]);

  const removeProfessor = async (id: string) => {
    try {
      await deleteDoc(doc(db, "users", id));
      ok("Professeur supprimé.");
      await fetchProfessors();
    } catch (e) {
      console.error(e);
      ko("Suppression impossible.");
    } finally {
      setDeleteOpen(null);
    }
  };

  /* =============================== Assignation — helpers =============================== */

  const resetCascade = () => {
    setSelSection("");
    setSelFiliereId("");
    setSelClasseId("");
    setSelectedMatieres(new Set());
  };

  const loadFilieresBySection = async (section: SectionKey, yearId?: string) => {
    const snap = await getDocs(
      query(collection(db, "filieres"), where("section", "==", section))
      // where("academic_year_id","==",yearId) si tu veux filtrer par année
    );
    const rows: TFiliere[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      rows.push({
        id: d.id,
        libelle: String(v.libelle || ""),
        section: v.section as SectionKey,
        academic_year_id: String(v.academic_year_id || ""),
      });
    });
    rows.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    setFilieres(rows);
  };

  const loadClassesByFiliere = async (filiereId: string) => {
    if (!filiereId) {
      setClasses([]);
      return;
    }
    const snap = await getDocs(query(collection(db, "classes"), where("filiere_id", "==", filiereId)));
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
    cs.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    setClasses(cs);
  };

  const loadMatieresByClasse = async (classId: string) => {
    if (!classId) {
      setMatieres([]);
      return;
    }
    const snap = await getDocs(query(collection(db, "matieres"), where("class_id", "==", classId)));
    const ms: TMatiere[] = [];
    snap.forEach((d) => {
      const v = d.data() as any;
      ms.push({ id: d.id, libelle: String(v.libelle || ""), class_id: String(v.class_id || "") });
    });
    ms.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr"));
    setMatieres(ms);
  };

  // Cascade : charge filières quand section change
  useEffect(() => {
    if (selSection) {
      loadFilieresBySection(selSection, selAnneeId);
    } else {
      setFilieres([]);
    }
    setSelFiliereId("");
    setSelClasseId("");
    setMatieres([]);
    setSelectedMatieres(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSection]);

  // charge classes quand filiere change
  useEffect(() => {
    if (selFiliereId) {
      loadClassesByFiliere(selFiliereId);
    } else {
      setClasses([]);
    }
    setSelClasseId("");
    setMatieres([]);
    setSelectedMatieres(new Set());
  }, [selFiliereId]);

  // charge matieres quand classe change
  useEffect(() => {
    if (selClasseId) loadMatieresByClasse(selClasseId);
    else setMatieres([]);
    setSelectedMatieres(new Set());
  }, [selClasseId]);

  /* ---------- Préremplissage fiable en édition (orchestrateur) ---------- */
  useEffect(() => {
    if (!pendingPrefill) return;
    // Étape 1 : Section
    if (!selSection || selSection !== pendingPrefill.section) {
      setSelSection(pendingPrefill.section);
      return;
    }
    // Étape 2 : Filière (attend que filières soient chargées)
    if (filieres.length && !selFiliereId) {
      const found = filieres.find((f) => f.id === pendingPrefill.filiere_id);
      if (found) {
        setSelFiliereId(found.id);
        return;
      }
    }
    // Étape 3 : Classe (attend chargement des classes)
    if (selFiliereId === pendingPrefill.filiere_id && classes.length && !selClasseId) {
      const found = classes.find((c) => c.id === pendingPrefill.classe_id);
      if (found) {
        setSelClasseId(found.id);
        return;
      }
    }
    // Étape 4 : Matières
    if (selClasseId === pendingPrefill.classe_id && matieres.length) {
      setSelectedMatieres(new Set(pendingPrefill.matieres_ids || []));
      setPendingPrefill(null); // terminé
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrefill, selSection, filieres, selFiliereId, classes, selClasseId, matieres]);

  /* =============================== Assignation — open/save =============================== */

  const openAssign = async (docId: string) => {
    setAssignForDocId(docId);
    setAssignErr("");
    setAssignOk("");
    setShowAssign(true);

    const year = activeAnneeId;
    setSelAnneeId(year || "");

    try {
      const ref = doc(db, "affectations_professeurs", `${year || activeAnneeId}__${docId}`);
      const d = await getDoc(ref);
      if (d.exists()) {
        const data = d.data() as any;
        const rows: TDraft[] = (data.classes || []).map((c: any) => ({
          section: (c.section as SectionKey) || "Gestion",
          filiere_id: String(c.filiere_id || ""),
          filiere_libelle: String(c.filiere_libelle || ""),
          classe_id: String(c.classe_id || ""),
          classe_libelle: String(c.classe_libelle || ""),
          matieres_ids: Array.isArray(c.matieres_ids) ? c.matieres_ids : [],
          matieres_libelles: Array.isArray(c.matieres_libelles) ? c.matieres_libelles : [],
        }));
        setDraftList(rows);
        setInitialDraftJson(JSON.stringify(rows));
      } else {
        setDraftList([]);
        setInitialDraftJson("[]");
      }
    } catch (e) {
      console.error(e);
      setDraftList([]);
      setInitialDraftJson("[]");
    }

    resetCascade(); // vierge pour ajout
  };

  const addOrUpdateDraft = () => {
    setAssignErr("");
    if (!selSection || !selFiliereId || !selClasseId || selectedMatieres.size === 0) {
      setAssignErr("Veuillez sélectionner la filière, la classe et au moins une matière.");
      return;
    }
    const filiere = filieres.find((f) => f.id === selFiliereId);
    const classe = classes.find((c) => c.id === selClasseId);
    const mats = Array.from(selectedMatieres);
    const matLabels = mats
      .map((id) => matieres.find((m) => m.id === id)?.libelle)
      .filter(Boolean) as string[];

    const item: TDraft = {
      section: selSection as SectionKey,
      filiere_id: selFiliereId,
      filiere_libelle: filiere?.libelle || "",
      classe_id: selClasseId,
      classe_libelle: classe?.libelle || "",
      matieres_ids: mats,
      matieres_libelles: matLabels,
    };

    setDraftList((list) => {
      if (editingIdx !== null) {
        const next = [...list];
        next[editingIdx] = item;
        return next;
      }
      return [...list, item];
    });

    // reset édition
    setEditingIdx(null);
    resetCascade();
  };

  const editDraftAt = (idx: number) => {
    const row = draftList[idx];
    setEditingIdx(idx);
    setPendingPrefill(row); // lance l’orchestration (useEffect ci-dessus)
  };

  const removeDraftAt = (idx: number) => {
    setDraftList((lst) => lst.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const saveAssign = async () => {
    if (!assignForDocId) return;
    setAssignSaving(true);
    setAssignErr("");
    setAssignOk("");

    try {
      const annee_id = selAnneeId || activeAnneeId;
      if (!annee_id) {
        setAssignErr("Veuillez choisir une année scolaire.");
        setAssignSaving(false);
        return;
      }

      const ref = doc(db, "affectations_professeurs", `${annee_id}__${assignForDocId}`);

      if (draftList.length === 0) {
        await deleteDoc(ref);
      } else {
        await setDoc(
          ref,
          {
            annee_id,
            prof_doc_id: assignForDocId,
            sections: Array.from(new Set(draftList.map((d) => d.section))),
            classes: draftList.map((d) => ({
              classe_id: d.classe_id,
              classe_libelle: d.classe_libelle,
              filiere_id: d.filiere_id,
              filiere_libelle: d.filiere_libelle,
              section: d.section,
              matieres_ids: d.matieres_ids,
              matieres_libelles: d.matieres_libelles,
            })),
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: false } // remplace tout => supprime bien d’anciennes lignes
        );
      }

      setAssignOk("Affectations enregistrées.");
      setInitialDraftJson(JSON.stringify(draftList));
      setTimeout(() => {
        setShowAssign(false);
        setAssignForDocId(null);
        setAssignOk("");
      }, 700);
    } catch (e) {
      console.error(e);
      setAssignErr("Enregistrement impossible. Réessayez.");
    } finally {
      setAssignSaving(false);
    }
  };

  /* =============================== Render =============================== */

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div
        className="d-flex justify-content-between align-items-center mb-3 sticky-top bg-white"
        style={{ zIndex: 5 }}
      >
        <div className="py-2">
          <h3 className="mb-1">
            <i className="bi bi-person-badge me-2" />
            Professeurs
          </h3>
          <div className="text-muted">Gestion des comptes et des affectations (année scolaire).</div>
        </div>

        <div className="d-flex gap-2 align-items-center">
          {/* Recherche visible */}
          <div className="input-group">
            <span className="input-group-text bg-white">
              <i className="bi bi-search" />
            </span>
            <input
              className="form-control"
              placeholder="Rechercher (nom, prénom, spécialité)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn btn-outline-secondary" type="button" onClick={() => setPage(1)}>
              <i className="bi bi-funnel me-1" /> Rechercher
            </button>
          </div>

          {/* Ajouter */}
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">
            <i className="bi bi-people me-2" />
            Liste des professeurs
          </h5>
          <span className="badge bg-light text-dark">
            {loading ? "Chargement…" : `${filtered.length} résultat(s)`}
          </span>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">
              <div className="placeholder-glow">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="d-flex align-items-center gap-3 py-2">
                    <span className="placeholder col-2" />
                    <span className="placeholder col-2" />
                    <span className="placeholder col-3" />
                    <span className="placeholder col-2" />
                  </div>
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-emoji-neutral fs-2 d-block mb-2" />
              Aucun professeur ne correspond à la recherche.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Nom</th>
                      <th>Prénom</th>
                      <th>Spécialité</th>
                      <th>Classe</th>
                      <th style={{ width: 360 }} className="text-end">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((u) => (
                      <tr key={u.docId}>
                        <td className="fw-semibold">{u.nom}</td>
                        <td>{u.prenom}</td>
                        <td>{u.specialite || "—"}</td>
                        <td>{u.classe_libelle || "—"}</td>
                        <td className="text-end">
                          <div className="btn-toolbar justify-content-end" role="toolbar">
                            <div className="btn-group me-2" role="group">
                              <button
                                className="btn btn-sm btn-outline-info"
                                title="Voir détails"
                                onClick={() => openDetails(u.docId)}
                              >
                                <i className="bi bi-eye" />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-primary"
                                title="Modifier"
                                onClick={() => setEditOpen(u.docId)}
                              >
                                <i className="bi bi-pencil" />
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                title="Supprimer"
                                onClick={() => setDeleteOpen({ id: u.docId, nom: u.nom, prenom: u.prenom })}
                              >
                                <i className="bi bi-trash" />
                              </button>
                            </div>
                            <div className="btn-group" role="group">
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                title="Assigner classes & matières"
                                onClick={() => openAssign(u.docId)}
                              >
                                <i className="bi bi-diagram-3" /> <span className="ms-1">Assigner</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination (client) */}
              <div className="d-flex justify-content-between align-items-center p-3">
                <div className="text-muted small">
                  Page {page} / {totalPages}
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

      {/* =================== MODALES =================== */}

      {/* Détails complet */}
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
                  <button className="btn-close" onClick={() => setShowDetails(false)} />
                </div>
                <div className="modal-body">
                  {detailsLoading ? (
                    <div className="text-center py-4">
                      <div className="spinner-border" />
                    </div>
                  ) : !details ? (
                    <div className="alert alert-warning">Professeur introuvable.</div>
                  ) : (
                    <>
                      <h6 className="fw-bold">Informations de base</h6>
                      <hr className="mt-1" />
                      <div className="row small">
                        <div className="col-md-3"><strong>Nom</strong><div>{details.nom}</div></div>
                        <div className="col-md-3"><strong>Prénom</strong><div>{details.prenom}</div></div>
                        <div className="col-md-3"><strong>Email</strong><div>{details.email || "—"}</div></div>
                        <div className="col-md-3"><strong>Login</strong><div>{details.login || "—"}</div></div>
                        <div className="col-md-3"><strong>Spécialité</strong><div>{details.specialite || "—"}</div></div>
                        <div className="col-md-3"><strong>Téléphone</strong><div>{details.telephone || "—"}</div></div>
                        <div className="col-md-6"><strong>Adresse</strong><div>{details.adresse || "—"}</div></div>
                        <div className="col-md-3"><strong>Classe (simple)</strong><div>{details.classe_libelle || "—"}</div></div>
                      </div>

                      <h6 className="fw-bold mt-3">Identité</h6>
                      <hr className="mt-1" />
                      <div className="row small">
                        <div className="col-md-3"><strong>Sexe</strong><div>{details.sexe || "—"}</div></div>
                        <div className="col-md-3"><strong>Date de naissance</strong><div>{details.date_naissance || "—"}</div></div>
                        <div className="col-md-3"><strong>Lieu de naissance</strong><div>{details.lieu_naissance || "—"}</div></div>
                        <div className="col-md-3"><strong>Nationalité</strong><div>{details.nationalite || "—"}</div></div>
                        <div className="col-md-3"><strong>Situation matrimoniale</strong><div>{details.situation_matrimoniale || "—"}</div></div>
                        <div className="col-md-3"><strong>CNI / Passeport</strong><div>{details.cni_passeport || "—"}</div></div>
                      </div>

                      <h6 className="fw-bold mt-3">Carrière & Compétences</h6>
                      <hr className="mt-1" />
                      <div className="row small">
                        <div className="col-md-3"><strong>Statut</strong><div>{details.statut || "—"}</div></div>
                        <div className="col-md-3"><strong>Fonction principale</strong><div>{details.fonction_principale || "—"}</div></div>
                        <div className="col-md-3"><strong>Expérience (années)</strong><div>{details.experience_enseignement?.annees ?? "—"}</div></div>
                        <div className="col-md-12"><strong>Établissements</strong><div>{(details.experience_enseignement?.etablissements || []).join(", ") || "—"}</div></div>
                        <div className="col-md-12"><strong>Éléments constitutifs</strong><div>{(details.elements_constitutifs || []).join(", ") || "—"}</div></div>
                        <div className="col-md-12"><strong>Niveaux d’enseignement</strong><div>{(details.niveaux_enseignement || []).join(", ") || "—"}</div></div>
                        <div className="col-md-12"><strong>Compétences — Outils</strong><div>{(details.competences?.outils || []).join(", ") || "—"}</div></div>
                        <div className="col-md-12"><strong>Compétences — Langues</strong><div>{(details.competences?.langues || []).join(", ") || "—"}</div></div>
                        <div className="col-md-12"><strong>Publications</strong><div>{(details.competences?.publications || []).join(", ") || "—"}</div></div>
                      </div>

                      <h6 className="fw-bold mt-3">Disponibilités</h6>
                      <hr className="mt-1" />
                      <div className="small">
                        {(details.disponibilites || []).length === 0 ? (
                          <div className="text-muted">—</div>
                        ) : (
                          <ul className="mb-0">
                            {(details.disponibilites || []).map((d, i) => (
                              <li key={i}>
                                {d.jour}: {d.debut} → {d.fin}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <h6 className="fw-bold mt-3">Diplômes</h6>
                      <hr className="mt-1" />
                      <div className="small">
                        {(details.diplomes || []).length === 0 ? (
                          <div className="text-muted">—</div>
                        ) : (
                          <ul className="mb-0">
                            {(details.diplomes || []).map((d, i) => (
                              <li key={i}>
                                {d.intitule} — {d.niveau} — {d.annee} — {d.etablissement}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <h6 className="fw-bold mt-3">Documents</h6>
                      <hr className="mt-1" />
                      <div className="small">
                        <div>
                          CV :{" "}
                          {details.documents?.cv ? (
                            <a href={details.documents.cv || ""} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          Diplômes :{" "}
                          {details.documents?.diplomes ? (
                            <a href={details.documents.diplomes || ""} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          Pièce d’identité :{" "}
                          {details.documents?.piece_identite ? (
                            <a href={details.documents.piece_identite || ""} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                        <div>
                          RIB :{" "}
                          {details.documents?.rib ? (
                            <a href={details.documents.rib || ""} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          ) : (
                            "—"
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDetails(false)} />
        </>
      )}

      {/* Modale ASSIGNATION */}
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
                  <button className="btn-close" onClick={() => setShowAssign(false)} />
                </div>

                <div className="modal-body">
                  {assignErr && <div className="alert alert-danger">{assignErr}</div>}
                  {assignOk && <div className="alert alert-success">{assignOk}</div>}

                  {/* Année */}
                  <div className="mb-3">
                    <label className="form-label">Année scolaire</label>
                    <select
                      className="form-select"
                      value={selAnneeId || activeAnneeId}
                      onChange={(e) => {
                        setSelAnneeId(e.target.value);
                      }}
                    >
                      {annees.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.libelle} {a.active ? "(en cours)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cascade */}
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label">Section</label>
                      <select
                        className="form-select"
                        value={selSection || ""}
                        onChange={(e) => setSelSection((e.target.value || "") as SectionKey | "")}
                      >
                        <option value="">—</option>
                        <option value="Gestion">Gestion</option>
                        <option value="Informatique">Informatique</option>
                      </select>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Filière</label>
                      <select
                        className="form-select"
                        value={selFiliereId}
                        disabled={!selSection}
                        onChange={(e) => setSelFiliereId(e.target.value)}
                      >
                        <option value="">—</option>
                        {filieres.map((f) => (
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
                        value={selClasseId}
                        disabled={!selFiliereId}
                        onChange={(e) => setSelClasseId(e.target.value)}
                      >
                        <option value="">—</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.libelle}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Matières */}
                    <div className="col-12">
                      <label className="form-label">Matières de la classe</label>
                      {selClasseId ? (
                        matieres.length === 0 ? (
                          <div className="text-muted small">Aucune matière pour cette classe.</div>
                        ) : (
                          <div className="row g-2">
                            {matieres.map((m) => {
                              const checked = selectedMatieres.has(m.id);
                              return (
                                <div key={m.id} className="col-12 col-md-6 col-lg-4">
                                  <div className="form-check">
                                    <input
                                      id={`m-${m.id}`}
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setSelectedMatieres((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(m.id);
                                          else next.delete(m.id);
                                          return next;
                                        });
                                      }}
                                    />
                                    <label className="form-check-label" htmlFor={`m-${m.id}`}>
                                      {m.libelle}
                                    </label>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      ) : (
                        <div className="text-muted small">Choisissez d’abord une filière et une classe.</div>
                      )}
                    </div>

                    <div className="col-12 d-flex gap-2">
                      {editingIdx !== null && (
                        <button
                          className="btn btn-outline-secondary"
                          onClick={() => {
                            setEditingIdx(null);
                            setPendingPrefill(null);
                            resetCascade();
                          }}
                        >
                          Annuler l’édition
                        </button>
                      )}
                      <button className="btn btn-outline-primary" onClick={addOrUpdateDraft}>
                        {editingIdx !== null ? "Mettre à jour la ligne" : "Ajouter à la liste"}
                      </button>
                    </div>
                  </div>

                  {/* Tableau brouillon */}
                  <div className="mt-4">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h6 className="mb-0">
                        Affectations{" "}
                        {hasChanges ? <span className="badge bg-warning text-dark ms-1">non enregistrées</span> : null}
                      </h6>
                      <div className="text-muted small">{draftList.length} ligne(s)</div>
                    </div>
                    <div className="table-responsive">
                      <table className="table align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Section</th>
                            <th>Filière</th>
                            <th>Classe</th>
                            <th>Matières</th>
                            <th style={{ width: 160 }} className="text-end">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftList.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center text-muted py-4">
                                Aucune ligne. Ajoutez une affectation via les champs ci-dessus.
                              </td>
                            </tr>
                          ) : (
                            draftList.map((d, i) => (
                              <tr key={`${d.classe_id}-${i}`}>
                                <td>{d.section}</td>
                                <td>{d.filiere_libelle}</td>
                                <td>{d.classe_libelle}</td>
                                <td className="small">{d.matieres_libelles.join(", ")}</td>
                                <td className="text-end">
                                  <div className="btn-group">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      title="Modifier"
                                      onClick={() => editDraftAt(i)}
                                    >
                                      <i className="bi bi-pencil" />
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      title="Supprimer"
                                      onClick={() => removeDraftAt(i)}
                                    >
                                      <i className="bi bi-x-lg" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAssign(false)} disabled={assignSaving}>
                    Fermer
                  </button>
                  <button className="btn btn-primary" onClick={saveAssign} disabled={assignSaving}>
                    {assignSaving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Enregistrement…
                      </>
                    ) : (
                      "Enregistrer l’affectation"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAssign(false)} />
        </>
      )}

      {/* ===== Modale AJOUT rapide ===== */}
      {createOpen && (
        <QuickCreateProfessorModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await fetchProfessors();
            ok("Professeur ajouté.");
          }}
          profRoleId={profRoleId}
        />
      )}

      {/* ===== Modale EDIT rapide ===== */}
      {editOpen && (
        <QuickEditProfessorModal
          docId={editOpen}
          onClose={() => setEditOpen(null)}
          onSaved={async () => {
            setEditOpen(null);
            await fetchProfessors();
            ok("Professeur modifié.");
          }}
        />
      )}

      {/* ===== Modale SUPPRIMER ===== */}
      {deleteOpen && (
        <ConfirmDeleteModal
          user={deleteOpen}
          onCancel={() => setDeleteOpen(null)}
          onConfirm={() => removeProfessor(deleteOpen.id)}
        />
      )}

      {/* Toasts (globaux) */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}

/* =============================== Modales CRUD rapides =============================== */

function QuickCreateProfessorModal({
  open,
  onClose,
  onCreated,
  profRoleId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  profRoleId: string;
}) {
  const [f, setF] = useState({
    prenom: "",
    nom: "",
    email: "",
    login: "",
    specialite: "",
    telephone: "",
    adresse: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setErr(null);
    if (!f.prenom.trim() || !f.nom.trim() || !f.email.trim()) {
      setErr("Prénom, nom et email sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "users"), {
        prenom: f.prenom.trim(),
        nom: f.nom.trim(),
        email: f.email.trim(),
        login: f.login.trim(),
        specialite: f.specialite.trim(),
        telephone: f.telephone.trim(),
        adresse: f.adresse.trim(),
        role_key: ROLE_PROF_KEY,
        role_libelle: "Professeur",
        role_id: profRoleId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await onCreated();
    } catch (e) {
      console.error(e);
      setErr("Impossible d'ajouter ce professeur.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-plus-circle me-2" />
                Ajouter un professeur
              </h5>
              <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-danger">{err}</div>}

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={f.prenom} onChange={(e) => setField("prenom", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Nom *</label>
                  <input className="form-control" value={f.nom} onChange={(e) => setField("nom", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email *</label>
                  <input className="form-control" value={f.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Login</label>
                  <input className="form-control" value={f.login} onChange={(e) => setField("login", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Spécialité</label>
                  <input
                    className="form-control"
                    value={f.specialite}
                    onChange={(e) => setField("specialite", e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Téléphone</label>
                  <input
                    className="form-control"
                    value={f.telephone}
                    onChange={(e) => setField("telephone", e.target.value)}
                  />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Adresse</label>
                  <input
                    className="form-control"
                    value={f.adresse}
                    onChange={(e) => setField("adresse", e.target.value)}
                  />
                </div>
              </div>
              <div className="form-text mt-2">
                (Formulaire rapide — tu peux remplacer par ton grand <code>ProfesseurForm</code> plus tard)
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}

function QuickEditProfessorModal({
  docId,
  onClose,
  onSaved,
}: {
  docId: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [f, setF] = useState<TProfessor | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "users", docId));
      if (snap.exists()) {
        const v = snap.data() as any;
        setF({
          docId,
          nom: v.nom || "",
          prenom: v.prenom || "",
          email: v.email || "",
          login: v.login || "",
          specialite: v.specialite || v.specialty || "",
          telephone: v.telephone || "",
          adresse: v.adresse || "",
        } as TProfessor);
      }
    })();
  }, [docId]);

  const setField = (k: keyof TProfessor, v: any) => setF((p) => (p ? { ...p, [k]: v } : p));

  const save = async () => {
    if (!f) return;
    setErr(null);
    if (!f.prenom?.trim() || !f.nom?.trim() || !f.email?.trim()) {
      setErr("Prénom, nom et email sont obligatoires.");
      return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "users", f.docId), {
        prenom: f.prenom.trim(),
        nom: f.nom.trim(),
        email: f.email.trim(),
        login: (f.login || "").trim(),
        specialite: (f.specialite || "").trim(),
        telephone: (f.telephone || "").trim(),
        adresse: (f.adresse || "").trim(),
        updatedAt: serverTimestamp(),
      });
      await onSaved();
    } catch (e) {
      console.error(e);
      setErr("Impossible de modifier ce professeur.");
    } finally {
      setBusy(false);
    }
  };

  if (!f) {
    return (
      <>
        <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Modifier le professeur</h5>
                <button className="btn-close" onClick={onClose} />
              </div>
              <div className="modal-body">
                <div className="text-center py-4">
                  <div className="spinner-border" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-backdrop fade show" onClick={onClose} />
      </>
    );
  }

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="bi bi-pencil me-2" />
                Modifier — {f.nom} {f.prenom}
              </h5>
              <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {err && <div className="alert alert-danger">{err}</div>}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Prénom *</label>
                  <input className="form-control" value={f.prenom || ""} onChange={(e) => setField("prenom", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Nom *</label>
                  <input className="form-control" value={f.nom || ""} onChange={(e) => setField("nom", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Email *</label>
                  <input className="form-control" value={f.email || ""} onChange={(e) => setField("email", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Login</label>
                  <input className="form-control" value={f.login || ""} onChange={(e) => setField("login", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Spécialité</label>
                  <input className="form-control" value={f.specialite || ""} onChange={(e) => setField("specialite", e.target.value)} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Téléphone</label>
                  <input className="form-control" value={f.telephone || ""} onChange={(e) => setField("telephone", e.target.value)} />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Adresse</label>
                  <input className="form-control" value={f.adresse || ""} onChange={(e) => setField("adresse", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}

function ConfirmDeleteModal({
  user,
  onCancel,
  onConfirm,
}: {
  user: { id: string; nom: string; prenom: string } | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!user) return null;
  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="bi bi-exclamation-triangle me-2" />
                Supprimer ce professeur ?
              </h5>
              <button className="btn-close btn-close-white" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <p>
                Vous êtes sur le point de <strong>supprimer</strong> le compte de{" "}
                <strong>
                  {user.nom} {user.prenom}
                </strong>
                .
              </p>
              <ul className="small mb-0">
                <li>Le document Firestore sera supprimé.</li>
                <li>La suppression côté Firebase Auth nécessite une route Admin (non incluse ici).</li>
                <li>Action irréversible.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onCancel}>
                Annuler
              </button>
              <button className="btn btn-danger" onClick={onConfirm}>
                <i className="bi bi-trash me-1" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onCancel} />
    </>
  );
}
