'use client';

import { collection, getDocs, addDoc, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig'; 
import { useState, useEffect } from 'react';
import Toast from '../../components/ui/Toast';
import React from 'react';

interface Role {
  id: number;
  libelle: string;
  docId?: string; // Firestore document ID
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [libelle, setLibelle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editLibelle, setEditLibelle] = useState<string>('');

  const showSuccessToast = (msg: string) => {
    setToastMessage(msg);
    setShowSuccess(true);
  };

  const showErrorToast = (msg: string) => {
    setToastMessage(msg);
    setShowError(true);
  };

  // Function to list roles from Firestore
  const listRoles = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, "roles"), orderBy("id", "asc"));
      const querySnapshot = await getDocs(q);
      
      const rolesList: Role[] = [];
      querySnapshot.forEach((doc) => {
        rolesList.push({
          id: doc.data().id,
          libelle: doc.data().libelle,
          docId: doc.id // Store Firestore document ID
        });
      });
      
      setRoles(rolesList);
    } catch (error) {
      console.error('Error fetching roles:', error);
      showErrorToast('Erreur lors du chargement des rôles.');
    } finally {
      setLoading(false);
    }
  };

  // Function to add a new role
  const addRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!libelle.trim()) {
      showErrorToast('Veuillez saisir un libellé.');
      return;
    }

    try {
      // Get current collection size to generate new ID
      const rolesSnapshot = await getDocs(collection(db, "roles"));
      const newId = rolesSnapshot.size + 1;

      // Add new role to Firestore
      await addDoc(collection(db, "roles"), {
        id: newId,
        libelle: libelle.trim()
      });

      showSuccessToast('Rôle ajouté avec succès !');
      setLibelle(''); // Clear form
      
      // Refresh the roles list
      await listRoles();
      
    } catch (error) {
      console.error('Error adding role:', error);
      showErrorToast('Erreur lors de l\'ajout du rôle.');
    }
  };

  // Function to delete a role
  const deleteRole = async (role: Role) => {
    if (!role.docId) {
      showErrorToast('Impossible de supprimer ce rôle.');
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.libelle}" ?`)) {
      try {
        await deleteDoc(doc(db, "roles", role.docId));
        showSuccessToast('Rôle supprimé avec succès !');
        await listRoles(); // Refresh the list
      } catch (error) {
        console.error('Error deleting role:', error);
        showErrorToast('Erreur lors de la suppression du rôle.');
      }
    }
  };

  // Function to start editing a role
  const startEdit = (role: Role) => {
    setEditingRole(role);
    setEditLibelle(role.libelle);
  };

  // Function to cancel editing
  const cancelEdit = () => {
    setEditingRole(null);
    setEditLibelle('');
  };

  // Function to save edited role
  const saveEdit = async () => {
    if (!editingRole || !editingRole.docId) {
      showErrorToast('Erreur lors de la modification.');
      return;
    }

    if (!editLibelle.trim()) {
      showErrorToast('Veuillez saisir un libellé.');
      return;
    }

    try {
      await updateDoc(doc(db, "roles", editingRole.docId), {
        libelle: editLibelle.trim()
      });
      
      showSuccessToast('Rôle modifié avec succès !');
      setEditingRole(null);
      setEditLibelle('');
      await listRoles(); // Refresh the list
    } catch (error) {
      console.error('Error updating role:', error);
      showErrorToast('Erreur lors de la modification du rôle.');
    }
  };

  // Load roles on component mount
  useEffect(() => {
    listRoles();
  }, []);

  return (
    <div className="container-fluid px-4 py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">Gestion des Rôles</h2>
          <p className="text-muted mb-0">Gérez les rôles et permissions utilisateurs</p>
        </div>
        <div className="badge bg-primary fs-6 px-3 py-2">
          {roles.length} rôle{roles.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="row g-4">
        {/* Add Role Card */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <h5 className="card-title mb-0 fw-semibold">
                <i className="bi bi-plus-circle me-2 text-primary"></i>
                Ajouter un nouveau rôle
              </h5>
            </div>
            <div className="card-body">
              <form onSubmit={addRole}>
                <div className="row g-3 align-items-end">
                  <div className="col-md-8">
                    <label htmlFor="libelle" className="form-label fw-medium text-dark">
                      Libellé du rôle
                    </label>
                    <input
                      type="text"
                      id="libelle"
                      className="form-control form-control-lg border-0 bg-light"
                      placeholder="Ex: Administrateur, Professeur, Étudiant..."
                      value={libelle}
                      onChange={(e) => setLibelle(e.target.value)}
                      required
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                  <div className="col-md-4">
                    <button
                      className="btn btn-primary btn-lg w-100 fw-semibold"
                      type="submit"
                      style={{ borderRadius: '10px' }}
                    >
                      <i className="bi bi-plus-lg me-2"></i>
                      Ajouter
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Roles List Card */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0 fw-semibold">
                  <i className="bi bi-list-ul me-2 text-primary"></i>
                  Liste des rôles
                </h5>
                <span className="badge bg-light text-dark px-3 py-2">
                  Total: {roles.length}
                </span>
              </div>
            </div>
            
            {loading ? (
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
                  <span className="visually-hidden">Chargement...</span>
                </div>
                <p className="text-muted mb-0">Chargement des rôles...</p>
              </div>
            ) : (
              <div className="card-body p-0">
                {roles.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="border-0 fw-semibold text-dark" style={{ width: '100px' }}>
                            <i className="bi bi-hash me-1"></i>ID
                          </th>
                          <th className="border-0 fw-semibold text-dark">
                            <i className="bi bi-tag me-1"></i>Libellé
                          </th>
                          <th className="border-0 fw-semibold text-dark" style={{ width: '120px' }}>
                            <i className="bi bi-calendar me-1"></i>Statut
                          </th>
                          <th className="border-0 fw-semibold text-dark" style={{ width: '150px' }}>
                            <i className="bi bi-gear me-1"></i>Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((role, index) => (
                          <tr key={`${role.id}-${index}`} style={{ transition: 'all 0.2s ease' }}>
                            <td className="align-middle">
                              <span 
                                className="badge bg-gradient"
                                style={{ 
                                  background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '600'
                                }}
                              >
                                #{role.id.toString().padStart(3, '0')}
                              </span>
                            </td>
                            <td className="align-middle">
                              {editingRole?.id === role.id ? (
                                <div className="d-flex align-items-center">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm me-2"
                                    value={editLibelle}
                                    onChange={(e) => setEditLibelle(e.target.value)}
                                    style={{ borderRadius: '6px' }}
                                  />
                                </div>
                              ) : (
                                <div className="d-flex align-items-center">
                                  <div 
                                    className="rounded-circle me-3 d-flex align-items-center justify-content-center"
                                    style={{ 
                                      width: '40px', 
                                      height: '40px', 
                                      background: 'linear-gradient(45deg, #667eea 0%, #764ba2 100%)',
                                      color: 'white',
                                      fontSize: '14px',
                                      fontWeight: '600'
                                    }}
                                  >
                                    {role.libelle.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="fw-medium text-dark">{role.libelle}</span>
                                    <div className="small text-muted">Rôle système</div>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="align-middle">
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                                <i className="bi bi-check-circle me-1"></i>
                                Actif
                              </span>
                            </td>
                            <td className="align-middle">
                              {editingRole?.id === role.id ? (
                                <div className="btn-group" role="group">
                                  <button
                                    className="btn btn-success btn-sm"
                                    onClick={saveEdit}
                                    title="Sauvegarder"
                                  >
                                    <i className="bi bi-check-lg">Sauvegarder</i>
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={cancelEdit}
                                    title="Annuler"
                                  >
                                    <i className="bi bi-x-lg">Annuler</i>
                                  </button>
                                </div>
                              ) : (
                                <div className="btn-group" role="group">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => startEdit(role)}
                                    title="Modifier"
                                  >
                                    <i className="bi bi-pencil">Modifier</i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => deleteRole(role)}
                                    title="Supprimer"
                                  >
                                    <i className="bi bi-trash">Supprimer</i>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <div className="mb-4">
                      <i className="bi bi-folder2-open text-muted" style={{ fontSize: '4rem' }}></i>
                    </div>
                    <h6 className="text-muted fw-medium">Aucun rôle trouvé</h6>
                    <p className="text-muted mb-4">Commencez par ajouter votre premier rôle</p>
                    <div className="d-flex justify-content-center">
                      <div className="bg-light rounded-3 px-4 py-2">
                        <small className="text-muted">
                          <i className="bi bi-lightbulb me-1"></i>
                          Utilisez le formulaire ci-dessus pour créer un nouveau rôle
                        </small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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