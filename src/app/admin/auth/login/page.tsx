//src/app/admin/auth/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

import Link from 'next/link'; // (pas utilisé pour "Sign up" mais conservé si besoin d’autres liens)
import {
  collection,
  getDocs,
  query,
  where,
  limit as fbLimit,
  doc,
  getDoc
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

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

// Anti-injection très simple (supprime chevrons & contrôles)
const sanitize = (v: string) =>
  v.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/[<>]/g, '').trim();

export default function Login() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState(''); // email OU nom d'utilisateur
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modals
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [fpIdentifier, setFpIdentifier] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState<string | null>(null);
  const [showCheckEmailModal, setShowCheckEmailModal] = useState(false);

  // Toasts
  const [toastMessage, setToastMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const showSuccessToast = (msg: string) => { setToastMessage(msg); setShowSuccess(true); };
  const showErrorToast   = (msg: string) => { setToastMessage(msg); setShowError(true); };

  /** Résout un email à partir d’un identifiant (email direct ou username). */
  const resolveEmail = async (id: string): Promise<{ email: string; userDocId?: string }> => {
    const raw = sanitize(id);
    const trimmed = raw.trim();

    // Email direct ?
    if (EMAIL_REGEX.test(trimmed)) {
      return { email: trimmed };
    }

    // Sinon, on considère un nom d'utilisateur -> on cherche l'email en base
    const usersCol = collection(db, 'users');
    const norm = loginNorm(normalizeLogin(trimmed));

    // D'abord par login_norm
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

      // 3) Charger la fiche dans `users`
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

      // 4) Stockage local
      localStorage.setItem('userLogin', userData?.login || sanitize(identifier));
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

      // Résolution libellé via roles si besoin
      if (roleId) {
        try {
          const roleDoc = await getDoc(doc(db, 'roles', String(roleId)));
          let roleName = roleDoc.exists() ? (roleDoc.data() as any)?.libelle || '' : '';
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
        } catch {
          /* ignore */
        }
      }

      router.replace('/admin/home');
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      const code = error?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        showErrorToast('Identifiants invalides, veuillez réessayer.');
      } else if (error?.message?.includes("Aucun utilisateur")) {
        showErrorToast("Aucun utilisateur trouvé avec cet identifiant.");
      } else if (code === 'permission-denied') {
        showErrorToast("Impossible de vérifier le nom d'utilisateur. Essayez avec votre email.");
      } else {
        showErrorToast('Erreur serveur, veuillez réessayer plus tard.');
      }
    } finally {
      setLoading(false);
    }
  };

  /* -------- Forgot Password Flow -------- */
  const openForgot = () => {
    setFpIdentifier('');
    setFpError(null);
    setShowForgotModal(true);
  };

  const cancelForgot = () => {
    setShowForgotModal(false);
    setFpIdentifier('');
    setFpError(null);
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpLoading) return;

    const input = sanitize(fpIdentifier);
    if (!input) {
      setFpError("Veuillez saisir votre email ou nom d'utilisateur.");
      return;
    }

    setFpLoading(true);
    setFpError(null);

    try {
      const { email } = await resolveEmail(input);
      await sendPasswordResetEmail(auth, email);

      // Ferme le premier modal et ouvre la confirmation
      setShowForgotModal(false);
      setShowCheckEmailModal(true);
    } catch (err: any) {
      console.error('Forgot error:', err);
      const code = err?.code || '';
      if (err?.message?.includes('Aucun utilisateur')) {
        setFpError("Aucun utilisateur trouvé avec cet identifiant.");
      } else if (code === 'auth/invalid-email') {
        setFpError("Adresse e-mail invalide.");
      } else {
        setFpError("Impossible d'envoyer l’email. Réessayez plus tard.");
      }
    } finally {
      setFpLoading(false);
    }
  };

  const closeCheckEmail = () => {
    setShowCheckEmailModal(false);
    // On “revient” sur la page de login : on y est déjà, on recentre juste le focus
    // Optionnel : router.replace('/admin/auth/login');
  };

  /* -------- UI compacte (pas de scroll) -------- */
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center" style={{ background: '#f8f9fb' }}>
      <div className="container" style={{ maxWidth: 460 }}>
        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            <div className="text-center mb-3">
              <Image
                src={Logo}
                alt="IBS Logo"
                className="img-fluid d-block mx-auto"
                style={{ maxWidth: 160, height: 'auto' }}
                priority
              />
            </div>

            <h5 className="text-center fw-semibold mb-3">Connexion</h5>

            <form onSubmit={handleLogin} className="mb-2">
              <div className="mb-2">
                <label htmlFor="identifier" className="form-label small fw-semibold mb-1">
                  Email ou nom d’utilisateur
                </label>
                <input
                  type="text"
                  id="identifier"
                  className="form-control rounded-3 py-2"
                  placeholder="ex: jean@exemple.com ou j.dupont"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="mb-2">
                <label htmlFor="password" className="form-label small fw-semibold mb-1">
                  Mot de passe
                </label>
                <input
                  type="password"
                  id="password"
                  className="form-control rounded-3 py-2"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                className="btn btn-dark w-100 fw-semibold mt-2 py-2 rounded-3"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Connexion...
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>

              <div className="text-center mt-2">
                <button
                  type="button"
                  className="btn btn-link p-0 small"
                  onClick={openForgot}
                >
                  Mot de passe oublié ?
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

      {/* -------- Modal: Saisir email/login pour reset -------- */}
      {showForgotModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={submitForgot} noValidate>
                  <div className="modal-header">
                    <h6 className="modal-title fw-bold">Réinitialiser le mot de passe</h6>
                    <button type="button" className="btn-close" onClick={cancelForgot} />
                  </div>
                  <div className="modal-body">
                    <div className="mb-2">
                      <label className="form-label small fw-semibold mb-1">Email ou nom d’utilisateur</label>
                      <input
                        type="text"
                        className="form-control rounded-3 py-2"
                        placeholder="Saisissez votre email ou login"
                        value={fpIdentifier}
                        onChange={(e) => setFpIdentifier(e.target.value)}
                        autoFocus
                      />
                      {fpError && <div className="text-danger small mt-1">{fpError}</div>}
                    </div>
                    <div className="small text-muted">
                      Nous enverrons un lien sécurisé à l’adresse e-Mail associée à votre compte. Vérifiez vos spams aussi.
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={cancelForgot} disabled={fpLoading}>
                      Annuler
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={fpLoading}>
                      {fpLoading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Envoi...
                        </>
                      ) : (
                        'Envoyer le lien'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={cancelForgot} />
        </>
      )}

      {/* -------- Modal: Confirmation "Vérifiez votre mail" -------- */}
      {showCheckEmailModal && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h6 className="modal-title fw-bold">Vérifiez votre adresse mail</h6>
                  <button type="button" className="btn-close" onClick={closeCheckEmail} />
                </div>
                <div className="modal-body">
                  Un e-mail de réinitialisation a été envoyé. Veuillez suivre le lien reçu pour créer un nouveau mot de passe.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={closeCheckEmail}>
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeCheckEmail} />
        </>
      )}
    </div>
  );
}