// src/app/directeur-des-etudes/components/HomeDashboard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useAcademicYear } from '../context/AcademicYearContext';
import Toast from '../../admin/components/ui/Toast';

export default function HomeDashboard() {
  const { years, selected, setSelectedById, createYear, updateYear, loading } = useAcademicYear();

  // Modal création année
  const [showNewYear, setShowNewYear] = React.useState(false);
  const [newYear, setNewYear] = React.useState('');
  const [newStart, setNewStart] = React.useState('');       // YYYY-MM-DD
  const [newEnd, setNewEnd] = React.useState('');           // YYYY-MM-DD
  const [newTz, setNewTz] = React.useState('Africa/Dakar');
  const [newActive, setNewActive] = React.useState(false);

  // Modal édition année
  const [showEdit, setShowEdit] = React.useState(false);
  const [editStart, setEditStart] = React.useState('');
  const [editEnd, setEditEnd] = React.useState('');
  const [editTz, setEditTz] = React.useState('Africa/Dakar');
  const [editActive, setEditActive] = React.useState(false);

  // Toasts
  const [toastMsg, setToastMsg] = React.useState('');
  const [okShow, setOkShow] = React.useState(false);
  const [errShow, setErrShow] = React.useState(false);
  const ok = (m: string) => { setToastMsg(m); setOkShow(true); };
  const ko = (m: string) => { setToastMsg(m); setErrShow(true); };

  const onOpenCreate = () => {
    setNewYear('');
    setNewStart('');
    setNewEnd('');
    setNewTz('Africa/Dakar');
    setNewActive(false);
    setShowNewYear(true);
  };

  const onCreateYear = async () => {
    try {
      await createYear({
        label: newYear,
        date_debut: newStart,
        date_fin: newEnd,
        timezone: newTz || 'Africa/Dakar',
        active: newActive,
      });
      setShowNewYear(false);
      ok('Année académique créée et sélectionnée.');
    } catch (e: any) {
      console.error(e);
      ko(e?.message || "Impossible de créer l'année académique.");
    }
  };

  const onOpenEdit = () => {
    if (!selected) return;
    setEditStart((selected as any).date_debut || '');
    setEditEnd((selected as any).date_fin || '');
    setEditTz((selected as any).timezone || 'Africa/Dakar');
    setEditActive(!!(selected as any).active);
    setShowEdit(true);
  };

  const onSaveEdit = async () => {
    if (!selected) return;
    try {
      await updateYear(selected.id, {
        date_debut: editStart,
        date_fin: editEnd,
        timezone: editTz || 'Africa/Dakar',
        active: editActive,
      });
      setShowEdit(false);
      ok('Année académique mise à jour.');
    } catch (e: any) {
      console.error(e);
      ko(e?.message || "Impossible de modifier l'année académique.");
    }
  };

  // ✅ Sync: persiste l'année sélectionnée pour toutes les pages
  React.useEffect(() => {
    if (selected?.label) {
      try { localStorage.setItem('app.selectedAnnee', selected.label); } catch {}
    }
  }, [selected?.label]);

  const selectedLabel = selected?.label || '';

  /* ------------------------------------------------------------------ */
  /* Statistiques fictives (visuelles) — ne modifie aucune donnée       */
  /* ------------------------------------------------------------------ */
  const stats = React.useMemo(() => {
    // petit générateur pseudo-aléatoire déterministe basé sur l'année
    const key = selectedLabel || '2024-2025';
    let seed = 0;
    for (const ch of key) seed += ch.charCodeAt(0);
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      const r = seed / 233280;
      return Math.floor(min + r * (max - min + 1));
    };

    const etudiants = rnd(320, 620);
    const profs = rnd(18, 45);
    const filieres = rnd(4, 9);
    const classes = rnd(8, 22);
    const tauxReussite = rnd(68, 96);
    const tauxAssiduite = rnd(75, 98);

    // répartition niveaux (%) qui somme ~100
    const partsRaw = [rnd(10, 30), rnd(10, 30), rnd(10, 25), rnd(10, 25), rnd(5, 20)];
    const sum = partsRaw.reduce((a, b) => a + b, 0);
    const parts = partsRaw.map((p, i) =>
      i < partsRaw.length - 1 ? Math.round((p / sum) * 100) : 100 - partsRaw.slice(0, -1).reduce((a, b) => a + Math.round((b / sum) * 100), 0)
    );
    const niveaux = [
      { k: 'L1', v: parts[0] },
      { k: 'L2', v: parts[1] },
      { k: 'L3', v: parts[2] },
      { k: 'M1', v: parts[3] },
      { k: 'M2', v: parts[4] },
    ];

    const addDays = (d: Date, n: number) => {
      const t = new Date(d);
      t.setDate(t.getDate() + n);
      return t;
    };
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });

    const now = new Date();
    const examens = [
      { lib: 'Algorithme & Structures', date: addDays(now, 7) },
      { lib: 'Bases de données', date: addDays(now, 14) },
      { lib: 'Réseaux & Systèmes', date: addDays(now, 21) },
    ].map(e => ({ ...e, dateTxt: fmt(e.date) }));

    const attendus = rnd(18, 28);
    const signes = Math.min(attendus, Math.max(0, attendus - rnd(0, 5)));
    const emargements = { attendus, signes, pct: Math.round((signes / attendus) * 100) };

    return {
      etudiants, profs, filieres, classes,
      tauxReussite, tauxAssiduite,
      niveaux, examens, emargements,
    };
  }, [selectedLabel]);

  return (
    <div className="container-fluid px-0 mt-4">
      {/* En-tête */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
        <div>
          <h5 className="mb-1">Bienvenue</h5>
          <small className="text-muted">
            Choisissez l’année académique.
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

          <button className="btn btn-outline-secondary btn-sm" disabled={!selected} onClick={onOpenEdit}>
            <i className="bi bi-pencil me-1" /> Modifier
          </button>

          <button className="btn btn-dark btn-sm" onClick={onOpenCreate}>
            <i className="bi bi-plus-lg me-1" />
            Créer une année
          </button>

          {/* ✅ Accès direct à la page Étudiants avec ?annee=... */}
          <Link
            href={
              selectedLabel
                ? `/directeur-des-etudes/etudiants?annee=${encodeURIComponent(selectedLabel)}`
                : `/directeur-des-etudes/etudiants`
            }
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (selectedLabel) {
                try { localStorage.setItem('app.selectedAnnee', selectedLabel); } catch {}
              }
            }}
          >
            <i className="bi bi-people me-1" />
            Ouvrir Étudiants
          </Link>
        </div>
      </div>

      {/* Carte info simple */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="text-muted">
            Année académique active : <strong>{selected?.label || '—'}</strong>
            {(selected as any)?.active ? (
              <span className="badge bg-success-subtle text-success ms-2">active</span>
            ) : null}
          </div>
          <div className="small text-muted mt-1">
            Période : <strong>{(selected as any)?.date_debut || '—'}</strong> →{' '}
            <strong>{(selected as any)?.date_fin || '—'}</strong>
            {(selected as any)?.timezone ? (
              <span> • TZ <code>{(selected as any).timezone}</code></span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Bloc statistiques fictives                                       */}
      {/* ---------------------------------------------------------------- */}
      <div className="row g-3 mb-3">
        {/* KPI cards */}
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted small">Étudiants</span>
                <i className="bi bi-mortarboard text-primary fs-5" />
              </div>
              <div className="fs-3 fw-semibold mt-1">{stats.etudiants}</div>
              <div className="small text-success">
                <i className="bi bi-arrow-up-short" /> +{Math.max(1, Math.floor(stats.etudiants * 0.03))} ce mois
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted small">Professeurs</span>
                <i className="bi bi-person-badge text-primary fs-5" />
              </div>
              <div className="fs-3 fw-semibold mt-1">{stats.profs}</div>
              <div className="small text-muted">
                <i className="bi bi-people" /> Ratio ~ {Math.max(8, Math.round(stats.etudiants / Math.max(1, stats.profs)))} étudiants / prof
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted small">Filières</span>
                <i className="bi bi-diagram-3 text-primary fs-5" />
              </div>
              <div className="fs-3 fw-semibold mt-1">{stats.filieres}</div>
              <div className="small text-muted">Actives sur {selectedLabel || '—'}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-sm-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted small">Classes</span>
                <i className="bi bi-columns-gap text-primary fs-5" />
              </div>
              <div className="fs-3 fw-semibold mt-1">{stats.classes}</div>
              <div className="small text-muted">
                Capacité moyenne ~ {Math.round(stats.etudiants / Math.max(1, stats.classes))} étudiants
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {/* Répartition par niveau */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold"><i className="bi bi-bar-chart me-2" />Répartition par niveau</div>
            </div>
            <div className="card-body">
              {stats.niveaux.map(n => (
                <div key={n.k} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span className="small text-muted">{n.k}</span>
                    <span className="small">{n.v}%</span>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={n.v} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-bar" style={{ width: `${n.v}%` }} />
                  </div>
                </div>
              ))}
              <div className="small text-muted">Répartition indicative sur l’année {selectedLabel || '—'}.</div>
            </div>
          </div>
        </div>

        {/* Emargements du jour */}
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0">
              <div className="fw-semibold"><i className="bi bi-journal-check me-2" />Émargements du jour</div>
            </div>
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between">
                    <span className="small text-muted">Signés</span>
                    <span className="small fw-semibold">{stats.emargements.signes}/{stats.emargements.attendus}</span>
                  </div>
                  <div className="progress" role="progressbar" aria-valuenow={stats.emargements.pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="progress-bar" style={{ width: `${stats.emargements.pct}%` }} />
                  </div>
                </div>
                <div className="text-center" style={{ minWidth: 86 }}>
                  <div className="fw-bold fs-4">{stats.emargements.pct}%</div>
                  <div className="small text-muted">complété</div>
                </div>
              </div>
              <div className="row text-center mt-3 g-2">
                <div className="col-6">
                  <div className="border rounded p-2">
                    <div className="small text-muted">Assiduité</div>
                    <div className="fw-semibold fs-5">{stats.tauxAssiduite}%</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="border rounded p-2">
                    <div className="small text-muted">Réussite</div>
                    <div className="fw-semibold fs-5">{stats.tauxReussite}%</div>
                  </div>
                </div>
              </div>
              <div className="small text-muted mt-2">Indicateurs simulés pour illustration.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prochains examens */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white border-0">
          <div className="fw-semibold"><i className="bi bi-calendar-event me-2" />Prochains examens (fictifs)</div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Intitulé</th>
                  <th>Date</th>
                  <th className="text-end">Préparation</th>
                </tr>
              </thead>
              <tbody>
                {stats.examens.map((ex, idx) => (
                  <tr key={idx}>
                    <td>{ex.lib}</td>
                    <td>{ex.dateTxt}</td>
                    <td className="text-end">
                      <span className="badge bg-light text-dark">
                        <i className="bi bi-gear me-1" /> En cours
                      </span>
                    </td>
                  </tr>
                ))}
                {stats.examens.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center text-muted py-4">Aucun examen à afficher.</td>
                  </tr>
                )}
              </tbody>
            </table>
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
                  <div className="mb-3">
                    <label className="form-label">Libellé (format YYYY-YYYY)</label>
                    <input
                      className="form-control"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      placeholder="ex: 2025-2026"
                    />
                    <small className="text-muted">
                      Exemple : 2025-2026 (l’année de droite = année de gauche + 1).
                    </small>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Début d’année</label>
                      <input type="date" className="form-control" value={newStart} onChange={(e)=>setNewStart(e.target.value)} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fin d’année</label>
                      <input type="date" className="form-control" value={newEnd} onChange={(e)=>setNewEnd(e.target.value)} />
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-md-8">
                      <label className="form-label">Timezone</label>
                      <input className="form-control" value={newTz} onChange={(e)=>setNewTz(e.target.value)} placeholder="Africa/Dakar" />
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <div className="form-check">
                        <input id="new-active" type="checkbox" className="form-check-input" checked={newActive} onChange={(e)=>setNewActive(e.target.checked)} />
                        <label className="form-check-label" htmlFor="new-active">Active</label>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowNewYear(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={onCreateYear}>Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowNewYear(false)} />
        </>
      )}

      {/* Modal édition année académique */}
      {showEdit && selected && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-pencil-square me-2" />
                    Modifier {selected.label}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowEdit(false)} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Début d’année</label>
                      <input type="date" className="form-control" value={editStart} onChange={(e)=>setEditStart(e.target.value)} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Fin d’année</label>
                      <input type="date" className="form-control" value={editEnd} onChange={(e)=>setEditEnd(e.target.value)} />
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-md-8">
                      <label className="form-label">Timezone</label>
                      <input className="form-control" value={editTz} onChange={(e)=>setEditTz(e.target.value)} />
                    </div>
                    <div className="col-md-4 d-flex align-items-end">
                      <div className="form-check">
                        <input id="edit-active" type="checkbox" className="form-check-input" checked={editActive} onChange={(e)=>setEditActive(e.target.checked)} />
                        <label className="form-check-label" htmlFor="edit-active">Active</label>
                      </div>
                    </div>
                  </div>

                  <div className="form-text mt-2">
                    Astuce : marquez comme <b>Active</b> l’année en cours pour vos filtres et écrans par défaut.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={() => setShowEdit(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={onSaveEdit}>Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowEdit(false)} />
        </>
      )}

      {/* Toasts */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}
