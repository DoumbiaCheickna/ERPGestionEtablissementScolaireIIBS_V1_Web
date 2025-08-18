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
            <EDTSection filiere={filiere} classe={classe} ok={ok} ko={ko} />
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

/* ======================= EMPLOI DU TEMPS (avec Voir/Modifier) ======================= */
type TSemestre = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

type TEDTSlot = {
  day: number; // 1=Lundi ... 6=Samedi
  matiere_id: string;
  matiere_libelle: string;
  start: string; // "08:00"
  end: string;   // "10:30"
  salle: string;
  enseignant: string;
};
type TEDT = {
  id: string;
  class_id: string;
  class_libelle: string;
  annee: string;     // "2024-2025"
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
  const ECOLE = "Institut Informatique Business School";

  // filtres haut
  const [selectedSem, setSelectedSem] = React.useState<TSemestre>("S1");
  

  // data
  const [matieres, setMatieres] = React.useState<TMatiere[]>([]);
  const [edts, setEdts] = React.useState<TEDT[]>([]);
  const [loading, setLoading] = React.useState(true);

  // création
  const [showCreate, setShowCreate] = React.useState(false);
  const [createSem, setCreateSem] = React.useState<TSemestre>("S1");
  const [draftSlots, setDraftSlots] = React.useState<Record<number, TEDTSlot[]>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
  });
  type AnneeScolaire = "2024-2025" | "2025-2026";
