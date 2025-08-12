// src/app/directeur-des-etudes/components/FilieresPage.tsx
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
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import SecondaryMenu from "./SecondaryMenu";
import Toast from "../../admin/components/ui/Toast";

type TFiliere = { id: string; libelle: string };
type TClasse = {
  id: string;
  filiere_id: string;
  filiere_libelle: string;
  niveau: TNiveau;
  libelle: string;
};
type TUE = { id: string; class_id: string; libelle: string; code?: string };
type TMatiere = {
  id: string;
  class_id: string;
  libelle: string;
  ue_id?: string | null;
};

type TNiveau = "Licence 1" | "Licence 2" | "Licence 3" | "Master 1" | "Master 2";
const NIVEAUX: TNiveau[] = [
  "Licence 1",
  "Licence 2",
  "Licence 3",
  "Master 1",
  "Master 2",
];

type View =
  | { type: "filieres" }
  | { type: "classes"; filiere: TFiliere }
  | { type: "classe"; filiere: TFiliere; classe: TClasse; tab?: "matieres" | "edt" | "bulletin" };

export default function FilieresPage() {
  const [view, setView] = useState<View>({ type: "filieres" });

  // toasts
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
      {view.type === "filieres" && (
        <FilieresList
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

      {/* Toasts */}
      <Toast message={toastMsg} type="success" show={sok} onClose={() => setSOk(false)} />
      <Toast message={toastMsg} type="error" show={serr} onClose={() => setSErr(false)} />
    </div>
  );
}

/* ================================================================
   1) FILIERES LIST
================================================================ */
function FilieresList({
  onOpenFiliere,
  ok,
  ko,
}: {
  onOpenFiliere: (f: TFiliere) => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [items, setItems] = useState<TFiliere[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [libelle, setLibelle] = useState("");

  const [edit, setEdit] = useState<TFiliere | null>(null);
  const [editLibelle, setEditLibelle] = useState("");

  const fetchFilieres = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "filieres"));
      const rows: TFiliere[] = [];
      snap.forEach((d) => rows.push({ id: d.id, libelle: (d.data() as any).libelle }));
      // tri alpha
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
  }, []);

  const addFiliere = async () => {
    if (!libelle.trim()) {
      ko("Libellé requis.");
      return;
    }
    try {
      await addDoc(collection(db, "filieres"), { libelle: libelle.trim() });
      ok("Filière ajoutée.");
      setLibelle("");
      setShowAdd(false);
      fetchFilieres();
    } catch (e) {
      console.error(e);
      ko("Ajout impossible.");
    }
  };

  const openEdit = (f: TFiliere) => {
    setEdit(f);
    setEditLibelle(f.libelle);
  };
  const saveEdit = async () => {
    if (!edit) return;
    if (!editLibelle.trim()) {
      ko("Libellé requis.");
      return;
    }
    try {
      await updateDoc(doc(db, "filieres", edit.id), { libelle: editLibelle.trim() });
      ok("Filière mise à jour.");
      setEdit(null);
      fetchFilieres();
    } catch (e) {
      console.error(e);
      ko("Mise à jour impossible.");
    }
  };

  const removeFiliere = async (id: string) => {
    if (!confirm("Supprimer cette filière ?")) return;
    try {
      await deleteDoc(doc(db, "filieres", id));
      ok("Filière supprimée.");
      fetchFilieres();
    } catch (e) {
      console.error(e);
      ko("Suppression impossible.");
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h3 className="mb-1">Filières</h3>
            <div className="text-muted">Gérez les filières de l’établissement</div>
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
                  <th style={{ width: 220 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id}>
                    <td className="fw-semibold">{f.libelle}</td>
                    <td className="d-flex gap-2">
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => onOpenFiliere(f)}>
                        Ouvrir
                      </button>
                      <button className="btn btn-outline-primary btn-sm" onClick={() => openEdit(f)}>
                        Modifier
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={() => removeFiliere(f.id)}>
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
                  <h5 className="modal-title">Ajouter filière</h5>
                  <button className="btn-close" onClick={() => setShowAdd(false)} />
                </div>
                <div className="modal-body">
                  <label className="form-label">Libellé</label>
                  <input
                    className="form-control"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    placeholder="Ex: Informatique"
                  />
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
    </div>
  );
}

