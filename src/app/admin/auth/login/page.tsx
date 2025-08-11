'use client';

import { collection, getDocs, query, where } from "firebase/firestore";
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


        // Stocker le login dans localStorage pour la page de changement de mot de passe
        localStorage.setItem('userLogin', username);

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
              return;
            }
          } else {
            showErrorToast("Erreur lors de la création du compte.");
            console.error(error);
            return;
          }
        }

        // Redirection selon first_login
        setTimeout(() => {
          if (firstLogin == 1) {
            router.push("/admin/auth/change-password");
          } else {
            router.push("/admin/home");
          }
        }, 1000);

      } else {
        showErrorToast("Identifiants invalides, veuillez réessayer.");
      }

    } catch (error) {
      console.error(error);
      showErrorToast("Erreur serveur, veuillez réessayer plus tard.");
    }
  };

  return (
    <div className="container-fluid" style={{ marginLeft: '-100px', marginTop: '50px' }}>
      <div className="row justify-content-center pt-5">
        <div className="col-md-4">
          <Image
            src={Logo}
            alt="IBS Logo"
            className="img-fluid"
            style={{ maxWidth: '220px' }}
          />
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label fw-semibold">Username</label>
              <input
                type="text"
                id="username"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Password</label>
              <input
                type="password"
                id="password"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="d-grid">
              <button
                className="btn btn-dark border fw-semibold mt-3 py-3"
                style={{ borderRadius: '15px', color: 'white'}}
                type="submit"
              >
                Log In
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
  );
}