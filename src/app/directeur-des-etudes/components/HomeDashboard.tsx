// src/app/directeur-des-etudes/components/HomeDashboard.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { auth, db } from '../../../../firebaseConfig';
import {
  collection, getDocs, getCountFromServer, query, where, limit, orderBy,
} from 'firebase/firestore';
import { useAcademicYear } from '../context/AcademicYearContext';
import Toast from '../../admin/components/ui/Toast';

/* ------------------------- Types utiles ------------------------- */
type TUser = {
  docId?: string;
  prenom?: string;
  nom?: string;
  role_libelle?: string;
  academic_year_id?: string | null;
  annee_academique?: string | null;
  date_naissance?: string;   // attendu: 'YYYY-MM-DD'
  classe?: string;
  niveau_id?: 'L1'|'L2'|'L3'|'M1'|'M2'|string;
};

export default function HomeDashboard() {
  const { years, selected, setSelectedById, createYear, updateYear, loading } = useAcademicYear();
  const selectedLabel = selected?.label || '';

  /* ------------------------- UI Année ------------------------- */
  const [showNewYear, setShowNewYear] = React.useState(false);
  const [newYear, setNewYear] = React.useState('');
  const [newStart, setNewStart] = React.useState('');
  const [newEnd, setNewEnd] = React.useState('');
  const [newTz, setNewTz] = React.useState('Africa/Dakar');
  const [newActive, setNewActive] = React.useState(false);

  const [showEdit, setShowEdit] = React.useState(false);
  const [editStart, setEditStart] = React.useState('');
  const [editEnd, setEditEnd] = React.useState('');
  const [editTz, setEditTz] = React.useState('Africa/Dakar');
  const [editActive, setEditActive] = React.useState(false);

  const [toastMsg, setToastMsg] = React.useState('');
  const [okShow, setOkShow] = React.useState(false);
  const [errShow, setErrShow] = React.useState(false);
  const ok = (m: string) => { setToastMsg(m); setOkShow(true); };
  const ko = (m: string) => { setToastMsg(m); setErrShow(true); };

  const onOpenCreate = () => {
    setNewYear(''); setNewStart(''); setNewEnd(''); setNewTz('Africa/Dakar'); setNewActive(false);
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
      console.error(e); ko(e?.message || "Impossible de créer l'année académique.");
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
      console.error(e); ko(e?.message || "Impossible de modifier l'année académique.");
    }
  };

  React.useEffect(() => {
    if (selected?.label) {
      try { localStorage.setItem('app.selectedAnnee', selected.label); } catch {}
    }
  }, [selected?.label]);

  /* ------------------------- Bienvenue {prenom} ------------------------- */
  const [prenom, setPrenom] = React.useState<string>('');
  React.useEffect(() => {
    (async () => {
      try {
        const login = typeof window !== 'undefined' ? localStorage.getItem('userLogin') : null;
        const email = auth.currentUser?.email;
        if (!login && !email) return;
        const q1 = login
          ? query(collection(db, 'users'), where('login', '==', login))
          : query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q1);
        if (!snap.empty) {
          const d: any = snap.docs[0].data();
          setPrenom(d?.prenom || '');
        }
      } catch { /* ignore */ }
    })();
  }, []);

  /* ------------------------- Stats Firestore ------------------------- */
  const [loadingStats, setLoadingStats] = React.useState(false);
  const [nbEtudiants, setNbEtudiants] = React.useState<number>(0);
  const [nbProfs, setNbProfs] = React.useState<number>(0);
  const [nbFilieres, setNbFilieres] = React.useState<number>(0);
  const [nbClasses, setNbClasses] = React.useState<number>(0);

  // pour la répartition et les anniversaires
  const [students, setStudents] = React.useState<TUser[]>([]);

  const yearFilterFields: Array<'academic_year_id'|'annee_academique'> = ['academic_year_id','annee_academique'];

  const fetchCounts = React.useCallback(async () => {
    if (!selectedLabel) return;
    setLoadingStats(true);
    try {
      // Étudiants + dataset pour filtres
      // on récupère un échantillon large (ou tout si peu de données)
      const studentRoles = ['Etudiant','Étudiant','Student'];
      let stuSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('role_libelle', 'in', studentRoles),
          limit(500)
        )
      );
      let stu = stuSnap.docs.map(d => ({ docId: d.id, ...(d.data() as any) })) as TUser[];
      // filtre année (supporte 2 clés possibles)
      stu = stu.filter(s =>
        (s.academic_year_id && s.academic_year_id === selectedLabel) ||
        (s.annee_academique && s.annee_academique === selectedLabel)
      );
      setStudents(stu);
      setNbEtudiants(stu.length);

      // Profs
      const profRoles = ['Professeur','Enseignant','Teacher'];
      const profSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('role_libelle', 'in', profRoles),
          limit(500)
        )
      );
      const profs = profSnap.docs
        .map(d => d.data() as any)
        .filter(p =>
          (p.academic_year_id && p.academic_year_id === selectedLabel) ||
          (p.annee_academique && p.annee_academique === selectedLabel)
        );
      setNbProfs(profs.length);

      // Filières
      let fCount = 0;
      try {
        const c = await getCountFromServer(
          query(collection(db, 'filieres'), where('academic_year_id','==',selectedLabel))
        );
        fCount = c.data().count;
      } catch { /* peut ne pas exister */ }
      if (fCount === 0) {
        try {
          const c = await getCountFromServer(
            query(collection(db, 'filieres'), where('annee_academique','==',selectedLabel))
          );
          fCount = c.data().count;
        } catch {}
      }
      setNbFilieres(fCount);

      // Classes
      let clCount = 0;
      try {
        const c = await getCountFromServer(
          query(collection(db, 'classes'), where('academic_year_id','==',selectedLabel))
        );
        clCount = c.data().count;
      } catch {}
      if (clCount === 0) {
        try {
          const c = await getCountFromServer(
            query(collection(db, 'classes'), where('annee_academique','==',selectedLabel))
          );
          clCount = c.data().count;
        } catch {}
      }
      setNbClasses(clCount);
    } catch (e) {
      console.error(e);
      // on ne bloque pas l’UI
    } finally {
      setLoadingStats(false);
    }
  }, [db, selectedLabel]);

  React.useEffect(() => { fetchCounts(); }, [fetchCounts]);

  /* ------------------------- Filtre étudiants par niveau ------------------------- */
  const [niveauFilter, setNiveauFilter] = React.useState<'ALL'|'L1'|'L2'|'L3'|'M1'|'M2'>('ALL');
  const niveauxList: Array<'L1'|'L2'|'L3'|'M1'|'M2'> = ['L1','L2','L3','M1','M2'];
  const repartition = React.useMemo(() => {
    // compter par niveau depuis students
    const base = new Map(niveauxList.map(n => [n, 0]));
    for (const s of students) {
      const n = (s.niveau_id || '').toUpperCase() as any;
      if (base.has(n)) base.set(n, (base.get(n) || 0) + 1);
    }
    const rows = niveauxList.map(k => ({ k, v: base.get(k) || 0 }));
    // applique filtre si ≠ ALL
    if (niveauFilter !== 'ALL') {
      return rows.map(r => ({ ...r, v: r.k === niveauFilter ? r.v : 0 }));
    }
    return rows;
  }, [students, niveauFilter]);

  /* ------------------------- Mini calendrier (anniversaires) ------------------------- */
  const today = new Date();
  const [calRefDate, setCalRefDate] = React.useState<Date>(today);
  const [selectedDay, setSelectedDay] = React.useState<Date>(today);

  // birthdays pour l’année sélectionnée (on récupère ~300 users et on filtre côté client)
  const [birthdays, setBirthdays] = React.useState<TUser[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'users'), orderBy('created_at', 'desc'), limit(300))
        );
        const all = snap.docs.map(d => ({ docId: d.id, ...(d.data() as any) })) as TUser[];
        // Filtre année (si renseignée sur l’utilisateur)
        const inYear = all.filter(u =>
          !selectedLabel ||
          (u.academic_year_id === selectedLabel) || (u.annee_academique === selectedLabel)
        );
        setBirthdays(inYear);
      } catch {/* ignore */}
    })();
  }, [selectedLabel]);

  const yyyy_mm_dd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const mm_dd = (d: Date) => yyyy_mm_dd(d).slice(5); // 'MM-DD'

  const dayBirths = React.useMemo(() => {
    const key = mm_dd(selectedDay);
    return birthdays.filter(b => {
      if (!b.date_naissance) return false;
      // support 'YYYY-MM-DD' ou 'DD/MM/YYYY'
      const v = b.date_naissance.includes('-')
        ? b.date_naissance.slice(5)
        : b.date_naissance.slice(3,5) + '-' + b.date_naissance.slice(0,2);
      return v === key;
    });
  }, [birthdays, selectedDay]);

  const buildMonthMatrix = (ref: Date) => {
    const y = ref.getFullYear(), m = ref.getMonth();
    const first = new Date(y, m, 1);
    const startIdx = (first.getDay() + 6) % 7; // lundi=0
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const cells: Date[] = [];
    // jours avant
    for (let i=0; i<startIdx; i++) cells.push(new Date(y, m, -i));
    cells.reverse();
    // mois courant
    for (let d=1; d<=daysInMonth; d++) cells.push(new Date(y, m, d));
    // compléter 6 lignes * 7 = 42
    while (cells.length < 42) cells.push(new Date(y, m, daysInMonth + (cells.length - startIdx - daysInMonth) + 1));
    return cells;
  };
  const matrix = buildMonthMatrix(calRefDate);

  /* ------------------------- Sparkline pour “activité” ------------------------- */
  const sparkVals = React.useMemo(() => {
    // mini série à partir des répartitions
    const arr = repartition.map(r => r.v || 0);
    const max = Math.max(1, ...arr);
    return arr.map((v,i) => ({ x: (i/(arr.length-1))*100, y: 100 - (v/max)*100 }));
  }, [repartition]);

  /* ------------------------- UI ------------------------- */
  return (
    <div className="container-fluid px-0 mt-2">

      {/* En-tête + actions année */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
        <div className="pe-3">
          <h2 className="fw-bold mb-1">
            Bienvenue{prenom ? ` ${prenom}` : ''} <span className="ms-1">!</span>
          </h2>
          <div className="text-muted">
            Tableau de bord de <span className="fw-semibold">gestion scolaire</span> — suivez d’un coup d’œil vos effectifs,
            vos enseignants, vos filières et vos classes.
          </div>
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
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </select>

          <button className="btn btn-outline-secondary btn-sm" disabled={!selected} onClick={onOpenEdit}>
            <i className="bi bi-pencil me-1" /> Modifier
          </button>

          <button className="btn btn-dark btn-sm" onClick={onOpenCreate}>
            <i className="bi bi-plus-lg me-1" /> Créer une année
          </button>

          <Link
            href={ selectedLabel ? `/directeur-des-etudes/etudiants?annee=${encodeURIComponent(selectedLabel)}` : `/directeur-des-etudes/etudiants` }
            className="btn btn-primary btn-sm"
            onClick={() => { if (selectedLabel) { try { localStorage.setItem('app.selectedAnnee', selectedLabel); } catch {} } }}
          >
            <i className="bi bi-people me-1" /> Ouvrir Étudiants
          </Link>
        </div>
      </div>

      {/* Bandeau info année */}
      <div className="card border-0 shadow-sm mb-3 rounded-4">
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

      {/* KPIs */}
      <div className="row g-3 mb-3">
        {[
          { label: 'Étudiants', icon: 'bi-mortarboard', value: nbEtudiants },
          { label: 'Professeurs', icon: 'bi-person-badge', value: nbProfs },
          { label: 'Filières', icon: 'bi-diagram-3', value: nbFilieres },
          { label: 'Classes', icon: 'bi-columns-gap', value: nbClasses },
        ].map((kpi, i) => (
          <div key={kpi.label} className="col-12 col-sm-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 rounded-4">
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <span className="text-muted small">{kpi.label}</span>
                  <i className={`text-primary fs-5 ${kpi.icon}`} />
                </div>
                <div className="fs-2 fw-semibold mt-1">{loadingStats ? '—' : kpi.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Répartition + mini calendrier (colonne droite) */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
              <div className="fw-semibold"><i className="bi bi-bar-chart me-2" />Répartition par niveau</div>
              <div className="d-flex align-items-center gap-2">
                <span className="small text-muted">Filtre étudiants</span>
                <select className="form-select form-select-sm" value={niveauFilter} onChange={e => setNiveauFilter(e.target.value as any)}>
                  <option value="ALL">Tous</option>
                  {['L1','L2','L3','M1','M2'].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="card-body">
              {repartition.map(n => (
                <div key={n.k} className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span className="small text-muted">{n.k}</span>
                    <span className="small">{n.v}</span>
                  </div>
                  <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100}>
                    {/* largeur relative basée sur max */}
                    <div
                      className="progress-bar"
                      style={{
                        width: `${nbEtudiants ? Math.round((n.v / Math.max(1, nbEtudiants)) * 100) : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* mini bar chart propre (remplace le sparkline) */}
              <div className="mt-3 d-flex align-items-end gap-2" aria-hidden="true">
                {repartition.map((r, i) => {
                  const h = Math.max(6, Math.round((r.v / Math.max(1, nbEtudiants)) * 48)); // hauteur 6–48px
                  return (
                    <div
                      key={i}
                      title={`${r.k}: ${r.v}`}
                      style={{
                        height: h,
                        width: '18%',
                        background: '#0D6EFD',
                        borderRadius: 6,
                        opacity: r.v ? 1 : .25,
                        boxShadow: '0 2px 8px rgba(13,110,253,.25)',
                      }}
                    />
                  );
                })}
              </div>
              <div className="small text-muted mt-1">
                Total filtré : <strong>{repartition.reduce((a,b)=>a+b.v,0)}</strong> / {nbEtudiants}
              </div>
            </div>
          </div>
        </div>

        {/* Mini calendrier à droite */}
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
              <div className="fw-semibold"><i className="bi bi-calendar3 me-2" />Anniversaires</div>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary" onClick={() => setCalRefDate(new Date(calRefDate.getFullYear(), calRefDate.getMonth()-1, 1))}>
                  <i className="bi bi-chevron-left" />
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setCalRefDate(new Date())}>
                  Aujourd’hui
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setCalRefDate(new Date(calRefDate.getFullYear(), calRefDate.getMonth()+1, 1))}>
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="fw-semibold">
                  {calRefDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div className="mini-cal grid">
                {['L','M','M','J','V','S','D'].map((d,i)=>
                  <div key={i} className="mini-cal-cell mini-cal-head">{d}</div>
                )}
                {matrix.map((d, idx) => {
                  const inMonth = d.getMonth() === calRefDate.getMonth();
                  const isSel = yyyy_mm_dd(d) === yyyy_mm_dd(selectedDay);
                  const hasBirth = birthdays.some(b => {
                    if (!b.date_naissance) return false;
                    const v = b.date_naissance.includes('-')
                      ? b.date_naissance.slice(5)
                      : b.date_naissance.slice(3,5) + '-' + b.date_naissance.slice(0,2);
                    return v === mm_dd(d);
                  });
                  return (
                    <button
                      key={idx}
                      className={`mini-cal-cell btn ${isSel ? 'sel' : ''} ${!inMonth ? 'muted' : ''}`}
                      onClick={() => setSelectedDay(d)}
                      aria-label={yyyy_mm_dd(d)}
                    >
                      <span>{d.getDate()}</span>
                      {hasBirth && <span className="dot" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3">
                <div className="small text-muted mb-1">
                  {selectedDay.toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long' })}
                </div>
                {dayBirths.length === 0 && <div className="text-muted small">Aucun anniversaire.</div>}
                <ul className="list-unstyled mb-0">
                  {dayBirths.map((p, i) => (
                    <li key={i} className="py-1 d-flex align-items-center">
                      <i className="bi bi-gift text-primary me-2" />
                      <span className="me-2">{p.prenom} {p.nom}</span>
                      {p.role_libelle?.toLowerCase().includes('etud') && p.classe && (
                        <small className="text-muted">({p.classe})</small>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Citation finale */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body py-5 text-center">
          <blockquote className="mb-0 display-6" style={{ fontWeight: 700, lineHeight: 1.2 }}>
            « L’éducation est l’arme la plus puissante qu’on puisse utiliser pour changer le monde. »
          </blockquote>
          <div className="mt-2 text-muted">— Nelson Mandela</div>
        </div>
      </div>

      {/* ---------------------- Modals année ---------------------- */}
      {showNewYear && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-calendar2-plus me-2" />Nouvelle année académique</h5>
                  <button type="button" className="btn-close" onClick={() => setShowNewYear(false)} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Libellé (format YYYY-YYYY)</label>
                    <input className="form-control" value={newYear} onChange={(e)=>setNewYear(e.target.value)} placeholder="ex: 2025-2026" />
                    <small className="text-muted">Exemple : 2025-2026.</small>
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

      {showEdit && selected && (
        <>
          <div className="modal fade show" style={{ display: 'block' }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-pencil-square me-2" />Modifier {selected.label}</h5>
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

      {/* Styles locaux */}
      <style jsx>{`
        .mini-cal.grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .mini-cal-cell {
          border: 1px solid #e6ebf3;
          background: #fff;
          border-radius: 10px;
          padding: .35rem .2rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .mini-cal-cell.muted { opacity: .5; }
        .mini-cal-head {
          font-size: .75rem;
          font-weight: 600;
          color: #6c7a90;
          background: #f7f9fc;
        }
        .mini-cal-cell.btn { cursor: pointer; }
        .mini-cal-cell.sel { outline: 2px solid #0D6EFD; }
        .mini-cal-cell .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #0D6EFD; position: absolute; bottom: 4px;
        }
      `}</style>
    </div>
  );
}
