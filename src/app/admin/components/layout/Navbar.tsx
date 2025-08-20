'use client';

import Image from 'next/image';
import Logo from '../../assets/iibs_logo.png';
import React, { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../../../../firebaseConfig';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function RenderNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loggingOut, setLoggingOut] = useState(false);

  const currentTab = (searchParams.get('tab') || 'roles') as 'roles' | 'users';
  const onHome = pathname?.startsWith('/admin/home');

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    let navigated = false;
    const fallback = setTimeout(() => {
      if (!navigated) {
        navigated = true;
        router.replace('/admin/auth/login');
      }
    }, 300);

    try {
      await signOut(auth);
    } catch (e) {
      console.error('Erreur signOut:', e);
    } finally {
      clearTimeout(fallback);
      if (!navigated) {
        navigated = true;
        router.replace('/admin/auth/login');
      }
    }
  };

  const gotoTab = (tab: 'roles' | 'users') => {
    router.push(`/admin/home?tab=${tab}`, { scroll: false });
  };

  const isRolesActive = onHome && currentTab === 'roles';
  const isUsersActive = onHome && currentTab === 'users';

  return (
    <nav className="navbar navbar-expand-lg bg-white border-bottom px-4 py-2">
      <div className="container-fluid">
        <button
          className="navbar-brand btn btn-link p-0 text-decoration-none"
          onClick={() => gotoTab('roles')}
        >
          <Image src={Logo} alt="IIBS Logo" width={100} height={50} className="img-fluid" />
        </button>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#adminNavbar"
          aria-controls="adminNavbar"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse justify-content-end" id="adminNavbar">
          <ul className="navbar-nav align-items-lg-center">
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link ${isRolesActive ? 'active fw-semibold' : ''}`}
                onClick={() => gotoTab('roles')}
              >
                Rôles
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link ${isUsersActive ? 'active fw-semibold' : ''}`}
                onClick={() => gotoTab('users')}
              >
                Utilisateurs
              </button>
            </li>
          </ul>
        </div>

        <div className="ms-3">
          <button
            onClick={handleLogout}
            className="btn btn-outline-danger fw-semibold d-flex align-items-center gap-2"
            disabled={loggingOut}
          >
            {loggingOut && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
