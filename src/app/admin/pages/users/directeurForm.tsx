'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';

interface DirectorFormProps {
  roles: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

export default function DirectorForm({
  roles,
  showSuccessToast,
  showErrorToast,
  fetchData
}: DirectorFormProps) {

  const [directorForm, setDirectorForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',        // <- sélectionné dans le <select>
    first_login: '1',
    telephone: '',
    departement: '',
  });

  const handleDirectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation minimale
      if (
        !directorForm.nom ||
        !directorForm.prenom ||
        !directorForm.email ||
        !directorForm.login ||
        !directorForm.password ||
        !directorForm.role_id
      ) {
        showErrorToast('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Rôle sélectionné (pour stocker aussi le libellé)
      const selectedRole = roles.find(r => r.id === directorForm.role_id);
      if (!selectedRole) {
        showErrorToast('Rôle sélectionné invalide');
        return;
      }

      // Générer un ID séquentiel (même logique que le reste de l’app)
      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      await addDoc(collection(db, "users"), {
        ...directorForm,
        id: newUserId,
        role_id: directorForm.role_id,
        role_libelle: selectedRole.libelle, // ✅ pratique pour la redirection post-login
      });

      showSuccessToast('Directeur des Études ajouté avec succès !');

      // Reset
      setDirectorForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1',
        telephone: '',
        departement: '',
      });

      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l’ajout du Directeur des Études:', error);
      showErrorToast('Erreur lors de l’ajout du Directeur des Études');
    }
  };

  return (
    <form onSubmit={handleDirectorSubmit}>
      <div className="row g-3">
        <div className="col-12">
          <h5 className="fw-bold">Directeur des Études</h5>
          <hr />
        </div>

        <div className="col-md-6">
          <label className="form-label">Prénom*</label>
          <input
            type="text"
            className="form-control"
            value={directorForm.prenom}
            onChange={(e) => setDirectorForm({ ...directorForm, prenom: e.target.value })}
            required
            placeholder="Entrez le prénom"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Nom*</label>
          <input
            type="text"
            className="form-control"
            value={directorForm.nom}
            onChange={(e) => setDirectorForm({ ...directorForm, nom: e.target.value })}
            required
            placeholder="Entrez le nom"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Email*</label>
          <input
            type="email"
            className="form-control"
            value={directorForm.email}
            onChange={(e) => setDirectorForm({ ...directorForm, email: e.target.value })}
            required
            placeholder="exemple@email.com"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Nom d’utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={directorForm.login}
            onChange={(e) => setDirectorForm({ ...directorForm, login: e.target.value })}
            required
            placeholder="Nom d'utilisateur unique"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Mot de passe*</label>
          <input
            type="password"
            className="form-control"
            value={directorForm.password}
            onChange={(e) => setDirectorForm({ ...directorForm, password: e.target.value })}
            required
            placeholder="Mot de passe sécurisé"
            minLength={6}
          />
        </div>

        {/* Sélection du rôle (depuis la collection roles) */}
        <div className="col-md-6">
          <label className="form-label">Rôle*</label>
          <select
            className="form-select"
            value={directorForm.role_id}
            onChange={(e) => setDirectorForm({ ...directorForm, role_id: e.target.value })}
            required
          >
            <option value="">Sélectionner un rôle</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>
                {r.libelle}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={directorForm.telephone}
            onChange={(e) => setDirectorForm({ ...directorForm, telephone: e.target.value })}
            placeholder="Numéro de téléphone"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Département</label>
          <input
            type="text"
            className="form-control"
            value={directorForm.departement}
            onChange={(e) => setDirectorForm({ ...directorForm, departement: e.target.value })}
            placeholder="Ex : Pédagogie / Scolarité"
          />
        </div>

        <div className="col-12">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            La première connexion est activée pour forcer le changement de mot de passe.
          </div>
        </div>

        <div className="col-12 mt-2">
          <button type="submit" className="btn btn-primary px-4">
            <i className="bi bi-plus-lg me-2"></i>
            Ajouter le Directeur des Études
          </button>
        </div>
      </div>
    </form>
  );
}
