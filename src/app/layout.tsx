'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './admin/components/layout/Navbar';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      // Define auth paths (login, change password)
      const authPaths = ['/auth/login', '/auth/change-password'];
      const isAuthPath = authPaths.includes(pathname) || pathname === '/';
      
      // Define public paths (notReady page)
      const publicPaths = ['/notReady'];
      const isPublicPath = publicPaths.includes(pathname);

      // Redirect root to login
      if (pathname === '/') {
        router.push('/auth/login');
        return;
      }

      // Redirect authenticated users away from login page
      if (currentUser && pathname.includes('/auth/login')) {
        router.push('/admin/home');
        return;
      }

      // Redirect unauthenticated users to login (except auth and public paths)
      if (!currentUser && !isAuthPath && !isPublicPath) {
        router.push('/admin/auth/login');
        return;
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  // Show loading spinner
  if (loading) {
    return (
      <html lang="en">
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

  // Define paths where navbar should be hidden
  const hideNavbarPaths = ['/auth/login', '/auth/change-password', '/', '/notReady'];
  const shouldShowNavbar = user && !hideNavbarPaths.includes(pathname);

  return (
    <html lang="en">
      <body>
        {shouldShowNavbar && <Navbar />}
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}