'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../../firebaseConfig';

export type TAcademicYear = { id: string; label: string };

type Ctx = {
  years: TAcademicYear[];
  selected: TAcademicYear | null;
  setSelected: (y: TAcademicYear | null) => void;
  setSelectedById: (id: string) => void;
  createYear: (label: string) => Promise<void>;
  loading: boolean;
  reload: () => Promise<void>;
};

const AcademicYearContext = createContext<Ctx>({
  years: [],
  selected: null,
  setSelected: () => {},
  setSelectedById: () => {},
  createYear: async () => {},
  loading: true,
  reload: async () => {},
});

const YEAR_RE = /^\d{4}-\d{4}$/;
const sanitize = (s: string) => s.replace(/[<>]/g, '').trim();

export function AcademicYearProvider({ children }: { children: React.ReactNode }) {
  const [years, setYears] = useState<TAcademicYear[]>([]);
  const [selected, setSelectedState] = useState<TAcademicYear | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedAndPersist = (y: TAcademicYear | null) => {
    setSelectedState(y);
    if (typeof window !== 'undefined') {
      if (y) localStorage.setItem('academicYearId', y.id);
      else localStorage.removeItem('academicYearId');
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'annees_scolaires'), orderBy('label', 'desc')));
      const list: TAcademicYear[] = [];
      snap.forEach(d => list.push({ id: d.id, label: String((d.data() as any).label || d.id) }));

      // fallback si vide
      const base = list.length ? list : [{ id: '2024-2025', label: '2024-2025' }];
      setYears(base);

      // sélection depuis le localStorage si possible
      const ls = typeof window !== 'undefined' ? localStorage.getItem('academicYearId') : null;
      const fromLS = ls ? base.find(y => y.id === ls) || null : null;
      setSelectedAndPersist(fromLS ?? base[0] ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const setSelected = (y: TAcademicYear | null) => setSelectedAndPersist(y);

  const setSelectedById = (id: string) => {
    const y = years.find(y => y.id === id) || null;
    setSelectedAndPersist(y);
  };

  const createYear = async (raw: string) => {
    const label = sanitize(raw);
    if (!label) throw new Error("Saisissez une année académique (ex: 2025-2026).");
    if (!YEAR_RE.test(label)) throw new Error("Format invalide. Utilisez YYYY-YYYY (ex: 2025-2026).");

    const [y1s, y2s] = label.split('-');
    const y1 = Number(y1s), y2 = Number(y2s);
    if (y2 !== y1 + 1) throw new Error("L'année de droite doit être égale à l'année de gauche + 1.");

    const ref = doc(db, 'annees_scolaires', label);
    const exists = await getDoc(ref);
    if (exists.exists()) throw new Error('Cette année académique existe déjà.');

    await setDoc(ref, { label, created_at: Date.now() });

    // MAJ locale : on insère, on trie, on sélectionne la nouvelle
    setYears(prev => {
      const map = new Map(prev.map(y => [y.id, y]));
      map.set(label, { id: label, label });
      const next = Array.from(map.values()).sort((a, b) => b.label.localeCompare(a.label));
      return next;
    });
    setSelectedAndPersist({ id: label, label });
  };

  const value = useMemo(
    () => ({ years, selected, setSelected, setSelectedById, createYear, loading, reload }),
    [years, selected, loading]
  );

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export function useAcademicYear() {
  return useContext(AcademicYearContext);
}
