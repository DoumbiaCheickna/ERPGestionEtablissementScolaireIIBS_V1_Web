// src/app/directeur-des-etudes/components/EtudiantsPage.tsx
"use client";

import React from "react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  doc,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import Toast from "../../admin/components/ui/Toast";
import EtudiantForm from "../../admin/pages/users/etudiantForm";

/** ======== Années scolaires ======== */
type AnneeScolaire = "2024-2025" | "2025-2026";
const ANNEES: AnneeScolaire[] = ["2024-2025", "2025-2026"];

/** ======== Types ======== */
type TClasse = {
  id: string;
  libelle: string;
  filiere_libelle?: string;
  niveau?: string;
  filiere_id?: string;
  niveau_id?: string;
};
type TUser = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  role_id?: string;
};

type View =
  | { type: "cards" }
  | { type: "classe"; classe: TClasse }
  | { type: "fiche"; student: TUser; classe: TClasse };

/** (Optionnel) désactivation de la nav secondaire */
function useDisableVerticalNav2() {
  React.useEffect(() => {
    document.body.setAttribute("data-nav2-disabled", "true");
    return () => document.body.removeAttribute("data-nav2-disabled");
  }, []);
}

export default function EtudiantsPage() {
  useDisableVerticalNav2();

  const [annee, setAnnee] = React.useState<AnneeScolaire>("2024-2025");
  const [classes, setClasses] = React.useState<TClasse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState<View>({ type: "cards" });

  // toasts
  const [toastMsg, setToastMsg] = React.useState("");
  const [sok, setSOk] = React.useState(false);
  const [serr, setSErr] = React.useState(false);
  const ok = (m: string) => {
    setToastMsg(m);
    setSOk(true);
  };
  const ko = (m: string) => {
    setToastMsg(m);
    setSErr(true);
  };

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "classes"));
        const rows: TClasse[] = [];
        snap.forEach((d) => {
          const v = d.data() as any;
          rows.push({
            id: d.id,
            libelle: v.libelle,
            filiere_libelle: v.filiere_libelle ?? "",
            niveau: v.niveau ?? "",
            filiere_id: v.filiere_id,
            niveau_id: v.niveau_id,
          });
        });
        rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
        setClasses(rows);
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement des classes.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="container-fluid py-3">
      {/* En-tête */}
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-3">
        <div>
          <h3 className="mb-1">Étudiants</h3>
          <div className="text-muted">Gestion des inscriptions / réinscriptions</div>
        </div>
        <div className="d-flex align-items-end gap-2">
          <div>
            <label className="form-label mb-1">Année scolaire</label>
            <select
              className="form-select"
              value={annee}
              onChange={(e) => setAnnee(e.target.value as AnneeScolaire)}
            >
              {ANNEES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Routing interne */}
      {view.type === "cards" && (
        <ClassesCards
          classes={classes}
          loading={loading}
          annee={annee}
          onOpen={(c) => setView({ type: "classe", classe: c })}
        />
      )}

      {view.type === "classe" && (
        <ClasseStudents
          annee={annee}
          classe={view.classe}
          onBack={() => setView({ type: "cards" })}
          onOpenFiche={(student) =>
            setView({ type: "fiche", student, classe: view.classe })
          }
          ok={ok}
          ko={ko}
        />
      )}

      {view.type === "fiche" && (
        <StudentFiche
          student={view.student}
          annee={annee}
          classe={view.classe}
          onBack={() => setView({ type: "classe", classe: view.classe })}
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

/* ======================= Cartes des classes ======================= */
function ClassesCards({
  classes,
  loading,
  annee,
  onOpen,
}: {
  classes: TClasse[];
  loading: boolean;
  annee: AnneeScolaire;
  onOpen: (c: TClasse) => void;
}) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <h5 className="mb-3">Classes — {annee}</h5>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" />
          </div>
        ) : classes.length === 0 ? (
          <div className="text-muted">Aucune classe.</div>
        ) : (
          <div className="row g-3">
            {classes.map((c) => (
              <div className="col-md-4" key={c.id}>
                <div className="card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <h5 className="mb-1">{c.libelle}</h5>
                    <small className="text-muted">
                      {c.niveau ? `${c.niveau} • ` : ""}
                      {c.filiere_libelle || ""}
                    </small>
                    <div className="mt-auto pt-2">
                      <button className="btn btn-outline-secondary" onClick={() => onOpen(c)}>
                        Ouvrir la liste
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
  );
}

/* ======================= Liste des étudiants d’une classe (via inscriptions) ======================= */
function ClasseStudents({
  annee,
  classe,
  onBack,
  onOpenFiche,
  ok,
  ko,
}: {
  annee: AnneeScolaire;
  classe: TClasse;
  onBack: () => void;
  onOpenFiche: (u: TUser) => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<(TUser & { inscription_id: string })[]>([]);
  const [showCreateEnroll, setShowCreateEnroll] = React.useState(false);
  const [reinscrireFor, setReinscrireFor] = React.useState<TUser | null>(null);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      const qy = query(
        collection(db, "inscriptions"),
        where("class_id", "==", classe.id),
        where("annee", "==", annee),
        where("statut", "==", "actif")
      );
      const snap = await getDocs(qy);

      const users: (TUser & { inscription_id: string })[] = [];
      for (const d of snap.docs) {
        const ins = d.data() as any;
        const usnap = await getDoc(doc(db, "users", ins.student_id));
        if (usnap.exists()) {
          const u = usnap.data() as any;
          users.push({
            inscription_id: d.id,
            id: usnap.id,
            nom: u.nom ?? "",
            prenom: u.prenom ?? "",
            email: u.email ?? "",
            telephone: u.telephone ?? "",
            role_id: u.role_id,
          });
        }
      }
      users.sort((a, b) => a.nom.localeCompare(b.nom));
      setRows(users);
    } catch (e) {
      console.error(e);
      ko("Erreur de chargement des étudiants.");
    } finally {
      setLoading(false);
    }
  }, [annee, classe.id, ko]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const retirerEtudiant = async (inscription_id: string) => {
    if (!confirm("Retirer cet étudiant de la classe ?")) return;
    try {
      await updateDoc(doc(db, "inscriptions", inscription_id), { statut: "retire" });
      ok("Étudiant retiré.");
      fetchRows();
    } catch (e) {
      console.error(e);
      ko("Impossible de retirer l’étudiant.");
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <button className="btn btn-link px-0 me-2" onClick={onBack}>
              <i className="bi bi-arrow-left" /> Retour aux classes
            </button>
            <h4 className="mb-1">{classe.libelle}</h4>
            <div className="text-muted">{annee}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateEnroll(true)}>
            <i className="bi bi-person-plus me-2" />
            Inscrire un étudiant
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted">Aucun étudiant inscrit pour {annee}.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th style={{ width: 260 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td className="fw-semibold">{u.nom}</td>
                    <td>{u.prenom}</td>
                    <td>{u.email}</td>
                    <td>{u.telephone || "—"}</td>
                    <td className="d-flex gap-2">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => onOpenFiche(u)}
                      >
                        Voir
                      </button>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setReinscrireFor(u)}
                      >
                        Réinscrire
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => retirerEtudiant(u.inscription_id)}
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Créer + inscrire */}
      {showCreateEnroll && (
        <CreateAndEnrollModal
          annee={annee}
          classe={classe}
          onClose={() => setShowCreateEnroll(false)}
          onDone={() => {
            setShowCreateEnroll(false);
            fetchRows();
          }}
          ok={ok}
          ko={ko}
        />
      )}

      {/* Modal: Réinscrire */}
      {reinscrireFor && (
        <ReinscrireModal
          student={reinscrireFor}
          anneeCourante={annee}
          onClose={() => setReinscrireFor(null)}
          onDone={() => {
            setReinscrireFor(null);
            fetchRows();
          }}
          ok={ok}
          ko={ko}
        />
      )}
    </div>
  );
}

