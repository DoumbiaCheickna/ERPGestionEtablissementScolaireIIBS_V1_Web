// src/app/admin/auth/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

import { collection, getDocs, query, where, limit as fbLimit, doc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword } from 'firebase/auth';

import { db, auth } from '../../../../../firebaseConfig';
import Logo from '../../assets/iibs_logo.png';
import Toast from '../../components/ui/Toast';
import { routeForRole } from '@/lib/roleRouting';

/* Helpers */
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const normalizeLogin = (raw: string) => {
  let s = raw.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9._-]/g, '');
  s = s.replace(/[._-]{2,}/g, '.');
  s = s.replace(/^[^a-z]+/, '');
  s = s.slice(0, 32);
  return s;
};
const loginNorm = (login: string) => login.toLowerCase();

export default function Login() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState(''); // email OU nom d'utilisateur
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const showSuccessToast = (msg: string) => { setToastMessage(msg); setShowSuccess(true); };
  const showErrorToast   = (msg: string) => { setToastMessage(msg); setShowError(true); };

  /** Résout un email à partir d’un identifiant (email direct ou username). */
  const resolveEmail = async (id: string): Promise<{ email: string; userDocId?: string }> => {
    const trimmed = id.trim();

    // S'il s'agit déjà d'un email, on le prend tel quel
    if (EMAIL_REGEX.test(trimmed)) {
      return { email: trimmed };
    }

    // Sinon, on considère un nom d'utilisateur -> on cherche l'email en base
    // NB: nécessite des règles Firestore qui autorisent cette lecture (ou collection dédiée username->email)
    const usersCol = collection(db, 'users');
    const norm = loginNorm(normalizeLogin(trimmed));

    // D'abord par login_norm (recommandé)
    let snap = await getDocs(query(usersCol, where('login_norm', '==', norm), fbLimit(1)));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data() as any;
      if (!data?.email) throw new Error("Profil incomplet : email introuvable.");
      return { email: String(data.email), userDocId: d.id };
    }

    // Fallback legacy : certains anciens docs n'ont pas login_norm
    snap = await getDocs(query(usersCol, where('login', '==', trimmed), fbLimit(1)));
    if (!snap.empty) {
      const d = snap.docs[0];
      const data = d.data() as any;
      if (!data?.email) throw new Error("Profil incomplet : email introuvable.");
      return { email: String(data.email), userDocId: d.id };
    }

    throw new Error("Aucun utilisateur trouvé avec cet identifiant.");
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setShowError(false);
    setShowSuccess(false);

    try {
      // 1) Résoudre l'email depuis l'identifiant
      const { email } = await resolveEmail(identifier);

      // 2) Auth Firebase (source de vérité du mot de passe)
      const cred = await signInWithEmailAndPassword(auth, email, password);

      // 3) Charger la fiche dans `users` (nouveaux comptes: docId === uid ; anciens: fallback par email)
      const uid = cred.user.uid;
      let userDocSnap = await getDoc(doc(db, 'users', uid));

      if (!userDocSnap.exists()) {
        const fallback = await getDocs(
          query(collection(db, 'users'), where('email', '==', email), fbLimit(1))
        );
        if (!fallback.empty) {
          userDocSnap = fallback.docs[0];
        }
      }

      const userData = userDocSnap.exists() ? (userDocSnap.data() as any) : null;
      const roleLabelFromUser = userData?.role_libelle || '';
      const roleId = userData?.role_id || '';
      const firstLoginRaw = userData?.first_login;
      const firstLogin = firstLoginRaw === '1' || firstLoginRaw === 1 || firstLoginRaw === true;

      // 4) Stockage local pour le layout / navbar
      localStorage.setItem('userLogin', userData?.login || identifier);
      if (roleLabelFromUser) localStorage.setItem('userRole', roleLabelFromUser);

      // 5) Redirection
      if (firstLogin) {
        showSuccessToast('Connexion réussie — veuillez changer votre mot de passe.');
        router.replace('/admin/auth/change-password');
        return;
      }

      if (roleLabelFromUser) {
        router.replace(routeForRole(roleLabelFromUser));
        return;
      }

      // Fallback si le libellé n’est pas stocké sur le user: on résout via la collection roles
      if (roleId) {
        try {
          // doc direct
          const roleDoc = await getDoc(doc(db, 'roles', String(roleId)));
          let roleName = roleDoc.exists() ? (roleDoc.data() as any)?.libelle || '' : '';

          // fallback par champ "id" si la docId n'est pas roleId
          if (!roleName) {
            const rs = await getDocs(
              query(collection(db, 'roles'), where('id', '==', roleId), fbLimit(1))
            );
            if (!rs.empty) roleName = (rs.docs[0].data() as any)?.libelle || '';
          }

          if (roleName) {
            localStorage.setItem('userRole', roleName);
            router.replace(routeForRole(roleName));
            return;
          }
        } catch (e) {
          // on ignore et on envoie sur /admin/home
        }
      }

      // Si on n'a pas pu déterminer: route par défaut
      router.replace('/admin/home');
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      const code = error?.code || '';

      // Messages plus clairs
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        showErrorToast('Identifiants invalides, veuillez réessayer.');
      } else if (error?.message?.includes("Aucun utilisateur")) {
        showErrorToast("Aucun utilisateur trouvé avec cet identifiant.");
      } else if (code === 'permission-denied') {
        // Arrive si les règles Firestore empêchent la recherche du username avant login
        showErrorToast("Impossible de vérifier le nom d'utilisateur. Essayez avec votre email.");
      } else {
        showErrorToast('Erreur serveur, veuillez réessayer plus tard.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-4">
            <Image
              src={Logo}
              alt="IBS Logo"
              className="img-fluid d-block mx-auto mb-4"
              style={{ maxWidth: 220 }}
            />

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label htmlFor="identifier" className="form-label fw-semibold">
                  Email ou nom d’utilisateur
                </label>
                <input
                  type="text"
                  id="identifier"
                  className="form-control py-4 rounded-4 shadow-sm"
                  placeholder="ex: jean@exemple.com ou j.dupont"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
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
                  autoComplete="current-password"
                />
              </div>

              <div className="d-grid">
                <button
                  className="btn btn-dark border fw-semibold mt-3 py-3"
                  style={{ borderRadius: '15px', color: 'white' }}
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
