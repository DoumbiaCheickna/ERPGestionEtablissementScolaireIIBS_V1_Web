'use client';

import { ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Navbar from './components/layout/Navbar';
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

      if (!currentUser && pathname !== '/auth/login') {
        router.push('/auth/login');
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (loading) {
    return (
       <html lang="en">
      <body>
            <div className="text-center mt-5">Loading...</div>
      </body>
    </html>

    );
  }

const hideNavbarPaths = ['/auth/login', '/auth/change-password'];
const shouldShowNavbar = user && !hideNavbarPaths.includes(pathname);

return (
  <html lang="en">
    <body>
      {shouldShowNavbar && <Navbar />}
      {children}
    </body>
  </html>
);
}
