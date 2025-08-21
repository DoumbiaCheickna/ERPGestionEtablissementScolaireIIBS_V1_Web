'use client';

import React from 'react';
import { useAcademicYear } from '../context/AcademicYearContext';
import Toast from '../../admin/components/ui/Toast';

export default function HomeDashboard() {
  const { years, selected, setSelectedById, createYear, loading } = useAcademicYear();

  // Modal création année
  const [showNewYear, setShowNewYear] = React.useState(false);
  const [newYear, setNewYear] = React.useState('');

  // Toasts
  const [toastMsg, setToastMsg] = React.useState('');
  const [okShow, setOkShow] = React.useState(false);
  const [errShow, setErrShow] = React.useState(false);
  const ok = (m: string) => { setToastMsg(m); setOkShow(true); };
  const ko = (m: string) => { setToastMsg(m); setErrShow(true); };

  const onCreateYear = async () => {
    try {
      await createYear(newYear);
      setShowNewYear(false);
      setNewYear('');
      ok('Année académique créée et sélectionnée.');
    } catch (e: any) {
      console.error(e);
      ko(e?.message || "Impossible de créer l'année académique.");
    }
  };

  return (
    <div className="container-fluid px-0 mt-4">
      {/* En-tête */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-1">Bienvenue</h5>
          <small className="text-muted">
            Choisissez l’année académique. Toutes les données (filières, classes, matières, EDT, étudiants…)
            s’alignent automatiquement sur l’année sélectionnée.
          </small>
        </div>

        <div className="d-flex align-items-center gap-2">
          <label className="text-muted me-1">Année</label>
          <select
            className="form-select form-select-sm"
            style={{ width: 200 }}
            disabled={loading || !selected}
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedById(e.target.value)}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>

          <button className="btn btn-dark btn-sm" onClick={() => setShowNewYear(true)}>
            <i className="bi bi-plus-lg me-1" />
            Créer une année
          </button>
        </div>
      </div>

      {/* Carte info simple */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="text-muted">
            Année académique active : <strong>{selected?.label || '—'}</strong>
          </div>
          <div className="small text-muted mt-1">
            Dès que vous créez une filière, une classe, une UE, une matière ou un emploi du temps,
            l’année <strong>{selected?.label || '—'}</strong> est enregistrée et utilisée pour tous les filtres.
          </div>
        </div>
      </div>

      {/* Modal création année académique */}
      {showNewYear && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-calendar2-plus me-2" />
                    Nouvelle année académique
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowNewYear(false)} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <label className="form-label">Libellé (format YYYY-YYYY)</label>
                  <input
                    className="form-control"
                    value={newYear}
                    onChange={(e) => setNewYear(e.target.value)}
                    placeholder="ex: 2025-2026"
                  />
                  <small className="text-muted">
                    Exemple&nbsp;: 2025-2026 (l’année de droite doit être égale à l’année de gauche + 1).
                  </small>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowNewYear(false)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary" onClick={onCreateYear}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowNewYear(false)} />
        </>
      )}

      {/* Toasts */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}
