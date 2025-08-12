'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './admin/components/layout/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';
import { routeForRole } from '@/lib/roleRouting';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // chemins d'auth complets (dans /admin)
      const authPaths = ['/admin/auth/login', '/admin/auth/change-password'];
      const isAuthPath = authPaths.includes(pathname) || pathname === '/';

      // 1) Rediriger la racine vers login
      if (pathname === '/') {
        router.push('/admin/auth/login');
        return;
      }

      // 2) Si déjà connecté et sur la page login → envoyer selon le rôle
      if (currentUser && pathname === '/admin/auth/login') {
        try {
          const storedRole = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
          const target = routeForRole(storedRole) || '/admin/home';
          router.replace(target);
        } catch {
          router.replace('/admin/home');
        }
        return;
      }

      // 3) Si pas connecté et pas sur une page d'auth → forcer login
      if (!currentUser && !isAuthPath) {
        router.push('/admin/auth/login');
        return;
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Loader initial pendant la détection auth
  if (loading) {
    return (
      <html lang="fr">
        <head>
          {/* ... */}
          <link
            href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
            rel="stylesheet"
          />
        </head>

        <body>
          <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="mt-2">Chargement...</div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // --- Affichage navbar ---
  // On veut la navbar admin uniquement sur les pages /admin (sauf login & change-password)
  // et jamais sur /directeur-des-etudes
  const isDirectorArea = pathname.startsWith('/directeur-des-etudes');
  const authPaths = ['/admin/auth/login', '/admin/auth/change-password'];
  const showAdminNavbar =
    !!user &&
    pathname.startsWith('/admin') &&
    !authPaths.includes(pathname) &&
    !isDirectorArea;

  return (
    <html lang="fr">
      <body>
        {showAdminNavbar && <Navbar />}
        <main>{children}</main>
      </body>
    </html>
  );
}