const ANNEES: AnneeScolaire[] = ["2024-2025", "2025-2026"];

  const [selectedYear, setSelectedYear] = React.useState<AnneeScolaire>("2024-2025");
  const [createYear, setCreateYear] = React.useState<AnneeScolaire>("2024-2025");


  // prévisualisation / édition d’un EDT existant
  const [preview, setPreview] = React.useState<{
    open: boolean;
    edt: TEDT | null;
    edit: boolean;
    // brouillon d’édition (par jour), séparé du brouillon de création
    draft: Record<number, TEDTSlot[]>;
  }>({ open: false, edt: null, edit: false, draft: {1:[],2:[],3:[],4:[],5:[],6:[]} });

  // Accordéon React pour la modale Voir/Modifier
  const [openDaysPreview, setOpenDaysPreview] = React.useState<number[]>([]);
  const toggleDayPreview = (day: number) =>
    setOpenDaysPreview(prev => prev.includes(day) ? prev.filter(d=>d!==day) : [...prev, day]);

  // Chargement
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // matières
        const snapM = await getDocs(query(collection(db, "matieres"), where("class_id", "==", classe.id)));
        const listM: TMatiere[] = [];
        snapM.forEach(d => {
          const v = d.data() as any;
          listM.push({ id: d.id, class_id: v.class_id, libelle: v.libelle, ue_id: v.ue_id ?? null });
        });
        listM.sort((a,b)=>a.libelle.localeCompare(b.libelle));
        setMatieres(listM);

        // edts
        const snapE = await getDocs(query(collection(db, "edts"), where("class_id","==",classe.id)));
        const listE: TEDT[] = [];
        snapE.forEach(d => {
          const v = d.data() as any;
          listE.push({
            id: d.id,
            class_id: v.class_id,
            class_libelle: v.class_libelle,
            annee: v.annee,
            semestre: v.semestre,
            slots: (v.slots ?? []) as TEDTSlot[],
            created_at: v.created_at ?? Date.now(),
            title: v.title ?? undefined,
          });
        });
        listE.sort((a,b)=> (b.created_at ?? 0) - (a.created_at ?? 0));
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
  }, [classe.id]);

  const filtered = React.useMemo(() => {
    return edts.filter(e => e.semestre === selectedSem && e.annee === selectedYear);
  }, [edts, selectedSem, selectedYear]);

  /* ======== Création EDT ======== */
  const addDraftSlot = (day: number) => {
    setDraftSlots(prev => ({
      ...prev,
      [day]: [...prev[day], emptySlot(day)]
    }));
  };
  const removeDraftSlot = (day: number, idx: number) => {
    setDraftSlots(prev => {
      const cp = {...prev};
      cp[day] = cp[day].filter((_,i)=>i!==idx);
      return cp;
    });
  };
  const updateDraftSlot = (day: number, idx: number, patch: Partial<TEDTSlot>) => {
    setDraftSlots(prev => {
      const cp = {...prev};
      cp[day] = cp[day].map((s,i)=> i===idx ? {...s, ...patch} : s);
      return cp;
    });
  };
  const saveEDT = async () => {
    const allSlots = Object.values(draftSlots).flat();
    for (const s of allSlots) {
      if (!s.matiere_id) return ko("Sélectionnez une matière pour chaque ligne.");
      if (!isValidRange(s.start, s.end)) return ko("Vérifiez les horaires (début < fin).");
      s.matiere_libelle = matieres.find(m => m.id === s.matiere_id)?.libelle ?? "";
    }
    try {
      await addDoc(collection(db, "edts"), {
        class_id: classe.id,
        class_libelle: classe.libelle,
        annee: createYear,
        semestre: createSem,
        slots: allSlots,
        created_at: Date.now(),
        title: `EDT ${classe.libelle} - ${createSem} ${createYear}`,
      });
      ok("Emploi du temps créé.");
      setShowCreate(false);
      setDraftSlots({1:[],2:[],3:[],4:[],5:[],6:[]});
      // refresh
      const snapE = await getDocs(query(collection(db, "edts"), where("class_id","==",classe.id)));
      const listE: TEDT[] = [];
      snapE.forEach(d => {
        const v = d.data() as any;
        listE.push({
          id: d.id, class_id: v.class_id, class_libelle: v.class_libelle,
          annee: v.annee, semestre: v.semestre, slots: (v.slots ?? []) as TEDTSlot[],
          created_at: v.created_at ?? Date.now(), title: v.title ?? undefined
        });
      });
      listE.sort((a,b)=> (b.created_at ?? 0) - (a.created_at ?? 0));
      setEdts(listE);
      setSelectedSem(createSem);
      setSelectedYear(createYear);
    } catch (e) {
      console.error(e);
      ko("Impossible d’enregistrer l’EDT.");
    }
  };

  /* ======== Prévisualiser / Modifier un EDT existant ======== */
  const openPreview = (edt: TEDT) => {
    setOpenDaysPreview([1,2,3,4,5,6]); // ouvrir tout par défaut (facilement modifiable)
    setPreview({
      open: true,
      edt,
      edit: false,
      draft: slotsToDraft(edt.slots),
    });
  };

  const closePreview = () => {
    setPreview({ open:false, edt:null, edit:false, draft:{1:[],2:[],3:[],4:[],5:[],6:[]} });
  };

  const toggleEdit = () => {
    setPreview(p => ({ ...p, edit: !p.edit }));
  };

  // édition dans la modale
  const addPreviewSlot = (day: number) => {
    setPreview(p => ({ ...p, draft: { ...p.draft, [day]: [...p.draft[day], emptySlot(day)] }}));
  };
  const removePreviewSlot = (day: number, idx: number) => {
    setPreview(p => {
      const cp = {...p.draft};
      cp[day] = cp[day].filter((_,i)=>i!==idx);
      return { ...p, draft: cp };
    });
  };
  const updatePreviewSlot = (day: number, idx: number, patch: Partial<TEDTSlot>) => {
    setPreview(p => {
      const cp = {...p.draft};
      cp[day] = cp[day].map((s,i)=> i===idx ? {...s, ...patch} : s);
      return { ...p, draft: cp };
    });
  };

  const savePreviewChanges = async () => {
    if (!preview.edt) return;
    const all = Object.values(preview.draft).flat();
    for (const s of all) {
      if (!s.matiere_id) return ko("Sélectionnez une matière pour chaque ligne.");
      if (!isValidRange(s.start, s.end)) return ko("Vérifiez les horaires (début < fin).");
      s.matiere_libelle = matieres.find(m => m.id === s.matiere_id)?.libelle ?? "";
    }
    try {
      await updateDoc(doc(db, "edts", preview.edt.id), { slots: all });
      ok("Emploi du temps mis à jour.");
      // mets à jour l’array edts local
      setEdts(old => old.map(e => e.id === preview.edt!.id ? { ...e, slots: all } : e));
      setPreview(p => ({ ...p, edit:false }));
    } catch (e) {
      console.error(e);
      ko("Mise à jour impossible.");
    }
  };

  const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];

  const openPDF = (edt: TEDT) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const html = renderEDTHtml(ECOLE, filiere.libelle, classe.libelle, edt);
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(()=> w.print(), 250);
  };

  return (
    <div className="d-flex flex-column gap-3">
      {/* EN-TÊTE */}
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h5 className="mb-1">{ECOLE}</h5>
          <div className="text-muted">
            Filière : <strong>{filiere.libelle}</strong> — Classe : <strong>{classe.libelle}</strong>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-end gap-2">
          <div>
            <label className="form-label mb-1">Classe</label>
            <input className="form-control" value={classe.libelle} disabled />
          </div>
          <div>
            <label className="form-label mb-1">Semestre</label>
            <select className="form-select" value={selectedSem} onChange={(e)=>setSelectedSem(e.target.value as TSemestre)}>
              {["S1","S2","S3","S4","S5","S6"].map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Année scolaire</label>
            <select
              className="form-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value as AnneeScolaire)}
            >
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <button className="btn btn-primary ms-2" onClick={()=> setShowCreate(true)}>
            <i className="bi bi-calendar-plus me-2" />
            Créer un emploi du temps
          </button>
        </div>
      </div>

      {/* LISTE COMPACTE */}
      <div className="card border-0">
        <div className="card-body">
          <h6 className="mb-3">Emplois du temps ({selectedSem} — {selectedYear})</h6>

          {loading ? (
            <div className="text-center py-4"><div className="spinner-border" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucun emploi du temps pour ces critères.</div>
          ) : (
            <div className="row g-3">
              {filtered.map(edt => (
                <div className="col-md-4" key={edt.id}>
                  <div className="card h-100 shadow-sm">
                    <div className="card-body d-flex flex-column">
                      <h6 className="mb-1">{edt.title ?? `EDT ${classe.libelle}`}</h6>
                      <small className="text-muted">{classe.libelle} • {edt.semestre} • {edt.annee}</small>
                      <div className="mt-auto d-flex gap-2 pt-2">
                        <button className="btn btn-outline-secondary btn-sm" onClick={()=> openPreview(edt)}>
                          Voir
                        </button>
                        <button className="btn btn-outline-primary btn-sm" onClick={()=> openPDF(edt)}>
                          Télécharger PDF
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
                  <button className="btn-close" onClick={()=> setShowCreate(false)} />
                </div>

                <div className="modal-body">
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <label className="form-label">Classe</label>
                      <input className="form-control" value={classe.libelle} disabled />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label">Semestre</label>
                      <select className="form-select" value={createSem} onChange={(e)=> setCreateSem(e.target.value as TSemestre)}>
                        {["S1","S2","S3","S4","S5","S6"].map(s=> <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Année scolaire</label>
                      <select
                        className="form-select"
                        value={createYear}
                        onChange={(e) => setCreateYear(e.target.value as AnneeScolaire)}
                      >
                        {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Jours → créneaux (création) */}
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
                  <button className="btn btn-outline-secondary" onClick={()=> setShowCreate(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={saveEDT}>Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={()=> setShowCreate(false)} />
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
                    <small className="text-muted">{preview.edt.semestre} • {preview.edt.annee}</small>
                  </div>
                  <div className="d-flex gap-2">
                    {!preview.edit ? (
                      <button className="btn btn-outline-primary" onClick={toggleEdit}>
                        Modifier
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-outline-secondary" onClick={toggleEdit}>Annuler modifs</button>
                        <button className="btn btn-primary" onClick={savePreviewChanges}>Enregistrer</button>
                      </>
                    )}
                    <button className="btn-close" onClick={closePreview} />
                  </div>
                </div>

                <div className="modal-body">
                  {/* Entête établissement */}
                  <div className="d-flex justify-content-between align-items-end mb-3">
                    <div>
                      <strong>{ECOLE}</strong>
                      <div className="text-muted">
                        Filière : <strong>{filiere.libelle}</strong> — Classe : <strong>{classe.libelle}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Affichage par jour */}
                  {preview.edit ? (
                    // Mode édition : mêmes éditeurs que la création, mais basés sur preview.draft
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
                    // Mode lecture seule : tableau par jour
                    renderDayReadonly(preview.edt.slots)
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closePreview} />
        </>
      )}
    </div>
  );
}

/* ======== Helpers locaux au composant ======== */
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
function renderEDTHtml(
  ecole: string,
  filiereLib: string,
  classeLib: string,
  edt: { semestre: string; annee: string; slots: TEDTSlot[] }
): string {
  const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const grouped: Record<number, TEDTSlot[]> = {1:[],2:[],3:[],4:[],5:[],6:[]};
  (edt.slots ?? []).forEach(s => grouped[s.day].push(s));
  Object.values(grouped).forEach(list => list.sort((a,b)=> toMinutes(a.start)-toMinutes(b.start)));

  const rowsPerDay = (d: number) =>
    grouped[d].length === 0
      ? `<tr><td colspan="4" style="color:#666">—</td></tr>`
      : grouped[d].map(s => `
          <tr>
            <td>${formatFR(s.start)} — ${formatFR(s.end)}</td>
            <td>${s.matiere_libelle}</td>
            <td>${s.salle || "—"}</td>
            <td>${s.enseignant || "—"}</td>
          </tr>
        `).join("");

  const tables = days.map((label, i) => `
    <h3 style="margin:12px 0">${label}</h3>
    <table style="width:100%; border-collapse:collapse" border="1" cellpadding="6">
      <thead>
        <tr><th>Heure</th><th>Matière</th><th>Salle</th><th>Enseignant</th></tr>
      </thead>
      <tbody>${rowsPerDay(i+1)}</tbody>
    </table>
  `).join("");

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>EDT ${classeLib} ${edt.semestre} ${edt.annee}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
    h1 { margin: 0 0 6px 0; font-size: 20px; }
    h2 { margin: 0 0 18px 0; font-size: 16px; color:#444; }
    h3 { font-size: 15px; }
    th { background:#f5f5f5; }
  </style>
</head>
<body>
  <h1>${ecole}</h1>
  <h2>Filière : <b>${filiereLib}</b> — Classe : <b>${classeLib}</b> — ${edt.semestre} • ${edt.annee}</h2>
  ${tables}
</body>
</html>`;
}

function slotsToDraft(slots: TEDTSlot[]): Record<number, TEDTSlot[]> {
  const draft: Record<number, TEDTSlot[]> = {1:[],2:[],3:[],4:[],5:[],6:[]};
  for (const s of (slots ?? [])) {
    draft[s.day] = [...draft[s.day], { ...s }];
  }
  // tri par heure
  Object.values(draft).forEach(list => list.sort((a,b)=> toMinutes(a.start) - toMinutes(b.start)));
  return draft;
}

function renderDayReadonly(slots: TEDTSlot[]) {
  const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const grouped: Record<number, TEDTSlot[]> = {1:[],2:[],3:[],4:[],5:[],6:[]};
  (slots ?? []).forEach(s => grouped[s.day].push(s));
  Object.values(grouped).forEach(list => list.sort((a,b)=> toMinutes(a.start)-toMinutes(b.start)));

  return (
    <div className="d-flex flex-column gap-3">
      {Object.entries(grouped).map(([d, list]) => (
        <div className="card" key={d}>
          <div className="card-header fw-semibold">{days[Number(d)-1]}</div>
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
                        <td>{formatFR(s.start)} — {formatFR(s.end)}</td>
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

/** Génère les heures toutes les 30 min entre 08:00 et 22:00 */
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
    total += 30; // pas de 30 minutes
  }
  return res;
}

/** Convertit "HH:MM" -> minutes */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Vérifie que l'intervalle est valide (début < fin) */
function isValidRange(start: string, end: string): boolean {
  return toMinutes(start) < toMinutes(end);
}


/**
 * Editeurs par jour (utilisé en création et en édition dans la modale)
 * - mode "create" : pas d’accordéon, tout est ouvert
 * - mode "edit"   : accordéon controlé par openDays / onToggleDay
 */
function renderDayEditors(args: {
  mode: "create" | "edit";
  draft: Record<number, TEDTSlot[]>;
  matieres: TMatiere[];
  addSlot: (day: number) => void;
  removeSlot: (day: number, idx: number) => void;
  updateSlot: (day: number, idx: number, patch: Partial<TEDTSlot>) => void;
  openDays?: number[];
  onToggleDay?: (day: number) => void;
}) {
  const { mode, draft, matieres, addSlot, removeSlot, updateSlot, openDays = [1,2,3,4,5,6], onToggleDay } = args;
  const days = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  return (
    <div>
      {days.map((label, i) => {
        const day = (i+1) as 1|2|3|4|5|6;
        const slots = draft[day] ?? [];
        const isOpen = openDays.includes(day);
        return (
          <div className="border rounded mb-2" key={day}>
            <button
              type="button"
              className="w-100 text-start btn btn-light d-flex justify-content-between align-items-center"
              onClick={() => (mode === "edit" && onToggleDay) ? onToggleDay(day) : undefined}
              style={{ padding: "10px 14px", cursor: mode==="edit" ? "pointer" : "default" }}
            >
              <span>
                {label} {slots.length ? <span className="text-muted">({slots.length} créneau(x))</span> : null}
              </span>
              {mode === "edit" ? <i className={`bi ${isOpen ? "bi-chevron-up" : "bi-chevron-down"}`} /> : null}
            </button>

            {(mode === "create" || isOpen) && (
              <div className="p-3">
                <div className="d-flex justify-content-end mb-2">
                  <button className="btn btn-outline-primary btn-sm" onClick={()=> addSlot(day)}>
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
                          <th style={{minWidth: 220}}>Matière</th>
                          <th>Début</th>
                          <th>Fin</th>
                          <th>Salle</th>
                          <th>Enseignant</th>
                          <th style={{width: 80}}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slots.map((s, idx) => (
                          <tr key={idx}>
                            <td>
                              <select
                                className="form-select"
                                value={s.matiere_id}
                                onChange={(e)=> updateSlot(day, idx, { matiere_id: e.target.value })}
                              >
                                <option value="">— Choisir —</option>
                                {matieres.map(m => <option key={m.id} value={m.id}>{m.libelle}</option>)}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={s.start}
                                onChange={(e)=> updateSlot(day, idx, { start: e.target.value })}
                              >
                                {halfHours().map(h => <option key={h} value={h}>{formatFR(h)}</option>)}
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select"
                                value={s.end}
                                onChange={(e)=> updateSlot(day, idx, { end: e.target.value })}
                              >
                                {halfHours().map(h => <option key={h} value={h}>{formatFR(h)}</option>)}
                              </select>
                            </td>
                            <td>
                              <input
                                className="form-control"
                                value={s.salle}
                                onChange={(e)=> updateSlot(day, idx, { salle: e.target.value })}
                                placeholder="Ex: A102"
                              />
                            </td>
                            <td>
                              <input
                                className="form-control"
                                value={s.enseignant}
                                onChange={(e)=> updateSlot(day, idx, { enseignant: e.target.value })}
                                placeholder="Nom enseignant"
                              />
                            </td>
                            <td>
                              <button className="btn btn-outline-danger btn-sm" onClick={()=> removeSlot(day, idx)}>
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
