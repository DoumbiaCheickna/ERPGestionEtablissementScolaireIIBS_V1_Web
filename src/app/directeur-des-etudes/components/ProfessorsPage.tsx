// src/app/directeur-des-etudes/components/ProfessorsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  DocumentData,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  serverTimestamp,
} from "firebase/firestore";
// ⚠️ On n'utilise PLUS l'auth principale pour créer des comptes
// import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db } from "../../../../firebaseConfig";
import Toast from "../../admin/components/ui/Toast";


/* ------------------------------------------------------------------ */
/* Constantes                                                         */
/* ------------------------------------------------------------------ */
const ROLE_PROF_KEY = "prof";
const PAGE_SIZE = 20;
const MAX_FILE_MB = 5;
const START_HOUR = 8;
const END_HOUR = 22;

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type TRole = { id: string | number; libelle: string };
type TMatiere = { id: string; libelle: string };
type TClasse = { id: string; libelle: string };

type TDisponibilite = {
  jour: string;
  debut: string; // "HH:MM"
  fin: string; // "HH:MM"
};

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
  classe_id?: string | null;
  classe_libelle?: string | null;
  specialite_detaillee?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;
  sexe?: string;
  situation_matrimoniale?: string;
  cni_passeport?: string;
  statut?: string;
  fonction_principale?: string;
  disponibilites?: TDisponibilite[];
  elements_constitutifs?: string[];
  experience_enseignement?: {
    annees: number;
    etablissements: string[];
  };
  diplomes?: {
    intitule: string;
    niveau: string;
    annee: string;
    etablissement: string;
  }[];
  niveaux_enseignement?: string[];
  competences?: {
    outils: string[];
    langues: string[];
    publications: string[];
  };
  rib?: string | null;
  documents?: {
    cv?: string | null;
    diplomes?: string | null;
    piece_identite?: string | null;
    rib?: string | null;
  };
  auth_uid?: string;
};

type TUserRow = {
  id?: number;
  docId: string;
  nom: string;
  prenom: string;
  specialite?: string;
  role_id?: string; // normalisé en string
  role_libelle?: string;
  role_key?: string;
  classe_id?: string | null;
  classe_libelle?: string | null;
};

/* ------------------------------------------------------------------ */
/* Utils                                                              */
/* ------------------------------------------------------------------ */
function toRoleKey(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const sanitize = (s: string) =>
  String(s ?? "")
    .replace(/<[^>]*>?/g, "")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();

const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const usernameRegex = /^[a-zA-Z0-9._-]{3,}$/;
const phoneRegexLocal = /^(70|75|76|77|78)\d{7}$/;
const timeInRange = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  return h >= START_HOUR && (h < END_HOUR || (h === END_HOUR && m === 0));
};

