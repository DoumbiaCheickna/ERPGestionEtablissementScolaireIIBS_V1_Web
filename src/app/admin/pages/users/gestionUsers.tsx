'use client';

import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig'; 
import { useState, useEffect } from 'react';
import Toast from '../../components/ui/Toast';
import StudentForm from './etudiantForm';
import TeacherForm from './professeurForm';
import AdminForm from './adminForm'; 
import ResponsableFinancierForm from "./respoFinancierForm";

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
  // ... other fields
}

interface Role {
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

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [niveaux, setNiveaux] = useState<Niveau[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [matieres, setMatieres] = useState<Matiere[]>([]);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin' | 'responsable-financier'>('student');
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Fetch all necessary data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch users
      const usersQuery = query(collection(db, "users"), orderBy("id", "asc"));
      const usersSnapshot = await getDocs(usersQuery);
      const usersList = usersSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as User[];
      setUsers(usersList);
      
      // Fetch roles
      const rolesQuery = query(collection(db, "roles"));
      const rolesSnapshot = await getDocs(rolesQuery);
      const rolesList = rolesSnapshot.docs.map(doc => ({
        id: doc.id,
        libelle: doc.data().libelle
      })) as Role[];
      setRoles(rolesList);
      
      // Fetch niveaux
      const niveauxQuery = query(collection(db, "niveaux"));
      const niveauxSnapshot = await getDocs(niveauxQuery);
      const niveauxList = niveauxSnapshot.docs.map(doc => ({
        id: doc.id,
        libelle: doc.data().libelle
      })) as Niveau[];
      setNiveaux(niveauxList);
      
      // Fetch filieres
      const filieresQuery = query(collection(db, "filieres"));
      const filieresSnapshot = await getDocs(filieresQuery);
      const filieresList = filieresSnapshot.docs.map(doc => ({
        id: doc.id,
        libelle: doc.data().libelle
      })) as Filiere[];
      setFilieres(filieresList);

      // Fetch matieres
      const matieresQuery = query(collection(db, "matieres"));
      const matieresSnapshot = await getDocs(matieresQuery);
      const matieresList = matieresSnapshot.docs.map(doc => ({
        id: doc.id,
        libelle: doc.data().libelle
      })) as Matiere[];
      setMatieres(matieresList);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      showErrorToast('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  // CRUD operations
  const deleteUser = async (user: User) => {
    if (!user.docId) return;

    if (window.confirm(`Supprimer l'utilisateur ${user.prenom} ${user.nom}?`)) {
      try {
        await deleteDoc(doc(db, "users", user.docId));
        showSuccessToast('Utilisateur supprimé avec succès!');
        await fetchData();
      } catch (error) {
        console.error('Error deleting user:', error);
        showErrorToast('Erreur lors de la suppression');
      }
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const saveEdit = async () => {
    if (!editingUser || !editingUser.docId) return;

    try {
      await updateDoc(doc(db, "users", editingUser.docId), {
        ...editingUser
      });
      
      showSuccessToast('Utilisateur modifié avec succès!');
      setEditingUser(null);
      await fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      showErrorToast('Erreur lors de la modification');
    }
  };

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.prenom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.login.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        {/* Forms Section */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'student' ? 'active' : ''}`}
                    onClick={() => setActiveTab('student')}
                  >
                    <i className="bi bi-person-video2 me-2"></i>
                    Ajouter un étudiant
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'teacher' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teacher')}
                  >
                    <i className="bi bi-person-video me-2"></i>
                    Ajouter un professeur
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    <i className="bi bi-person-gear me-2"></i>
                    Ajouter un administrateur
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'responsable-financier' ? 'active' : ''}`}
                    onClick={() => setActiveTab('responsable-financier')}
                  >
                    <i className="bi bi-calculator me-2"></i>
                    Ajouter un responsable financier
                  </button>
                </li>
              </ul>
            </div>
            
            <div className="card-body">
              {activeTab === 'student' && (
                <StudentForm 
                  roles={roles}
                  niveaux={niveaux}
                  filieres={filieres}
                  showSuccessToast={showSuccessToast}
                  showErrorToast={showErrorToast}
                  fetchData={fetchData}
                />
              )}
              {activeTab === 'teacher' && (
                <TeacherForm 
                  roles={roles}
                  matieres={matieres}
                  showSuccessToast={showSuccessToast}
                  showErrorToast={showErrorToast}
                  fetchData={fetchData}
                />
              )}
              {activeTab === 'admin' && (
                <AdminForm 
                  roles={roles}
                  showSuccessToast={showSuccessToast}
                  showErrorToast={showErrorToast}
                  fetchData={fetchData}
                />
              )}
              {activeTab === 'responsable-financier' && (
                <ResponsableFinancierForm 
                  roles={roles}
                  showSuccessToast={showSuccessToast}
                  showErrorToast={showErrorToast}
                  fetchData={fetchData}
                />
              )}
            </div>
          </div>
        </div>

        {/* Users List Section */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0 fw-semibold">
                  <i className="bi bi-people me-2 text-primary"></i>
                  Liste des utilisateurs
                </h5>
                <div className="d-flex">
                  <input
                    type="text"
                    className="form-control me-2"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '200px' }}
                  />
                  <span className="badge bg-light text-dark px-3 py-2">
                    Affichés: {filteredUsers.length}
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
                {filteredUsers.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Nom</th>
                          <th>Email</th>
                          <th>Nom d utilisateur</th>
                          <th>Rôle</th>
                          <th>Classe/Poste</th>
                          <th>Première connexion</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>#{user.id}</td>
                            <td>
                              {editingUser?.id === user.id ? (
                                <>
                                  <input
                                    type="text"
                                    className="form-control form-control-sm mb-1"
                                    value={editingUser.prenom}
                                    onChange={(e) => setEditingUser({...editingUser, prenom: e.target.value})}
                                    placeholder="Prénom"
                                  />
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    value={editingUser.nom}
                                    onChange={(e) => setEditingUser({...editingUser, nom: e.target.value})}
                                    placeholder="Nom"
                                  />
                                </>
                              ) : (
                                `${user.prenom} ${user.nom}`
                              )}
                            </td>
                            <td>
                              {editingUser?.id === user.id ? (
                                <input
                                  type="email"
                                  className="form-control form-control-sm"
                                  value={editingUser.email}
                                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                                />
                              ) : (
                                user.email
                              )}
                            </td>
                            <td>
                              {editingUser?.id === user.id ? (
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={editingUser.login}
                                  onChange={(e) => setEditingUser({...editingUser, login: e.target.value})}
                                />
                              ) : (
                                user.login
                              )}
                            </td>
                            <td>
                              {editingUser?.id === user.id ? (
                                <select
                                  className="form-select form-select-sm"
                                  value={editingUser.role_id}
                                  onChange={(e) => setEditingUser({...editingUser, role_id: e.target.value})}
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
                              {editingUser?.id === user.id ? (
                                <div className="btn-group btn-group-sm">
                                  <button className="btn btn-success" onClick={saveEdit}>
                                    <i className="bi bi-check"></i> Sauvegarder
                                  </button>
                                  <button className="btn btn-secondary" onClick={cancelEdit}>
                                    <i className="bi bi-x"></i> Annuler
                                  </button>
                                </div>
                              ) : (
                                <div className="btn-group btn-group-sm">
                                  <button 
                                    className="btn btn-outline-primary" 
                                    onClick={() => startEdit(user)}
                                  >
                                    <i className="bi bi-pencil"></i> Modifier
                                  </button>
                                  <button 
                                    className="btn btn-outline-danger" 
                                    onClick={() => deleteUser(user)}
                                  >
                                    <i className="bi bi-trash"></i> Supprimer
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
                    <i className="bi bi-people text-muted" style={{ fontSize: '3rem' }}></i>
                    <h5 className="text-muted mt-3">Aucun utilisateur trouvé</h5>
                    {searchTerm ? (
                      <p className="text-muted">Essayez un autre terme de recherche</p>
                    ) : (
                      <p className="text-muted">Ajoutez votre premier utilisateur avec le formulaire ci-dessus</p>
                    )}
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