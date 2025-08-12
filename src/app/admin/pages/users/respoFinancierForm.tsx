'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';

interface ResponsableFinancierFormProps {
  roles: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

export default function ResponsableFinancierForm({ 
  roles, 
  showSuccessToast, 
  showErrorToast, 
  fetchData 
}: ResponsableFinancierFormProps) {
  const [responsableForm, setResponsableForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',
    first_login: '1',
    
    // Informations personnelles
    sexe: '',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: '',
    situation_matrimoniale: '',
    nombre_enfants: 0,
    cni_passeport: '',
    
    // Coordonnées
    adresse: '',
    telephone: '',
    
    // Poste visé
    intitule_poste: '',
    departement_service: '',
    type_contrat: '',
    disponibilite: '',
    
    // Profil professionnel
    dernier_poste: '',
    fonctions_exercees: [''],
    experience_domaine: '',
    niveau_responsabilite: '',
    
    // Formation / Diplômes
    diplomes: [{
      intitule: '',
      niveau: '',
      annee: '',
      etablissement: ''
    }],
    certifications_professionnelles: [''],
    formations_continues: [''],
    
    // Compétences
    competences: {
      techniques: [''],
      bureautiques: [''],
      langues: [''],
      permis_conduire: {
        type: '',
        validite: ''
      }
    },
    
    // Références professionnelles
    references_professionnelles: [{
      nom_reference: '',
      coordonnees: '',
      relation: ''
    }],
    
    // Engagements
    engagement_loyaute: false,
    consentement_verification: false,
    disponibilite_prise_poste: '',
    
    // Documents
    documents: {
      lettre_motivation: null as File | null,
      cv: null as File | null,
      piece_identite: null as File | null,
      diplomes: null as File | null,
      attestations_emploi: null as File | null,
      rib_bancaire: null as File | null
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof responsableForm.documents) => {
    if (e.target.files && e.target.files[0]) {
      setResponsableForm({
        ...responsableForm,
        documents: {
          ...responsableForm.documents,
          [field]: e.target.files[0]
        }
      });
    }
  };

  const handleAddDiplome = () => {
    setResponsableForm({
      ...responsableForm,
      diplomes: [
        ...responsableForm.diplomes,
        { intitule: '', niveau: '', annee: '', etablissement: '' }
      ]
    });
  };

  const handleRemoveDiplome = (index: number) => {
    const newDiplomes = [...responsableForm.diplomes];
    newDiplomes.splice(index, 1);
    setResponsableForm({
      ...responsableForm,
      diplomes: newDiplomes
    });
  };

  const handleDiplomeChange = (index: number, field: string, value: string) => {
    const newDiplomes = [...responsableForm.diplomes];
    newDiplomes[index] = {
      ...newDiplomes[index],
      [field]: value
    };
    setResponsableForm({
      ...responsableForm,
      diplomes: newDiplomes
    });
  };

  const handleAddReference = () => {
    setResponsableForm({
      ...responsableForm,
      references_professionnelles: [
        ...responsableForm.references_professionnelles,
        { nom_reference: '', coordonnees: '', relation: '' }
      ]
    });
  };

  const handleRemoveReference = (index: number) => {
    const newReferences = [...responsableForm.references_professionnelles];
    newReferences.splice(index, 1);
    setResponsableForm({
      ...responsableForm,
      references_professionnelles: newReferences
    });
  };

  const handleReferenceChange = (index: number, field: string, value: string) => {
    const newReferences = [...responsableForm.references_professionnelles];
    newReferences[index] = {
      ...newReferences[index],
      [field]: value
    };
    setResponsableForm({
      ...responsableForm,
      references_professionnelles: newReferences
    });
  };

  const handleAddArrayItem = (field: string) => {
    const value = responsableForm[field as keyof typeof responsableForm];
    if (Array.isArray(value)) {
      setResponsableForm({
        ...responsableForm,
        [field]: [...value, '']
      });
    }
  };

  const handleRemoveArrayItem = (field: string, index: number) => {
    const value = responsableForm[field as keyof typeof responsableForm];
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray.splice(index, 1);
      setResponsableForm({
        ...responsableForm,
        [field]: newArray
      });
    }
  };

  const handleArrayItemChange = (field: string, index: number, value: string) => {
    const fieldValue = responsableForm[field as keyof typeof responsableForm];
    if (Array.isArray(fieldValue)) {
      const newArray = [...fieldValue];
      newArray[index] = value;
      setResponsableForm({
        ...responsableForm,
        [field]: newArray
      });
    }
  };

  const handleCompetenceChange = (category: string, index: number, value: string) => {
    const newCompetences = { ...responsableForm.competences };
    if (category === 'permis_conduire') {
      // Handle permis_conduire separately as it's an object, not array
      return;
    }
    (newCompetences[category as keyof typeof newCompetences] as string[])[index] = value;
    setResponsableForm({
      ...responsableForm,
      competences: newCompetences
    });
  };

  const handlePermisChange = (field: string, value: string) => {
    setResponsableForm({
      ...responsableForm,
      competences: {
        ...responsableForm.competences,
        permis_conduire: {
          ...responsableForm.competences.permis_conduire,
          [field]: value
        }
      }
    });
  };

  const handleAddCompetence = (category: string) => {
    const newCompetences = { ...responsableForm.competences };
    if (category !== 'permis_conduire') {
      (newCompetences[category as keyof typeof newCompetences] as string[]).push('');
      setResponsableForm({
        ...responsableForm,
        competences: newCompetences
      });
    }
  };

  const handleRemoveCompetence = (category: string, index: number) => {
    const newCompetences = { ...responsableForm.competences };
    if (category !== 'permis_conduire') {
      (newCompetences[category as keyof typeof newCompetences] as string[]).splice(index, 1);
      setResponsableForm({
        ...responsableForm,
        competences: newCompetences
      });
    }
  };

  const handleResponsableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation des champs obligatoires
      if (!responsableForm.nom || !responsableForm.prenom || !responsableForm.email || 
          !responsableForm.login || !responsableForm.password || !responsableForm.intitule_poste) {
        showErrorToast('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Trouver le rôle "Responsable Financier"
      const responsableRole = roles.find(r => 
        r.libelle.toLowerCase().includes('financier') || 
        r.libelle.toLowerCase().includes('responsable')
      );
      
      if (!responsableRole) {
        showErrorToast('Rôle Responsable Financier non trouvé');
        return;
      }

      // Upload files (mock implementation)
      const fileUrls = {
        lettre_motivation: responsableForm.documents.lettre_motivation ? await uploadFile(responsableForm.documents.lettre_motivation) : null,
        cv: responsableForm.documents.cv ? await uploadFile(responsableForm.documents.cv) : null,
        piece_identite: responsableForm.documents.piece_identite ? await uploadFile(responsableForm.documents.piece_identite) : null,
        diplomes: responsableForm.documents.diplomes ? await uploadFile(responsableForm.documents.diplomes) : null,
        attestations_emploi: responsableForm.documents.attestations_emploi ? await uploadFile(responsableForm.documents.attestations_emploi) : null,
        rib_bancaire: responsableForm.documents.rib_bancaire ? await uploadFile(responsableForm.documents.rib_bancaire) : null
      };

      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      await addDoc(collection(db, "users"), {
        ...responsableForm,
        id: newUserId,
        role_id: responsableRole.id,
        documents: fileUrls
      });

      showSuccessToast('Responsable financier ajouté avec succès!');
      
      // Reset form
      setResponsableForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1',
        sexe: '',
        date_naissance: '',
        lieu_naissance: '',
        nationalite: '',
        situation_matrimoniale: '',
        nombre_enfants: 0,
        cni_passeport: '',
        adresse: '',
        telephone: '',
        intitule_poste: '',
        departement_service: '',
        type_contrat: '',
        disponibilite: '',
        dernier_poste: '',
        fonctions_exercees: [''],
        experience_domaine: '',
        niveau_responsabilite: '',
        diplomes: [{
          intitule: '',
          niveau: '',
          annee: '',
          etablissement: ''
        }],
        certifications_professionnelles: [''],
        formations_continues: [''],
        competences: {
          techniques: [''],
          bureautiques: [''],
          langues: [''],
          permis_conduire: {
            type: '',
            validite: ''
          }
        },
        references_professionnelles: [{
          nom_reference: '',
          coordonnees: '',
          relation: ''
        }],
        engagement_loyaute: false,
        consentement_verification: false,
        disponibilite_prise_poste: '',
        documents: {
          lettre_motivation: null,
          cv: null,
          piece_identite: null,
          diplomes: null,
          attestations_emploi: null,
          rib_bancaire: null
        }
      });
      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du responsable financier:', error);
      showErrorToast('Erreur lors de l\'ajout du responsable financier');
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    return `https://example.com/uploads/${file.name}`;
  };

