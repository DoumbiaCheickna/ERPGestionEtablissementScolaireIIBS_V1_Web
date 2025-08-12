'use client';

import { useState } from 'react';
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';

interface AdminFormProps {
  roles: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

export default function AdminForm({ 
  roles, 
  showSuccessToast, 
  showErrorToast, 
  fetchData 
}: AdminFormProps) {
  const [adminForm, setAdminForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',
    first_login: '1'
  });

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation des champs obligatoires
      if (!adminForm.nom || !adminForm.prenom || !adminForm.email || 
          !adminForm.login || !adminForm.password) {
        showErrorToast('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Trouver le rôle Admin automatiquement
      const adminRole = roles.find(r => r.libelle.toLowerCase().includes('admin'));
      if (!adminRole) {
        showErrorToast('Rôle administrateur non trouvé');
        return;
      }

      // Générer un nouvel ID séquentiel
      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      // Ajouter l'administrateur à la collection users
      await addDoc(collection(db, "users"), {
        ...adminForm,
        id: newUserId,
        role_id: adminRole.id // Assigner automatiquement le rôle admin
      });

      showSuccessToast('Administrateur ajouté avec succès!');
      
      // Réinitialiser le formulaire
      setAdminForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1'
      });

      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'administrateur:', error);
      showErrorToast('Erreur lors de l\'ajout de l\'administrateur');
    }
  };

  // Trouver le rôle admin pour l'affichage
  const adminRole = roles.find(r => r.libelle.toLowerCase().includes('admin'));

  return (
    <form onSubmit={handleAdminSubmit}>
      <div className="row g-3">
        {/* Informations de base */}
        <div className="col-12">
          <h5 className="fw-bold">Informations de l administrateur</h5>
          <hr />
        </div>

        <div className="col-md-6">
          <label className="form-label">Prénom*</label>
          <input
            type="text"
            className="form-control"
            value={adminForm.prenom}
            onChange={(e) => setAdminForm({...adminForm, prenom: e.target.value})}
            required
            placeholder="Entrez le prénom"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Nom*</label>
          <input
            type="text"
            className="form-control"
            value={adminForm.nom}
            onChange={(e) => setAdminForm({...adminForm, nom: e.target.value})}
            required
            placeholder="Entrez le nom"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Email*</label>
          <input
            type="email"
            className="form-control"
            value={adminForm.email}
            onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
            required
            placeholder="exemple@email.com"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Nom d utilisateur*</label>
          <input
            type="text"
            className="form-control"
            value={adminForm.login}
            onChange={(e) => setAdminForm({...adminForm, login: e.target.value})}
            required
            placeholder="Nom d'utilisateur unique"
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Mot de passe*</label>
          <input
            type="password"
            className="form-control"
            value={adminForm.password}
            onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
            required
            placeholder="Mot de passe sécurisé"
            minLength={6}
          />
        </div>

        <div className="col-md-6">
          <label className="form-label">Rôle</label>
          <input
            type="text"
            className="form-control"
            value={adminRole ? adminRole.libelle : 'Admin'}
            disabled
            style={{ backgroundColor: '#f8f9fa', cursor: 'not-allowed' }}
          />
          <small className="text-muted">Le rôle est automatiquement défini sur Administrateur</small>
        </div>

        {/* Information sur la première connexion */}
        <div className="col-12">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> La première connexion sera automatiquement définie pour forcer le changement de mot de passe lors de la première connexion.
          </div>
        </div>

        <div className="col-12 mt-4">
          <button type="submit" className="btn btn-primary px-4">
            <i className="bi bi-plus-lg me-2"></i>
            Ajouter l administrateur
          </button>
        </div>
      </div>
    </form>
  );
}