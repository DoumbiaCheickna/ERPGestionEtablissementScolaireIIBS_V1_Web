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
    role_id: '',        // <- sélectionnée dans le <select>
    first_login: '1'
  });

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation des champs obligatoires
      if (!adminForm.nom || !adminForm.prenom || !adminForm.email || 
          !adminForm.login || !adminForm.password || !adminForm.role_id) {
        showErrorToast('Veuillez remplir tous les champs obligatoires');
        return;
      }

      // Récupérer le libellé du rôle choisi pour le stocker sur l'utilisateur
      const selectedRole = roles.find(r => r.id === adminForm.role_id);
      if (!selectedRole) {
        showErrorToast('Rôle sélectionné invalide');
        return;
      }

      // Générer un nouvel ID séquentiel (simple, même logique que le reste du projet)
      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      // Ajouter l'utilisateur (administrateur ou autre selon le select)
      await addDoc(collection(db, "users"), {
        ...adminForm,
        id: newUserId,
        role_id: adminForm.role_id,
        role_libelle: selectedRole.libelle, // ✅ utile pour la redirection côté login
      });

      showSuccessToast('Utilisateur ajouté avec succès !');
      
      // Reset form
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
      console.error('Erreur lors de l\'ajout de l\'utilisateur:', error);
      showErrorToast('Erreur lors de l\'ajout de l\'utilisateur');
    }
  };

  return (
    <form onSubmit={handleAdminSubmit}>
      <div className="row g-3">
        {/* Informations de base */}
        <div className="col-12">
          <h5 className="fw-bold">Informations de l&apos;utilisateur (profil administrateur)</h5>
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
          <label className="form-label">Nom d&apos;utilisateur*</label>
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

        {/* Sélection du rôle (dynamique depuis Firestore) */}
        <div className="col-md-6">
          <label className="form-label">Rôle*</label>
          <select
            className="form-select"
            value={adminForm.role_id}
            onChange={(e) => setAdminForm({ ...adminForm, role_id: e.target.value })}
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

        {/* Information sur la première connexion */}
        <div className="col-12">
          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> La première connexion est définie à 1 pour forcer le changement de mot de passe.
          </div>
        </div>

        <div className="col-12 mt-4">
          <button type="submit" className="btn btn-primary px-4">
            <i className="bi bi-plus-lg me-2"></i>
            Ajouter l&apos;utilisateur
          </button>
        </div>
      </div>
    </form>
  );
}