  return (
    <form onSubmit={handleResponsableSubmit}>
      <div className="row g-3">
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
            value={responsableForm.prenom}
            onChange={(e) => setResponsableForm({...responsableForm, prenom: e.target.value})}
            required
            placeholder="Entrez le prénom"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom*</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.nom}
            onChange={(e) => setResponsableForm({...responsableForm, nom: e.target.value})}
            required
            placeholder="Entrez le nom"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Email*</label>
          <input
            type="email"
            className="form-control"
            value={responsableForm.email}
            onChange={(e) => setResponsableForm({...responsableForm, email: e.target.value})}
            required
            placeholder="exemple@email.com"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom d utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.login}
            onChange={(e) => setResponsableForm({...responsableForm, login: e.target.value})}
            required
            placeholder="Nom d'utilisateur unique"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mot de passe*</label>
          <input
            type="password"
            className="form-control"
            value={responsableForm.password}
            onChange={(e) => setResponsableForm({...responsableForm, password: e.target.value})}
            required
            placeholder="Mot de passe sécurisé"
            minLength={6}
          />
        </div>

        {/* Informations personnelles */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Informations personnelles</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Sexe</label>
          <select
            className="form-select"
            value={responsableForm.sexe}
            onChange={(e) => setResponsableForm({...responsableForm, sexe: e.target.value})}
          >
            <option value="">Sélectionner</option>
            <option value="Masculin">Masculin</option>
            <option value="Féminin">Féminin</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Date de naissance</label>
          <input
            type="date"
            className="form-control"
            value={responsableForm.date_naissance}
            onChange={(e) => setResponsableForm({...responsableForm, date_naissance: e.target.value})}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lieu de naissance</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.lieu_naissance}
            onChange={(e) => setResponsableForm({...responsableForm, lieu_naissance: e.target.value})}
            placeholder="Lieu de naissance"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nationalité</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.nationalite}
            onChange={(e) => setResponsableForm({...responsableForm, nationalite: e.target.value})}
            placeholder="Nationalité"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Situation matrimoniale</label>
          <select
            className="form-select"
            value={responsableForm.situation_matrimoniale}
            onChange={(e) => setResponsableForm({...responsableForm, situation_matrimoniale: e.target.value})}
          >
            <option value="">Sélectionner</option>
            <option value="Célibataire">Célibataire</option>
            <option value="Marié(e)">Marié(e)</option>
            <option value="Divorcé(e)">Divorcé(e)</option>
            <option value="Veuf(ve)">Veuf(ve)</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Nombre d enfants</label>
          <input
            type="number"
            className="form-control"
            value={responsableForm.nombre_enfants}
            onChange={(e) => setResponsableForm({...responsableForm, nombre_enfants: parseInt(e.target.value) || 0})}
            min="0"
            placeholder="0"
          />
        </div>
        <div className="col-md-12">
          <label className="form-label">CNI/Passeport</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.cni_passeport}
            onChange={(e) => setResponsableForm({...responsableForm, cni_passeport: e.target.value})}
            placeholder="Numéro CNI/Passeport"
          />
        </div>

        {/* Coordonnées */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Coordonnées</h5>
          <hr />
        </div>
        <div className="col-md-8">
          <label className="form-label">Adresse complète</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.adresse}
            onChange={(e) => setResponsableForm({...responsableForm, adresse: e.target.value})}
            placeholder="Adresse complète"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={responsableForm.telephone}
            onChange={(e) => setResponsableForm({...responsableForm, telephone: e.target.value})}
            placeholder="Numéro de téléphone"
          />
        </div>

        {/* Poste visé */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Poste visé</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Intitulé du poste*</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.intitule_poste}
            onChange={(e) => setResponsableForm({...responsableForm, intitule_poste: e.target.value})}
            required
            placeholder="Ex: Responsable Financier"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Département/Service</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.departement_service}
            onChange={(e) => setResponsableForm({...responsableForm, departement_service: e.target.value})}
            placeholder="Département de rattachement"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Type de contrat</label>
          <select
            className="form-select"
            value={responsableForm.type_contrat}
            onChange={(e) => setResponsableForm({...responsableForm, type_contrat: e.target.value})}
          >
            <option value="">Sélectionner</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Stage">Stage</option>
            <option value="Intérim">Intérim</option>
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Disponibilité</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.disponibilite}
            onChange={(e) => setResponsableForm({...responsableForm, disponibilite: e.target.value})}
            placeholder="Ex: Immédiate, À partir du..."
          />
        </div>

        {/* Profil professionnel */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Profil professionnel</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Dernier poste occupé</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.dernier_poste}
            onChange={(e) => setResponsableForm({...responsableForm, dernier_poste: e.target.value})}
            placeholder="Dernier poste occupé"
          />
        </div>
        <div className="col-md-6">
          <label className="form-label">Expérience dans le domaine</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.experience_domaine}
            onChange={(e) => setResponsableForm({...responsableForm, experience_domaine: e.target.value})}
            placeholder="Ex: 5 ans en finance"
          />
        </div>
        
        {/* Fonctions exercées */}
        <div className="col-12">
          <label className="form-label">Fonctions exercées</label>
          {responsableForm.fonctions_exercees.map((fonction, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={fonction}
                onChange={(e) => handleArrayItemChange('fonctions_exercees', index, e.target.value)}
                placeholder="Fonction exercée"
              />
              {responsableForm.fonctions_exercees.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('fonctions_exercees', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('fonctions_exercees')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter fonction
          </button>
        </div>

        <div className="col-md-12">
          <label className="form-label">Niveau de responsabilité</label>
          <textarea
            className="form-control"
            value={responsableForm.niveau_responsabilite}
            onChange={(e) => setResponsableForm({...responsableForm, niveau_responsabilite: e.target.value})}
            placeholder="Décrivez votre niveau de responsabilité..."
            rows={3}
          />
        </div>

        {/* Diplômes */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Formation / Diplômes</h5>
          <hr />
        </div>
        {responsableForm.diplomes.map((diplome, index) => (
          <div key={index} className="row g-2 mb-3 p-3 border rounded">
            <div className="col-md-3">
              <label className="form-label">Intitulé du diplôme</label>
              <input
                type="text"
                className="form-control"
                value={diplome.intitule}
                onChange={(e) => handleDiplomeChange(index, 'intitule', e.target.value)}
                placeholder="Ex: Master en Finance"
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
              {responsableForm.diplomes.length > 1 && (
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

        {/* Certifications et formations */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Certifications professionnelles</h6>
          {responsableForm.certifications_professionnelles.map((certification, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={certification}
                onChange={(e) => handleArrayItemChange('certifications_professionnelles', index, e.target.value)}
                placeholder="Certification professionnelle"
              />
              {responsableForm.certifications_professionnelles.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('certifications_professionnelles', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('certifications_professionnelles')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter certification
          </button>
        </div>

        <div className="col-12 mt-3">
          <h6 className="fw-bold">Formations continues / Stages</h6>
          {responsableForm.formations_continues.map((formation, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={formation}
                onChange={(e) => handleArrayItemChange('formations_continues', index, e.target.value)}
                placeholder="Formation continue ou stage"
              />
              {responsableForm.formations_continues.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveArrayItem('formations_continues', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddArrayItem('formations_continues')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter formation
          </button>
        </div>

        {/* Compétences */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Compétences</h5>
          <hr />
        </div>

        {/* Compétences techniques */}
        <div className="col-md-4">
          <h6 className="fw-bold">Compétences techniques</h6>
          {responsableForm.competences.techniques.map((competence, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={competence}
                onChange={(e) => handleCompetenceChange('techniques', index, e.target.value)}
                placeholder="Compétence technique"
              />
              {responsableForm.competences.techniques.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveCompetence('techniques', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddCompetence('techniques')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter compétence
          </button>
        </div>

        {/* Compétences bureautiques */}
        <div className="col-md-4">
          <h6 className="fw-bold">Compétences bureautiques</h6>
          {responsableForm.competences.bureautiques.map((competence, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={competence}
                onChange={(e) => handleCompetenceChange('bureautiques', index, e.target.value)}
                placeholder="Ex: Excel, Word, PowerPoint"
              />
              {responsableForm.competences.bureautiques.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger ms-2"
                  onClick={() => handleRemoveCompetence('bureautiques', index)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleAddCompetence('bureautiques')}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter compétence
          </button>
        </div>

        {/* Langues */}
        <div className="col-md-4">
          <h6 className="fw-bold">Langues</h6>
          {responsableForm.competences.langues.map((langue, index) => (
            <div key={index} className="mb-2 d-flex">
              <input
                type="text"
                className="form-control"
                value={langue}
                onChange={(e) => handleCompetenceChange('langues', index, e.target.value)}
                placeholder="Ex: Français (natif), Anglais (fluent)"
              />
              {responsableForm.competences.langues.length > 1 && (
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

        {/* Permis de conduire */}
        <div className="col-12 mt-3">
          <h6 className="fw-bold">Permis de conduire</h6>
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Type de permis</label>
              <select
                className="form-select"
                value={responsableForm.competences.permis_conduire.type}
                onChange={(e) => handlePermisChange('type', e.target.value)}
              >
                <option value="">Sélectionner</option>
                <option value="A">A (Moto)</option>
                <option value="B">B (Voiture)</option>
                <option value="C">C (Poids lourd)</option>
                <option value="D">D (Transport en commun)</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">Date de validité</label>
              <input
                type="date"
                className="form-control"
                value={responsableForm.competences.permis_conduire.validite}
                onChange={(e) => handlePermisChange('validite', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Références professionnelles */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Références professionnelles</h5>
          <hr />
        </div>
        {responsableForm.references_professionnelles.map((reference, index) => (
          <div key={index} className="row g-2 mb-3 p-3 border rounded">
            <div className="col-md-4">
              <label className="form-label">Nom de la référence</label>
              <input
                type="text"
                className="form-control"
                value={reference.nom_reference}
                onChange={(e) => handleReferenceChange(index, 'nom_reference', e.target.value)}
                placeholder="Nom et prénom"
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Coordonnées</label>
              <input
                type="text"
                className="form-control"
                value={reference.coordonnees}
                onChange={(e) => handleReferenceChange(index, 'coordonnees', e.target.value)}
                placeholder="Email ou téléphone"
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Relation</label>
              <select
                className="form-select"
                value={reference.relation}
                onChange={(e) => handleReferenceChange(index, 'relation', e.target.value)}
              >
                <option value="">Sélectionner</option>
                <option value="Ancien employeur">Ancien employeur</option>
                <option value="Responsable hiérarchique">Responsable hiérarchique</option>
                <option value="Collègue">Collègue</option>
                <option value="Client">Client</option>
              </select>
            </div>
            <div className="col-md-1 d-flex align-items-end">
              {responsableForm.references_professionnelles.length > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={() => handleRemoveReference(index)}
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
            onClick={handleAddReference}
          >
            <i className="bi bi-plus me-1"></i>
            Ajouter référence
          </button>
        </div>

        {/* Engagements */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Engagements</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Disponibilité pour prise de poste</label>
          <input
            type="text"
            className="form-control"
            value={responsableForm.disponibilite_prise_poste}
            onChange={(e) => setResponsableForm({...responsableForm, disponibilite_prise_poste: e.target.value})}
            placeholder="Ex: Immédiate, 15 jours, 1 mois"
          />
        </div>
        <div className="col-12 mt-3">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="engagement_loyaute"
              checked={responsableForm.engagement_loyaute}
              onChange={(e) => setResponsableForm({...responsableForm, engagement_loyaute: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="engagement_loyaute">
              Je m engage à respecter la confidentialité et la loyauté envers l entreprise
            </label>
          </div>
        </div>
        <div className="col-12">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="consentement_verification"
              checked={responsableForm.consentement_verification}
              onChange={(e) => setResponsableForm({...responsableForm, consentement_verification: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="consentement_verification">
              J accepte que mes informations soient vérifiées lors du processus de recrutement
            </label>
          </div>
        </div>

        {/* Documents à joindre */}
        <div className="col-12 mt-3">
          <h5 className="fw-bold">Documents à joindre</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Lettre de motivation</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileChange(e, 'lettre_motivation')}
          />
          <small className="form-text text-muted">Format PDF, DOC ou DOCX</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">CV</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileChange(e, 'cv')}
          />
          <small className="form-text text-muted">Format PDF, DOC ou DOCX</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">Pièce d identité</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(e, 'piece_identite')}
          />
          <small className="form-text text-muted">Format PDF ou image</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">Diplômes</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(e, 'diplomes')}
          />
          <small className="form-text text-muted">Format PDF ou image</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">Attestations d emploi</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.doc,.docx"
            onChange={(e) => handleFileChange(e, 'attestations_emploi')}
          />
          <small className="form-text text-muted">Format PDF, DOC ou DOCX</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">RIB bancaire</label>
          <input
            type="file"
            className="form-control"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(e, 'rib_bancaire')}
          />
          <small className="form-text text-muted">Format PDF ou image</small>
        </div>

        {/* Bouton de soumission */}
        <div className="col-12 mt-4">
          <hr />
          <div className="d-flex justify-content-end">
            <button
              type="submit"
              className="btn btn-primary px-4"
            >
              <i className="bi bi-save me-2"></i>
              Enregistrer le responsable financier
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}