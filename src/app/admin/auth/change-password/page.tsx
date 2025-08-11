'use client';

import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";
import { db, auth } from '../../../../../firebaseConfig'; 
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '../../assets/iibs_logo.png';
import Toast from '../../components/ui/Toast';
import { updatePassword } from "firebase/auth";
import React from 'react';

export default function ChangePassword() {
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [userLogin, setUserLogin] = useState<string>('');

  const router = useRouter();

  useEffect(() => {
    // Récupérer le login depuis localStorage
    const login = localStorage.getItem('userLogin');
    if (login) {
      setUserLogin(login);
    } else {
      // Si pas de login, rediriger vers login
      router.push("/login");
    }
  }, [router]);

  const showSuccessToast = (msg: string) => {
    setToastMessage(msg);
    setShowSuccess(true);
  };

  const showErrorToast = (msg: string) => {
    setToastMessage(msg);
    setShowError(true);
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showErrorToast("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      showErrorToast("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    try {
      // Requête Firestore pour récupérer l'utilisateur avec login
      const q = query(
        collection(db, "users"), 
        where("login", "==", userLogin)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Récupérer le document utilisateur
        const userDocRef = querySnapshot.docs[0];
        const userData = userDocRef.data();

        // Mettre à jour le mot de passe et first_login dans Firestore
        await updateDoc(doc(db, "users", userDocRef.id), {
          password: password,
          first_login: 0
        });

        // Mettre à jour le mot de passe Firebase Auth si l'utilisateur est connecté
        if (auth.currentUser) {
          try {
            await updatePassword(auth.currentUser, password);
          } catch (error) {
            console.error("Erreur mise à jour mot de passe Firebase:", error);
          }
        }

        showSuccessToast("Mot de passe changé avec succès !");

        // Nettoyer localStorage et rediriger
        setTimeout(() => {
          localStorage.removeItem('userLogin');
          router.push("/home");
        }, 1500);

      } else {
        showErrorToast("Utilisateur non trouvé.");
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
          
          <div className="mb-4">
            <h4 className="fw-semibold text-center">Changement de mot de passe</h4>
            <p className="text-muted text-center small">
              Première connexion détectée. Veuillez changer votre mot de passe.
            </p>
          </div>

          <form onSubmit={handleChangePassword}>
            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Nouveau mot de passe</label>
              <input
                type="password"
                id="password"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Entrez votre nouveau mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="confirmPassword" className="form-label fw-semibold">Confirmer le mot de passe</label>
              <input
                type="password"
                id="confirmPassword"
                className="form-control py-4 rounded-4 shadow-sm"
                placeholder="Confirmez votre nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="d-grid">
              <button
                className="btn btn-dark border fw-semibold mt-3 py-3"
                style={{ borderRadius: '15px', color: 'white'}}
                type="submit"
              >
                Changer le mot de passe
              </button>
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