'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../../firebaseConfig';
import Image from 'next/image';
import Logo from '../admin/assets/iibs_logo.png';

export default function NotReady() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Récupérer le rôle depuis localStorage
    const role = localStorage.getItem('userRole') || 'Utilisateur';
    setUserRole(role);
  }, []);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // Déconnexion Firebase
      await signOut(auth);
      
      // Nettoyer complètement le localStorage
      localStorage.removeItem('userLogin');
      localStorage.removeItem('userRole');
      localStorage.clear(); // Nettoie tout le localStorage
      
      // Rediriger vers la page de connexion
      router.push('/admin/auth/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-vh-100 d-flex align-items-center justify-content-center" 
           style={{ background: 'linear-gradient(135deg, #313135ff 0%, #262629ff  100%)' }}>
        
        {/* Background decorative elements */}
        <div className="position-absolute w-100 h-100 overflow-hidden" style={{ zIndex: 1 }}>
          <div 
            className="position-absolute rounded-circle"
            style={{
              width: '300px',
              height: '300px',
              background: 'rgba(255, 255, 255, 0.1)',
              top: '10%',
              left: '5%',
              animation: 'float 6s ease-in-out infinite'
            }}
          />
          <div 
            className="position-absolute rounded-circle"
            style={{
              width: '200px',
              height: '200px',
              background: 'rgba(255, 255, 255, 0.05)',
              bottom: '15%',
              right: '10%',
              animation: 'float 8s ease-in-out infinite reverse'
            }}
          />
        </div>

        <div className="container" style={{ zIndex: 2, position: 'relative' }}>
          <div className="row">
            <div className="col-lg-6 mb-5 mb-lg-0">
              <div className="text-white">
                <h1 className="display-4 fw-bold mb-4">
                  SYSTÈME EN <br />
                  <span style={{ color: '#8389c2ff' }}>DÉVELOPPEMENT</span>
                </h1>
                
                <p className="lead mb-4 opacity-75">
                  L équipe est en train de développer l application. 
                  L application est en cours de développement.
                </p>

                {/* User info */}
                <div className="d-flex align-items-center mb-4 p-3 rounded" 
                     style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                  <i className="bi bi-person-circle me-3 text-white" style={{ fontSize: '1.5rem' }}></i>
                  <div>
                    <small className="text-white opacity-75">Connecté en tant que:</small>
                    <div className="text-white fw-semibold">{userRole}</div>
                  </div>
                </div>

                <button
                  className="btn btn-light btn-lg px-4 py-3 rounded-pill fw-semibold"
                  onClick={handleLogout}
                  disabled={loading}
                  style={{ 
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Déconnexion...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Se déconnecter
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="col-lg-6">
              <div className="position-relative">
                {/* Main illustration container */}
                <div 
                  className="bg-white rounded-4 p-4 shadow-lg mx-auto"
                  style={{ 
                    maxWidth: '400px',
                    transform: 'rotate(-2deg)',
                    animation: 'gentle-sway 4s ease-in-out infinite'
                  }}
                >
                  {/* Logo in top corner */}
                  <div className="position-absolute top-0 end-0 p-3">
                    <Image
                      src={Logo}
                      alt="IBS Logo"
                      width={40}
                      height={40}
                      className="rounded"
                    />
                  </div>

                  {/* Browser window mockup */}
                  <div className="bg-light rounded-3 p-3 mb-3">
                    <div className="d-flex align-items-center mb-2">
                      <div className="d-flex gap-1">
                        <div className="rounded-circle bg-danger" style={{ width: '8px', height: '8px' }}></div>
                        <div className="rounded-circle bg-warning" style={{ width: '8px', height: '8px' }}></div>
                        <div className="rounded-circle bg-success" style={{ width: '8px', height: '8px' }}></div>
                      </div>
                      <div className="flex-grow-1 mx-2">
                        <div className="bg-white rounded-pill py-1 px-2">
                          <small className="text-muted">www.ibs-school.com</small>
                        </div>
                      </div>
                    </div>
                    
                    {/* Content area */}
                    <div 
                      className="text-center p-4 rounded-3"
                      style={{ backgroundColor: '#4FC3F7' }}
                    >
                      <div className="text-white mb-3">
                        <i className="bi bi-gear-fill" style={{ fontSize: '2.5rem', animation: 'spin 3s linear infinite' }}></i>
                        <i className="bi bi-wrench ms-2" style={{ fontSize: '1.5rem' }}></i>
                      </div>
                      <div className="text-white fw-bold">MISE À JOUR</div>
                      <div className="progress mt-2" style={{ height: '6px' }}>
                        <div 
                          className="progress-bar bg-white"
                          style={{ 
                            width: '75%',
                            animation: 'progress-fill 2s ease-in-out infinite alternate'
                          }}
                        />
                      </div>
                      <small className="text-white opacity-75 d-block mt-2">75%</small>
                    </div>
                  </div>

                  {/* Person illustration */}
                  <div className="text-center">
                    <div 
                      className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                      style={{ 
                        width: '60px', 
                        height: '60px',
                        backgroundColor: '#667eea',
                        animation: 'bounce-subtle 2s ease-in-out infinite'
                      }}
                    >
                      <i className="bi bi-person-workspace text-white" style={{ fontSize: '1.5rem' }}></i>
                    </div>
                    
                    {/* Decorative elements */}
                    <div className="d-flex justify-content-around mt-3">
                      <div className="text-center">
                        <div 
                          className="rounded bg-success d-inline-block mb-1"
                          style={{ width: '30px', height: '30px', animation: 'pulse 1.5s infinite' }}
                        ></div>
                        <div><small className="text-muted">Sécurisé</small></div>
                      </div>
                      <div className="text-center">
                        <div 
                          className="rounded bg-warning d-inline-block mb-1"
                          style={{ width: '30px', height: '30px', animation: 'pulse 1.8s infinite' }}
                        ></div>
                        <div><small className="text-muted">En cours</small></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating elements */}
                <div 
                  className="position-absolute bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '50px', 
                    height: '50px',
                    top: '20%',
                    left: '10%',
                    animation: 'float-up 3s ease-in-out infinite'
                  }}
                >
                  <i className="bi bi-arrow-up text-primary"></i>
                </div>
                
                <div 
                  className="position-absolute bg-white rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                  style={{ 
                    width: '40px', 
                    height: '40px',
                    bottom: '30%',
                    right: '15%',
                    animation: 'float-up 3.5s ease-in-out infinite reverse'
                  }}
                >
                  <i className="bi bi-code-slash text-success"></i>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom info */}
          <div className="row mt-5">
            <div className="col-12 text-center">
              <div className="text-white opacity-75">
                <small>
                  <i className="bi bi-info-circle me-2"></i>
                  Contactez l administrateur système pour plus d informations
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes gentle-sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes progress-fill {
          0% { width: 60%; }
          100% { width: 85%; }
        }
        
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes float-up {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(5deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}