/* ================================================================
   2) CLASSES OF A FILIERE
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

  const [showAdd, setShowAdd] = useState(false);
  const [niveau, setNiveau] = useState<TNiveau>("Licence 1");

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "classes"), where("filiere_id", "==", filiere.id))
      );
      const rows: TClasse[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        rows.push({
          id: d.id,
          filiere_id: data.filiere_id,
          filiere_libelle: data.filiere_libelle,
          niveau: data.niveau,
          libelle: data.libelle,
        });
      });
      // tri par niveau puis libellé
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
    fetchClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiere.id]);

  const addClasse = async () => {
    try {
      const lib = `${filiere.libelle} - ${niveau}`;
      await addDoc(collection(db, "classes"), {
        filiere_id: filiere.id,
        filiere_libelle: filiere.libelle,
        niveau,
        libelle: lib,
      });
      ok("Classe ajoutée.");
      setShowAdd(false);
      setNiveau("Licence 1");
      fetchClasses();
    } catch (e) {
      console.error(e);
      ko("Ajout impossible.");
    }
  };

  const removeClasse = async (id: string) => {
    if (!confirm("Supprimer cette classe ?")) return;
    try {
      await deleteDoc(doc(db, "classes", id));
      ok("Classe supprimée.");
      fetchClasses();
    } catch (e) {
      console.error(e);
      ko("Suppression impossible.");
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
            <div className="text-muted">Classes de cette filière</div>
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
                    <div className="text-muted mb-3">{c.niveau}</div>
                    <div className="mt-auto d-flex gap-2">
                      <button className="btn btn-outline-secondary" onClick={() => onOpenClasse(c)}>
                        Ouvrir
                      </button>
                      <button className="btn btn-outline-danger" onClick={() => removeClasse(c.id)}>
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
                  <label className="form-label">Niveau</label>
                  <select
                    className="form-select"
                    value={niveau}
                    onChange={(e) => setNiveau(e.target.value as TNiveau)}
                  >
                    {NIVEAUX.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    Le libellé sera : <strong>{filiere.libelle} - {niveau}</strong>
                  </small>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowAdd(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={addClasse}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAdd(false)} />
        </>
      )}
    </div>
  );
}

/* ================================================================
   3) CLASSE DETAIL + SECONDARY MENU (Matieres / EDT / Bulletin)
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

      {/* Le menu secondaire n'apparaît qu'ici */}
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
          <div className="text-muted mb-3">
            Filière : <strong>{filiere.libelle}</strong> — Niveau : <strong>{classe.niveau}</strong>
          </div>


          {tab === "matieres" && <MatieresSection classe={classe} ok={ok} ko={ko} />}
          {tab === "edt" && (
            <div className="text-muted">
              (À brancher) Ici, l’**emploi du temps** de la classe.
            </div>
          )}
          {tab === "bulletin" && (
            <div className="text-muted">
              (À brancher) Ici, créer un **modèle de bulletin** pour la classe.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================= MATIERES + UE ========================= */
function MatieresSection({ classe, ok, ko }: { classe: TClasse; ok: (m: string) => void; ko: (m: string) => void }) {
  const [ues, setUes] = useState<TUE[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);
  const [loading, setLoading] = useState(true);

  // filter UE
  const [ueFilter, setUeFilter] = useState<string>("");

  // add/edit matière
  const [showAdd, setShowAdd] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [matiereUeId, setMatiereUeId] = useState<string>("");

  const [edit, setEdit] = useState<TMatiere | null>(null);
  const [editLibelle, setEditLibelle] = useState("");
  const [editUeId, setEditUeId] = useState<string>("");

  // add UE
  const [showAddUE, setShowAddUE] = useState(false);
  const [ueLibelle, setUeLibelle] = useState("");
  const [ueCode, setUeCode] = useState("");

  const fetchAll = async () => {
    setLoading(true);
    try {
      // UE
      const snapUe = await getDocs(
        query(collection(db, "ues"), where("class_id", "==", classe.id))
      );
      const u: TUE[] = [];
      snapUe.forEach((d) => {
        const data = d.data() as any;
        u.push({ id: d.id, class_id: data.class_id, libelle: data.libelle, code: data.code });
      });
      u.sort((a, b) => a.libelle.localeCompare(b.libelle));
      setUes(u);

      // Matieres
      const snapM = await getDocs(
        query(collection(db, "matieres"), where("class_id", "==", classe.id))
      );
      const ms: TMatiere[] = [];
      snapM.forEach((d) => {
        const data = d.data() as any;
        ms.push({ id: d.id, class_id: data.class_id, libelle: data.libelle, ue_id: data.ue_id ?? null });
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
  }, [classe.id]);

  const filteredMatieres = useMemo(() => {
    if (!ueFilter) return matieres;
    return matieres.filter((m) => (m.ue_id ?? "") === ueFilter);
  }, [matieres, ueFilter]);

  const addMatiere = async () => {
    if (!libelle.trim()) {
      ko("Libellé requis.");
      return;
    }
    try {
      await addDoc(collection(db, "matieres"), {
        class_id: classe.id,
        libelle: libelle.trim(),
        ue_id: matiereUeId || null,
      });
      ok("Matière ajoutée.");
      setLibelle("");
      setMatiereUeId("");
      setShowAdd(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      ko("Ajout impossible.");
    }
  };

  const removeMatiere = async (id: string) => {
    if (!confirm("Supprimer cette matière ?")) return;
    try {
      await deleteDoc(doc(db, "matieres", id));
      ok("Matière supprimée.");
      fetchAll();
    } catch (e) {
      console.error(e);
      ko("Suppression impossible.");
    }
  };

  const openEdit = (m: TMatiere) => {
    setEdit(m);
    setEditLibelle(m.libelle);
    setEditUeId(m.ue_id ?? "");
  };
  const saveEdit = async () => {
    if (!edit) return;
    if (!editLibelle.trim()) {
      ko("Libellé requis.");
      return;
    }
    try {
      await updateDoc(doc(db, "matieres", edit.id), {
        libelle: editLibelle.trim(),
        ue_id: editUeId || null,
      });
      ok("Matière mise à jour.");
      setEdit(null);
      fetchAll();
    } catch (e) {
      console.error(e);
      ko("Mise à jour impossible.");
    }
  };

  const addUE = async () => {
    if (!ueLibelle.trim()) {
      ko("Libellé UE requis.");
      return;
    }
    try {
      await addDoc(collection(db, "ues"), {
        class_id: classe.id,
        libelle: ueLibelle.trim(),
        code: ueCode.trim() || null,
      });
      ok("UE créée.");
      setUeLibelle("");
      setUeCode("");
      setShowAddUE(false);
      fetchAll();
    } catch (e) {
      console.error(e);
      ko("Création UE impossible.");
    }
  };

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Matières</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setShowAddUE(true)}>
            <i className="bi bi-diagram-3 me-2" />
            Créer une UE
          </button>
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
                {u.libelle}{u.code ? ` (${u.code})` : ""}
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
          ) : filteredMatieres.length === 0 ? (
            <div className="text-center text-muted py-4">Aucune matière.</div>
          ) : (
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
                  {filteredMatieres.map((m) => {
                    const ue = m.ue_id ? ues.find((u) => u.id === m.ue_id) : undefined;
                    return (
                      <tr key={m.id}>
                        <td className="fw-semibold">{m.libelle}</td>
                        <td>{ue ? ue.libelle : <span className="text-muted">—</span>}</td>
                        <td className="d-flex gap-2">
                          <button className="btn btn-outline-primary btn-sm" onClick={() => openEdit(m)}>
                            Modifier
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => removeMatiere(m.id)}>
                            Supprimer
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
                          {u.libelle}{u.code ? ` (${u.code})` : ""}
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
                          {u.libelle}{u.code ? ` (${u.code})` : ""}
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

      {/* Modal créer UE */}
      {showAddUE && (
        <>
          <div className="modal fade show" style={{ display: "block" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Créer une UE</h5>
                  <button className="btn-close" onClick={() => setShowAddUE(false)} />
                </div>
                <div className="modal-body">
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
                  <button className="btn btn-outline-secondary" onClick={() => setShowAddUE(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={addUE}>
                    Créer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAddUE(false)} />
        </>
      )}
    </>
  );
}
