// src/app/admin/auth/login/page.tsx
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
import { routeForRole } from "@/lib/roleRouting";

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const showSuccessToast = (msg: string) => { setToastMessage(msg); setShowSuccess(true); };
  const showErrorToast   = (msg: string) => { setToastMessage(msg); setShowError(true); };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const q = query(
        collection(db, "users"),
        where("login", "==", username),
        where("password", "==", password)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        showErrorToast("Identifiants invalides, veuillez réessayer.");
        return;
      }

      const userDoc = snap.docs[0].data();
      const email = userDoc.email;
      const firstLogin = userDoc.first_login;
      const roleId = userDoc.role_id;
      const roleLabelFromUser = userDoc.role_libelle || "";

      // Auth Firebase
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        showSuccessToast("Compte créé et connecté !");
      } catch (error: any) {
        if (error?.code === 'auth/email-already-in-use') {
          await signInWithEmailAndPassword(auth, email, password);
          showSuccessToast("Connexion réussie !");
        } else {
          console.error(error);
          showErrorToast("Erreur lors de la création du compte.");
          return;
        }
      }

      // Stocker pour layout
      localStorage.setItem('userLogin', username);
      localStorage.setItem('userRole', roleLabelFromUser || '');

      // Redirection
      if (firstLogin == 1) {
        router.replace("/admin/auth/change-password");
        return;
      }

      // Si libellé présent sur le user → route immédiate
      if (roleLabelFromUser) {
        router.replace(routeForRole(roleLabelFromUser));
        return;
      }

      // Fallback: résoudre via la collection roles
      try {
        let roleName = '';
        const r1 = await getDoc(doc(db, "roles", String(roleId)));
        if (r1.exists()) {
          roleName = r1.data()?.libelle || '';
        } else {
          const rq = query(collection(db, "roles"), where("id", "==", roleId));
          const rs = await getDocs(rq);
          if (!rs.empty) {
            roleName = rs.docs[0].data()?.libelle || '';
          }
        }
        localStorage.setItem('userRole', roleName);
        router.replace(routeForRole(roleName));
      } catch (e) {
        console.error("Fallback rôle échoué:", e);
        // ✅ plus de /notReady — on renvoie sur /admin/home par défaut
        router.replace("/admin/home");
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
