"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  orderBy as fbOrderBy,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import SecondaryMenu from "./SecondaryMenu";
import Toast from "../../admin/components/ui/Toast";
import { useAcademicYear } from "../context/AcademicYearContext";

/* ================= Types & helpers ================= */

type SectionKey = "Gestion" | "Informatique";

// Niveaux: on lit la collection "niveaux" (id, libelle, order)
type TNiveauDoc = { id: string; libelle: string; order: number };

type TFiliere = { id: string; libelle: string; section: SectionKey; academic_year_id: string };
type TClasse = {
  id: string;
  filiere_id: string;
  filiere_libelle: string;
  niveau_id: string;
  niveau_libelle: string;
  libelle: string;
  academic_year_id: string;
};
type TUE = { id: string; class_id: string; libelle: string; code?: string | null; academic_year_id: string };
type TMatiere = {
  id: string;
  class_id: string;
  libelle: string;
  ue_id?: string | null;
  academic_year_id: string;
};

type View =
  | { type: "filieres" }
  | { type: "classes"; filiere: TFiliere }
  | { type: "classe"; filiere: TFiliere; classe: TClasse; tab?: "matieres" | "edt" | "bulletin" };

const sanitize = (v: string) =>
  v.replace(/<\s*script/gi, "").replace(/[<>]/g, "").trim().slice(0, 5000);
const ci = (s: string) => sanitize(s).toLowerCase();

const DEFAULT_NIVEAUX: TNiveauDoc[] = [
  { id: "L1", libelle: "Licence 1", order: 1 },
  { id: "L2", libelle: "Licence 2", order: 2 },
  { id: "L3", libelle: "Licence 3", order: 3 },
  { id: "M1", libelle: "Master 1", order: 4 },
  { id: "M2", libelle: "Master 2", order: 5 },
];

/* =============== Modal de confirmation "danger" réutilisable =============== */
function ConfirmDeleteModal({
  show,
  title = "Confirmation de suppression",
  message,
  onCancel,
  onConfirm,
  busy = false,
  error,
  confirmLabel = "Supprimer définitivement",
}: {
  show: boolean;
  title?: string;
  message: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
  confirmLabel?: string;
}) {
  if (!show) return null;
  return (
    <>
      <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content border-danger">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title">
                <i className="bi bi-exclamation-triangle me-2" />
                {title}
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={onCancel} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="alert alert-danger">
                <strong>Attention :</strong> cette action est <u>irréversible</u>. Toutes les données liées seront
                définitivement supprimées.
              </div>
              <div className="mb-2">{message}</div>
              {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
                Annuler
              </button>
              <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Suppression…
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onCancel} />
    </>
  );
}

/* ================= Entrée principale ================= */

export default function FilieresPage() {
  const { selected } = useAcademicYear();
  const [view, setView] = useState<View>({ type: "filieres" });

  // nav vertical section
  const [section, setSection] = useState<SectionKey>("Gestion");
  const handleSelectSection = (s: SectionKey) => {
    setSection(s);
    // Quel que soit l'endroit où on est, on revient sur la liste des filières
    setView({ type: "filieres" });
  };

  // toasts (succès/erreur globales)
  const [toastMsg, setToastMsg] = useState("");
  const [sok, setSOk] = useState(false);
  const [serr, setSErr] = useState(false);
  const ok = (m: string) => {
    setToastMsg(m);
    setSOk(true);
  };
  const ko = (m: string) => {
    setToastMsg(m);
    setSErr(true);
  };

  return (
    <div className="container-fluid py-3">
      <div className="row">
        {/* NAV vertical sections */}
        <aside className="col-12 col-md-3 col-lg-2 mb-3 mb-md-0">
          <div className="list-group">
            {(["Gestion", "Informatique"] as SectionKey[]).map((s) => (
              <button
                key={s}
                className={`list-group-item list-group-item-action ${section === s ? "active" : ""}`}
                onClick={() => handleSelectSection(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-2 small text-muted">
            Année : <strong>{selected?.label || "—"}</strong>
          </div>
        </aside>

        {/* CONTENU */}
        <div className="col-12 col-md-9 col-lg-10">
          {view.type === "filieres" && (
            <FilieresList
              section={section}
              academicYearId={selected?.id || ""}
              onOpenFiliere={(f) => setView({ type: "classes", filiere: f })}
              ok={ok}
              ko={ko}
            />
          )}

          {view.type === "classes" && (
            <FiliereClasses
              filiere={view.filiere}
              onBack={() => setView({ type: "filieres" })}
              onOpenClasse={(classe) =>
                setView({ type: "classe", filiere: view.filiere, classe, tab: "matieres" })
              }
              ok={ok}
              ko={ko}
            />
          )}

          {view.type === "classe" && (
            <ClasseDetail
              filiere={view.filiere}
              classe={view.classe}
              tab={view.tab ?? "matieres"}
              onChangeTab={(t) =>
                setView({ type: "classe", filiere: view.filiere, classe: view.classe, tab: t })
              }
              onBackToClasses={() => setView({ type: "classes", filiere: view.filiere })}
              ok={ok}
              ko={ko}
            />
          )}
        </div>
      </div>

      {/* Toasts global */}
      <Toast message={toastMsg} type="success" show={sok} onClose={() => setSOk(false)} />
      <Toast message={toastMsg} type="error" show={serr} onClose={() => setSErr(false)} />
    </div>
  );
}

/* ================================================================
   1) LISTE DES FILIERES — filtrée par section + année — anti-doublon
================================================================ */
function FilieresList({
  section,
  academicYearId,
  onOpenFiliere,
  ok,
  ko,
}: {
  section: SectionKey;
  academicYearId: string;
  onOpenFiliere: (f: TFiliere) => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [items, setItems] = useState<TFiliere[]>([]);
  const [loading, setLoading] = useState(true);

  // ajout / édition
  const [showAdd, setShowAdd] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const [edit, setEdit] = useState<TFiliere | null>(null);
  const [editLibelle, setEditLibelle] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // suppression (double confirmation)
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchFilieres = async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "filieres"),
          where("section", "==", section),
          where("academic_year_id", "==", academicYearId)
        )
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
      rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
      setItems(rows);
    } catch (e) {
      console.error(e);
      ko("Erreur de chargement des filières.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilieres();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, academicYearId]);

  const addFiliere = async () => {
    setAddError(null);
    const label = sanitize(libelle);
    if (!label) return setAddError("Libellé requis.");
    try {
      // anti-dup: même libellé (CI), même section, même année
      const snap = await getDocs(
        query(
          collection(db, "filieres"),
          where("section", "==", section),
          where("academic_year_id", "==", academicYearId)
        )
      );
      const exists = snap.docs.some((d) => ci((d.data() as any).libelle) === ci(label));
      if (exists) return setAddError("Cette filière existe déjà pour cette année.");

      await addDoc(collection(db, "filieres"), {
        libelle: label,
        section,
        academic_year_id: academicYearId,
        created_at: Date.now(),
      });
      ok("Filière ajoutée.");
      setLibelle("");
      setShowAdd(false);
      fetchFilieres();
    } catch (e) {
      console.error(e);
      setAddError("Ajout impossible.");
    }
  };

  const openEdit = (f: TFiliere) => {
    setEditError(null);
    setEdit(f);
    setEditLibelle(f.libelle);
  };

  const saveEdit = async () => {
    if (!edit) return;
    setEditError(null);
    const label = sanitize(editLibelle);
    if (!label) return setEditError("Libellé requis.");
    try {
      const snap = await getDocs(
        query(
          collection(db, "filieres"),
          where("section", "==", section),
          where("academic_year_id", "==", academicYearId)
        )
      );
      const exists = snap.docs.some((d) => d.id !== edit.id && ci((d.data() as any).libelle) === ci(label));
      if (exists) return setEditError("Cette filière existe déjà pour cette année.");

      await updateDoc(doc(db, "filieres", edit.id), { libelle: label });
      ok("Filière mise à jour.");
      setEdit(null);
      fetchFilieres();
    } catch (e) {
      console.error(e);
      setEditError("Mise à jour impossible.");
    }
  };

  const askRemoveFiliere = (id: string) => {
    setDeleteError(null);
    setDeleteId(id);
  };
  const cancelRemoveFiliere = () => {
    setDeleteBusy(false);
    setDeleteError(null);
    setDeleteId(null);
  };
  const confirmRemoveFiliere = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, "filieres", deleteId));
      ok("Filière supprimée.");
      cancelRemoveFiliere();
      fetchFilieres();
    } catch (e) {
      console.error(e);
      setDeleteError("Suppression impossible.");
      setDeleteBusy(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="mb-1">Filières — {section}</h3>
            <div className="text-muted">Année : {academicYearId || "—"}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <i className="bi bi-plus-lg me-2" />
            Ajouter filière
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status" />
            <div className="text-muted mt-2">Chargement…</div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-muted text-center py-4">Aucune filière.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead className="table-light">
                <tr>
                  <th>Libellé</th>
                  <th>Section</th>
                  <th>Année</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="fw-semibold">{f.libelle}</td>
                    <td>{f.section}</td>
                    <td>{f.academic_year_id}</td>
                    <td className="d-flex gap-2">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => onOpenFiliere(f)}>
                        Ouvrir
                      </button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => openEdit(f)}>
                        Modifier
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => askRemoveFiliere(f.id)}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ajout filière */}
      {showAdd && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Ajouter filière ({section})</h5>
                  <button className="btn-close" onClick={() => setShowAdd(false)} />
                </div>
                <div className="modal-body">
                  {addError ? <div className="alert alert-danger">{addError}</div> : null}
                  <label className="form-label">Libellé</label>
                  <input
                    className="form-control"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    placeholder="Ex: Informatique"
                  />
                  <small className="text-muted">Année imposée : {academicYearId || "—"}</small>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={addFiliere}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAdd(false)} />
        </>
      )}

      {/* Modal édition filière */}
      {edit && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Modifier filière</h5>
                  <button className="btn-close" onClick={() => setEdit(null)} />
                </div>
                <div className="modal-body">
                  {editError ? <div className="alert alert-danger">{editError}</div> : null}
                  <label className="form-label">Libellé</label>
                  <input
                    className="form-control"
                    value={editLibelle}
                    onChange={(e) => setEditLibelle(e.target.value)}
                  />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={saveEdit}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setEdit(null)} />
        </>
      )}

      {/* Double confirmation suppression */}
      <ConfirmDeleteModal
        show={!!deleteId}
        title="Supprimer cette filière ?"
        message={
          <div>
            La filière sélectionnée sera supprimée. Pensez que ses classes, matières, UE, EDT associés
            pourraient devenir incohérents si vous ne les nettoyez pas aussi.
          </div>
        }
        onCancel={cancelRemoveFiliere}
        onConfirm={confirmRemoveFiliere}
        busy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

