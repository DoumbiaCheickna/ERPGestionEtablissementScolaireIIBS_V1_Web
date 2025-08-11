'use client';

import { useState } from 'react';
import Link from 'next/link';
import React from 'react';

// Import your form components


export default function RenderHome() {
  const [activeTab, setActiveTab] = useState('students');

  const renderContent = () => {
    switch (activeTab) {
      case 'students':
        return (
          <>
            <p className="text-secondary">
              Manage student records, attendance, grades, and other relevant information.
              Add new students, update existing records, and generate reports.
            </p>
          </>
        );
      case 'modules':
        return (
          <>
            <p className="text-secondary">
              Manage modules, assign them to teachers, and track progress.
            </p>
          </>
        );
      case 'teachers':
        return (
          <>
            <p className="text-secondary">
              Manage teacher information, assign subjects, and track schedules.
            </p>
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
            className={`nav-link fw-semibold ${activeTab === 'students' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('students')}
          >
            Student Management
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'modules' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('modules')}
          >
            Module Management
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link fw-semibold ${activeTab === 'teachers' ? 'active' : 'text-secondary'}`}
            onClick={() => setActiveTab('teachers')}
          >
            Teacher Management
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
