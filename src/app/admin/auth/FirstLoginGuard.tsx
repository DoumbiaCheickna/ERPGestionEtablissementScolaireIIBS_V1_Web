//src/app/admin/auth/FirstLoginGuard.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../../firebaseConfig';
import {
  collection, doc, getDoc, getDocs, query, where, limit as fbLimit,
} from 'firebase/firestore';

type Status = 'loading' | 'ok' | 'redirect';

export default function FirstLoginGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const isAuthRoute = pathname?.startsWith('/admin/auth') ?? false;
        const isLogin = pathname === '/admin/auth/login';
        const isChangePwd = pathname === '/admin/auth/change-password';

        // Pas connecté → on autorise seulement les routes d’auth
        if (!user) {
          if (!isAuthRoute) {
            setStatus('redirect');
            router.replace('/admin/auth/login');
          } else {
            setStatus('ok');
          }
          return;
        }

        // Récup doc Firestore: priorité docId = uid, sinon fallback par email
        const uid = user.uid;
        let snap = await getDoc(doc(db, 'users', uid));
        if (!snap.exists() && user.email) {
          const rs = await getDocs(
            query(collection(db, 'users'), where('email', '==', user.email), fbLimit(1))
          );
          if (!rs.empty) snap = rs.docs[0];
        }

        const u = snap.exists() ? (snap.data() as any) : null;
        const firstLogin = u?.first_login === '1' || u?.first_login === 1 || u?.first_login === true;

        if (firstLogin) {
          // doit changer le mot de passe d’abord
          if (!isChangePwd) {
            setStatus('redirect');
            router.replace('/admin/auth/change-password');
            return;
          }
          setStatus('ok'); // déjà sur la bonne page
          return;
        }

        // pas “first login” → si l’utilisateur va sur une page d’auth, on l’envoie vers /admin/home
        if (isLogin || isChangePwd) {
          setStatus('redirect');
          router.replace('/admin/home');
          return;
        }

        setStatus('ok');
      } catch (e) {
        console.error('FirstLoginGuard error:', e);
        setStatus('redirect');
        router.replace('/admin/auth/login');
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (status === 'loading' || status === 'redirect') {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="spinner-border text-primary" role="status" />
          <div className="mt-2 text-muted small">Vérification de la session…</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