/* ================================================================
   2) CLASSES D’UNE FILIERE — hérite année — anti-doublon (niveau_id)
   + NIVEAUX depuis la collection `niveaux`
================================================================ */
function FiliereClasses({
  filiere,
  onBack,
  onOpenClasse,
  ok,
  ko,
}: {
  filiere: TFiliere;
  onBack: () => void;
  onOpenClasse: (c: TClasse) => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [list, setList] = useState<TClasse[]>([]);
  const [loading, setLoading] = useState(true);

  // niveaux (collection)
  const [niveaux, setNiveaux] = useState<TNiveauDoc[]>([]);
  const [nivLoading, setNivLoading] = useState(true);
  const [nivError, setNivError] = useState<string | null>(null);

  // ajout classe
  const [showAdd, setShowAdd] = useState(false);
  const [niveauId, setNiveauId] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);

  // suppression
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchNiveaux = async () => {
    setNivLoading(true);
    setNivError(null);
    try {
      const snap = await getDocs(query(collection(db, "niveaux"), fbOrderBy("order", "asc")));
      const rows: TNiveauDoc[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        rows.push({ id: d.id, libelle: String(v.libelle || ""), order: Number(v.order || 0) });
      });
      setNiveaux(rows);
    } catch (e) {
      console.error(e);
      setNivError("Impossible de charger les niveaux.");
    } finally {
      setNivLoading(false);
    }
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "classes"),
          where("filiere_id", "==", filiere.id),
          where("academic_year_id", "==", filiere.academic_year_id)
        )
      );
      const rows: TClasse[] = [];
      snap.forEach((d) => {
        const v = d.data() as any;
        rows.push({
          id: d.id,
          filiere_id: String(v.filiere_id),
          filiere_libelle: String(v.filiere_libelle),
          niveau_id: String(v.niveau_id || ""),
          niveau_libelle: String(v.niveau_libelle || ""),
          libelle: String(v.libelle),
          academic_year_id: String(v.academic_year_id),
        });
      });
      rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
      setList(rows);
    } catch (e) {
      console.error(e);
      ko("Erreur de chargement des classes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNiveaux();
  }, []);

  // présélection du premier niveau quand disponibles
  useEffect(() => {
    if (!nivLoading && niveaux.length && !niveauId) {
      setNiveauId(niveaux[0].id);
    }
  }, [nivLoading, niveaux, niveauId]);

  useEffect(() => {
    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiere.id, filiere.academic_year_id]);

  const addClasse = async () => {
    setAddError(null);
    try {
      if (!niveauId) return setAddError("Veuillez choisir un niveau.");
      const niv = niveaux.find((n) => n.id === niveauId);
      if (!niv) return setAddError("Niveau introuvable.");

      const lib = `${filiere.libelle} - ${niv.libelle}`;
      // anti-dup : même filière + même niveau_id + même année
      const dup = await getDocs(
        query(
          collection(db, "classes"),
          where("filiere_id", "==", filiere.id),
          where("niveau_id", "==", niveauId),
          where("academic_year_id", "==", filiere.academic_year_id)
        )
      );
      if (!dup.empty) return setAddError("Cette classe existe déjà pour cette année.");

      await addDoc(collection(db, "classes"), {
        filiere_id: filiere.id,
        filiere_libelle: filiere.libelle,
        niveau_id: niveauId,
        niveau_libelle: niv.libelle,
        libelle: sanitize(lib),
        academic_year_id: filiere.academic_year_id,
        created_at: Date.now(),
      });
      ok("Classe ajoutée.");
      setShowAdd(false);
      fetchClasses();
    } catch (e) {
      console.error(e);
      setAddError("Ajout impossible.");
    }
  };

  const askRemoveClasse = (id: string) => {
    setDeleteError(null);
    setDeleteId(id);
  };
  const cancelRemoveClasse = () => {
    setDeleteBusy(false);
    setDeleteError(null);
    setDeleteId(null);
  };
  const confirmRemoveClasse = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, "classes", deleteId));
      ok("Classe supprimée.");
      cancelRemoveClasse();
      fetchClasses();
    } catch (e) {
      console.error(e);
      setDeleteError("Suppression impossible.");
      setDeleteBusy(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <button className="btn btn-link px-0 me-2" onClick={onBack}>
              <i className="bi bi-arrow-left" /> Retour
            </button>
            <h3 className="mb-1">{filiere.libelle}</h3>
            <div className="text-muted">Année : {filiere.academic_year_id}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <i className="bi bi-plus-lg me-2" />
            Ajouter classe
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status" />
            <div className="text-muted mt-2">Chargement…</div>
          </div>
        ) : list.length === 0 ? (
          <div className="text-muted text-center py-4">Aucune classe.</div>
        ) : (
          <div className="row g-3">
            {list.map((c) => (
              <div className="col-md-4" key={c.id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title mb-1">{c.libelle}</h5>
                    <div className="text-muted mb-3">{c.niveau_libelle}</div>
                    <div className="mt-auto d-flex gap-2">
                      <button className="btn btn-outline-secondary" onClick={() => onOpenClasse(c)}>
                        Ouvrir
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => askRemoveClasse(c.id)}>
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal ajout classe */}
      {showAdd && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Ajouter une classe</h5>
                  <button className="btn-close" onClick={() => setShowAdd(false)} />
                </div>
                <div className="modal-body">
                  {addError ? <div className="alert alert-danger">{addError}</div> : null}
                  {nivError ? <div className="alert alert-danger">{nivError}</div> : null}

                  <label className="form-label">Niveau</label>
                  {nivLoading ? (
                    <div className="form-text">Chargement des niveaux…</div>
                  ) : niveaux.length === 0 ? (
                    <>
                      <div className="alert alert-warning">
                        Aucun niveau trouvé. Vous pouvez initialiser les niveaux par défaut.
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={async () => {
                          try {
                            await Promise.all(
                              DEFAULT_NIVEAUX.map((n) =>
                                setDoc(doc(db, "niveaux", n.id), { libelle: n.libelle, order: n.order })
                              )
                            );
                            await fetchNiveaux();
                          } catch (e) {
                            console.error(e);
                            setNivError("Initialisation impossible.");
                          }
                        }}
                      >
                        Initialiser niveaux par défaut
                      </button>
                    </>
                  ) : (
                    <select
                      className="form-select"
                      value={niveauId}
                      onChange={(e) => setNiveauId(e.target.value)}
                    >
                      {niveaux.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.libelle}
                        </option>
                      ))}
                    </select>
                  )}

                  <small className="text-muted">
                    Libellé:&nbsp;
                    <strong>
                      {filiere.libelle} - {niveaux.find((n) => n.id === niveauId)?.libelle || "—"}
                    </strong>
                    <br />
                    Année: <strong>{filiere.academic_year_id}</strong>
                  </small>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={addClasse} disabled={!niveaux.length}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAdd(false)} />
        </>
      )}

      {/* Double confirmation suppression */}
      <ConfirmDeleteModal
        show={!!deleteId}
        title="Supprimer cette classe ?"
        message={<div>La classe sera supprimée. Les matières, UE et emplois du temps liés devront être gérés en conséquence.</div>}
        onCancel={cancelRemoveClasse}
        onConfirm={confirmRemoveClasse}
        busy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

