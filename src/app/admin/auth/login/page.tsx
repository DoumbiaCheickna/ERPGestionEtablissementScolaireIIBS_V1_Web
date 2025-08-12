'use client';

import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db, auth } from '../../../../../firebaseConfig'; 
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '../../assets/iibs_logo.png';
import Link from 'next/link';
import Toast from '../../components/ui/Toast';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import React from 'react';

export default function Login() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const router = useRouter();

  const showSuccessToast = (msg: string) => {
    setToastMessage(msg);
    setShowSuccess(true);
  };

  const showErrorToast = (msg: string) => {
    setToastMessage(msg);
    setShowError(true);
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Requête Firestore pour récupérer l'utilisateur avec login et password
      const q = query(
        collection(db, "users"), 
        where("login", "==", username),
        where("password", "==", password)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Récupérer les données du premier document (on suppose login unique)
        const userDoc = querySnapshot.docs[0].data();
        const email = userDoc.email;
        const firstLogin = userDoc.first_login;
        const roleId = userDoc.role_id;

        // Récupérer les informations du rôle
        const roleDoc = await getDoc(doc(db, "roles", roleId));
        const roleData = roleDoc.data();
        const roleName = roleData?.libelle || '';
        console.log("Role Name:", roleName);

        // Stocker le login dans localStorage pour la page de changement de mot de passe
        localStorage.setItem('userLogin', username);
        localStorage.setItem('userRole', roleName);

        // Vérifier le rôle et first_login pour déterminer la redirection
        const isAdmin = roleName.toLowerCase() === 'admin';
        
        // Si non-admin et pas première connexion, aller vers notReady
        if (!isAdmin && firstLogin == 0) {
          showErrorToast("Accès limité. Redirection vers la page d'information...");
          setTimeout(() => {
            router.push("/notReady");
          }, 2000);
          setLoading(false);
          return;
        }

        // Si non-admin et première connexion, ils doivent changer le mot de passe mais iront vers notReady après
        // Les admins peuvent procéder normalement

        try {
          // Essayer de créer le compte Firebase Auth (si existe déjà, ça va planter)
          await createUserWithEmailAndPassword(auth, email, password);
          showSuccessToast("Compte créé et connecté !");
        } catch (error: unknown) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === 'auth/email-already-in-use'
          ) {
            // Si compte Firebase existe, on essaie de se connecter
            try {
              await signInWithEmailAndPassword(auth, email, password);
              showSuccessToast("Connexion réussie !");
            } catch (signInError: unknown) {
              showErrorToast("Erreur de connexion, veuillez vérifier vos identifiants.");
              console.error(signInError);
              setLoading(false);
              return;
            }
          } else {
            showErrorToast("Erreur lors de la création du compte.");
            console.error(error);
            setLoading(false);
            return;
          }
        }

        // Redirection selon first_login
        if (firstLogin == 1) {
          router.replace("/admin/auth/change-password");
          return;
        }
        router.replace("/admin/home");
        return;
      } else {
        showErrorToast("Identifiants invalides, veuillez réessayer.");
      }

    } catch (error) {
      console.error(error);
      showErrorToast("Erreur serveur, veuillez réessayer plus tard.");
    } finally {
      setLoading(false);
    }
  };

  return (
     <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-4">
            <Image src={Logo} alt="IBS Logo" className="img-fluid d-block mx-auto mb-4" style={{ maxWidth: 220 }} />
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label fw-semibold">Identifiant</label>
              <input
                type="text"
                id="username"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Mot de passe</label>
              <input
                type="password"
                id="password"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="d-grid">
              <button
                className="btn btn-dark border fw-semibold mt-3 py-3"
                style={{ borderRadius: '15px', color: 'white'}}
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Connexion...
                  </>
                ) : (
                  'Log In'
                )}
              </button>
            </div>

            <div className="text-center mt-5">
              <Link href="#" className="text-decoration-none text-muted small">
                Dont have an account? <span className="text-primary">Sign up</span>
              </Link>
            </div>
          </form>

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
      </div>
    </div>
    </div>
  );
}