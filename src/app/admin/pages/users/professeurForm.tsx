'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';

interface TeacherFormProps {
  roles: { id: string; libelle: string }[];
  matieres: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

export default function TeacherForm({
  roles,
  matieres,
  showSuccessToast,
  showErrorToast,
  fetchData
}: TeacherFormProps) {
  const [teacherForm, setTeacherForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',
    first_login: '1',
    specialty: '',
    specialite: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: '',
    sexe: '',
    situation_matrimoniale: '',
    cni_passeport: '',
    adresse: '',
    telephone: '',
    statut: '',
    fonction_principale: '',
    disponibilite: '',
    matieres_enseignees: [] as string[],
    experience_enseignement: {
      annees: 0,
      etablissements: ['']
    },
    diplomes: [{
      intitule: '',
      niveau: '',
      annee: '',
      etablissement: ''
    }],
    domaines_specialisation: [''],
    formation_pedagogique: '',
    niveaux_enseignement: [''],
    langues_enseignement: [''],
    experiences_professionnelles: [{
      etablissements: [''],
      duree: ''
    }],
    competences: {
      outils: [''],
      langues: [''],
      publications: ['']
    },
    documents: {
      cv: null as File | null,
      diplomes: null as File | null,
      piece_identite: null as File | null
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof teacherForm.documents) => {
    if (e.target.files && e.target.files[0]) {
      setTeacherForm({
        ...teacherForm,
        documents: {
          ...teacherForm.documents,
          [field]: e.target.files[0]
        }
      });
    }
  };

  const handleAddDiplome = () => {
    setTeacherForm({
      ...teacherForm,
      diplomes: [
        ...teacherForm.diplomes,
        { intitule: '', niveau: '', annee: '', etablissement: '' }
      ]
    });
  };

  const handleRemoveDiplome = (index: number) => {
    const newDiplomes = [...teacherForm.diplomes];
    newDiplomes.splice(index, 1);
    setTeacherForm({
      ...teacherForm,
      diplomes: newDiplomes
    });
  };

  const handleDiplomeChange = (index: number, field: string, value: string) => {
    const newDiplomes = [...teacherForm.diplomes];
    newDiplomes[index] = {
      ...newDiplomes[index],
      [field]: value
    };
    setTeacherForm({
      ...teacherForm,
      diplomes: newDiplomes
    });
  };

  const handleAddExperience = () => {
    setTeacherForm({
      ...teacherForm,
      experiences_professionnelles: [
        ...teacherForm.experiences_professionnelles,
        { etablissements: [''], duree: '' }
      ]
    });
  };

  const handleRemoveExperience = (index: number) => {
    const newExperiences = [...teacherForm.experiences_professionnelles];
    newExperiences.splice(index, 1);
    setTeacherForm({
      ...teacherForm,
      experiences_professionnelles: newExperiences
    });
  };

  const handleExperienceChange = (index: number, field: string, value: string | string[]) => {
    const newExperiences = [...teacherForm.experiences_professionnelles];
    newExperiences[index] = {
      ...newExperiences[index],
      [field]: value
    };
    setTeacherForm({
      ...teacherForm,
      experiences_professionnelles: newExperiences
    });
  };

  const handleAddArrayItem = (field: string) => {
    const value = teacherForm[field as keyof typeof teacherForm];
    if (Array.isArray(value)) {
      setTeacherForm({
        ...teacherForm,
        [field]: [...value, '']
      });
    } else {
      console.error(`${field} is not an array`);
    }
  };

  const handleRemoveArrayItem = (field: string, index: number) => {
    const value = teacherForm[field as keyof typeof teacherForm];
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray.splice(index, 1);
      setTeacherForm({
        ...teacherForm,
        [field]: newArray
      });
    } else {
      console.error(`${field} is not an array`);
    }
  };

  const handleArrayItemChange = (field: string, index: number, value: string) => {
    const fieldValue = teacherForm[field as keyof typeof teacherForm];
    if (Array.isArray(fieldValue)) {
      const newArray = [...fieldValue];
      newArray[index] = value;
      setTeacherForm({
        ...teacherForm,
        [field]: newArray
      });
    } else {
      console.error(`${field} is not an array`);
    }
  };

  const handleCompetenceChange = (category: string, index: number, value: string) => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category][index] = value;
    setTeacherForm({
      ...teacherForm,
      competences: newCompetences
    });
  };

  const handleAddCompetence = (category: string) => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category].push('');
    setTeacherForm({
      ...teacherForm,
      competences: newCompetences
    });
  };

  const handleRemoveCompetence = (category: string, index: number) => {
    const newCompetences = { ...teacherForm.competences };
    (newCompetences as any)[category].splice(index, 1);
    setTeacherForm({
      ...teacherForm,
      competences: newCompetences
    });
  };

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation des champs obligatoires
      if (!teacherForm.nom || !teacherForm.prenom || !teacherForm.email ||
          !teacherForm.login || !teacherForm.password || !teacherForm.specialty) {
        showErrorToast('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // ✅ Rôle sélectionné (obligatoire)
      if (!teacherForm.role_id) {
        showErrorToast('Veuillez sélectionner un rôle');
        return;
      }
      const roleObj = roles.find(r => String(r.id) === String(teacherForm.role_id));
      if (!roleObj) {
        showErrorToast('Rôle sélectionné introuvable');
        return;
      }

      // ✅ Si le rôle est "Professeur", on impose au moins une matière
      if (roleObj.libelle === 'Professeur' && teacherForm.matieres_enseignees.length === 0) {
        showErrorToast('Veuillez sélectionner au moins une matière');
        return;
      }

      const fileUrls = {
        cv: teacherForm.documents.cv ? await uploadFile(teacherForm.documents.cv) : null,
        diplomes: teacherForm.documents.diplomes ? await uploadFile(teacherForm.documents.diplomes) : null,
        piece_identite: teacherForm.documents.piece_identite ? await uploadFile(teacherForm.documents.piece_identite) : null
      };

      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      await addDoc(collection(db, "users"), {
        ...teacherForm,
        id: newUserId,
        role_id: roleObj.id,           // <= id choisi dans le select
        role_libelle: roleObj.libelle, // <= utile pour les redirections
        documents: fileUrls
      });

      showSuccessToast('Utilisateur ajouté avec succès !');

      // Reset form
      setTeacherForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1',
        specialty: '',
        specialite: '',
        date_naissance: '',
        lieu_naissance: '',
        nationalite: '',
        sexe: '',
        situation_matrimoniale: '',
        cni_passeport: '',
        adresse: '',
        telephone: '',
        statut: '',
        fonction_principale: '',
        disponibilite: '',
        matieres_enseignees: [],
        experience_enseignement: {
          annees: 0,
          etablissements: ['']
        },
        diplomes: [{
          intitule: '',
          niveau: '',
          annee: '',
          etablissement: ''
        }],
        domaines_specialisation: [''],
        formation_pedagogique: '',
        niveaux_enseignement: [''],
        langues_enseignement: [''],
        experiences_professionnelles: [{
          etablissements: [''],
          duree: ''
        }],
        competences: {
          outils: [''],
          langues: [''],
          publications: ['']
        },
        documents: {
          cv: null,
          diplomes: null,
          piece_identite: null
        }
      });

      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du professeur:', error);
      showErrorToast('Erreur lors de l\'ajout du professeur');
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    // TODO: brancher vers Firebase Storage si besoin
    return `https://example.com/uploads/${file.name}`;
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
            onChange={(e) => setTeacherForm({ ...teacherForm, role_id: e.target.value })}
            required
          >
            <option value="">Sélectionner un rôle</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
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
            onChange={(e) => setTeacherForm({ ...teacherForm, prenom: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, nom: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
            required
            placeholder="exemple@email.com"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom d utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.login}
            onChange={(e) => setTeacherForm({ ...teacherForm, login: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, specialty: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, specialite: e.target.value })}
            placeholder="Description détaillée de la spécialité (ex: Développeuse FullStack)"
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
            onChange={(e) => setTeacherForm({ ...teacherForm, date_naissance: e.target.value })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lieu de naissance</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.lieu_naissance}
            onChange={(e) => setTeacherForm({ ...teacherForm, lieu_naissance: e.target.value })}
            placeholder="Lieu de naissance"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nationalité</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.nationalite}
            onChange={(e) => setTeacherForm({ ...teacherForm, nationalite: e.target.value })}
            placeholder="Nationalité"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Sexe</label>
          <select
            className="form-select"
            value={teacherForm.sexe}
            onChange={(e) => setTeacherForm({ ...teacherForm, sexe: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, situation_matrimoniale: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, cni_passeport: e.target.value })}
            placeholder="Numéro CNI/Passeport"
          />
        </div>

        {/* Informations de contact */}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, adresse: e.target.value })}
            placeholder="Adresse complète"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={teacherForm.telephone}
            onChange={(e) => setTeacherForm({ ...teacherForm, telephone: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, statut: e.target.value })}
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
            onChange={(e) => setTeacherForm({ ...teacherForm, fonction_principale: e.target.value })}
            placeholder="Fonction principale"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Disponibilité hebdomadaire</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.disponibilite}
            onChange={(e) => setTeacherForm({ ...teacherForm, disponibilite: e.target.value })}
            placeholder="Ex: Lundi-Vendredi, 8h-16h"
          />
        </div>

        {/* Matières enseignées (imposées si rôle Professeur) */}
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
                if (options[i].selected) {
                  selectedValues.push(options[i].value);
                }
              }
              setTeacherForm({ ...teacherForm, matieres_enseignees: selectedValues });
            }}
            required={roles.find(r => String(r.id) === String(teacherForm.role_id))?.libelle === 'Professeur'}
          >
            {matieres.map(matiere => (
              <option key={matiere.id} value={matiere.id}>
                {matiere.libelle}
              </option>
            ))}
          </select>
          <small className="text-muted">Maintenez Ctrl (Windows) ou Cmd (Mac) pour sélectionner plusieurs matières</small>
        </div>

        {/* Expérience d'enseignement */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Expérience d enseignement</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Années d expérience</label>
          <input
            type="number"
            className="form-control"
            value={teacherForm.experience_enseignement.annees}
            onChange={(e) => setTeacherForm({
              ...teacherForm,
              experience_enseignement: {
                ...teacherForm.experience_enseignement,
                annees: parseInt(e.target.value) || 0
              }
            })}
            min={0}
            placeholder="Nombre d'années"
          />
        </div>
        <div className="col-12">
          <label className="form-label">Établissements précédents</label>
          {teacherForm.experience_enseignement.etablissements.map((etablissement, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={etablissement}
                onChange={(e) => {
                  const newEtablissements = [...teacherForm.experience_enseignement.etablissements];
                  newEtablissements[index] = e.target.value;
                  setTeacherForm({
                    ...teacherForm,
                    experience_enseignement: {
                      ...teacherForm.experience_enseignement,
                      etablissements: newEtablissements
                    }
                  });
                }}
                placeholder="Nom de l'établissement"
              />
              {teacherForm.experience_enseignement.etablissements.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => {
                    const newEtablissements = [...teacherForm.experience_enseignement.etablissements];
                    newEtablissements.splice(index, 1);
                    setTeacherForm({
                      ...teacherForm,
                      experience_enseignement: {
                        ...teacherForm.experience_enseignement,
                        etablissements: newEtablissements
                      }
                    });
                  }}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => setTeacherForm({
              ...teacherForm,
              experience_enseignement: {
                ...teacherForm.experience_enseignement,
                etablissements: [...teacherForm.experience_enseignement.etablissements, '']
              }
            })}
          >
            <i className="bi bi-plus me-1"></i>
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
                onChange={(e) => handleDiplomeChange(index, 'intitule', e.target.value)}
                placeholder="Ex: Master en Informatique"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Niveau</label>
              <select
                className="form-select"
                value={diplome.niveau}
                onChange={(e) => handleDiplomeChange(index, 'niveau', e.target.value)}
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
                onChange={(e) => handleDiplomeChange(index, 'annee', e.target.value)}
                placeholder="2023"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Établissement</label>
              <input
                type="text"
                className="form-control"
                value={diplome.etablissement}
                onChange={(e) => handleDiplomeChange(index, 'etablissement', e.target.value)}
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
                  <i className="bi bi-trash"></i>
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
            <i className="bi bi-plus me-1"></i>
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
                onChange={(e) => handleArrayItemChange('domaines_specialisation', index, e.target.value)}
                placeholder="Domaine de spécialisation"
              />
              {teacherForm.domaines_specialisation.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('domaines_specialisation', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('domaines_specialisation')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter domaine
          </button>
        </div>

        {/* Formation pédagogique */}
        <div className="col-12 mt-3">
          <label className="form-label">Formation pédagogique</label>
          <textarea
            className="form-control"
            value={teacherForm.formation_pedagogique}
            onChange={(e) => setTeacherForm({ ...teacherForm, formation_pedagogique: e.target.value })}
            placeholder="Décrivez vos formations pédagogiques..."
            rows={3}
          />
        </div>

        {/* Niveaux d'enseignement */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Niveaux d enseignement</h6>
          {teacherForm.niveaux_enseignement.map((niveau, index) => (
            <div key={index} className="mb-2 d-flex">
              <select
                className="form-select"
                value={niveau}
                onChange={(e) => handleArrayItemChange('niveaux_enseignement', index, e.target.value)}
              >
                <option value="">Sélectionner un niveau</option>
                <option value="Primaire">Primaire</option>
                <option value="Secondaire">Secondaire</option>
                <option value="Lycée">Lycée</option>
                <option value="Université">Université</option>
                <option value="Formation professionnelle">Formation professionnelle</option>
              </select>
              {teacherForm.niveaux_enseignement.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('niveaux_enseignement', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('niveaux_enseignement')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter niveau
          </button>
        </div>

        {/* Langues d'enseignement */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Langues d enseignement</h6>
          {teacherForm.langues_enseignement.map((langue, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={langue}
                onChange={(e) => handleArrayItemChange('langues_enseignement', index, e.target.value)}
                placeholder="Langue d'enseignement"
              />
              {teacherForm.langues_enseignement.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('langues_enseignement', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('langues_enseignement')}
          >
            <i className="bi bi-plus me-1"></i>
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
                        const newEtablissements = [...experience.etablissements];
                        newEtablissements[etabIndex] = e.target.value;
                        handleExperienceChange(index, 'etablissements', newEtablissements);
                      }}
                      placeholder="Nom de l'établissement"
                    />
                    {experience.etablissements.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger ms-2"
                        onClick={() => {
                          const newEtablissements = [...experience.etablissements];
                          newEtablissements.splice(etabIndex, 1);
                          handleExperienceChange(index, 'etablissements', newEtablissements);
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => {
                    const newEtablissements = [...experience.etablissements, ''];
                    handleExperienceChange(index, 'etablissements', newEtablissements);
                  }}
                >
                  <i className="bi bi-plus me-1"></i>
                  Ajouter établissement
                </button>
              </div>
              <div className="col-md-4">
                <label className="form-label">Durée</label>
                <input
                  type="text"
                  className="form-control"
                  value={experience.duree}
                  onChange={(e) => handleExperienceChange(index, 'duree', e.target.value)}
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
                    <i className="bi bi-trash"></i>
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
            <i className="bi bi-plus me-1"></i>
            Ajouter expérience
          </button>
        </div>

        {/* Compétences */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Compétences</h5>
          <hr />
        </div>

        {/* Outils */}
        <div className="col-md-4">
          <h6 className="fw-bold">Outils maîtrisés</h6>
          {teacherForm.competences.outils.map((outil, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={outil}
                onChange={(e) => handleCompetenceChange('outils', index, e.target.value)}
                placeholder="Nom de l'outil"
              />
              {teacherForm.competences.outils.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveCompetence('outils', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddCompetence('outils')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter outil
          </button>
        </div>

        {/* Langues */}
        <div className="col-md-4">
          <h6 className="fw-bold">Langues parlées</h6>
          {teacherForm.competences.langues.map((langue, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={langue}
                onChange={(e) => handleCompetenceChange('langues', index, e.target.value)}
                placeholder="Langue + niveau"
              />
              {teacherForm.competences.langues.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveCompetence('langues', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddCompetence('langues')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter langue
          </button>
        </div>

        {/* Documents à fournir */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Documents à fournir</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">CV (PDF)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'cv')}
            accept=".pdf"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Copie des diplômes (PDF)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'diplomes')}
            accept=".pdf"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Pièce d identité (PDF ou image)</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'piece_identite')}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        <div className="col-12 mt-4">
          <button type="submit" className="btn btn-primary px-4">
            <i className="bi bi-plus-lg me-2"></i>
            Ajouter le professeur
          </button>
        </div>
      </div>
    </form>
  );
}
