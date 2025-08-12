'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { updatePassword } from 'firebase/auth';
import { db, auth } from '../../../../../firebaseConfig';
import Logo from '../../assets/iibs_logo.png';
import Toast from '../../components/ui/Toast';
import { routeForRole } from '@/lib/roleRouting';

export default function ChangePassword() {
  const router = useRouter();

  // UI state
  const [checking, setChecking] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [userLogin, setUserLogin] = useState<string>('');

  // Toasts
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [showError, setShowError] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showSuccessToast = (msg: string) => { setToastMessage(msg); setShowSuccess(true); };
  const showErrorToast   = (msg: string) => { setToastMessage(msg); setShowError(true); };

  /**
   * Pré-check avant d’afficher la page :
   * - login présent en localStorage
   * - utilisateur existe
   * - si first_login == 0 → on redirige directement (évite le “flash”)
   */
  useEffect(() => {
    const precheck = async () => {
      const login = localStorage.getItem('userLogin');
      if (!login) {
        router.replace('/admin/auth/login');
        return;
      }

      try {
        const q = query(collection(db, 'users'), where('login', '==', login));
        const snap = await getDocs(q);

        if (snap.empty) {
          router.replace('/admin/auth/login');
          return;
        }

        const userDoc = snap.docs[0];
        const userData = userDoc.data() as any;

        // Déjà traité → route d’accueil suivant le rôle
        if (userData.first_login === 0 || userData.first_login === '0') {
          // on essaye d'abord role_libelle (si stocké sur le user)
          const roleLabel =
            userData.role_libelle ||
            (await (async () => {
              try {
                const r = await getDoc(doc(db, 'roles', String(userData.role_id)));
                return r.data()?.libelle || '';
              } catch {
                return '';
              }
            })());

          router.replace(routeForRole(roleLabel));
          return;
        }

        // OK pour afficher le formulaire
        setUserLogin(login);
        setChecking(false);
      } catch (err) {
        console.error('Precheck error:', err);
        router.replace('/admin/auth/login');
      }
    };

    precheck();
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showErrorToast('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      showErrorToast('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      // Récupérer l’utilisateur par login
      const q = query(collection(db, 'users'), where('login', '==', userLogin));
      const snap = await getDocs(q);

      if (snap.empty) {
        showErrorToast('Utilisateur non trouvé.');
        return;
      }

      const userDocRef = snap.docs[0].ref;
      const userData = snap.docs[0].data() as any;

      // Mettre à jour Firestore
      await updateDoc(userDocRef, {
        password: password, // ⚠️ en prod, ne stocke pas en clair
        first_login: 0,
      });

      // Mettre à jour dans Firebase Auth (si connecté)
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, password);
        } catch (err: any) {
          console.error('Erreur updatePassword:', err);
          if (err?.code === 'auth/requires-recent-login') {
            showErrorToast('Veuillez vous reconnecter pour changer le mot de passe.');
            router.replace('/admin/auth/login');
            return;
          }
        }
      }

      showSuccessToast('Mot de passe changé avec succès !');

      // Rôle & redirection (on privilégie role_libelle, sinon on résout via roles)
      const roleLabel =
        userData.role_libelle ||
        (await (async () => {
          try {
            const roleSnap = await getDoc(doc(db, 'roles', String(userData.role_id)));
            return roleSnap.data()?.libelle || '';
          } catch {
            return '';
          }
        })());

      // Nettoyer le localStorage (optionnel)
      localStorage.removeItem('userLogin');
      localStorage.setItem('userRole', roleLabel || '');

      setTimeout(() => {
        router.replace(routeForRole(roleLabel));
      }, 800);
    } catch (error) {
      console.error(error);
      showErrorToast('Erreur serveur, veuillez réessayer plus tard.');
    }
  };

  if (checking) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border" role="status" />
          <p className="text-muted mt-3 mb-0">Préparation de la page…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-4">
            <Image
              src={Logo}
              alt="IBS Logo"
              className="img-fluid d-block mx-auto mb-4"
              style={{ maxWidth: '220px' }}
            />

            <div className="mb-3 text-center">
              <h4 className="fw-semibold mb-1">Changement de mot de passe</h4>
              <p className="text-muted small mb-0">
                Première connexion détectée. Veuillez changer votre mot de passe.
              </p>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label htmlFor="password" className="form-label fw-semibold">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-control py-3 rounded-4 shadow-sm"
                  placeholder="Entrez votre nouveau mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="mb-3">
                <label htmlFor="confirmPassword" className="form-label fw-semibold">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="form-control py-3 rounded-4 shadow-sm"
                  placeholder="Confirmez votre nouveau mot de passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="d-grid">
                <button
                  className="btn btn-dark border fw-semibold mt-2 py-3"
                  style={{ borderRadius: '15px', color: 'white' }}
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
    </div>
  );
}
