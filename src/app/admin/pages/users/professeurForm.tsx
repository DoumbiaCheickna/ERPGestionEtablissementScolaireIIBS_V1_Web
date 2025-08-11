'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';
import Toast from '../../components/ui/Toast';

interface TeacherFormProps {
  roles: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

interface Matiere {
  id: string;
  libelle: string;
}

export default function TeacherForm({ 
  roles, 
  showSuccessToast, 
  showErrorToast, 
  fetchData 
}: TeacherFormProps) {
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [loadingMatieres, setLoadingMatieres] = useState(true);
  
  const [teacherForm, setTeacherForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',
    first_login: '1',
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

  // Charger les matières depuis Firestore
  useEffect(() => {
    const fetchMatieres = async () => {
      try {
        const q = query(collection(db, "matieres"));
        const querySnapshot = await getDocs(q);
        const matieresData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          libelle: doc.data().libelle
        }));
        setMatieres(matieresData);
        setLoadingMatieres(false);
      } catch (error) {
        console.error("Erreur lors du chargement des matières:", error);
        showErrorToast("Erreur lors du chargement des matières");
        setLoadingMatieres(false);
      }
    };

    fetchMatieres();
  }, []);

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

  const handleTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Trouver le rôle professeur
      const teacherRole = roles.find(r => r.libelle === 'Professeur');
      if (!teacherRole) {
        showErrorToast('Rôle professeur non trouvé');
        return;
      }

      // Vérifier que des matières sont sélectionnées
      if (teacherForm.matieres_enseignees.length === 0) {
        showErrorToast('Veuillez sélectionner au moins une matière');
        return;
      }

      // Upload des fichiers (à implémenter selon votre backend)
      const fileUrls = {
        cv: teacherForm.documents.cv ? await uploadFile(teacherForm.documents.cv) : null,
        diplomes: teacherForm.documents.diplomes ? await uploadFile(teacherForm.documents.diplomes) : null,
        piece_identite: teacherForm.documents.piece_identite ? await uploadFile(teacherForm.documents.piece_identite) : null
      };

      const usersSnapshot = await getDocs(collection(db, "users"));
      await addDoc(collection(db, "users"), {
        ...teacherForm,
        id: usersSnapshot.size + 1,
        role_id: teacherRole.id,
        documents: fileUrls // Stocker les URLs des fichiers
      });

      showSuccessToast('Professeur ajouté avec succès!');
      
      // Réinitialiser le formulaire
      setTeacherForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1',
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

  // Fonction simulée pour uploader les fichiers
  const uploadFile = async (file: File): Promise<string> => {
    // Implémentez votre logique d'upload ici
    // Retourne l'URL du fichier uploadé
    return `https://example.com/uploads/${file.name}`;
  };

  return (
    <form onSubmit={handleTeacherSubmit}>
      <div className="row g-3">
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
            onChange={(e) => setTeacherForm({...teacherForm, prenom: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.nom}
            onChange={(e) => setTeacherForm({...teacherForm, nom: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Email*</label>
          <input
            type="email"
            className="form-control"
            value={teacherForm.email}
            onChange={(e) => setTeacherForm({...teacherForm, email: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom d utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.login}
            onChange={(e) => setTeacherForm({...teacherForm, login: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mot de passe*</label>
          <input
            type="password"
            className="form-control"
            value={teacherForm.password}
            onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Spécialité*</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.specialite}
            onChange={(e) => setTeacherForm({...teacherForm, specialite: e.target.value})}
            required
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
            onChange={(e) => setTeacherForm({...teacherForm, date_naissance: e.target.value})}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lieu de naissance</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.lieu_naissance}
            onChange={(e) => setTeacherForm({...teacherForm, lieu_naissance: e.target.value})}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nationalité</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.nationalite}
            onChange={(e) => setTeacherForm({...teacherForm, nationalite: e.target.value})}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Sexe</label>
          <select
            className="form-select"
            value={teacherForm.sexe}
            onChange={(e) => setTeacherForm({...teacherForm, sexe: e.target.value})}
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
            onChange={(e) => setTeacherForm({...teacherForm, situation_matrimoniale: e.target.value})}
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
            onChange={(e) => setTeacherForm({...teacherForm, cni_passeport: e.target.value})}
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
            onChange={(e) => setTeacherForm({...teacherForm, adresse: e.target.value})}
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={teacherForm.telephone}
            onChange={(e) => setTeacherForm({...teacherForm, telephone: e.target.value})}
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
            onChange={(e) => setTeacherForm({...teacherForm, statut: e.target.value})}
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
            onChange={(e) => setTeacherForm({...teacherForm, fonction_principale: e.target.value})}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Disponibilité hebdomadaire</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.disponibilite}
            onChange={(e) => setTeacherForm({...teacherForm, disponibilite: e.target.value})}
            placeholder="Ex: Lundi-Vendredi, 8h-16h"
          />
        </div>

        {/* Matières enseignées */}
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
              const selectedValues = [];
              for (let i = 0; i < options.length; i++) {
                if (options[i].selected) {
                  selectedValues.push(options[i].value);
                }
              }
              setTeacherForm({...teacherForm, matieres_enseignees: selectedValues});
            }}
            required
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
          <h6 className="fw-bold">Expérience d enseignement</h6>
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
            min="0"
          />
        </div>
        <div className="col-md-8">
          <label className="form-label">Établissements précédents</label>
          <input
            type="text"
            className="form-control"
            value={teacherForm.experience_enseignement.etablissements.join(', ')}
            onChange={(e) => setTeacherForm({
              ...teacherForm,
              experience_enseignement: {
                ...teacherForm.experience_enseignement,
                etablissements: e.target.value.split(',').map(item => item.trim())
              }
            })}
            placeholder="Séparer par des virgules"
          />
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