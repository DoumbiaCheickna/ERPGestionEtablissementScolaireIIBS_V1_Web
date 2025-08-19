'use client';

import { useEffect, useMemo, useState } from 'react';
import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import RolesPage from '../pages/roles/page';
import UsersManagement from '../pages/users/gestionUsers';

type TabKey = 'roles' | 'users';

export default function RenderHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Onglet initial → depuis ?tab=... (fallback 'roles')
  const urlTab = (searchParams.get('tab') || 'roles') as TabKey;
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab);

  // Si l’URL change (ex: via la navbar), on resynchronise l’onglet
  useEffect(() => {
    if (urlTab !== activeTab) setActiveTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  // Navigue et met à jour l’onglet (sans scroll en haut)
  const goTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    const next = `${pathname}?tab=${tab}`;
    router.push(next, { scroll: false });
    setActiveTab(tab);
  };

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'roles':
        return (
          <>
            <p className="text-secondary">
              Gérez les rôles applicatifs : création, édition, suppression et recherche.
            </p>
            <RolesPage />
          </>
        );
      case 'users':
        return (
          <>
            <p className="text-secondary">
              Consultez et gérez les comptes utilisateurs (pagination, recherche, actions).
            </p>
            <UsersManagement />
          </>
        );
      default:
        return null;
    }
  }, [activeTab]);

  return (
    <div className="container mt-5">
      <h2 className="fw-bold">Bienvenue dans la Gestion Scolaire</h2>

      {/* Onglets */}
      <ul className="nav nav-tabs mt-4">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'roles' ? 'active' : 'text-secondary'}`}
            onClick={() => goTab('roles')}
          >
            Rôles
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'users' ? 'active' : 'text-secondary'}`}
            onClick={() => goTab('users')}
          >
            Utilisateurs
          </button>
        </li>
      </ul>

      {/* Contenu */}
      <div className="mt-3">
        {renderContent}
      </div>
    </div>
  );
}
