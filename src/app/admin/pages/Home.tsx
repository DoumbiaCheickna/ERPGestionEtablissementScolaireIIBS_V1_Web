'use client';

import { useState } from 'react';
import Link from 'next/link';
import React from 'react';
import RolesPage from '../pages/roles/page';
import UsersManagement from '../pages/users/gestionUsers';
import GestionModule from './modules/gestionModulesForm';

// Import your form components


export default function RenderHome() {
  const [activeTab, setActiveTab] = useState('roles');

  const renderContent = () => {
    switch (activeTab) {
      case 'roles':
        return (
          <>
            <p className="text-secondary">
              Manage student records, attendance, grades, and other relevant information.
              Add new students, update existing records, and generate reports.
            </p>
            <RolesPage />
          </>
        );
      case 'users':
        return (
          <>
            <p className="text-secondary">
              Manage modules, assign them to teachers, and track progress.
            </p>
            <UsersManagement />
          </>
        );
      case 'modules':
        return (
          <>
            <p className="text-secondary">
              Manage teacher information, assign subjects, and track schedules.
            </p>
            <GestionModule />
          </>
        );
      default:
        return null;
    }
  };

  return (

    <div className="container mt-5">
      <h2 className="fw-bold">Welcome to School Manager</h2>

      {/* Tabs */}
      <ul className="nav nav-tabs mt-4">
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'roles' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('roles')}
          >
            Role Management
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'users' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            Users Management
          </button>
        </li>

        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'modules' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('modules')}
          >
            Modules Management
          </button>
        </li>

      </ul>

      {/* Content */}
      <div className="mt-3">
        {renderContent()}
      </div>
    </div>
  );
}
