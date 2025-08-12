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
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import Toast from "../../admin/components/ui/Toast";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type TRole = { id: string | number; libelle: string };
type TMatiere = { id: string; libelle: string };
type TUserRow = {
  id?: number;
  docId: string;
  nom: string;
  prenom: string;
  specialite?: string;
  specialty?: string;
  role_id?: string | number;
  role_libelle?: string;
};

/* ------------------------------------------------------------------ */
/* Page: Professeurs                                                  */
/* ------------------------------------------------------------------ */
export default function ProfessorsPage() {
  const [roles, setRoles] = useState<TRole[]>([]);
  const [matieres, setMatieres] = useState<TMatiere[]>([]);
  const [list, setList] = useState<TUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI: toasts
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // UI: formulaire visible ?
  const [showForm, setShowForm] = useState(false);

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
      // Pas bloquant si la collection n'existe pas encore
      setMatieres([]);
    }
  };

  const fetchProfessors = async () => {
    setLoading(true);
    try {
      // on essaye d'abord via role_libelle == 'Professeur'
      let snap = await getDocs(
        query(collection(db, "users"), where("role_libelle", "==", "Professeur"))
      );

      // si vide, on retente via role_id
      if (snap.empty) {
        const profRole = roles.find((r) => r.libelle === "Professeur");
        if (profRole) {
          snap = await getDocs(
            query(
              collection(db, "users"),
              where("role_id", "==", (profRole.id as any) ?? "")
            )
          );
        } else {
          // sinon on prend tout et on filtrera
          snap = await getDocs(collection(db, "users"));
        }
      }

      const rows: TUserRow[] = [];
      snap.forEach((d) => {
        const data = d.data() as DocumentData;
        rows.push({
          docId: d.id,
          id: data.id,
          nom: data.nom || "",
          prenom: data.prenom || "",
          specialite: data.specialite || data.specialty || "",
          role_id: data.role_id,
          role_libelle: data.role_libelle,
        });
      });

      // Filtre de secours si on a dû tout récupérer
      const final = rows.filter((r) => {
        if (r.role_libelle) return r.role_libelle === "Professeur";
        const pr = roles.find((x) => x.libelle === "Professeur");
        if (!pr) return true; // si on ne connaît pas le rôle, on affiche tout (au pire)
        return String(r.role_id ?? "") === String(pr.id ?? "");
      });

      setList(final);
    } catch (e) {
      console.error(e);
      showErrorToast("Erreur lors du chargement des professeurs.");
    } finally {
      setLoading(false);
    }
  };

  const fetchAll = async () => {
    await Promise.all([fetchRoles(), fetchMatieres()]);
    await fetchProfessors();
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quand les rôles arrivent après coup, on relance la liste pr un tri correct
  useEffect(() => {
    if (roles.length) fetchProfessors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.length]);

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Professeurs</h3>
          <div className="text-muted">
            Ajoutez et gérez les professeurs de l’établissement.
          </div>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary"
            onClick={() => setShowForm((s) => !s)}
          >
            <i className="bi bi-plus-lg me-2" />
            {showForm ? "Fermer le formulaire" : "Ajouter Professeur"}
          </button>
        </div>
      </div>

      {/* Formulaire complet (comme admin) */}
      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <TeacherForm
              roles={roles as any}
              matieres={matieres}
              showSuccessToast={showSuccessToast}
              showErrorToast={showErrorToast}
              fetchData={async () => {
                await fetchProfessors();
              }}
            />
          </div>
        </div>
      )}

      {/* Liste courte pour vérif d’ajout */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold">
              <i className="bi bi-people me-2" />
              Liste des professeurs
            </h5>
            <span className="badge bg-light text-dark">
              {loading ? "Chargement…" : `${list.length} résultat(s)`}
            </span>
          </div>
        </div>
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
              <div className="text-muted mt-2">Chargement…</div>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-5 text-muted">
              Aucun professeur pour le moment.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Spécialité</th>
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.docId}>
                      <td className="fw-semibold">{u.nom}</td>
                      <td>{u.prenom}</td>
                      <td>{u.specialite || "-"}</td>
                      <td>
                        <button className="btn btn-outline-secondary btn-sm" disabled>
                          Voir plus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

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
/* Formulaire complet (copie admin + select rôle)                     */
/* ------------------------------------------------------------------ */
function TeacherForm({
  roles,
  matieres,
  showSuccessToast,
  showErrorToast,
  fetchData,
}: {
  roles: { id: string | number; libelle: string }[];
  matieres: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}) {
  const [teacherForm, setTeacherForm] = useState({
    email: "",
    login: "",
    nom: "",
    prenom: "",
    password: "",
    role_id: "",
    first_login: "1",
    specialty: "",
    specialite: "",
    date_naissance: "",
    lieu_naissance: "",
    nationalite: "",
    sexe: "",
    situation_matrimoniale: "",
    cni_passeport: "",
    adresse: "",
    telephone: "",
    statut: "",
    fonction_principale: "",
    disponibilite: "",
    matieres_enseignees: [] as string[],
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
    domaines_specialisation: [""],
    formation_pedagogique: "",
    niveaux_enseignement: [""],
    langues_enseignement: [""],
    experiences_professionnelles: [
      {
        etablissements: [""],
        duree: "",
      },
    ],
    competences: {
      outils: [""],
      langues: [""],
      publications: [""],
    },
    documents: {
      cv: null as File | null,
      diplomes: null as File | null,
      piece_identite: null as File | null,
    },
  });

  const uploadFile = async (file: File): Promise<string> => {
    // branchement futur sur Firebase Storage si besoin
    return `https://example.com/uploads/${file.name}`;
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof teacherForm.documents
  ) => {
    if (e.target.files && e.target.files[0]) {
      setTeacherForm((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [field]: e.target.files![0],
        },
      }));
    }
  };

  const handleAddArrayItem = (field: string) => {
    const value = (teacherForm as any)[field];
    if (Array.isArray(value)) {
      setTeacherForm((prev) => ({
        ...prev,
        [field]: [...value, ""],
      }));
    }
  };
  const handleRemoveArrayItem = (field: string, index: number) => {
    const value = (teacherForm as any)[field];
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray.splice(index, 1);
      setTeacherForm((prev) => ({ ...prev, [field]: newArray }));
    }
  };
  const handleArrayItemChange = (
    field: string,
    index: number,
    value: string
  ) => {
    const fieldValue = (teacherForm as any)[field];
    if (Array.isArray(fieldValue)) {
      const newArray = [...fieldValue];
      newArray[index] = value;
      setTeacherForm((prev) => ({ ...prev, [field]: newArray }));
    }
  };

  const handleAddDiplome = () => {
    setTeacherForm((prev) => ({
      ...prev,
      diplomes: [
        ...prev.diplomes,
        { intitule: "", niveau: "", annee: "", etablissement: "" },
      ],
    }));
  };
  const handleRemoveDiplome = (index: number) => {
    const newDiplomes = [...teacherForm.diplomes];
    newDiplomes.splice(index, 1);
    setTeacherForm((prev) => ({ ...prev, diplomes: newDiplomes }));
  };
  const handleDiplomeChange = (index: number, field: string, value: string) => {
    const newDiplomes = [...teacherForm.diplomes];
    newDiplomes[index] = { ...newDiplomes[index], [field]: value };
    setTeacherForm((prev) => ({ ...prev, diplomes: newDiplomes }));
  };

  const handleAddExperience = () => {
    setTeacherForm((prev) => ({
      ...prev,
      experiences_professionnelles: [
        ...prev.experiences_professionnelles,
        { etablissements: [""], duree: "" },
      ],
    }));
  };
  const handleRemoveExperience = (index: number) => {
    const arr = [...teacherForm.experiences_professionnelles];
    arr.splice(index, 1);
    setTeacherForm((prev) => ({ ...prev, experiences_professionnelles: arr }));
  };
  const handleExperienceChange = (
    index: number,
    field: string,
    value: string | string[]
  ) => {
    const arr = [...teacherForm.experiences_professionnelles];
    (arr[index] as any)[field] = value;
    setTeacherForm((prev) => ({ ...prev, experiences_professionnelles: arr }));
  };

  const handleCompetenceChange = (
    category: "outils" | "langues" | "publications",
    index: number,
    value: string
  ) => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category][index] = value;
    setTeacherForm((prev) => ({ ...prev, competences: newCompetences }));
  };
  const handleAddCompetence = (category: "outils" | "langues" | "publications") => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category].push("");
    setTeacherForm((prev) => ({ ...prev, competences: newCompetences }));
  };
  const handleRemoveCompetence = (
    category: "outils" | "langues" | "publications",
    index: number
  ) => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category].splice(index, 1);
    setTeacherForm((prev) => ({ ...prev, competences: newCompetences }));
  };

  const selectedRoleLabel = useMemo(() => {
    const r = roles.find((x) => String(x.id) === String(teacherForm.role_id));
    return r?.libelle ?? "";
  }, [teacherForm.role_id, roles]);

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Champs requis
      if (
        !teacherForm.nom ||
        !teacherForm.prenom ||
        !teacherForm.email ||
        !teacherForm.login ||
        !teacherForm.password ||
        !teacherForm.specialty
      ) {
        showErrorToast("Veuillez remplir tous les champs obligatoires");
        return;
      }
      if (!teacherForm.role_id) {
        showErrorToast("Veuillez sélectionner un rôle");
        return;
      }

      const roleObj = roles.find(
        (r) => String(r.id) === String(teacherForm.role_id)
      );
      if (!roleObj) {
        showErrorToast("Rôle sélectionné introuvable");
        return;
      }

      // Si rôle Professeur → au moins 1 matière
      if (
        roleObj.libelle === "Professeur" &&
        teacherForm.matieres_enseignees.length === 0
      ) {
        showErrorToast("Veuillez sélectionner au moins une matière");
        return;
      }

      const fileUrls = {
        cv: teacherForm.documents.cv
          ? await uploadFile(teacherForm.documents.cv)
          : null,
        diplomes: teacherForm.documents.diplomes
          ? await uploadFile(teacherForm.documents.diplomes)
          : null,
        piece_identite: teacherForm.documents.piece_identite
          ? await uploadFile(teacherForm.documents.piece_identite)
          : null,
      };

      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      await addDoc(collection(db, "users"), {
        ...teacherForm,
        id: newUserId,
        role_id: roleObj.id,
        role_libelle: roleObj.libelle, // utile pour les redirections
        documents: fileUrls,
      });

      showSuccessToast("Professeur ajouté avec succès !");
      // reset
      setTeacherForm({
        email: "",
        login: "",
        nom: "",
        prenom: "",
        password: "",
        role_id: "",
        first_login: "1",
        specialty: "",
        specialite: "",
        date_naissance: "",
        lieu_naissance: "",
        nationalite: "",
        sexe: "",
        situation_matrimoniale: "",
        cni_passeport: "",
        adresse: "",
        telephone: "",
        statut: "",
        fonction_principale: "",
        disponibilite: "",
        matieres_enseignees: [],
        experience_enseignement: { annees: 0, etablissements: [""] },
        diplomes: [
          { intitule: "", niveau: "", annee: "", etablissement: "" },
        ],
        domaines_specialisation: [""],
        formation_pedagogique: "",
        niveaux_enseignement: [""],
        langues_enseignement: [""],
        experiences_professionnelles: [{ etablissements: [""], duree: "" }],
        competences: { outils: [""], langues: [""], publications: [""] },
        documents: { cv: null, diplomes: null, piece_identite: null },
      });

      await fetchData();
    } catch (error) {
      console.error("Erreur lors de l'ajout du professeur:", error);
      showErrorToast("Erreur lors de l'ajout du professeur");
    }
  };

  return (
    <form onSubmit={handleTeacherSubmit}>
      <div className="row g-3">
        {/* Sélection du rôle */}
        <div className="col-12">
          <label className="form-label">Rôle*</label>
          <select
            className="form-select"
            value={teacherForm.role_id}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, role_id: e.target.value })
            }
            required
          >
            <option value="">Sélectionner un rôle</option>
            {roles.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {r.libelle}
              </option>
            ))}
          </select>
        </div>

        {/* Informations de base */}
        <div className="col-12">
          <h5 className="fw-bold">Informations de base</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Prénom*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.prenom}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, prenom: e.target.value })
            }
            required
            placeholder="Entrez le prénom"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.nom}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, nom: e.target.value })
            }
            required
            placeholder="Entrez le nom"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Email*</label>
          <input
            type="email"
            className="form-control"
            value={teacherForm.email}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, email: e.target.value })
            }
            required
            placeholder="exemple@email.com"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom d’utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.login}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, login: e.target.value })
            }
            required
            placeholder="Nom d'utilisateur unique"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mot de passe*</label>
          <input
            type="password"
            className="form-control"
            value={teacherForm.password}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, password: e.target.value })
            }
            required
            placeholder="Mot de passe sécurisé"
            minLength={6}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Spécialité*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.specialty}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, specialty: e.target.value })
            }
            required
            placeholder="Spécialité du professeur"
          />
        </div>
        <div className="col-md-12">
          <label className="form-label">Spécialité détaillée</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.specialite}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, specialite: e.target.value })
            }
            placeholder="Ex: Développeur/Developpeuse FullStack"
          />
        </div>

        {/* Informations personnelles */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Informations personnelles</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Date de naissance</label>
          <input
            type="date"
            className="form-control"
            value={teacherForm.date_naissance}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, date_naissance: e.target.value })
            }
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lieu de naissance</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.lieu_naissance}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, lieu_naissance: e.target.value })
            }
            placeholder="Lieu de naissance"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nationalité</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.nationalite}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, nationalite: e.target.value })
            }
            placeholder="Nationalité"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Sexe</label>
          <select
            className="form-select"
            value={teacherForm.sexe}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, sexe: e.target.value })
            }
          >
            <option value="">Sélectionner</option>
            <option value="Masculin">Masculin</option>
            <option value="Féminin">Féminin</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Situation matrimoniale</label>
          <select
            className="form-select"
            value={teacherForm.situation_matrimoniale}
            onChange={(e) =>
              setTeacherForm({
                ...teacherForm,
                situation_matrimoniale: e.target.value,
              })
            }
          >
            <option value="">Sélectionner</option>
            <option value="Célibataire">Célibataire</option>
            <option value="Marié(e)">Marié(e)</option>
            <option value="Divorcé(e)">Divorcé(e)</option>
            <option value="Veuf(ve)">Veuf(ve)</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">CNI/Passeport</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.cni_passeport}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, cni_passeport: e.target.value })
            }
            placeholder="Numéro CNI/Passeport"
          />
        </div>

        {/* Contact */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Informations de contact</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Adresse</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.adresse}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, adresse: e.target.value })
            }
            placeholder="Adresse complète"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={teacherForm.telephone}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, telephone: e.target.value })
            }
            placeholder="Numéro de téléphone"
          />
        </div>

        {/* Situation professionnelle */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Situation professionnelle</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Statut</label>
          <select
            className="form-select"
            value={teacherForm.statut}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, statut: e.target.value })
            }
          >
            <option value="">Sélectionner</option>
            <option value="Vacataire">Vacataire</option>
            <option value="Permanent">Permanent</option>
            <option value="Temps partiel">Temps partiel</option>
            <option value="Temps plein">Temps plein</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Fonction principale</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.fonction_principale}
            onChange={(e) =>
              setTeacherForm({
                ...teacherForm,
                fonction_principale: e.target.value,
              })
            }
            placeholder="Fonction principale"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Disponibilité hebdomadaire</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.disponibilite}
            onChange={(e) =>
              setTeacherForm({ ...teacherForm, disponibilite: e.target.value })
            }
            placeholder="Ex: Lundi-Vendredi, 8h-16h"
          />
        </div>

        {/* Matières */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Matières enseignées*</h6>
        </div>
        <div className="col-12">
          <select
            className="form-select"
            multiple
            value={teacherForm.matieres_enseignees}
            onChange={(e) => {
              const options = e.target.options;
              const selectedValues: string[] = [];
              for (let i = 0; i < options.length; i++) {
                if (options[i].selected) selectedValues.push(options[i].value);
              }
              setTeacherForm({
                ...teacherForm,
                matieres_enseignees: selectedValues,
              });
            }}
            required={selectedRoleLabel === "Professeur"}
          >
            {matieres.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle}
              </option>
            ))}
          </select>
          <small className="text-muted">
            Maintenez Ctrl (Windows) ou Cmd (Mac) pour sélectionner plusieurs
            matières
          </small>
        </div>

        {/* Expérience d'enseignement */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Expérience d’enseignement</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Années d’expérience</label>
          <input
            type="number"
            className="form-control"
            value={teacherForm.experience_enseignement.annees}
            onChange={(e) =>
              setTeacherForm({
                ...teacherForm,
                experience_enseignement: {
                  ...teacherForm.experience_enseignement,
                  annees: parseInt(e.target.value) || 0,
                },
              })
            }
            min={0}
            placeholder="Nombre d'années"
          />
        </div>
        <div className="col-12">
          <label className="form-label">Établissements précédents</label>
          {teacherForm.experience_enseignement.etablissements.map(
            (etab, index) => (
              <div key={index} className="mb-2 d-flex">
                <input
                  type="text"
                  className="form-control"
                  value={etab}
                  onChange={(e) => {
                    const arr = [
                      ...teacherForm.experience_enseignement.etablissements,
                    ];
                    arr[index] = e.target.value;
                    setTeacherForm({
                      ...teacherForm,
                      experience_enseignement: {
                        ...teacherForm.experience_enseignement,
                        etablissements: arr,
                      },
                    });
                  }}
                  placeholder="Nom de l'établissement"
                />
                {teacherForm.experience_enseignement.etablissements.length >
                  1 && (
                  <button
                    type="button"
                    className="btn btn-outline-danger ms-2"
                    onClick={() => {
                      const arr = [
                        ...teacherForm.experience_enseignement.etablissements,
                      ];
                      arr.splice(index, 1);
                      setTeacherForm({
                        ...teacherForm,
                        experience_enseignement: {
                          ...teacherForm.experience_enseignement,
                          etablissements: arr,
                        },
                      });
                    }}
                  >
                    <i className="bi bi-trash" />
                  </button>
                )}
              </div>
            )
          )}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() =>
              setTeacherForm({
                ...teacherForm,
                experience_enseignement: {
                  ...teacherForm.experience_enseignement,
                  etablissements: [
                    ...teacherForm.experience_enseignement.etablissements,
                    "",
                  ],
                },
              })
            }
          >
            <i className="bi bi-plus me-1" />
            Ajouter établissement
          </button>
        </div>

        {/* Diplômes */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Diplômes et formations</h5>
          <hr />
        </div>
        {teacherForm.diplomes.map((diplome, index) => (
          <div key={index} className="row g-2 mb-3 p-3 border rounded">
            <div className="col-md-3">
              <label className="form-label">Intitulé du diplôme</label>
              <input
                type="text"
                className="form-control"
                value={diplome.intitule}
                onChange={(e) =>
                  handleDiplomeChange(index, "intitule", e.target.value)
                }
                placeholder="Ex: Master en Informatique"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Niveau</label>
              <select
                className="form-select"
                value={diplome.niveau}
                onChange={(e) =>
                  handleDiplomeChange(index, "niveau", e.target.value)
                }
              >
                <option value="">Sélectionner</option>
                <option value="Bac">Bac</option>
                <option value="Bac+2">Bac+2</option>
                <option value="Bac+3">Bac+3</option>
                <option value="Bac+5">Bac+5</option>
                <option value="Doctorat">Doctorat</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label">Année</label>
              <input
                type="text"
                className="form-control"
                value={diplome.annee}
                onChange={(e) =>
                  handleDiplomeChange(index, "annee", e.target.value)
                }
                placeholder="2023"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Établissement</label>
              <input
                type="text"
                className="form-control"
                value={diplome.etablissement}
                onChange={(e) =>
                  handleDiplomeChange(index, "etablissement", e.target.value)
                }
                placeholder="Nom de l'établissement"
              />
            </div>
            <div className="col-md-1 d-flex align-items-end">
              {teacherForm.diplomes.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => handleRemoveDiplome(index)}
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="col-12">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleAddDiplome}
          >
            <i className="bi bi-plus me-1" />
            Ajouter diplôme
          </button>
        </div>

        {/* Domaines de spécialisation */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Domaines de spécialisation</h6>
          {teacherForm.domaines_specialisation.map((domaine, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={domaine}
                onChange={(e) =>
                  handleArrayItemChange(
                    "domaines_specialisation",
                    index,
                    e.target.value
                  )
                }
                placeholder="Domaine de spécialisation"
              />
              {teacherForm.domaines_specialisation.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() =>
                    handleRemoveArrayItem("domaines_specialisation", index)
                  }
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem("domaines_specialisation")}
          >
            <i className="bi bi-plus me-1" />
            Ajouter domaine
          </button>
        </div>

        {/* Formation pédagogique */}
        <div className="col-12 mt-3">
          <label className="form-label">Formation pédagogique</label>
          <textarea
            className="form-control"
            value={teacherForm.formation_pedagogique}
            onChange={(e) =>
              setTeacherForm({
                ...teacherForm,
                formation_pedagogique: e.target.value,
              })
            }
            placeholder="Décrivez vos formations pédagogiques..."
            rows={3}
          />
        </div>

        {/* Niveaux d'enseignement */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Niveaux d’enseignement</h6>
          {teacherForm.niveaux_enseignement.map((niveau, index) => (
            <div key={index} className="mb-2 d-flex">
              <select
                className="form-select"
                value={niveau}
                onChange={(e) =>
                  handleArrayItemChange(
                    "niveaux_enseignement",
                    index,
                    e.target.value
                  )
                }
              >
                <option value="">Sélectionner un niveau</option>
                <option value="Primaire">Primaire</option>
                <option value="Secondaire">Secondaire</option>
                <option value="Lycée">Lycée</option>
                <option value="Université">Université</option>
                <option value="Formation professionnelle">
                  Formation professionnelle
                </option>
              </select>
              {teacherForm.niveaux_enseignement.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() =>
                    handleRemoveArrayItem("niveaux_enseignement", index)
                  }
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem("niveaux_enseignement")}
          >
            <i className="bi bi-plus me-1" />
            Ajouter niveau
          </button>
        </div>

        {/* Langues d’enseignement */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Langues d’enseignement</h6>
          {teacherForm.langues_enseignement.map((langue, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={langue}
                onChange={(e) =>
                  handleArrayItemChange(
                    "langues_enseignement",
                    index,
                    e.target.value
                  )
                }
                placeholder="Langue d'enseignement"
              />
              {teacherForm.langues_enseignement.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() =>
                    handleRemoveArrayItem("langues_enseignement", index)
                  }
                >
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem("langues_enseignement")}
          >
            <i className="bi bi-plus me-1" />
            Ajouter langue
          </button>
        </div>

        {/* Expériences professionnelles */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Expériences professionnelles</h5>
          <hr />
        </div>
        {teacherForm.experiences_professionnelles.map((experience, index) => (
          <div key={index} className="p-3 border rounded mb-3">
            <div className="row g-2">
              <div className="col-md-6">
                <label className="form-label">Établissements</label>
                {experience.etablissements.map((etablissement, etabIndex) => (
                  <div key={etabIndex} className="mb-2 d-flex">
                    <input
                      type="text"
                      className="form-control"
                      value={etablissement}
                      onChange={(e) => {
                        const arr = [...experience.etablissements];
                        arr[etabIndex] = e.target.value;
                        handleExperienceChange(
                          index,
                          "etablissements",
                          arr
                        );
                      }}
                      placeholder="Nom de l'établissement"
                    />
                    {experience.etablissements.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-2"
                        onClick={() => {
                          const arr = [...experience.etablissements];
                          arr.splice(etabIndex, 1);
                          handleExperienceChange(
                            index,
                            "etablissements",
                            arr
                          );
                        }}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const arr = [...experience.etablissements, ""];
                    handleExperienceChange(index, "etablissements", arr);
                  }}
                >
                  <i className="bi bi-plus me-1" />
                  Ajouter établissement
                </button>
              </div>
              <div className="col-md-4">
                <label className="form-label">Durée</label>
                <input
                  type="text"
                  className="form-control"
                  value={experience.duree}
                  onChange={(e) =>
                    handleExperienceChange(index, "duree", e.target.value)
                  }
                  placeholder="Ex: 2 ans, 6 mois..."
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                {teacherForm.experiences_professionnelles.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => handleRemoveExperience(index)}
                  >
                    <i className="bi bi-trash" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        <div className="col-12">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={handleAddExperience}
          >
            <i className="bi bi-plus me-1" />
            Ajouter expérience
          </button>
        </div>

        {/* Documents */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Documents à fournir</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">CV (PDF)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, "cv")}
            accept=".pdf"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Copie des diplômes (PDF)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, "diplomes")}
            accept=".pdf"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Pièce d’identité (PDF ou image)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, "piece_identite")}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        <div className="col-12 mt-4">
          <button type="submit" className="btn btn-primary px-4">
            <i className="bi bi-plus-lg me-2" />
            Ajouter le professeur
          </button>
        </div>
      </div>
    </form>
  );
}