/* ================================================================
   3) DETAIL CLASSE + onglets (Matières / EDT / Bulletin)
   (on évite les infos répétées dans l’onglet EDT)
================================================================ */
function ClasseDetail({
  filiere,
  classe,
  tab,
  onChangeTab,
  onBackToClasses,
  ok,
  ko,
}: {
  filiere: TFiliere;
  classe: TClasse;
  tab: "matieres" | "edt" | "bulletin";
  onChangeTab: (t: "matieres" | "edt" | "bulletin") => void;
  onBackToClasses: () => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center">
        <button className="btn btn-link px-0 me-2" onClick={onBackToClasses}>
          <i className="bi bi-arrow-left" /> Retour aux classes
        </button>
      </div>

      <SecondaryMenu
        items={[
          { key: "matieres", label: "Liste des matières" },
          { key: "edt", label: "Emploi du temps" },
          { key: "bulletin", label: "Créer un modèle de bulletin" },
        ]}
        layout="horizontal"
        selectedKey={tab}
        onChange={(k) => onChangeTab(k as any)}
      />

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h4 className="mb-2">{classe.libelle}</h4>
          {/* Masque des infos répétées si on est dans l'onglet EDT */}
          {tab !== "edt" && (
            <div className="text-muted mb-3">
              Filière : <strong>{filiere.libelle}</strong> — Niveau :{" "}
              <strong>{classe.niveau_libelle}</strong> — Année :{" "}
              <strong>{classe.academic_year_id}</strong>
            </div>
          )}

          {tab === "matieres" && <MatieresSection classe={classe} ok={ok} ko={ko} />}
          {tab === "edt" && <EDTSection filiere={filiere} classe={classe} ok={ok} ko={ko} />}
          {tab === "bulletin" && <div className="text-muted">(À venir)</div>}
        </div>
      </div>
    </div>
  );
}

