// src/app/directeur-des-etudes/components/EtudiantsPage.tsx
"use client";

import React from "react";
import {
  collection,
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
  // On tentera de lire ces champs dans le doc de classe si disponibles
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
  | { type: "cards" } // cartes des classes
  | { type: "classe"; classe: TClasse } // liste d'une classe
  | { type: "fiche"; student: TUser; classe: TClasse }; // fiche étudiant

/** (Optionnel) désactivation de la nav secondaire si nécessaire */
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
          <div className="text-muted">Gestion des étudiants par classe</div>
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
      <Toast
        message={toastMsg}
        type="success"
        show={sok}
        onClose={() => setSOk(false)}
      />
      <Toast
        message={toastMsg}
        type="error"
        show={serr}
        onClose={() => setSErr(false)}
      />
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
                      <button
                        className="btn btn-outline-secondary"
                        onClick={() => onOpen(c)}
                      >
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

/* ======================= Liste des étudiants d’une classe ======================= */
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
  const [rows, setRows] = React.useState<TUser[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);

  const fetchRows = React.useCallback(async () => {
    setLoading(true);
    try {
      // 1) Cherche par ID de classe (nouvelle donnée)
      const qById = query(
        collection(db, "users"),
        where("role_libelle", "==", "Etudiant"),
        where("classe_id", "==", classe.id),
        where("annee_academique", "==", annee)
      );
      let snap = await getDocs(qById);

      // 2) Fallback : anciens users qui stockent le libellé au lieu de l'id
      if (snap.empty) {
        const qByLabel = query(
          collection(db, "users"),
          where("role_libelle", "==", "Etudiant"),
          where("classe", "==", classe.libelle),
          where("annee_academique", "==", annee)
        );
        snap = await getDocs(qByLabel);
      }

      const users: TUser[] = snap.docs.map((d) => {
        const u = d.data() as any;
        return {
          id: d.id,
          nom: u.nom ?? "",
          prenom: u.prenom ?? "",
          email: u.email ?? "",
          telephone: u.telephone ?? "",
          role_id: u.role_id,
        };
      });

      users.sort((a, b) => a.nom.localeCompare(b.nom));
      setRows(users);
    } catch (e) {
      console.error(e);
      ko("Erreur de chargement des étudiants.");
    } finally {
      setLoading(false);
    }
  }, [annee, classe.id, classe.libelle, ko]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Retirer = enlever la classe du user
  const retirerEtudiant = async (userId: string) => {
    if (!confirm("Retirer cet étudiant de la classe ?")) return;
    try {
      await updateDoc(doc(db, "users", userId), {
        classe_id: "",
        classe: "",
      });
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
          <button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
          >
            <i className="bi bi-person-plus me-2" />
            Créer un étudiant
          </button>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-muted">Aucun étudiant pour {annee}.</div>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nom</th>
                  <th>Prénom</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th style={{ width: 220 }}>Actions</th>
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
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => retirerEtudiant(u.id)}
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

      {/* Modal: Créer (formulaire complet) */}
      {showCreate && (
        <CreateStudentModal
          annee={annee}
          classe={classe}
          onClose={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false); // ferme le modal
            fetchRows();          // refresh la liste
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
                onChange={(e) =>
                  setDetails({ ...details, email: e.target.value })
                }
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Téléphone</label>
              <input
                className="form-control"
                value={details.telephone || ""}
                onChange={(e) =>
                  setDetails({ ...details, telephone: e.target.value })
                }
              />
            </div>
            {/* Ajoutez d’autres champs au besoin */}
          </div>
        )}
      </div>
    </div>
  );
}

/* ======================= Modal: créer (sans inscriptions) ======================= */
function CreateStudentModal({
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
  const [roles, setRoles] = React.useState<{ id: string; libelle: string }[]>(
    []
  );
  const [niveaux, setNiveaux] = React.useState<{ id: string; libelle: string }[]>(
    []
  );
  const [filieres, setFilieres] = React.useState<
    { id: string; libelle: string }[]
  >([]);
  const [partenaires, setPartenaires] = React.useState<
    { id: string; libelle: string }[]
  >([]);
  const [classeMeta, setClasseMeta] = React.useState<{
    niveau_id?: string;
    filiere_id?: string;
  }>({});

  React.useEffect(() => {
    (async () => {
      try {
        // rôles
        const r = await getDocs(collection(db, "roles"));
        const R: { id: string; libelle: string }[] = [];
        r.forEach((d) => R.push({ id: d.id, libelle: (d.data() as any).libelle }));
        setRoles(R);

        // niveaux
        const n = await getDocs(collection(db, "niveaux"));
        const N: { id: string; libelle: string }[] = [];
        n.forEach((d) => N.push({ id: d.id, libelle: (d.data() as any).libelle }));
        setNiveaux(N);

        // filières
        const f = await getDocs(collection(db, "filieres"));
        const F: { id: string; libelle: string }[] = [];
        f.forEach((d) => F.push({ id: d.id, libelle: (d.data() as any).libelle }));
        setFilieres(F);

        // partenaires (bourses)
        const p = await getDocs(collection(db, "partenaires"));
        const P: { id: string; libelle: string }[] = [];
        p.forEach((d) => P.push({ id: d.id, libelle: (d.data() as any).libelle }));
        setPartenaires(P);

        // récupérer niveau_id / filiere_id réels de la classe si dispo
        const csnap = await getDoc(doc(db, "classes", classe.id));
        if (csnap.exists()) {
          const v = csnap.data() as any;
          setClasseMeta({
            niveau_id: v.niveau_id,
            filiere_id: v.filiere_id,
          });
        }
      } catch (e) {
        console.error(e);
        ko("Erreur de chargement des données du formulaire.");
      } finally {
        setLoading(false);
      }
    })();
  }, [classe.id, ko]);

  // Quand l’étudiant est créé dans EtudiantForm, on le rattache
  const handleCreated = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        // on force le rattachement à la classe ouverte
        classe_id: classe.id,
        classe: classe.libelle,
        annee_academique: annee,
        // si la classe possède ces ids, on les pose aussi
        ...(classeMeta.niveau_id ? { niveau_id: classeMeta.niveau_id } : {}),
        ...(classeMeta.filiere_id ? { filiere_id: classeMeta.filiere_id } : {}),
      });
      ok("Étudiant créé et rattaché à la classe.");
      onDone(); // ferme + refresh
    } catch (e) {
      console.error(e);
      ko("Étudiant créé, mais rattachement à la classe impossible.");
    }
  };

  return (
    <>
      <div className="modal fade show" style={{ display: "block" }}>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">Créer un étudiant</h5>
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