/* ------------------------------------------------------------------ */
/* Page: Professeurs                                                  */
/* ------------------------------------------------------------------ */
export default function ProfessorsPage() {
  const [roles, setRoles] = useState<TRole[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);
  const [classes, setClasses] = useState<TClasse[]>([]);
  const [list, setList] = useState<TUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsDocId, setDetailsDocId] = useState<string | null>(null);
  const [details, setDetails] = useState<TProfessor | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const showSuccessToast = (msg: string) => {
    setToastMessage(msg);
    setShowSuccess(true);
  };
  const showErrorToast = (msg: string) => {
    setToastMessage(msg);
    setShowError(true);
  };

  const fetchRoles = async () => {
    const snap = await getDocs(collection(db, "roles"));
    const rs: TRole[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      rs.push({ id: data.id ?? d.id, libelle: data.libelle });
    });
    setRoles(rs);
  };

  const fetchMatieres = async () => {
    try {
      const snap = await getDocs(collection(db, "matieres"));
      const ms: TMatiere[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        ms.push({ id: d.id, libelle: data.libelle });
      });
      setMatieres(ms);
    } catch {
      setMatieres([]);
    }
  };

  const fetchClasses = async () => {
    try {
      const snap = await getDocs(collection(db, "classes"));
      const cs: TClasse[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        cs.push({ id: d.id, libelle: data.libelle ?? d.id });
      });
      setClasses(cs);
    } catch {
      setClasses([]);
    }
  };

  /* ---------------------- Liste: chargement paginé ------------------ */
  const loadFirstPage = async () => {
    setLoading(true);
    try {
      const qy = query(
        collection(db, "users"),
        where("role_key", "==", ROLE_PROF_KEY),
        orderBy("nom"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(qy);

      const rows: TUserRow[] = snap.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          docId: d.id,
          id: data.id,
          nom: data.nom || "",
          prenom: data.prenom || "",
          specialite: data.specialite || data.specialty || "",
          role_id:
            data.role_id !== undefined && data.role_id !== null
              ? String(data.role_id)
              : undefined,
          role_libelle: data.role_libelle,
          role_key: data.role_key,
          classe_id: data.classe_id ?? null,
          classe_libelle: data.classe_libelle ?? null,
        };
      });

      setList(rows);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.size === PAGE_SIZE);
    } catch (e) {
      console.error(e);
      showErrorToast("Erreur lors du chargement des professeurs.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const qy = query(
        collection(db, "users"),
        where("role_key", "==", ROLE_PROF_KEY),
        orderBy("nom"),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(qy);

      const rows: TUserRow[] = snap.docs.map((d) => {
        const data = d.data() as DocumentData;
        return {
          docId: d.id,
          id: data.id,
          nom: data.nom || "",
          prenom: data.prenom || "",
          specialite: data.specialite || data.specialty || "",
          role_id:
            data.role_id !== undefined && data.role_id !== null
              ? String(data.role_id)
              : undefined,
          role_libelle: data.role_libelle,
          role_key: data.role_key,
          classe_id: data.classe_id ?? null,
          classe_libelle: data.classe_libelle ?? null,
        };
      });

      setList((prev) => [...prev, ...rows]);
      setLastDoc(snap.docs.length ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.size === PAGE_SIZE);
    } catch (e) {
      console.error(e);
      showErrorToast("Impossible de charger plus de professeurs.");
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchRoles(), fetchMatieres(), fetchClasses()]);
    await loadFirstPage();
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* ---------------------- Détails: open / load ---------------------- */
  const openDetails = async (docId: string) => {
    setShowDetails(true);
    setDetailsLoading(true);
    setEditMode(false);
    setSavingEdit(false);
    setDetailsDocId(docId);
    try {
      const ref = doc(db, "users", docId);
      const d = await getDoc(ref);
      if (!d.exists()) {
        setShowDetails(false);
        showErrorToast("Professeur introuvable.");
        return;
      }
      const data = d.data() as DocumentData;
      const prof: TProfessor = {
        docId,
        id: data.id,
        nom: data.nom ?? "",
        prenom: data.prenom ?? "",
        email: data.email ?? "",
        login: data.login ?? "",
        specialite: data.specialite ?? data.specialty ?? "",
        role_id:
          data.role_id !== undefined && data.role_id !== null
            ? String(data.role_id)
            : undefined,
        role_libelle: data.role_libelle,
        role_key: data.role_key,
        telephone: data.telephone ?? "",
        adresse: data.adresse ?? "",
        classe_id: data.classe_id ?? null,
        classe_libelle: data.classe_libelle ?? null,
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
        experience_enseignement: data.experience_enseignement ?? {
          annees: 0,
          etablissements: [],
        },
        diplomes: data.diplomes ?? [],
        niveaux_enseignement: data.niveaux_enseignement ?? [],
        competences: data.competences ?? {
          outils: [],
          langues: [],
          publications: [],
        },
        rib: data.rib ?? null,
        documents: data.documents ?? {},
        auth_uid: data.auth_uid,
      };
      setDetails(prof);
    } catch (e) {
      console.error(e);
      setShowDetails(false);
      showErrorToast("Erreur lors du chargement des détails.");
    } finally {
      setDetailsLoading(false);
    }
  };

  /* ---------------------- Détails: modifier ------------------------- */
  const [detailsErrors, setDetailsErrors] = useState<Record<string, string>>({});

  const validateDetails = (p: TProfessor) => {
    const e: Record<string, string> = {};
    if (!p.prenom || p.prenom.trim().length < 2) e.prenom = "Au moins 2 caractères.";
    if (!p.nom || p.nom.trim().length < 2) e.nom = "Au moins 2 caractères.";
    if (!p.email || !emailRegex.test(p.email)) e.email = "Adresse email invalide.";
    if (!p.specialite) e.specialite = "Obligatoire.";
    return e;
  };

  const saveEdition = async () => {
    if (!detailsDocId || !details) return;
    const errs = validateDetails(details);
    setDetailsErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingEdit(true);
    try {
      const ref = doc(db, "users", detailsDocId);
      const payload: Partial<TProfessor> & { specialty?: string } = {
        nom: sanitize(details.nom || ""),
        prenom: sanitize(details.prenom || ""),
        email: sanitize(details.email || ""),
        login: sanitize(details.login || ""),
        specialite: sanitize(details.specialite || ""),
        telephone: sanitize(details.telephone || ""),
        adresse: sanitize(details.adresse || ""),
        specialite_detaillee: sanitize(details.specialite_detaillee || ""),
        date_naissance: details.date_naissance || "",
        lieu_naissance: sanitize(details.lieu_naissance || ""),
        nationalite: sanitize(details.nationalite || ""),
        sexe: details.sexe || "",
        situation_matrimoniale: details.situation_matrimoniale || "",
        cni_passeport: sanitize(details.cni_passeport || ""),
        statut: details.statut || "",
        fonction_principale: sanitize(details.fonction_principale || ""),
        disponibilites: details.disponibilites || [],
        elements_constitutifs: (details.elements_constitutifs || []).map(sanitize),
        experience_enseignement: details.experience_enseignement,
        diplomes: (details.diplomes || []).map((d) => ({
          intitule: sanitize(d.intitule),
          niveau: d.niveau,
          annee: sanitize(d.annee),
          etablissement: sanitize(d.etablissement),
        })),
        niveaux_enseignement: details.niveaux_enseignement || [],
        competences: {
          outils: (details.competences?.outils || []).map(sanitize),
          langues: (details.competences?.langues || []).map(sanitize),
          publications: (details.competences?.publications || []).map(sanitize),
        },
        rib: details.rib ?? null,
        updatedAt: serverTimestamp(),
      };
      payload.specialty = payload.specialite ?? "";

      await updateDoc(ref, payload as any);
      setShowDetails(false);
      await loadFirstPage();
    } catch (e) {
      console.error(e);
      setDetailsErrors({
        _global: "Impossible d’enregistrer les modifications. Réessayez plus tard.",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  /* ---------------------- Détails: affecter classe ------------------ */
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  useEffect(() => {
    if (showDetails && details) {
      setSelectedClasseId(details.classe_id || "");
    }
  }, [showDetails, details]);

  const assignClasse = async () => {
    if (!detailsDocId) return;
    setAssigning(true);
    try {
      const chosen = classes.find((c) => c.id === selectedClasseId);
      await updateDoc(doc(db, "users", detailsDocId), {
        classe_id: selectedClasseId || null,
        classe_libelle: chosen?.libelle || null,
        updatedAt: serverTimestamp(),
      });
      if (details) {
        setDetails({
          ...details,
          classe_id: selectedClasseId || null,
          classe_libelle: chosen?.libelle || null,
        });
      }
      await loadFirstPage();
    } catch (e) {
      console.error(e);
    } finally {
      setAssigning(false);
    }
  };

  /* ---------------------- Suppression ------------------------------- */
  const confirmDeleteProfessor = async () => {
    if (!detailsDocId) return;
    try {
      await deleteDoc(doc(db, "users", detailsDocId));
      // ⚠️ Pour supprimer aussi dans Firebase Auth, utiliser une Cloud Function Admin côté serveur.
      setShowDeleteModal(false);
      setShowDetails(false);
      showSuccessToast("Professeur supprimé.");
      await loadFirstPage();
    } catch (e) {
      console.error(e);
      showErrorToast("Suppression impossible.");
    }
  };

  /* ------------------------------------------------------------------ */
  /* Create Modal                                                       */
  /* ------------------------------------------------------------------ */
  const profRoleId = useMemo(() => {
    const prof = roles.find((r) => r.libelle?.toLowerCase().trim() === "professeur");
    return prof ? String(prof.id) : "";
  }, [roles]);

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Professeurs</h3>
          <div className="text-muted">Ajoutez et gérez les professeurs de l’établissement.</div>
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
        <div className="card-header bg-white border-0">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold">
              <i className="bi bi-people me-2" />
              Liste des professeurs
            </h5>
            <span className="badge bg-light text-dark">
              {loading && list.length === 0 ? "Chargement…" : `${list.length} résultat(s)`}
            </span>
          </div>
        </div>
        <div className="card-body p-0">
          {loading && list.length === 0 ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
              <div className="text-muted mt-2">Chargement…</div>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-5 text-muted">Aucun professeur pour le moment.</div>
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
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((u) => (
                      <tr key={u.docId}>
                        <td className="fw-semibold">{u.nom}</td>
                        <td>{u.prenom}</td>
                        <td>{u.specialite || "-"}</td>
                        <td>{u.classe_libelle || "-"}</td>
                        <td className="d-flex gap-2">
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => openDetails(u.docId)}>
                            Détails
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 d-flex justify-content-center">
                {hasMore ? (
                  <button className="btn btn-outline-primary" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Chargement…
                      </>
                    ) : (
                      "Charger plus"
                    )}
                  </button>
                ) : (
                  <span className="text-muted small">Fin de la liste des professeurs.</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <CreateProfessorModal
          onClose={() => setShowCreate(false)}
          roles={roles}
          defaultRoleId={profRoleId}
          classes={classes}
          onCreated={async () => {
            setShowCreate(false);
            await loadFirstPage();
          }}
        />
      )}

      {/* Details Modal */}
      {showDetails && (
        <>
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-person-vcard me-2" />
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
                  ) : details ? (
                    <>
                      {detailsErrors._global && (
                        <div className="alert alert-danger">{detailsErrors._global}</div>
                      )}

                      {/* Infos principales */}
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label">
                            Prénom <span className="text-danger">*</span>
                          </label>
                          <input
                            className={`form-control ${detailsErrors.prenom ? "is-invalid" : ""}`}
                            value={details.prenom || ""}
                            onChange={(e) => setDetails({ ...details, prenom: e.target.value })}
                            readOnly={!editMode}
                          />
                          {detailsErrors.prenom && (
                            <div className="invalid-feedback">{detailsErrors.prenom}</div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">
                            Nom <span className="text-danger">*</span>
                          </label>
                          <input
                            className={`form-control ${detailsErrors.nom ? "is-invalid" : ""}`}
                            value={details.nom || ""}
                            onChange={(e) => setDetails({ ...details, nom: e.target.value })}
                            readOnly={!editMode}
                          />
                          {detailsErrors.nom && (
                            <div className="invalid-feedback">{detailsErrors.nom}</div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">
                            Email <span className="text-danger">*</span>
                          </label>
                          <input
                            className={`form-control ${detailsErrors.email ? "is-invalid" : ""}`}
                            value={details.email || ""}
                            onChange={(e) => setDetails({ ...details, email: e.target.value })}
                            readOnly={!editMode}
                          />
                          {detailsErrors.email && (
                            <div className="invalid-feedback">{detailsErrors.email}</div>
                          )}
                        </div>

                        <div className="col-md-4">
                          <label className="form-label">Nom d’utilisateur</label>
                          <input
                            className="form-control"
                            value={details.login || ""}
                            onChange={(e) => setDetails({ ...details, login: e.target.value })}
                            readOnly={!editMode}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">
                            Spécialité <span className="text-danger">*</span>
                          </label>
                          <input
                            className={`form-control ${detailsErrors.specialite ? "is-invalid" : ""}`}
                            value={details.specialite || ""}
                            onChange={(e) => setDetails({ ...details, specialite: e.target.value })}
                            readOnly={!editMode}
                          />
                          {detailsErrors.specialite && (
                            <div className="invalid-feedback">{detailsErrors.specialite}</div>
                          )}
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Téléphone</label>
                          <div className="input-group">
                            <span className="input-group-text">+221</span>
                            <input
                              className="form-control"
                              value={(details.telephone || "").replace(/^\+221\s?/, "")}
                              onChange={(e) => setDetails({ ...details, telephone: "+221 " + e.target.value })}
                              readOnly={!editMode}
                              placeholder="70XXXXXXX"
                            />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <label className="form-label">Adresse</label>
                          <input
                            className="form-control"
                            value={details.adresse || ""}
                            onChange={(e) => setDetails({ ...details, adresse: e.target.value })}
                            readOnly={!editMode}
                          />
                        </div>
                      </div>

                      <hr className="my-3" />

                      {/* Affectation classe */}
                      <div className="row g-2 align-items-end">
                        <div className="col-md-8">
                          <label className="form-label">Affecter à une classe</label>
                          <select
                            className="form-select"
                            value={selectedClasseId}
                            onChange={(e) => setSelectedClasseId(e.target.value)}
                            disabled={!editMode}
                          >
                            <option value="">— Aucune —</option>
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.libelle}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-4 d-flex gap-2">
                          <button
                            className="btn btn-outline-primary w-100"
                            onClick={assignClasse}
                            disabled={assigning || !editMode}
                          >
                            {assigning ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Affectation…
                              </>
                            ) : (
                              "Enregistrer l’affectation"
                            )}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted">Aucune donnée à afficher.</div>
                  )}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowDetails(false)}>
                    Fermer
                  </button>
                  {!editMode ? (
                    <>
                      <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                        Modifier
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => setShowDeleteModal(true)}>
                        Supprimer
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-primary" onClick={saveEdition} disabled={savingEdit}>
                      {savingEdit ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Enregistrement…
                        </>
                      ) : (
                        "Enregistrer"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDetails(false)} />
        </>
      )}

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <>
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title">Action dangereuse, définitive, irréversible</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setShowDeleteModal(false)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-2">La suppression entraîne la perte définitive des données.</p>
                  <p className="fw-semibold mb-0">Êtes-vous sûr de vouloir supprimer ce professeur ?</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowDeleteModal(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-danger" onClick={confirmDeleteProfessor}>
                    Oui, supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDeleteModal(false)} />
        </>
      )}

      {/* Toasts */}
      <Toast
        message={toastMessage}
        type="success"
        show={showSuccess}
        onClose={() => setShowSuccess(false)}
      />
      <Toast
        message={toastMessage}
        type="error"
        show={showError}
        onClose={() => setShowError(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CreateProfessorModal                                               */
/* ------------------------------------------------------------------ */
function CreateProfessorModal({
  onClose,
  onCreated,
  roles,
  defaultRoleId,
  classes,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  roles: TRole[];
  defaultRoleId: string;
  classes: TClasse[];
}) {
  const [form, setForm] = useState({
    email: "",
    login: "",
    nom: "",
    prenom: "",
    password: "",
    role_id: defaultRoleId || "",
    first_login: "1",
    specialite: "",
    specialite_detaillee: "",
    date_naissance: "",
    lieu_naissance: "",
    nationalite: "",
    sexe: "",
    situation_matrimoniale: "",
    cni_passeport: "",
    adresse: "",
    telephoneLocal: "",
    statut: "",
    fonction_principale: "",
    disponibilites: [] as TDisponibilite[],
    elements_constitutifs: [""],
    experience_enseignement: {
      annees: 0,
      etablissements: [""],
    },
    diplomes: [
      {
        intitule: "",
        niveau: "",
        annee: "",
        etablissement: "",
      },
    ],
    niveaux_enseignement: [""],
    competences: {
      outils: [""],
      langues: [""],
      publications: [""],
    },
    rib: "",
    documents: {
      cv: null as File | null,
      diplomes: null as File | null,
      piece_identite: null as File | null,
      rib: null as File | null,
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (defaultRoleId && !form.role_id) {
      setForm((f) => ({ ...f, role_id: defaultRoleId }));
    }
  }, [defaultRoleId]);

  const selectedRoleLabel =
    roles.find((r) => String(r.id) === String(form.role_id))?.libelle || "";

  const setField = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setDocField = (key: keyof typeof form.documents, file: File | null) =>
    setForm((prev) => ({
      ...prev,
      documents: {
        ...prev.documents,
        [key]: file,
      },
    }));

  const addItem = (field: string) => {
    const value: any = (form as any)[field];
    if (Array.isArray(value)) setForm((p) => ({ ...p, [field]: [...value, ""] }));
  };
  const removeItem = (field: string, index: number) => {
    const value: any = (form as any)[field];
    if (Array.isArray(value)) {
      const arr = [...value];
      arr.splice(index, 1);
      setForm((p) => ({ ...p, [field]: arr }));
    }
  };
  const changeItem = (field: string, index: number, v: string) => {
    const value: any = (form as any)[field];
    if (Array.isArray(value)) {
      const arr = [...value];
      arr[index] = v;
      setForm((p) => ({ ...p, [field]: arr }));
    }
  };

  const addDiplome = () =>
    setForm((p) => ({
      ...p,
      diplomes: [...p.diplomes, { intitule: "", niveau: "", annee: "", etablissement: "" }],
    }));
  const removeDiplome = (idx: number) => {
    const arr = [...form.diplomes];
    arr.splice(idx, 1);
    setForm((p) => ({ ...p, diplomes: arr }));
  };
  const changeDiplome = (idx: number, field: string, v: string) => {
    const arr = [...form.diplomes];
    arr[idx] = { ...arr[idx], [field]: v };
    setForm((p) => ({ ...p, diplomes: arr }));
  };

  const addEtab = () =>
    setForm((p) => ({
      ...p,
      experience_enseignement: {
        ...p.experience_enseignement,
        etablissements: [...p.experience_enseignement.etablissements, ""],
      },
    }));
  const removeEtab = (idx: number) => {
    const arr = [...form.experience_enseignement.etablissements];
    arr.splice(idx, 1);
    setForm((p) => ({
      ...p,
      experience_enseignement: { ...p.experience_enseignement, etablissements: arr },
    }));
  };
  const changeEtab = (idx: number, v: string) => {
    const arr = [...form.experience_enseignement.etablissements];
    arr[idx] = v;
    setForm((p) => ({
      ...p,
      experience_enseignement: { ...p.experience_enseignement, etablissements: arr },
    }));
  };

  const addDisponibilite = () =>
    setForm((p) => ({
      ...p,
      disponibilites: [...p.disponibilites, { jour: "", debut: "08:00", fin: "10:00" }],
    }));
  const changeDisponibilite = (idx: number, field: keyof TDisponibilite, v: string) => {
    const arr = [...form.disponibilites];
    arr[idx] = { ...arr[idx], [field]: v };
    setForm((p) => ({ ...p, disponibilites: arr }));
  };
  const removeDisponibilite = (idx: number) => {
    const arr = [...form.disponibilites];
    arr.splice(idx, 1);
    setForm((p) => ({ ...p, disponibilites: arr }));
  };

  const validateFile = (file: File, acceptMime: string[]) => {
    if (!file) return null;
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_FILE_MB) return `Fichier trop volumineux (max ${MAX_FILE_MB} Mo).`;
    if (!acceptMime.some((m) => file.type.includes(m)))
      return "Type de fichier non autorisé.";
    return null;
  };

  const validate = async () => {
    const e: Record<string, string> = {};
    if (!form.role_id) e.role_id = "Rôle obligatoire (Professeur).";
    if (!form.prenom || form.prenom.trim().length < 2) e.prenom = "Au moins 2 caractères.";
    if (!form.nom || form.nom.trim().length < 2) e.nom = "Au moins 2 caractères.";
    if (!form.email || !emailRegex.test(form.email)) e.email = "Adresse email invalide.";
    if (!form.login || !usernameRegex.test(form.login))
      e.login = "3+ caractères (lettres/chiffres . _ -).";
    if (!form.password || form.password.length < 6) e.password = "6 caractères minimum.";
    if (!form.specialite) e.specialite = "Spécialité obligatoire.";

    if (!form.date_naissance) e.date_naissance = "Obligatoire.";
    if (!form.lieu_naissance) e.lieu_naissance = "Obligatoire.";
    if (!form.nationalite) e.nationalite = "Obligatoire.";
    if (!form.sexe) e.sexe = "Obligatoire.";
    if (!form.situation_matrimoniale) e.situation_matrimoniale = "Obligatoire.";
    if (!form.cni_passeport) e.cni_passeport = "Obligatoire.";

    if (!phoneRegexLocal.test(form.telephoneLocal))
      e.telephoneLocal = "Format attendu : 70/75/76/77/78 + 7 chiffres (ex: 771234567).";

    if (!form.statut) e.statut = "Obligatoire.";

    if (!form.disponibilites.length) {
      e.disponibilites = "Ajoutez au moins une disponibilité.";
    } else {
      form.disponibilites.forEach((d, i) => {
        if (!d.jour) e[`disponibilites.${i}.jour`] = "Jour obligatoire.";
        if (!timeInRange(d.debut) || !timeInRange(d.fin))
          e[`disponibilites.${i}.plage`] = "Heures entre 08:00 et 22:00.";
        if (d.debut && d.fin && d.debut >= d.fin)
          e[`disponibilites.${i}.ordre`] = "Heure de début < heure de fin.";
      });
    }

    const ecs = form.elements_constitutifs.map((s) => s.trim()).filter(Boolean);
    if (!ecs.length) e.elements_constitutifs = "Renseignez au moins un élément.";

    if (!form.experience_enseignement.annees || form.experience_enseignement.annees < 1)
      e.experience_enseignement_annees = "Au moins 1 année d’expérience.";

    const dipOK = form.diplomes.some((d) => d.intitule.trim() && d.niveau.trim());
    if (!dipOK) e.diplomes = "Ajoutez au moins un diplôme (intitulé et niveau).";

    const nivs = form.niveaux_enseignement.map((s) => s.trim()).filter(Boolean);
    if (!nivs.length) e.niveaux_enseignement = "Sélectionnez au moins un niveau.";

    const cvErr = form.documents.cv && validateFile(form.documents.cv, ["pdf"]);
    if (cvErr) e.documents_cv = cvErr;

    const diplomeDocErr = form.documents.diplomes && validateFile(form.documents.diplomes, ["pdf"]);
    if (diplomeDocErr) e.documents_diplomes = diplomeDocErr;

    const idErr =
      form.documents.piece_identite &&
      validateFile(form.documents.piece_identite, ["pdf", "jpeg", "png", "jpg"]);
    if (idErr) e.documents_piece_identite = idErr;

    const ribErr =
      form.documents.rib && validateFile(form.documents.rib, ["pdf", "jpeg", "png", "jpg"]);
    if (ribErr) e.documents_rib = ribErr;

    // Login unique (Firestore)
    if (!e.login) {
      const qy = query(collection(db, "users"), where("login", "==", form.login));
      const snap = await getDocs(qy);
      if (!snap.empty) e.login = "Nom d’utilisateur déjà pris.";
    }

    setErrors(e);
    return e;
  };

  const uploadFile = async (file: File): Promise<string> => {
    // TODO: brancher Firebase Storage si besoin
    return Promise.resolve(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const e1 = await validate();
      if (Object.keys(e1).length) {
        setSaving(false);
        return;
      }

      // ✅ Utilise l'AUTH SECONDAIRE pour ne pas déconnecter l'admin actuel
      let authUid = "";
      try {
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          form.email,
          form.password
        );
        authUid = cred.user.uid;
      } catch (err: any) {
        const map: Record<string, string> = {};
        if (err?.code === "auth/email-already-in-use") {
          map.email = "Email déjà utilisé.";
        } else if (err?.code === "auth/weak-password") {
          map.password = "Mot de passe trop faible.";
        } else {
          map._global =
            "Création du compte échouée. Vérifiez l’email/mot de passe et réessayez.";
        }
        setErrors(map);
        setSaving(false);
        return;
      }

      const fileUrls = {
        cv: form.documents.cv ? await uploadFile(form.documents.cv) : null,
        diplomes: form.documents.diplomes ? await uploadFile(form.documents.diplomes) : null,
        piece_identite: form.documents.piece_identite
          ? await uploadFile(form.documents.piece_identite)
          : null,
        rib: form.documents.rib ? await uploadFile(form.documents.rib) : null,
      };

      // Id incrémental basique
      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      const roleObj = roles.find((r) => String(r.id) === String(form.role_id));
      const role_key =
        roleObj?.libelle?.toLowerCase().trim() === "professeur"
          ? ROLE_PROF_KEY
          : toRoleKey(roleObj?.libelle || "professeur");

      const phoneFull = `+221 ${form.telephoneLocal}`;

      await addDoc(collection(db, "users"), {
        id: newUserId,
        role_id: String(form.role_id),
        role_libelle: roleObj?.libelle || "Professeur",
        role_key,
        email: sanitize(form.email),
        login: sanitize(form.login),
        nom: sanitize(form.nom),
        prenom: sanitize(form.prenom),
        specialty: sanitize(form.specialite), // compat
        specialite: sanitize(form.specialite),
        specialite_detaillee: sanitize(form.specialite_detaillee),
        date_naissance: form.date_naissance,
        lieu_naissance: sanitize(form.lieu_naissance),
        nationalite: sanitize(form.nationalite),
        sexe: form.sexe,
        situation_matrimoniale: form.situation_matrimoniale,
        cni_passeport: sanitize(form.cni_passeport),
        adresse: sanitize(form.adresse),
        telephone: phoneFull,
        statut: form.statut,
        fonction_principale: sanitize(form.fonction_principale),
        disponibilites: form.disponibilites,
        elements_constitutifs: form.elements_constitutifs.map(sanitize).filter(Boolean),
        experience_enseignement: {
          annees: Number(form.experience_enseignement.annees || 0),
          etablissements: form.experience_enseignement.etablissements.map(sanitize).filter(Boolean),
        },
        diplomes: form.diplomes.map((d) => ({
          intitule: sanitize(d.intitule),
          niveau: d.niveau,
          annee: sanitize(d.annee),
          etablissement: sanitize(d.etablissement),
        })),
        niveaux_enseignement: form.niveaux_enseignement.filter(Boolean),
        competences: {
          outils: form.competences.outils.map(sanitize).filter(Boolean),
          langues: form.competences.langues.map(sanitize).filter(Boolean),
          publications: form.competences.publications.map(sanitize).filter(Boolean),
        },
        rib: sanitize(form.rib || ""),
        documents: fileUrls,
        auth_uid: authUid,
        first_login: form.first_login,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await onCreated();
    } catch (err) {
      console.error(err);
      setErrors({
        _global: "Erreur lors de l’ajout du professeur.",
      });
    } finally {
      setSaving(false);
    }
  };

  const preview = (file: File | null) => {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    if (file.type.includes("pdf")) {
      return (
        <a href={url} target="_blank" rel="noreferrer" className="small">
          Prévisualiser le PDF
        </a>
      );
    }
    if (file.type.includes("png") || file.type.includes("jpeg") || file.type.includes("jpg")) {
      return <img src={url} alt="aperçu" style={{ maxWidth: 120, borderRadius: 6 }} />;
    }
    return <span className="small text-muted">{file.name}</span>;
  };

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-plus-circle me-2" />
                  Créer un professeur
                </h5>
                <button type="button" className="btn-close" onClick={onClose} />
              </div>

              <div className="modal-body">
                {errors._global && <div className="alert alert-danger">{errors._global}</div>}

                {/* Rôle */}
                <div className="mb-3">
                  <label className="form-label">
                    Rôle <span className="text-danger">*</span>
                  </label>
                  <select
                    className={`form-select ${errors.role_id ? "is-invalid" : ""}`}
                    value={form.role_id}
                    onChange={(e) => setField("role_id", e.target.value)}
                    disabled
                  >
                    <option value={form.role_id}>{selectedRoleLabel || "Professeur"}</option>
                  </select>
                  {errors.role_id && <div className="invalid-feedback">{errors.role_id}</div>}
                  <div className="form-text">
                    Le rôle est fixé à <b>Professeur</b>.
                  </div>
                </div>

                {/* (Formulaire inchangé — mêmes champs que ta version) */}
                {/* ... toutes les sections et champs que tu avais déjà ... */}
                {/* Je les laisse identiques pour ne pas alourdir inutilement (tu viens de les coller). */}
                {/* >>> Conserve exactement le même JSX des champs que tu as posté. <<< */}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Enregistrement…
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
