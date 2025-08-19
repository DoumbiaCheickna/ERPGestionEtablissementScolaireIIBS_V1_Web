'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';
import Toast from '../../components/ui/Toast';
import StudentForm from './etudiantForm';
import TeacherForm from './professeurForm';
import AdminForm from './adminForm';
import ResponsableFinancierForm from "./respoFinancierForm";
import DirectorForm from './directeurForm';
import UserViewModal from './userModalView';

interface User {
  classe?: string;
  id: number;
  email: string;
  first_login: string;
  login: string;
  nom: string;
  password: string;
  prenom: string;
  role_id: string;
  docId?: string;
  specialty?: string;
  intitule_poste?: string;
}

interface Role {
  id: string;
  libelle: string;
}

interface Partenaire {
  id: string;
  libelle: string;
}
interface Niveau {
  id: string;
  libelle: string;
}

interface Filiere {
  id: string;
  libelle: string;
}

interface Matiere {
  id: string;
  libelle: string;
}

const PAGE_SIZE = 10;

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [partenaires, setPartenaires] = useState<Partenaire[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals d’ajout
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showFinModal, setShowFinModal] = useState(false);
  const [showDirectorModal, setShowDirectorModal] = useState(false);

  // Toast
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Edition inline
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Vue détail
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Recherche / filtres
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination (client)
  const [currentPage, setCurrentPage] = useState(1);

  // Toast helpers
  const showSuccessToast = (msg: string) => {
    setToastMessage(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };
  const showErrorToast = (msg: string) => {
    setToastMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 3000);
  };

  // Vue détail
  const viewUser = (user: User) => {
    setViewingUser(user);
    setShowViewModal(true);
  };
  const closeViewModal = () => {
    setViewingUser(null);
    setShowViewModal(false);
  };

  // Effacer filtres
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedRole('');
  };

  // Chargement des données
  const fetchData = async () => {
    try {
      setLoading(true);

      // Users
      const usersQuery = query(collection(db, "users"), orderBy("id", "asc"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(d => ({
        ...(d.data() as any),
        docId: d.id
      })) as User[];
      setUsers(usersList);

      // Roles
      const rolesQuery = query(collection(db, "roles"));
      const rolesSnapshot = await getDocs(rolesQuery);
      const rolesList = rolesSnapshot.docs.map(d => ({
        id: d.id,
        libelle: (d.data() as any).libelle
      })) as Role[];
      setRoles(rolesList);

      // Niveaux
      const niveauxQuery = query(collection(db, "niveaux"));
      const niveauxSnapshot = await getDocs(niveauxQuery);
      const niveauxList = niveauxSnapshot.docs.map(d => ({
        id: d.id,
        libelle: (d.data() as any).libelle
      })) as Niveau[];
      setNiveaux(niveauxList);

      // Filieres
      const filieresQuery = query(collection(db, "filieres"));
      const filieresSnapshot = await getDocs(filieresQuery);
      const filieresList = filieresSnapshot.docs.map(d => ({
        id: d.id,
        libelle: (d.data() as any).libelle
      })) as Filiere[];
      setFilieres(filieresList);

      // Matieres
      const matieresQuery = query(collection(db, "matieres"));
      const matieresSnapshot = await getDocs(matieresQuery);
      const matieresList = matieresSnapshot.docs.map(d => ({
        id: d.id,
        libelle: (d.data() as any).libelle
      })) as Matiere[];
      setMatieres(matieresList);

      // Partenaires
      const partenairesQuery = query(collection(db, "partenaires"));
      const partenairesSnapshot = await getDocs(partenairesQuery);
      const partenairesList = partenairesSnapshot.docs.map(d => ({
        id: d.id,
        libelle: (d.data() as any).libelle
      })) as Partenaire[];
      setPartenaires(partenairesList);

    } catch (error) {
      console.error('Error fetching data:', error);
      showErrorToast('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // Après création via un modal, on recharge la liste
  const reloadAfterMutation = async () => {
    await fetchData();
  };

  // CRUD
  const deleteUser = async (user: User) => {
    if (!user.docId) return;

    if (window.confirm(`Supprimer l'utilisateur ${user.prenom} ${user.nom} ?`)) {
      try {
        await deleteDoc(doc(db, "users", user.docId));
        showSuccessToast('Utilisateur supprimé avec succès !');
        await fetchData();
      } catch (error) {
        console.error('Error deleting user:', error);
        showErrorToast('Erreur lors de la suppression');
      }
    }
  };

  const startEdit = (user: User) => setEditingUser(user);
  const cancelEdit = () => setEditingUser(null);

  const saveEdit = async () => {
    if (!editingUser || !editingUser.docId) return;
    try {
      const { docId, ...payload } = editingUser; // ne pas envoyer docId dans le doc
      await updateDoc(doc(db, "users", editingUser.docId), payload as any);
      showSuccessToast('Utilisateur modifié avec succès !');
      setEditingUser(null);
      await fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      showErrorToast('Erreur lors de la modification');
    }
  };

  // Filtrage + pagination
  const filteredUsers = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return users.filter(u => {
      const matchesSearch =
        !s ||
        u.nom?.toLowerCase().includes(s) ||
        u.prenom?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.login?.toLowerCase().includes(s);
      const matchesRole = !selectedRole || u.role_id === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, selectedRole]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const pageStart = (page - 1) * PAGE_SIZE;
  const pageEnd = pageStart + PAGE_SIZE;
  const pagedUsers = filteredUsers.slice(pageStart, pageEnd);

  useEffect(() => {
    // Revenir à la page 1 quand filtres/recherche changent ou quand users sont rechargés
    setCurrentPage(1);
  }, [searchTerm, selectedRole, users.length]);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container-fluid px-4 py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">Gestion des utilisateurs</h2>
          <p className="text-muted mb-0">Gérer les étudiants, professeurs, administrateurs et responsables financiers</p>
        </div>
        <div className="badge bg-primary fs-6 px-3 py-2">
          {users.length} utilisateur{users.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="row g-4">
        {/* Boutons qui ouvrent les MODALS */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex flex-wrap gap-2">
                {/* >>> Boutons masqués à ta demande (commentés) <<< */}
                {/*
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setShowStudentModal(true)}
                >
                  <i className="bi bi-person-video2 me-2"></i>
                  Ajouter un étudiant
                </button>
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => setShowTeacherModal(true)}
                >
                  <i className="bi bi-person-video me-2"></i>
                  Ajouter un professeur
                </button>
                */}
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setShowAdminModal(true)}
                >
                  <i className="bi bi-person-gear me-2"></i>
                  Ajouter un administrateur
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setShowFinModal(true)}
                >
                  <i className="bi bi-calculator me-2"></i>
                  Ajouter un responsable financier
                </button>
                <button
                  className="btn btn-outline-primary"
                  onClick={() => setShowDirectorModal(true)}
                >
                  <i className="bi bi-mortarboard me-2"></i>
                  Ajouter un Directeur des Études
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Liste paginée */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0 fw-semibold">
                  <i className="bi bi-people me-2 text-primary"></i>
                  Liste des utilisateurs
                </h5>

                <div className="d-flex align-items-center gap-2">
                  <div className="input-group" style={{ width: '250px' }}>
                    <span className="input-group-text bg-white border-end-0">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control border-start-0"
                      placeholder="Rechercher..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="btn btn-outline-secondary border-start-0"
                        type="button"
                        onClick={() => setSearchTerm('')}
                      >
                        <i className="bi bi-x"></i>
                      </button>
                    )}
                  </div>

                  <select
                    className="form-select"
                    style={{ width: '200px' }}
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    <option value="">Tous les rôles</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.libelle}
                      </option>
                    ))}
                  </select>

                  {(searchTerm || selectedRole) && (
                    <button
                      className="btn btn-outline-warning"
                      onClick={clearFilters}
                      title="Effacer les filtres"
                    >
                      <i className="bi bi-filter-circle-fill me-1"></i>
                      Effacer
                    </button>
                  )}

                  <span className="badge bg-light text-dark px-3 py-2 border">
                    <i className="bi bi-eye me-1"></i>
                    {filteredUsers.length} sur {users.length}
                  </span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Chargement...</span>
                </div>
                <p className="text-muted mt-2">Chargement des utilisateurs...</p>
              </div>
            ) : (
              <div className="card-body p-0">
                {pagedUsers.length > 0 ? (
                  <>
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>ID</th>
                            <th>Nom</th>
                            <th>Email</th>
                            <th>Nom d’utilisateur</th>
                            <th>Rôle</th>
                            <th>Classe/Poste</th>
                            <th>Première connexion</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedUsers.map((user) => (
                            <tr key={user.docId}>
                              <td>#{user.id}</td>

                              <td>
                                {editingUser?.docId === user.docId ? (
                                  <>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm mb-1"
                                      value={editingUser?.prenom ?? ''}
                                      onChange={(e) =>
                                        setEditingUser(prev =>
                                          prev ? { ...prev, prenom: e.target.value } : prev
                                        )
                                      }
                                      placeholder="Prénom"
                                    />
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={editingUser?.nom ?? ''}
                                      onChange={(e) =>
                                        setEditingUser(prev =>
                                          prev ? { ...prev, nom: e.target.value } : prev
                                        )
                                      }
                                      placeholder="Nom"
                                    />
                                  </>
                                ) : (
                                  `${user.prenom} ${user.nom}`
                                )}
                              </td>

                              <td>
                                {editingUser?.docId === user.docId ? (
                                  <input
                                    type="email"
                                    className="form-control form-control-sm"
                                    value={editingUser?.email ?? ''}
                                    onChange={(e) =>
                                      setEditingUser(prev =>
                                        prev ? { ...prev, email: e.target.value } : prev
                                      )
                                    }
                                  />
                                ) : (
                                  user.email
                                )}
                              </td>

                              <td>
                                {editingUser?.docId === user.docId ? (
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editingUser?.login ?? ''}
                                    onChange={(e) =>
                                      setEditingUser(prev =>
                                        prev ? { ...prev, login: e.target.value } : prev
                                      )
                                    }
                                  />
                                ) : (
                                  user.login
                                )}
                              </td>

                              <td>
                                {editingUser?.docId === user.docId ? (
                                  <select
                                    className="form-select form-select-sm"
                                    value={editingUser?.role_id ?? ''}
                                    onChange={(e) =>
                                      setEditingUser(prev =>
                                        prev ? { ...prev, role_id: e.target.value } : prev
                                      )
                                    }
                                  >
                                    {roles.map(role => (
                                      <option key={role.id} value={role.id}>
                                        {role.libelle}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  roles.find(r => r.id === user.role_id)?.libelle || 'Inconnu'
                                )}
                              </td>

                              <td>
                                {user.classe || user.intitule_poste || user.specialty || '-'}
                              </td>

                              <td>
                                {user.first_login === '1' ? (
                                  <span className="badge bg-warning text-dark">Oui</span>
                                ) : (
                                  <span className="badge bg-success">Non</span>
                                )}
                              </td>

                              <td>
                                {editingUser?.docId === user.docId ? (
                                  <div className="btn-group btn-group-sm">
                                    <button className="btn btn-success" onClick={saveEdit}>
                                      <i className="bi bi-check"></i>
                                    </button>
                                    <button className="btn btn-secondary" onClick={cancelEdit}>
                                      <i className="bi bi-x"></i>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="btn-group btn-group-sm">
                                    <button
                                      className="btn btn-outline-info"
                                      onClick={() => viewUser(user)}
                                      title="Voir les détails"
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>
                                    <button
                                      className="btn btn-outline-primary"
                                      onClick={() => startEdit(user)}
                                      title="Modifier"
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                    <button
                                      className="btn btn-outline-danger"
                                      onClick={() => deleteUser(user)}
                                      title="Supprimer"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination controls */}
                    <div className="d-flex justify-content-between align-items-center px-3 py-2">
                      <small className="text-muted">
                        Affichage {filteredUsers.length === 0 ? 0 : pageStart + 1}–
                        {Math.min(pageEnd, filteredUsers.length)} sur {filteredUsers.length}
                      </small>

                      <nav>
                        <ul className="pagination mb-0">
                          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                              Précédent
                            </button>
                          </li>

                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pn => (
                            <li key={pn} className={`page-item ${pn === page ? 'active' : ''}`}>
                              <button className="page-link" onClick={() => setCurrentPage(pn)}>
                                {pn}
                              </button>
                            </li>
                          ))}

                          <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                            <button
                              className="page-link"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                              Suivant
                            </button>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
                    <h5 className="text-muted mt-3">Aucun utilisateur trouvé</h5>
                    {searchTerm || selectedRole ? (
                      <div>
                        <p className="text-muted">Aucun résultat pour les filtres appliqués</p>
                        <button className="btn btn-outline-primary btn-sm" onClick={clearFilters}>
                          <i className="bi bi-arrow-clockwise me-1"></i>
                          Effacer les filtres
                        </button>
                      </div>
                    ) : (
                      <p className="text-muted">Ajoutez votre premier utilisateur avec les boutons ci-dessus</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------- MODALS ------- */}

      {/* Modal Administrateur */}
      {showAdminModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-person-gear me-2" />
                    Ajouter un administrateur
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowAdminModal(false)} />
                </div>
                <div className="modal-body">
                  <AdminForm
                    roles={roles}
                    showSuccessToast={showSuccessToast}
                    showErrorToast={showErrorToast}
                    fetchData={reloadAfterMutation}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowAdminModal(false)} />
        </>
      )}

      {/* Modal Responsable Financier */}
      {showFinModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-calculator me-2" />
                    Ajouter un responsable financier
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowFinModal(false)} />
                </div>
                <div className="modal-body">
                  <ResponsableFinancierForm
                    roles={roles}
                    showSuccessToast={showSuccessToast}
                    showErrorToast={showErrorToast}
                    fetchData={reloadAfterMutation}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowFinModal(false)} />
        </>
      )}

      {/* Modal Directeur des Études */}
      {showDirectorModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-mortarboard me-2" />
                    Ajouter un Directeur des Études
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowDirectorModal(false)} />
                </div>
                <div className="modal-body">
                  <DirectorForm
                    roles={roles}
                    showSuccessToast={showSuccessToast}
                    showErrorToast={showErrorToast}
                    fetchData={reloadAfterMutation}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowDirectorModal(false)} />
        </>
      )}

      {/* Modal de visualisation d’un utilisateur */}
      <UserViewModal
        user={viewingUser}
        roles={roles}
        show={showViewModal}
        onClose={closeViewModal}
        onEdit={startEdit}
      />

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
