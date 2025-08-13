import React from 'react';

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

interface UserViewModalProps {
  user: User | null;
  roles: Role[];
  show: boolean;
  onClose: () => void;
  onEdit: (user: User) => void;
}

const UserViewModal: React.FC<UserViewModalProps> = ({ 
  user, 
  roles, 
  show, 
  onClose, 
  onEdit 
}) => {
  if (!show || !user) return null;

  // Get user role name
  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.libelle || 'Inconnu';
  };

  // Get additional info based on role
  const getAdditionalInfo = (user: User) => {
    const role = getRoleName(user.role_id).toLowerCase();
    if (role.includes('étudiant') || role.includes('student')) {
      return user.classe ? `Classe: ${user.classe}` : null;
    } else if (role.includes('professeur') || role.includes('teacher')) {
      return user.specialty ? `Spécialité: ${user.specialty}` : null;
    } else if (role.includes('admin') || role.includes('directeur') || role.includes('responsable')) {
      return user.intitule_poste ? `Poste: ${user.intitule_poste}` : null;
    }
    return null;
  };

  const handleEditClick = () => {
    onClose();
    onEdit(user);
  };

  return (
    <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-dark text-white border-0">
            <div className="d-flex align-items-center">
              <div className="bg-white rounded-circle p-2 me-3">
                <i className="bi bi-person-circle text-dark" style={{ fontSize: '1.5rem' }}></i>
              </div>
              <div>
                <h5 className="modal-title mb-0 fw-bold">Détails de l utilisateur</h5>
                <small className="opacity-75">#{user.id}</small>
              </div>
            </div>
            <button 
              type="button" 
              className="btn-close btn-close-white" 
              onClick={onClose}
            ></button>
          </div>
          
          <div className="modal-body p-0">
            <div className="row g-0">
              {/* Left Column - Main Info */}
              <div className="col-md-8 p-4">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-person-fill text-dark me-2"></i>
                      <small className="text-muted text-uppercase fw-semibold">Nom complet</small>
                    </div>
                    <h6 className="fw-bold text-dark">{user.prenom} {user.nom}</h6>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-envelope-fill text-dark me-2"></i>
                      <small className="text-muted text-uppercase fw-semibold">Email</small>
                    </div>
                    <h6 className="fw-bold text-dark">{user.email}</h6>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-at text-dark me-2"></i>
                      <small className="text-muted text-uppercase fw-semibold">Nom d utilisateur</small>
                    </div>
                    <h6 className="fw-bold text-dark">{user.login}</h6>
                  </div>
                  
                  <div className="col-md-6">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-shield-fill text-dark me-2"></i>
                      <small className="text-muted text-uppercase fw-semibold">Rôle</small>
                    </div>
                    <span className="badge bg-dark-subtle text-dark px-3 py-2 rounded-pill">
                      {getRoleName(user.role_id)}
                    </span>
                  </div>
                  
                  {getAdditionalInfo(user) && (
                    <div className="col-12">
                      <div className="d-flex align-items-center mb-2">
                        <i className="bi bi-info-circle-fill text-dark me-2"></i>
                        <small className="text-muted text-uppercase fw-semibold">Information supplémentaire</small>
                      </div>
                      <h6 className="fw-bold text-dark">{getAdditionalInfo(user)}</h6>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column - Status Info */}
              <div className="col-md-4 bg-light p-4 border-start">
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-key-fill text-warning me-2"></i>
                    <small className="text-muted text-uppercase fw-semibold">Première connexion</small>
                  </div>
                  {user.first_login === '1' ? (
                    <div className="d-flex align-items-center">
                      <span className="badge bg-warning text-dark px-3 py-2 rounded-pill me-2">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Oui
                      </span>
                      <small className="text-muted">Mot de passe à changer</small>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center">
                      <span className="badge bg-success px-3 py-2 rounded-pill me-2">
                        <i className="bi bi-check-circle me-1"></i>
                        Non
                      </span>
                      <small className="text-muted">Compte activé</small>
                    </div>
                  )}
                </div>
                
                <div className="mb-4">
                  <div className="d-flex align-items-center mb-2">
                    <i className="bi bi-calendar-fill text-info me-2"></i>
                    <small className="text-muted text-uppercase fw-semibold">ID utilisateur</small>
                  </div>
                  <div className="bg-white rounded p-2 border">
                    <code className="text-dark fw-bold">#{user.id}</code>
                  </div>
                </div>
                
                {user.docId && (
                  <div className="mb-4">
                    <div className="d-flex align-items-center mb-2">
                      <i className="bi bi-database-fill text-secondary me-2"></i>
                      <small className="text-muted text-uppercase fw-semibold">ID Document</small>
                    </div>
                    <div className="bg-white rounded p-2 border">
                      <code className="text-dark fw-bold text-truncate d-block" style={{ fontSize: '0.75rem' }}>
                        {user.docId}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="modal-footer border-0 bg-light">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <i className="bi bi-x-circle me-1"></i>
              Fermer
            </button>
            <button 
              type="button" 
              className="btn btn-dark" 
              onClick={handleEditClick}
            >
              <i className="bi bi-pencil me-1"></i>
              Modifier cet utilisateur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserViewModal;