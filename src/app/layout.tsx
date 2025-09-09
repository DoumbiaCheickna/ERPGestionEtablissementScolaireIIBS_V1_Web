//src/app/layout.tsx
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './admin/components/layout/Navbar';
import FirstLoginGuard from './admin/auth/FirstLoginGuard';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // On observe la session juste pour l’affichage de la navbar
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setBooting(false);
    });
    return () => unsub();
  }, []);

  // Rediriger la racine vers login (le reste est géré par le garde)
  useEffect(() => {
    if (pathname === '/') router.replace('/admin/auth/login');
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

  // afficher la navbar sur /admin sauf login/change-password et hors espace directeur
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
        {/* ⬇️ blocage 1ʳᵉ connexion / accès non auth */}
        <FirstLoginGuard>{children}</FirstLoginGuard>
      </body>
    </html>
  );
}