/* ======================= MATIERES + UE (anti-doublons) ========================= */
function MatieresSection({ classe, ok, ko }: { classe: TClasse; ok: (m: string) => void; ko: (m: string) => void }) {
  const ITEMS_PER_PAGE = 10;

  const [ues, setUes] = useState<TUE[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);
  const [loading, setLoading] = useState(true);

  // filter UE
  const [ueFilter, setUeFilter] = useState<string>("");

  // pagination
  const [matPage, setMatPage] = useState<number>(1);
  const [uePage, setUePage] = useState<number>(1);

  // add/edit matière
  const [showAdd, setShowAdd] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [matiereUeId, setMatiereUeId] = useState<string>("");
  const [addError, setAddError] = useState<string | null>(null);

  // add UE (modale dédiée)
  const [showAddUE, setShowAddUE] = useState(false);

  const [edit, setEdit] = useState<TMatiere | null>(null);
  const [editLibelle, setEditLibelle] = useState("");
  const [editUeId, setEditUeId] = useState<string>("");
  const [editError, setEditError] = useState<string | null>(null);

  // UE edit
  const [ueEdit, setUeEdit] = useState<TUE | null>(null);
  const [ueEditLibelle, setUeEditLibelle] = useState("");
  const [ueEditCode, setUeEditCode] = useState("");
  const [ueEditError, setUeEditError] = useState<string | null>(null);

  // suppression
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // suppression UE unitaire
  const [ueDeleteId, setUeDeleteId] = useState<string | null>(null);
  const [ueDeleteBusy, setUeDeleteBusy] = useState(false);
  const [ueDeleteError, setUeDeleteError] = useState<string | null>(null);

  // suppression UE de masse
  const [ueBulkOpen, setUeBulkOpen] = useState(false);
  const [ueBulkBusy, setUeBulkBusy] = useState(false);
  const [ueBulkError, setUeBulkError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // UE (filtrée par classe + année)
      const snapUe = await getDocs(
        query(
          collection(db, "ues"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const u: TUE[] = [];
      snapUe.forEach((d) => {
        const data = d.data() as any;
        u.push({
          id: d.id,
          class_id: data.class_id,
          libelle: String(data.libelle || ""),
          code: data.code ?? null,
          academic_year_id: String(data.academic_year_id || ""),
        });
      });
      u.sort((a, b) => a.libelle.localeCompare(b.libelle));
      setUes(u);

      // Matières
      const snapM = await getDocs(
        query(
          collection(db, "matieres"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const ms: TMatiere[] = [];
      snapM.forEach((d) => {
        const data = d.data() as any;
        ms.push({
          id: d.id,
          class_id: data.class_id,
          libelle: String(data.libelle || ""),
          ue_id: data.ue_id ?? null,
          academic_year_id: String(data.academic_year_id || ""),
        });
      });
      ms.sort((a, b) => a.libelle.localeCompare(b.libelle));
      setMatieres(ms);
    } catch (e) {
      console.error(e);
      ko("Erreur de chargement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id, classe.academic_year_id]);

  // reset pagination quand filtre/longueur change
  useEffect(() => {
    setMatPage(1);
  }, [ueFilter, matieres.length]);
  useEffect(() => {
    setUePage(1);
  }, [ues.length]);

  const filteredMatieres = useMemo(() => {
    if (!ueFilter) return matieres;
    return matieres.filter((m) => (m.ue_id ?? "") === ueFilter);
  }, [matieres, ueFilter]);

  // pagination: matières
  const matTotalPages = Math.max(1, Math.ceil(filteredMatieres.length / ITEMS_PER_PAGE));
  const matSlice = filteredMatieres.slice((matPage - 1) * ITEMS_PER_PAGE, matPage * ITEMS_PER_PAGE);

  // pagination: UE
  const ueTotalPages = Math.max(1, Math.ceil(ues.length / ITEMS_PER_PAGE));
  const ueSlice = ues.slice((uePage - 1) * ITEMS_PER_PAGE, uePage * ITEMS_PER_PAGE);

  const addMatiere = async () => {
    setAddError(null);
    const label = sanitize(libelle);
    if (!label) return setAddError("Libellé requis.");
    try {
      // anti-dup matière (même libellé CI) dans la même classe + année
      const snap = await getDocs(
        query(
          collection(db, "matieres"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const exists = snap.docs.some((d) => ci((d.data() as any).libelle) === ci(label));
      if (exists) return setAddError("Cette matière existe déjà pour la classe (année en cours).");

      await addDoc(collection(db, "matieres"), {
        class_id: classe.id,
        libelle: label,
        ue_id: matiereUeId || null,
        academic_year_id: classe.academic_year_id,
        created_at: Date.now(),
      });
      ok("Matière ajoutée.");
      setLibelle("");
      setMatiereUeId("");
      setShowAdd(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      setAddError("Ajout impossible.");
    }
  };

  const openEdit = (m: TMatiere) => {
    setEditError(null);
    setEdit(m);
    setEditLibelle(m.libelle);
    setEditUeId(m.ue_id ?? "");
  };

  const saveEdit = async () => {
    if (!edit) return;
    setEditError(null);
    const label = sanitize(editLibelle);
    if (!label) return setEditError("Libellé requis.");
    try {
      // anti-dup sur update
      const snap = await getDocs(
        query(
          collection(db, "matieres"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const exists = snap.docs.some((d) => d.id !== edit.id && ci((d.data() as any).libelle) === ci(label));
      if (exists) return setEditError("Cette matière existe déjà pour la classe (année en cours).");

      await updateDoc(doc(db, "matieres", edit.id), {
        libelle: label,
        ue_id: editUeId || null,
      });
      ok("Matière mise à jour.");
      setEdit(null);
      fetchAll();
    } catch (e) {
      console.error(e);
      setEditError("Mise à jour impossible.");
    }
  };

  // suppression matière
  const askRemoveMatiere = (id: string) => {
    setDeleteError(null);
    setDeleteId(id);
  };
  const cancelRemoveMatiere = () => {
    setDeleteBusy(false);
    setDeleteError(null);
    setDeleteId(null);
  };
  const confirmRemoveMatiere = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, "matieres", deleteId));
      ok("Matière supprimée.");
      cancelRemoveMatiere();
      fetchAll();
    } catch (e) {
      console.error(e);
      setDeleteError("Suppression impossible.");
      setDeleteBusy(false);
    }
  };

  // --- UE: éditer ---
  const openUeEdit = (u: TUE) => {
    setUeEditError(null);
    setUeEdit(u);
    setUeEditLibelle(u.libelle);
    setUeEditCode(u.code || "");
  };
  const saveUeEdit = async () => {
    if (!ueEdit) return;
    setUeEditError(null);
    const label = sanitize(ueEditLibelle);
    if (!label) return setUeEditError("Libellé requis.");
    try {
      // anti-dup dans la même classe + année
      const snap = await getDocs(
        query(
          collection(db, "ues"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const exists = snap.docs.some(
        (d) => d.id !== ueEdit.id && ci((d.data() as any).libelle) === ci(label)
      );
      if (exists) return setUeEditError("Cette UE existe déjà pour la classe (année en cours).");

      await updateDoc(doc(db, "ues", ueEdit.id), {
        libelle: label,
        code: sanitize(ueEditCode) || null,
      });
      ok("UE mise à jour.");
      setUeEdit(null);
      fetchAll();
    } catch (e) {
      console.error(e);
      setUeEditError("Mise à jour impossible.");
    }
  };

  // --- UE: supprimer (unitaire) ---
  const askRemoveUE = (id: string) => {
    setUeDeleteError(null);
    setUeDeleteId(id);
  };
  const cancelRemoveUE = () => {
    setUeDeleteBusy(false);
    setUeDeleteError(null);
    setUeDeleteId(null);
  };
  const confirmRemoveUE = async () => {
    if (!ueDeleteId) return;
    setUeDeleteBusy(true);
    setUeDeleteError(null);
    try {
      // Nettoyer les matières pointant vers cette UE (ue_id -> null)
      const mSnap = await getDocs(
        query(
          collection(db, "matieres"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id),
          where("ue_id", "==", ueDeleteId)
        )
      );
      await Promise.all(
        mSnap.docs.map((d) => updateDoc(doc(db, "matieres", d.id), { ue_id: null }))
      );

      await deleteDoc(doc(db, "ues", ueDeleteId));
      ok("UE supprimée.");
      // si c'était la valeur du filtre, on le réinitialise
      if (ueFilter === ueDeleteId) setUeFilter("");
      cancelRemoveUE();
      fetchAll();
    } catch (e) {
      console.error(e);
      setUeDeleteError("Suppression impossible.");
      setUeDeleteBusy(false);
    }
  };

  // --- UE: suppression de masse ---
  const confirmRemoveAllUE = async () => {
    setUeBulkBusy(true);
    setUeBulkError(null);
    try {
      // Récupère toutes les UE de la classe/année
      const ueSnap = await getDocs(
        query(
          collection(db, "ues"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      const ueIds = ueSnap.docs.map((d) => d.id);

      // Nettoie toutes les matières référencées
      const mSnap = await getDocs(
        query(
          collection(db, "matieres"),
          where("class_id", "==", classe.id),
          where("academic_year_id", "==", classe.academic_year_id)
        )
      );
      await Promise.all(
        mSnap.docs
          .filter((d) => ueIds.includes((d.data() as any).ue_id))
          .map((d) => updateDoc(doc(db, "matieres", d.id), { ue_id: null }))
      );

      await Promise.all(ueIds.map((id) => deleteDoc(doc(db, "ues", id))));
      ok("Toutes les UE ont été supprimées.");
      setUeFilter("");
      setUeBulkBusy(false);
      setUeBulkOpen(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      setUeBulkError("Suppression de masse impossible.");
      setUeBulkBusy(false);
    }
  };

  const Paginator = ({
    page,
    total,
    onChange,
  }: {
    page: number;
    total: number;
    onChange: (p: number) => void;
  }) => (
    <div className="d-flex align-items-center justify-content-end gap-2 p-2">
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Précédent
      </button>
      <span className="small text-muted">
        Page {page} / {total}
      </span>
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Suivant
      </button>
    </div>
  );

  return (
    <>
      {/* ====== Section UE ====== */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h5 className="mb-0">Unités d’enseignement (UE)</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-danger" onClick={() => setUeBulkOpen(true)} disabled={!ues.length}>
            Supprimer toutes les UE
          </button>
          <button className="btn btn-outline-secondary" onClick={() => setShowAddUE(true)}>
            <i className="bi bi-diagram-3 me-2" />
            Créer une UE
          </button>
        </div>
      </div>

      <div className="card border-0 mb-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
            </div>
          ) : ues.length === 0 ? (
            <div className="text-center text-muted py-4">Aucune UE.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Libellé</th>
                      <th>Code</th>
                      <th style={{ width: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ueSlice.map((u) => (
                      <tr key={u.id}>
                        <td className="fw-semibold">{u.libelle}</td>
                        <td>{u.code || <span className="text-muted">—</span>}</td>
                        <td className="d-flex gap-2">
                          <button className="btn btn-outline-primary btn-sm" onClick={() => openUeEdit(u)}>
                            Modifier
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => askRemoveUE(u.id)}>
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Paginator page={uePage} total={ueTotalPages} onChange={setUePage} />
            </>
          )}
        </div>
      </div>

      {/* ====== Section Matières ====== */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Matières</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <i className="bi bi-plus-lg me-2" />
            Ajouter matière
          </button>
        </div>
      </div>

      {/* Filtre UE */}
      <div className="row g-2 mb-3">
        <div className="col-md-4">
          <label className="form-label">Filtrer par UE</label>
          <select className="form-select" value={ueFilter} onChange={(e) => setUeFilter(e.target.value)}>
            <option value="">— Toutes —</option>
            {ues.map((u) => (
              <option key={u.id} value={u.id}>
                {u.libelle}
                {u.code ? ` (${u.code})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card border-0">
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
              <div className="text-muted mt-2">Chargement…</div>
            </div>
          ) : matSlice.length === 0 ? (
            <div className="text-center text-muted py-4">Aucune matière.</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Libellé</th>
                      <th>UE</th>
                      <th style={{ width: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matSlice.map((m) => {
                      const ue = m.ue_id ? ues.find((u) => u.id === m.ue_id) : undefined;
                      return (
                        <tr key={m.id}>
                          <td className="fw-semibold">{m.libelle}</td>
                          <td>{ue ? ue.libelle : <span className="text-muted">—</span>}</td>
                          <td className="d-flex gap-2">
                            <button className="btn btn-outline-primary btn-sm" onClick={() => openEdit(m)}>
                              Modifier
                            </button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => askRemoveMatiere(m.id)}>
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Paginator page={matPage} total={matTotalPages} onChange={setMatPage} />
            </>
          )}
        </div>
      </div>

      {/* Modal ajouter matière */}
      {showAdd && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Ajouter une matière</h5>
                  <button className="btn-close" onClick={() => setShowAdd(false)} />
                </div>
                <div className="modal-body">
                  {addError ? <div className="alert alert-danger">{addError}</div> : null}
                  <div className="mb-3">
                    <label className="form-label">Libellé</label>
                    <input
                      className="form-control"
                      value={libelle}
                      onChange={(e) => setLibelle(e.target.value)}
                      placeholder="Ex: Algorithmique"
                    />
                  </div>
                  <div className="mb-1">
                    <label className="form-label">Associer à une UE (optionnel)</label>
                    <select
                      className="form-select"
                      value={matiereUeId}
                      onChange={(e) => setMatiereUeId(e.target.value)}
                    >
                      <option value="">— Aucune —</option>
                      {ues.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.libelle}
                          {u.code ? ` (${u.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={addMatiere}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAdd(false)} />
        </>
      )}

      {/* Modal éditer matière */}
      {edit && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Modifier la matière</h5>
                  <button className="btn-close" onClick={() => setEdit(null)} />
                </div>
                <div className="modal-body">
                  {editError ? <div className="alert alert-danger">{editError}</div> : null}
                  <div className="mb-3">
                    <label className="form-label">Libellé</label>
                    <input
                      className="form-control"
                      value={editLibelle}
                      onChange={(e) => setEditLibelle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">UE (optionnel)</label>
                    <select
                      className="form-select"
                      value={editUeId}
                      onChange={(e) => setEditUeId(e.target.value)}
                    >
                      <option value="">— Aucune —</option>
                      {ues.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.libelle}
                          {u.code ? ` (${u.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setEdit(null)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={saveEdit}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setEdit(null)} />
        </>
      )}

      {/* Double confirmation suppression matière */}
      <ConfirmDeleteModal
        show={!!deleteId}
        title="Supprimer cette matière ?"
        message={<div>La matière sera supprimée pour cette classe et cette année.</div>}
        onCancel={cancelRemoveMatiere}
        onConfirm={confirmRemoveMatiere}
        busy={deleteBusy}
        error={deleteError}
      />

      {/* Modal créer UE dédiée */}
      {showAddUE && (
        <CreateUEModal
          show={showAddUE}
          onClose={() => setShowAddUE(false)}
          onCreated={() => {
            fetchAll();
          }}
          classe={classe}
          ok={ok}
        />
      )}

      {/* Modal éditer UE */}
      {ueEdit && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Modifier l’UE</h5>
                  <button className="btn-close" onClick={() => setUeEdit(null)} />
                </div>
                <div className="modal-body">
                  {ueEditError ? <div className="alert alert-danger">{ueEditError}</div> : null}
                  <div className="mb-3">
                    <label className="form-label">Libellé</label>
                    <input
                      className="form-control"
                      value={ueEditLibelle}
                      onChange={(e) => setUeEditLibelle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Code (optionnel)</label>
                    <input
                      className="form-control"
                      value={ueEditCode}
                      onChange={(e) => setUeEditCode(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setUeEdit(null)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={saveUeEdit}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setUeEdit(null)} />
        </>
      )}

      {/* Double confirmation suppression UE (unitaire) */}
      <ConfirmDeleteModal
        show={!!ueDeleteId}
        title="Supprimer cette UE ?"
        message={<div>L’UE sera supprimée. Les matières liées ne seront pas supprimées (leur UE sera vidée).</div>}
        onCancel={cancelRemoveUE}
        onConfirm={confirmRemoveUE}
        busy={ueDeleteBusy}
        error={ueDeleteError}
      />

      {/* Double confirmation suppression de masse des UE */}
      <ConfirmDeleteModal
        show={ueBulkOpen}
        title="Supprimer TOUTES les UE ?"
        message={
          <div>
            Toutes les UE de cette classe (année en cours) seront supprimées.
            Les matières resteront mais ne seront plus associées à une UE.
          </div>
        }
        onCancel={() => setUeBulkOpen(false)}
        onConfirm={confirmRemoveAllUE}
        busy={ueBulkBusy}
        error={ueBulkError}
        confirmLabel="Tout supprimer"
      />
    </>
  );

  // ----- petite modale dédiée à la création d'UE (avec erreurs visibles) -----
  function CreateUEModal({
    show,
    onClose,
    onCreated,
    classe,
    ok,
  }: {
    show: boolean;
    onClose: () => void;
    onCreated: () => void;
    classe: TClasse;
    ok: (m: string) => void;
  }) {
    const [ueLibelle, setUeLibelle] = useState("");
    const [ueCode, setUeCode] = useState("");
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const addUE = async () => {
      setErr(null);
      const label = sanitize(ueLibelle);
      if (!label) return setErr("Libellé UE requis.");
      try {
        // anti-dup UE (même libellé CI) dans la même classe + année
        const snap = await getDocs(
          query(
            collection(db, "ues"),
            where("class_id", "==", classe.id),
            where("academic_year_id", "==", classe.academic_year_id)
          )
        );
        const exists = snap.docs.some((d) => ci((d.data() as any).libelle) === ci(label));
        if (exists) return setErr("Cette UE existe déjà pour la classe (année en cours).");

        setBusy(true);
        await addDoc(collection(db, "ues"), {
          class_id: classe.id,
          libelle: label,
          code: sanitize(ueCode) || null,
          academic_year_id: classe.academic_year_id,
          created_at: Date.now(),
        });
        ok("UE créée.");
        setBusy(false);
        onClose();
        onCreated();
      } catch (e) {
        console.error(e);
        setErr("Création UE impossible.");
        setBusy(false);
      }
    };

    if (!show) return null;
    return (
      <>
        <div className="modal fade show" style={{ display: "block" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Créer une UE</h5>
                <button className="btn-close" onClick={onClose} />
              </div>
              <div className="modal-body">
                {err ? <div className="alert alert-danger">{err}</div> : null}
                <div className="mb-3">
                  <label className="form-label">Libellé de l’UE</label>
                  <input
                    className="form-control"
                    value={ueLibelle}
                    onChange={(e) => setUeLibelle(e.target.value)}
                    placeholder="Ex: UE Fondamentaux Informatique"
                  />
                </div>
                <div>
                  <label className="form-label">Code (optionnel)</label>
                  <input
                    className="form-control"
                    value={ueCode}
                    onChange={(e) => setUeCode(e.target.value)}
                    placeholder="Ex: UE101"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                  Annuler
                </button>
                <button className="btn btn-primary" onClick={addUE} disabled={busy}>
                  {busy ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Enregistrement…
                    </>
                  ) : (
                    "Créer"
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
}

/* ======================= EMPLOI DU TEMPS (un seul par classe/année/semestre)
   UI allégée : pas d’infos répétées (filière/niveau) dans la vue
================================================================== */
type TSemestre = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

type TEDTSlot = {
  day: number; // 1..6
  matiere_id: string;
  matiere_libelle: string;
  start: string; // "08:00"
  end: string; // "10:30"
  salle: string;
  enseignant: string;
};
type TEDT = {
  id: string;
  class_id: string;
  class_libelle: string;
  annee: string; // "2024-2025"
  semestre: TSemestre;
  slots: TEDTSlot[];
  created_at: number;
  title?: string;
};

function EDTSection({
  filiere,
  classe,
  ok,
  ko,
}: {
  filiere: TFiliere;
  classe: TClasse;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  // filtres haut
  const [selectedSem, setSelectedSem] = React.useState<TSemestre>("S1");
  const selectedYear = classe.academic_year_id; // année imposée par la classe

  // data
  const [matieres, setMatieres] = React.useState<TMatiere[]>([]);
  const [edts, setEdts] = React.useState<TEDT[]>([]);
  const [loading, setLoading] = React.useState(true);

  // création
  const [showCreate, setShowCreate] = React.useState(false);
  const [createSem, setCreateSem] = React.useState<TSemestre>("S1");
  const [draftSlots, setDraftSlots] = React.useState<Record<number, TEDTSlot[]>>({
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  });
  const [createError, setCreateError] = React.useState<string | null>(null);

  // suppression EDT
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // prévisualisation / édition d’un EDT existant
  const [preview, setPreview] = React.useState<{
    open: boolean;
    edt: TEDT | null;
    edit: boolean;
    draft: Record<number, TEDTSlot[]>;
  }>({ open: false, edt: null, edit: false, draft: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } });

  const [openDaysPreview, setOpenDaysPreview] = React.useState<number[]>([]);
  const toggleDayPreview = (day: number) =>
    setOpenDaysPreview((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  // Chargement
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // matières (classe + année)
        const snapM = await getDocs(
          query(
            collection(db, "matieres"),
            where("class_id", "==", classe.id),
            where("academic_year_id", "==", classe.academic_year_id)
          )
        );
        const listM: TMatiere[] = [];
        snapM.forEach((d) => {
          const v = d.data() as any;
          listM.push({
            id: d.id,
            class_id: v.class_id,
            libelle: String(v.libelle || ""),
            ue_id: v.ue_id ?? null,
            academic_year_id: String(v.academic_year_id || ""),
          });
        });
        listM.sort((a, b) => a.libelle.localeCompare(b.libelle));
        setMatieres(listM);

        // edts (de la classe ; on filtrera par année/sem ensuite)
        const snapE = await getDocs(query(collection(db, "edts"), where("class_id", "==", classe.id)));
        const listE: TEDT[] = [];
        snapE.forEach((d) => {
          const v = d.data() as any;
          listE.push({
            id: d.id,
            class_id: v.class_id,
            class_libelle: String(v.class_libelle || ""),
            annee: String(v.annee || ""),
            semestre: v.semestre as TSemestre,
            slots: (v.slots ?? []) as TEDTSlot[],
            created_at: v.created_at ?? Date.now(),
            title: v.title ?? undefined,
          });
        });
        listE.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
        setEdts(listE);
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement des emplois du temps.");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id, classe.academic_year_id]);

  const filtered = React.useMemo(() => {
    return edts.filter((e) => e.semestre === selectedSem && e.annee === selectedYear);
  }, [edts, selectedSem, selectedYear]);

  /* ======== Création EDT ======== */
  const addDraftSlot = (day: number) => {
    setDraftSlots((prev) => ({ ...prev, [day]: [...prev[day], emptySlot(day)] }));
  };
  const removeDraftSlot = (day: number, idx: number) => {
    setDraftSlots((prev) => {
      const cp = { ...prev };
      cp[day] = cp[day].filter((_, i) => i !== idx);
      return cp;
    });
  };
  const updateDraftSlot = (day: number, idx: number, patch: Partial<TEDTSlot>) => {
    setDraftSlots((prev) => {
      const cp = { ...prev };
      cp[day] = cp[day].map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return cp;
    });
  };

  const saveEDT = async () => {
    setCreateError(null);
    const allSlots = Object.values(draftSlots).flat();
    for (const s of allSlots) {
      if (!s.matiere_id) return setCreateError("Sélectionnez une matière pour chaque ligne.");
      if (!isValidRange(s.start, s.end)) return setCreateError("Vérifiez les horaires (début < fin).");
      s.matiere_libelle = matieres.find((m) => m.id === s.matiere_id)?.libelle ?? "";
      s.salle = sanitize(s.salle);
      s.enseignant = sanitize(s.enseignant);
    }
    try {
      // anti-dup EDT : un seul par classe + année + semestre
      const dup = await getDocs(
        query(
          collection(db, "edts"),
          where("class_id", "==", classe.id),
          where("annee", "==", selectedYear),
          where("semestre", "==", createSem)
        )
      );
      if (!dup.empty) return setCreateError("Un EDT existe déjà pour cette classe (même année & semestre).");

      await addDoc(collection(db, "edts"), {
        class_id: classe.id,
        class_libelle: classe.libelle,
        annee: selectedYear,
        semestre: createSem,
        slots: allSlots,
        created_at: Date.now(),
        title: `EDT ${classe.libelle} - ${createSem} ${selectedYear}`,
      });
      ok("Emploi du temps créé.");
      setShowCreate(false);
      setDraftSlots({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

      // refresh
      const snapE = await getDocs(query(collection(db, "edts"), where("class_id", "==", classe.id)));
      const listE: TEDT[] = [];
      snapE.forEach((d) => {
        const v = d.data() as any;
        listE.push({
          id: d.id,
          class_id: v.class_id,
          class_libelle: String(v.class_libelle || ""),
          annee: String(v.annee || ""),
          semestre: v.semestre as TSemestre,
          slots: (v.slots ?? []) as TEDTSlot[],
          created_at: v.created_at ?? Date.now(),
          title: v.title ?? undefined,
        });
      });
      listE.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      setEdts(listE);
      setSelectedSem(createSem);
    } catch (e) {
      console.error(e);
      setCreateError("Impossible d’enregistrer l’EDT.");
    }
  };

  /* ======== Prévisualiser / Modifier / Supprimer un EDT ======== */
  const openPreview = (edt: TEDT) => {
    setOpenDaysPreview([1, 2, 3, 4, 5, 6]);
    setPreview({
      open: true,
      edt,
      edit: false,
      draft: slotsToDraft(edt.slots),
    });
  };
  const closePreview = () =>
    setPreview({ open: false, edt: null, edit: false, draft: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } });
  const toggleEdit = () => setPreview((p) => ({ ...p, edit: !p.edit }));

  const addPreviewSlot = (day: number) =>
    setPreview((p) => ({ ...p, draft: { ...p.draft, [day]: [...p.draft[day], emptySlot(day)] } }));
  const removePreviewSlot = (day: number, idx: number) =>
    setPreview((p) => {
      const cp = { ...p.draft };
      cp[day] = cp[day].filter((_, i) => i !== idx);
      return { ...p, draft: cp };
    });
  const updatePreviewSlot = (day: number, idx: number, patch: Partial<TEDTSlot>) =>
    setPreview((p) => {
      const cp = { ...p.draft };
      cp[day] = cp[day].map((s, i) => (i === idx ? { ...s, ...patch } : s));
      return { ...p, draft: cp };
    });

  const savePreviewChanges = async () => {
    if (!preview.edt) return;
    const all = Object.values(preview.draft).flat();
    for (const s of all) {
      if (!s.matiere_id) return ko("Sélectionnez une matière pour chaque ligne.");
      if (!isValidRange(s.start, s.end)) return ko("Vérifiez les horaires (début < fin).");
      s.matiere_libelle = matieres.find((m) => m.id === s.matiere_id)?.libelle ?? "";
      s.salle = sanitize(s.salle);
      s.enseignant = sanitize(s.enseignant);
    }
    try {
      await updateDoc(doc(db, "edts", preview.edt.id), { slots: all });
      ok("Emploi du temps mis à jour.");
      setEdts((old) => old.map((e) => (e.id === preview.edt!.id ? { ...e, slots: all } : e)));
      setPreview((p) => ({ ...p, edit: false }));
    } catch (e) {
      console.error(e);
      ko("Mise à jour impossible.");
    }
  };

  // suppression EDT
  const askRemoveEDT = (id: string) => {
    setDeleteError(null);
    setDeleteId(id);
  };
  const cancelRemoveEDT = () => {
    setDeleteBusy(false);
    setDeleteError(null);
    setDeleteId(null);
  };
  const confirmRemoveEDT = async () => {
    if (!deleteId) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await deleteDoc(doc(db, "edts", deleteId));
      ok("Emploi du temps supprimé.");
      cancelRemoveEDT();
      // refresh local
      setEdts((prev) => prev.filter((e) => e.id !== deleteId));
    } catch (e) {
      console.error(e);
      setDeleteError("Suppression impossible.");
      setDeleteBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* EN-TÊTE allégée (pas d’infos répétées) */}
      <div className="d-flex flex-wrap align-items-end gap-2">
        <div>
          <label className="form-label mb-1">Semestre</label>
          <select className="form-select" value={selectedSem} onChange={(e) => setSelectedSem(e.target.value as TSemestre)}>
            {["S1", "S2", "S3", "S4", "S5", "S6"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary ms-2" onClick={() => setShowCreate(true)}>
          <i className="bi bi-calendar-plus me-2" />
          Créer un emploi du temps
        </button>
      </div>

      {/* LISTE COMPACTE */}
      <div className="card border-0">
        <div className="card-body">
          <h6 className="mb-3">Emplois du temps ({selectedSem} — {selectedYear})</h6>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucun emploi du temps pour ces critères.</div>
          ) : (
            <div className="row g-3">
              {filtered.map((edt) => (
                <div className="col-md-4" key={edt.id}>
                  <div className="card h-100 shadow-sm">
                    <div className="card-body d-flex flex-column">
                      <h6 className="mb-1">{edt.title ?? `EDT ${selectedSem} ${selectedYear}`}</h6>
                      <div className="mt-auto d-flex gap-2 pt-2">
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => openPreview(edt)}>
                          Voir / Modifier
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => askRemoveEDT(edt.id)}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREATION EDT */}
      {showCreate && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Créer un emploi du temps</h5>
                  <button className="btn-close" onClick={() => setShowCreate(false)} />
                </div>

                <div className="modal-body">
                  {createError ? <div className="alert alert-danger">{createError}</div> : null}
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Classe</label>
                      <input className="form-control" value={classe.libelle} disabled />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Semestre</label>
                      <select className="form-select" value={createSem} onChange={(e) => setCreateSem(e.target.value as TSemestre)}>
                        {["S1", "S2", "S3", "S4", "S5", "S6"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Année scolaire</label>
                      <input className="form-control" value={selectedYear} disabled />
                    </div>
                  </div>

                  {/* Editeurs par jour (création) */}
                  {renderDayEditors({
                    mode: "create",
                    draft: draftSlots,
                    matieres,
                    addSlot: addDraftSlot,
                    removeSlot: removeDraftSlot,
                    updateSlot: updateDraftSlot,
                  })}
                </div>

                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowCreate(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={saveEDT}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowCreate(false)} />
        </>
      )}

      {/* MODAL VOIR / MODIFIER */}
      {preview.open && preview.edt && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-xl modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">{preview.edt.title ?? "Emploi du temps"}</h5>
                    <small className="text-muted">
                      {preview.edt.semestre} • {preview.edt.annee}
                    </small>
                  </div>
                  <div className="d-flex gap-2">
                    {!preview.edit ? (
                      <button className="btn btn-outline-primary" onClick={toggleEdit}>
                        Modifier
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-outline-secondary" onClick={toggleEdit}>
                          Annuler modifs
                        </button>
                        <button className="btn btn-primary" onClick={savePreviewChanges}>
                          Enregistrer
                        </button>
                      </>
                    )}
                    <button className="btn-close" onClick={closePreview} />
                  </div>
                </div>

                <div className="modal-body">
                  {/* Mode lecture / édition */}
                  {preview.edit ? (
                    renderDayEditors({
                      mode: "edit",
                      draft: preview.draft,
                      matieres,
                      addSlot: addPreviewSlot,
                      removeSlot: removePreviewSlot,
                      updateSlot: updatePreviewSlot,
                      openDays: openDaysPreview,
                      onToggleDay: toggleDayPreview,
                    })
                  ) : (
                    renderDayReadonly(preview.edt.slots)
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closePreview} />
        </>
      )}

      {/* Double confirmation suppression EDT */}
      <ConfirmDeleteModal
        show={!!deleteId}
        title="Supprimer cet emploi du temps ?"
        message={<div>L’emploi du temps (tous les créneaux) sera supprimé définitivement.</div>}
        onCancel={cancelRemoveEDT}
        onConfirm={confirmRemoveEDT}
        busy={deleteBusy}
        error={deleteError}
      />
    </div>
  );
}

/* ======================= Helpers EDT ======================= */
function emptySlot(day: number): TEDTSlot {
  return {
    day,
    matiere_id: "",
    matiere_libelle: "",
    start: "08:00",
    end: "10:00",
    salle: "",
    enseignant: "",
  };
}
function slotsToDraft(slots: TEDTSlot[]): Record<number, TEDTSlot[]> {
  const draft: Record<number, TEDTSlot[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const s of slots ?? []) draft[s.day] = [...draft[s.day], { ...s }];
  Object.values(draft).forEach((list) => list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start)));
  return draft;
}
function renderDayReadonly(slots: TEDTSlot[]) {
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const grouped: Record<number, TEDTSlot[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  (slots ?? []).forEach((s) => grouped[s.day].push(s));
  Object.values(grouped).forEach((list) => list.sort((a, b) => toMinutes(a.start) - toMinutes(b.start)));
  return (
    <div className="d-flex flex-column gap-3">
      {Object.entries(grouped).map(([d, list]) => (
        <div className="card" key={d}>
          <div className="card-header fw-semibold">{days[Number(d) - 1]}</div>
          <div className="card-body p-0">
            {list.length === 0 ? (
              <div className="text-muted p-3">—</div>
            ) : (
              <div className="table-responsive">
                <table className="table mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Heure</th>
                      <th>Matière</th>
                      <th>Salle</th>
                      <th>Enseignant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s, i) => (
                      <tr key={i}>
                        <td>
                          {formatFR(s.start)} — {formatFR(s.end)}
                        </td>
                        <td>{s.matiere_libelle}</td>
                        <td>{s.salle || "—"}</td>
                        <td>{s.enseignant || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
function formatFR(hhmm: string) {
  const [hh, mm] = hhmm.split(":");
  return `${hh}h${mm === "00" ? "" : mm}`;
}
function halfHours(start = "08:00", end = "22:00"): string[] {
  const res: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let total = sh * 60 + sm;
  const limit = eh * 60 + em;
  while (total <= limit) {
    const h = Math.floor(total / 60).toString().padStart(2, "0");
    const m = (total % 60).toString().padStart(2, "0");
    res.push(`${h}:${m}`);
    total += 30;
  }
  return res;
}
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function isValidRange(start: string, end: string): boolean {
  return toMinutes(start) < toMinutes(end);
}

/** <<< RÉ-INTRODUCTION : éditeur de créneaux par jour (utilisé dans EDTSection) >>> */
function renderDayEditors(args: {
  mode: "create" | "edit";
  draft: Record<number, TEDTSlot[]>;
  matieres: TMatiere[];
  addSlot: (day: number) => void;
  removeSlot: (day: number, idx: number) => void;
  updateSlot: (day: number, idx: number, patch: Partial<TEDTSlot>) => void;
  openDays?: number[];
  onToggleDay?: (day: number) => void;
}): React.ReactNode {
  const { mode, draft, matieres, addSlot, removeSlot, updateSlot, openDays = [1, 2, 3, 4, 5, 6], onToggleDay } = args;
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  return (
    <div>
      {days.map((label, i) => {
        const day = (i + 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const slots = draft[day] ?? [];
        const isOpen = openDays.includes(day);
        return (
          <div className="border rounded mb-2" key={day}>
            <button
              type="button"
              className="w-100 text-start btn btn-light d-flex justify-content-between align-items-center"
              onClick={() => (mode === "edit" && onToggleDay ? onToggleDay(day) : undefined)}
              style={{ padding: "10px 14px", cursor: mode === "edit" ? "pointer" : "default" }}
            >
              <span>
                {label} {slots.length ? <span className="text-muted">({slots.length} créneau(x))</span> : null}
              </span>
              {mode === "edit" ? <i className={`bi ${isOpen ? "bi-chevron-up" : "bi-chevron-down"}`} /> : null}
            </button>

            {(mode === "create" || isOpen) && (
              <div className="p-3">
                <div className="d-flex justify-content-end mb-2">
                  <button className="btn btn-outline-primary btn-sm" onClick={() => addSlot(day)}>
                    <i className="bi bi-plus-lg me-1" /> Ajouter un créneau
                  </button>
                </div>

                {slots.length === 0 ? (
                  <div className="text-muted">Aucun créneau pour ce jour.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table align-middle">
                      <thead className="table-light">
                        <tr>
                          <th style={{ minWidth: 220 }}>Matière</th>
                          <th>Début</th>
                          <th>Fin</th>
                          <th>Salle</th>
                          <th>Enseignant</th>
                          <th style={{ width: 80 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                className="form-select"
                                value={s.matiere_id}
                                onChange={(e) => updateSlot(day, idx, { matiere_id: e.target.value })}
                              >
                                <option value="">— Choisir —</option>
                                {matieres.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.libelle}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={s.start}
                                onChange={(e) => updateSlot(day, idx, { start: e.target.value })}
                              >
                                {halfHours().map((h) => (
                                  <option key={h} value={h}>
                                    {formatFR(h)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={s.end}
                                onChange={(e) => updateSlot(day, idx, { end: e.target.value })}
                              >
                                {halfHours().map((h) => (
                                  <option key={h} value={h}>
                                    {formatFR(h)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                className="form-control"
                                value={s.salle}
                                onChange={(e) => updateSlot(day, idx, { salle: e.target.value })}
                                placeholder="Ex: A102"
                              />
                            </td>
                            <td>
                              <input
                                className="form-control"
                                value={s.enseignant}
                                onChange={(e) => updateSlot(day, idx, { enseignant: e.target.value })}
                                placeholder="Nom enseignant"
                              />
                            </td>
                            <td>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => removeSlot(day, idx)}>
                                Suppr.
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