/* ======================= Fiche étudiant ======================= */
function StudentFiche({
  student,
  annee,
  classe,
  onBack,
  ok,
  ko,
}: {
  student: TUser;
  annee: AnneeScolaire;
  classe: TClasse;
  onBack: () => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [details, setDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", student.id));
        setDetails(snap.exists() ? snap.data() : {});
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement de la fiche.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [student.id, ko]);

  const save = async () => {
    try {
      await updateDoc(doc(db, "users", student.id), details);
      ok("Fiche mise à jour.");
    } catch (e) {
      console.error(e);
      ko("Impossible de sauvegarder.");
    }
  };

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <button className="btn btn-link px-0 me-2" onClick={onBack}>
              <i className="bi bi-arrow-left" /> Retour à la liste
            </button>
            <h4 className="mb-1">
              {student.prenom} {student.nom}
            </h4>
            <div className="text-muted">
              {classe.libelle} — {annee}
            </div>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={save}>
              Modifier
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" />
          </div>
        ) : (
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                value={details.email || ""}
                onChange={(e) => setDetails({ ...details, email: e.target.value })}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Téléphone</label>
              <input
                className="form-control"
                value={details.telephone || ""}
                onChange={(e) => setDetails({ ...details, telephone: e.target.value })}
              />
            </div>
            {/* Ajoute d’autres champs si nécessaire */}
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================= Modal: créer + inscrire ======================= */
function CreateAndEnrollModal({
  annee,
  classe,
  onClose,
  onDone,
  ok,
  ko,
}: {
  annee: AnneeScolaire;
  classe: TClasse;
  onClose: () => void;
  onDone: () => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [roles, setRoles] = React.useState<{ id: string; libelle: string }[]>([]);
  const [niveaux, setNiveaux] = React.useState<{ id: string; libelle: string }[]>([]);
  const [filieres, setFilieres] = React.useState<{ id: string; libelle: string }[]>(
    []
  );
  const [partenaires, setPartenaires] = React.useState<
    { id: string; libelle: string }[]
  >([]);

  React.useEffect(() => {
    (async () => {
      try {
        const r = await getDocs(collection(db, "roles"));
        setRoles(r.docs.map((d) => ({ id: d.id, libelle: (d.data() as any).libelle })));

        const n = await getDocs(collection(db, "niveaux"));
        setNiveaux(
          n.docs.map((d) => ({ id: d.id, libelle: (d.data() as any).libelle }))
        );

        const f = await getDocs(collection(db, "filieres"));
        setFilieres(
          f.docs.map((d) => ({ id: d.id, libelle: (d.data() as any).libelle }))
        );

        const p = await getDocs(collection(db, "partenaires"));
        setPartenaires(
          p.docs.map((d) => ({ id: d.id, libelle: (d.data() as any).libelle }))
        );
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement des données du formulaire.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ko]);

  const handleCreated = async (userId: string) => {
    try {
      const exist = await getDocs(
        query(
          collection(db, "inscriptions"),
          where("student_id", "==", userId),
          where("annee", "==", annee),
          where("class_id", "==", classe.id),
          where("statut", "==", "actif")
        )
      );
      if (!exist.empty) {
        ok("Étudiant déjà inscrit pour cette année dans cette classe.");
        onDone();
        return;
      }

      await addDoc(collection(db, "inscriptions"), {
        student_id: userId,
        class_id: classe.id,
        annee,
        statut: "actif",
        created_at: Date.now(),
      });

      ok("Étudiant créé et inscrit.");
      onDone();
    } catch (e) {
      console.error(e);
      ko("Étudiant créé, mais inscription impossible.");
    }
  };

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">Inscrire un étudiant</h5>
                <small className="text-muted">
                  {classe.libelle} • {annee}
                </small>
              </div>
              <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border" />
                </div>
              ) : (
                <EtudiantForm
                  roles={roles}
                  niveaux={niveaux}
                  filieres={filieres}
                  partenaires={partenaires}
                  showSuccessToast={ok}
                  showErrorToast={ko}
                  fetchData={async () => {}}
                  onCreated={handleCreated}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}

/* ======================= Modal: réinscription (par étudiant) ======================= */
function ReinscrireModal({
  student,
  anneeCourante,
  onClose,
  onDone,
  ok,
  ko,
}: {
  student: TUser;
  anneeCourante: AnneeScolaire;
  onClose: () => void;
  onDone: () => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const [classes, setClasses] = React.useState<TClasse[]>([]);
  const [annee, setAnnee] = React.useState<AnneeScolaire>(anneeCourante);
  const [classId, setClassId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const csnap = await getDocs(collection(db, "classes"));
        const cls: TClasse[] = [];
        csnap.forEach((d) => {
          const v = d.data() as any;
          cls.push({
            id: d.id,
            libelle: v.libelle,
            filiere_libelle: v.filiere_libelle,
            niveau: v.niveau,
          });
        });
        cls.sort((a, b) => a.libelle.localeCompare(b.libelle));
        setClasses(cls);
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement des classes.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ko]);

  const valider = async () => {
    if (!classId) return ko("Sélectionnez une classe.");
    try {
      const exist = await getDocs(
        query(
          collection(db, "inscriptions"),
          where("student_id", "==", student.id),
          where("annee", "==", annee),
          where("class_id", "==", classId),
          where("statut", "==", "actif")
        )
      );
      if (!exist.empty) return ko("Déjà inscrit dans cette classe pour cette année.");

      await addDoc(collection(db, "inscriptions"), {
        student_id: student.id,
        class_id: classId,
        annee,
        statut: "actif",
        created_at: Date.now(),
      });

      ok("Réinscription enregistrée.");
      onDone();
    } catch (e) {
      console.error(e);
      ko("Impossible d’enregistrer la réinscription.");
    }
  };

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">
                  Réinscrire {student.prenom} {student.nom}
                </h5>
              </div>
              <button className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border" />
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Année scolaire</label>
                    <select
                      className="form-select"
                      value={annee}
                      onChange={(e) => setAnnee(e.target.value as AnneeScolaire)}
                    >
                      {ANNEES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Classe</label>
                    <select
                      className="form-select"
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      <option value="">— Sélectionner —</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.libelle}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <small className="text-muted">
                      Une nouvelle inscription est créée. Les années antérieures restent inchangées
                      (historique conservé).
                    </small>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={valider}>
                Valider
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}
