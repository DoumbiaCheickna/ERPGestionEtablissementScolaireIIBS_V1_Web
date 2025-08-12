'use client';

import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, addDoc } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig'; 
import { useState, useEffect } from 'react';
import Toast from '../../components/ui/Toast';

interface Item {
  id: number;
  libelle: string;
  docId?: string;
}

export default function GestionModule() {
  const [filieres, setFilieres] = useState<Item[]>([]);
  const [matieres, setMatieres] = useState<Item[]>([]);
  const [niveaux, setNiveaux] = useState<Item[]>([]);
  const [partenaires, setPartenaires] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<'filieres' | 'matieres' | 'niveaux' | 'partenaires'>('filieres');
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [filiereForm, setFiliereForm] = useState({ libelle: '' });
  const [matiereForm, setMatiereForm] = useState({ libelle: '' });
  const [niveauForm, setNiveauForm] = useState({ libelle: '' });
  const [partenaireForm, setPartenaireForm] = useState({ libelle: '' });

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

  // Fetch data functions
  const fetchFilieres = async () => {
    try {
      const filieresQuery = query(collection(db, "filieres"), orderBy("id", "asc"));
      const filieresSnapshot = await getDocs(filieresQuery);
      const filieresList = filieresSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as Item[];
      setFilieres(filieresList);
    } catch (error) {
      console.error('Error fetching filieres:', error);
    }
  };

  const fetchMatieres = async () => {
    try {
      const matieresQuery = query(collection(db, "matieres"), orderBy("id", "asc"));
      const matieresSnapshot = await getDocs(matieresQuery);
      const matieresList = matieresSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as Item[];
      setMatieres(matieresList);
    } catch (error) {
      console.error('Error fetching matieres:', error);
    }
  };

  const fetchNiveaux = async () => {
    try {
      const niveauxQuery = query(collection(db, "niveaux"), orderBy("id", "asc"));
      const niveauxSnapshot = await getDocs(niveauxQuery);
      const niveauxList = niveauxSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as Item[];
      setNiveaux(niveauxList);
    } catch (error) {
      console.error('Error fetching niveaux:', error);
    }
  };

  const fetchPartenaires = async () => {
    try {
      const partenairesQuery = query(collection(db, "partenaires"), orderBy("id", "asc"));
      const partenairesSnapshot = await getDocs(partenairesQuery);
      const partenairesList = partenairesSnapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      })) as Item[];
      setPartenaires(partenairesList);
    } catch (error) {
      console.error('Error fetching partenaires:', error);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchFilieres(),
        fetchMatieres(),
        fetchNiveaux(),
        fetchPartenaires()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      showErrorToast('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  // CRUD operations
    const addItem = async (
        collectionName: string,
        formData: { libelle: string },
        setForm: React.Dispatch<React.SetStateAction<{ libelle: string }>>
    ) => {
    try {
      if (!formData.libelle.trim()) {
        showErrorToast('Veuillez saisir un libellé');
        return;
      }

      // Get collection snapshot to calculate new ID
      const snapshot = await getDocs(collection(db, collectionName));
      const newId = snapshot.size + 1;

      await addDoc(collection(db, collectionName), {
        id: newId,
        libelle: formData.libelle.trim()
      });

      showSuccessToast(`${collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1)} ajouté avec succès!`);
      setForm({ libelle: '' });
      await fetchAllData();
    } catch (error) {
      console.error(`Error adding ${collectionName}:`, error);
      showErrorToast(`Erreur lors de l'ajout`);
    }
  };

  const deleteItem = async (collectionName: string, item: Item) => {
    if (!item.docId) return;

    if (window.confirm(`Supprimer "${item.libelle}"?`)) {
      try {
        await deleteDoc(doc(db, collectionName, item.docId));
        showSuccessToast('Élément supprimé avec succès!');
        await fetchAllData();
      } catch (error) {
        console.error('Error deleting item:', error);
        showErrorToast('Erreur lors de la suppression');
      }
    }
  };

  const startEdit = (item: Item) => {
    setEditingItem(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const saveEdit = async (collectionName: string) => {
    if (!editingItem || !editingItem.docId) return;

    try {
      await updateDoc(doc(db, collectionName, editingItem.docId), {
        libelle: editingItem.libelle
      });
      
      showSuccessToast('Élément modifié avec succès!');
      setEditingItem(null);
      await fetchAllData();
    } catch (error) {
      console.error('Error updating item:', error);
      showErrorToast('Erreur lors de la modification');
    }
  };

  // Get current data based on active tab
  const getCurrentData = () => {
    switch (activeTab) {
      case 'filieres': return filieres;
      case 'matieres': return matieres;
      case 'niveaux': return niveaux;
      case 'partenaires': return partenaires;
      default: return [];
    }
  };

  const getCurrentForm = () => {
    switch (activeTab) {
      case 'filieres': return filiereForm;
      case 'matieres': return matiereForm;
      case 'niveaux': return niveauForm;
      case 'partenaires': return partenaireForm;
      default: return { libelle: '' };
    }
  };

  const getCurrentSetForm = () => {
    switch (activeTab) {
      case 'filieres': return setFiliereForm;
      case 'matieres': return setMatiereForm;
      case 'niveaux': return setNiveauForm;
      case 'partenaires': return setPartenaireForm;
      default: return () => {};
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'filieres': return 'Filière';
      case 'matieres': return 'Matière';
      case 'niveaux': return 'Niveau';
      case 'partenaires': return 'Partenaire';
      default: return '';
    }
  };

  const getTabIcon = () => {
    switch (activeTab) {
      case 'filieres': return 'bi-diagram-3';
      case 'matieres': return 'bi-book';
      case 'niveaux': return 'bi-bar-chart-steps';
      case 'partenaires': return 'bi-building';
      default: return 'bi-plus';
    }
  };

  // Filter items based on search term
  const filteredData = getCurrentData().filter(item => 
    item.libelle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addItem(activeTab, getCurrentForm(), getCurrentSetForm());
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <div className="container-fluid px-4 py-4" style={{ backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">Gestion des modules</h2>
          <p className="text-muted mb-0">Gérer les filières, matières, niveaux et partenaires</p>
        </div>
        <div className="badge bg-primary fs-6 px-3 py-2">
          {getCurrentData().length} {activeTab}
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
                    className={`nav-link ${activeTab === 'filieres' ? 'active' : ''}`}
                    onClick={() => setActiveTab('filieres')}
                  >
                    <i className="bi bi-diagram-3 me-2"></i>
                    Filières
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'matieres' ? 'active' : ''}`}
                    onClick={() => setActiveTab('matieres')}
                  >
                    <i className="bi bi-book me-2"></i>
                    Matières
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'niveaux' ? 'active' : ''}`}
                    onClick={() => setActiveTab('niveaux')}
                  >
                    <i className="bi bi-bar-chart-steps me-2"></i>
                    Niveaux
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className={`nav-link ${activeTab === 'partenaires' ? 'active' : ''}`}
                    onClick={() => setActiveTab('partenaires')}
                  >
                    <i className="bi bi-building me-2"></i>
                    Partenaires
                  </button>
                </li>
              </ul>
            </div>
            
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-12">
                    <h5 className="fw-bold">
                      <i className={`${getTabIcon()} me-2 text-primary`}></i>
                      Ajouter un(e) {getTabTitle()}
                    </h5>
                    <hr />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Libellé*</label>
                    <input
                      type="text"
                      className="form-control"
                      value={getCurrentForm().libelle}
                      onChange={(e) => getCurrentSetForm()({ libelle: e.target.value })}
                      required
                      placeholder={`Nom de la ${getTabTitle().toLowerCase()}`}
                    />
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button type="submit" className="btn btn-primary w-100">
                      <i className="bi bi-plus-lg me-2"></i>
                      Ajouter
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0 fw-semibold">
                  <i className={`${getTabIcon()} me-2 text-primary`}></i>
                  Liste des {activeTab}
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
                    Affichés: {filteredData.length}
                  </span>
                </div>
              </div>
            </div>
            
            {loading ? (
              <div className="card-body text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Chargement...</span>
                </div>
                <p className="text-muted mt-2">Chargement des {activeTab}...</p>
              </div>
            ) : (
              <div className="card-body p-0">
                {filteredData.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>ID</th>
                          <th>Libellé</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.map((item) => (
                          <tr key={item.id}>
                            <td>#{item.id}</td>
                            <td>
                              {editingItem?.id === item.id ? (
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  value={editingItem.libelle}
                                  onChange={(e) => setEditingItem({...editingItem, libelle: e.target.value})}
                                />
                              ) : (
                                item.libelle
                              )}
                            </td>
                            <td>
                              {editingItem?.id === item.id ? (
                                <div className="btn-group btn-group-sm">
                                  <button 
                                    className="btn btn-success" 
                                    onClick={() => saveEdit(activeTab)}
                                  >
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
                                    onClick={() => startEdit(item)}
                                  >
                                    <i className="bi bi-pencil"></i> Modifier
                                  </button>
                                  <button 
                                    className="btn btn-outline-danger" 
                                    onClick={() => deleteItem(activeTab, item)}
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
                    <i className={`${getTabIcon()} text-muted`} style={{ fontSize: '3rem' }}></i>
                    <h5 className="text-muted mt-3">Aucun(e) {getTabTitle().toLowerCase()} trouvé(e)</h5>
                    {searchTerm ? (
                      <p className="text-muted">Essayez un autre terme de recherche</p>
                    ) : (
                      <p className="text-muted">Ajoutez votre premier(e) {getTabTitle().toLowerCase()} avec le formulaire ci-dessus</p>
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