'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './admin/components/layout/Navbar';
import FirstLoginGuard from './admin/auth/FirstLoginGuard';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { isPathAllowedForRole, routeForRole } from '@/lib/roleRouting';

export default function RootLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // observer session (affichage navbar + logique d'accueil)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setBooting(false);
    });
    return () => unsub();
  }, []);

  // mémoriser la dernière route (sauf login/change-password)
  useEffect(() => {
    if (!pathname) return;
    const authPaths = ['/admin/auth/login', '/admin/auth/change-password'];
    if (!authPaths.includes(pathname)) {
      try { localStorage.setItem('lastPath', pathname); } catch {}
    }
  }, [pathname]);

  // gestion de la racine "/"
  useEffect(() => {
    if (pathname !== '/') return;

    const go = () => {
      const isLogged = !!auth.currentUser;
      if (isLogged) {
        const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
        const lastPath = (typeof window !== 'undefined' && localStorage.getItem('lastPath')) || '';
        if (role && lastPath && isPathAllowedForRole(role, lastPath)) {
          router.replace(lastPath);
        } else {
          router.replace(routeForRole(role));
        }
      } else {
        router.replace('/admin/auth/login');
      }
    };

    go();
  }, [pathname, router]);

  if (booting) {
    return (
      <html lang="fr">
        <body>
          <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
            <div className="text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <div className="mt-2">Chargement…</div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  // navbar sur /admin sauf login/change-password et hors espace directeur
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
        <FirstLoginGuard>{children}</FirstLoginGuard>
      </body>
    </html>
  );
}
