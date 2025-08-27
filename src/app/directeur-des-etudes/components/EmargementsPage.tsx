// src/app/directeur-des-etudes/components/EmargementsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  serverTimestamp,
  setDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import { useAcademicYear } from "../context/AcademicYearContext";
import Toast from "../../admin/components/ui/Toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

/* ========================= Types ========================= */

type SectionKey = "Gestion" | "Informatique";

type TFiliere = {
  id: string;
  libelle: string;
  section: SectionKey;
  academic_year_id: string;
};

type TClasse = {
  id: string;
  filiere_id: string;
  filiere_libelle: string;
  niveau_id: string;
  niveau_libelle: string;
  libelle: string;
  academic_year_id: string;
};

type TMatiere = {
  id: string;
  class_id: string;
  libelle: string;
  ue_id?: string | null;
  academic_year_id: string;
  assigned_prof_id?: string | null;
  assigned_prof_name?: string | null;
};

type TSemestre = "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

type TEDTSlot = {
  day: number;
  matiere_id: string;
  matiere_libelle: string;
  start: string;
  end: string;
  salle: string;
  enseignant: string;
};

type TParcoursEntry = { annee: string; classe: string; class_id: string | null };

type TUser = {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  matricule?: string;
  classe_id?: string | null;
  classe?: string;
  academic_year_id?: string | null;
  annee_academique?: string;
  parcours?: TParcoursEntry[];
  parcours_keys?: string[];
};

/** Doc d’une séance dans `emargements` (métadonnées au root) */
type TSeanceDoc = {
  annee: string;                 // "2024-2025"
  class_id: string;
  class_libelle: string;
  semestre: TSemestre;
  date: Date;                    // Timestamp (start of day)
  day: number;                   // 1..6 (lun..sam)
  start: string;                 // "HH:mm"
  end: string;                   // "HH:mm"
  salle?: string;
  enseignant?: string;
  matiere_id: string;
  matiere_libelle: string;
  created_at?: any;
  updated_at?: any;
  // + autres champs dynamiques: "<matricule>": AbsenceEntry[]
};

type AbsenceEntry = {
  type: "absence";
  timestamp: Date;               // quand enregistré (client)
  annee: string;                 // "2024-2025"
  semestre: TSemestre;
  start: string;
  end: string;
  salle?: string;
  enseignant?: string;
  matiereId: string;             // camelCase comme ta capture
  matiere_libelle: string;
  matricule: string;             // clé = même matricule
  nom_complet: string;
};

/* ========================= Helpers ========================= */

const clsx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

const keyForParcours = (yearId: string, classId: string) => `${yearId}__${classId}`;

const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const fromISODate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Lundi=1 … Samedi=6 (Dimanche=7 hors EDT)
function dayOfWeekLundi1(date: Date): number {
  const js = date.getDay(); // 0..6 (0=dim)
  return ((js + 6) % 7) + 1; // 1..7
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatFR = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":");
  return `${hh}h${mm === "00" ? "" : mm}`;
};

const makeSeanceId = (anneeId: string, classId: string, date: Date, matiereId: string, start: string, end: string) =>
  `${anneeId}__${classId}__${toISODate(date).replace(/-/g, "")}__${matiereId}__${start}-${end}`;

/* ========================= Page ========================= */

export default function EmargementsPage() {
  const { selected } = useAcademicYear();
  const academicYearId = selected?.id || "";
  const academicYearLabel = selected?.label || "";

  // UI : section & sélections
  const [section, setSection] = useState<SectionKey>("Gestion");
  const [filieres, setFilieres] = useState<TFiliere[]>([]);
  const [selectedFiliere, setSelectedFiliere] = useState<TFiliere | null>(null);

  const [classes, setClasses] = useState<TClasse[]>([]);
  const [openedClasse, setOpenedClasse] = useState<TClasse | null>(null);

  // Toasts globaux
  const [toastMsg, setToastMsg] = useState("");
  const [okShow, setOkShow] = useState(false);
  const [errShow, setErrShow] = useState(false);
  const ok = (m: string) => { setToastMsg(m); setOkShow(true); };
  const ko = (m: string) => { setToastMsg(m); setErrShow(true); };

  /* ===== Charger filières (par section & année) ===== */
  useEffect(() => {
    const load = async () => {
      if (!academicYearId) { setFilieres([]); setSelectedFiliere(null); return; }
      try {
        const snap = await getDocs(
          query(
            collection(db, "filieres"),
            where("section", "==", section),
            where("academic_year_id", "==", academicYearId)
          )
        );
        const rows: TFiliere[] = [];
        snap.forEach((d) => {
          const v = d.data() as any;
          rows.push({
            id: d.id,
            libelle: String(v.libelle || ""),
            section: v.section as SectionKey,
            academic_year_id: String(v.academic_year_id || ""),
          });
        });
        rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
        setFilieres(rows);
        setSelectedFiliere((prev) => (prev && rows.find((r) => r.id === prev.id)) ? prev : (rows[0] ?? null));
      } catch (e) { console.error(e); ko("Erreur de chargement des filières."); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, academicYearId]);

  /* ===== Charger classes de la filière ===== */
  useEffect(() => {
    const load = async () => {
      if (!selectedFiliere) { setClasses([]); return; }
      try {
        const snap = await getDocs(
          query(
            collection(db, "classes"),
            where("filiere_id", "==", selectedFiliere.id),
            where("academic_year_id", "==", selectedFiliere.academic_year_id)
          )
        );
        const rows: TClasse[] = [];
        snap.forEach((d) => {
          const v = d.data() as any;
          rows.push({
            id: d.id,
            filiere_id: String(v.filiere_id),
            filiere_libelle: String(v.filiere_libelle || ""),
            niveau_id: String(v.niveau_id || ""),
            niveau_libelle: String(v.niveau_libelle || ""),
            libelle: String(v.libelle || ""),
            academic_year_id: String(v.academic_year_id || ""),
          });
        });
        rows.sort((a, b) => a.libelle.localeCompare(b.libelle));
        setClasses(rows);
      } catch (e) { console.error(e); ko("Erreur de chargement des classes."); }
    };
    load();
  }, [selectedFiliere]);

  return (
    <div className="container-fluid py-3">
      <div className="row">
        {/* === MENU LATERAL === */}
        <aside className="col-12 col-md-3 col-lg-2 mb-3 mb-md-0">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-2">
              <div className="list-group list-group-flush">
                {(["Gestion", "Informatique"] as SectionKey[]).map((s) => (
                  <button
                    key={s}
                    className={clsx(
                      "list-group-item list-group-item-action rounded-2 my-1",
                      s === section ? "bg-primary text-white border-0" : "bg-light border text-dark"
                    )}
                    onClick={() => { setSection(s); setOpenedClasse(null); }}
                  >
                    <i className={clsx("me-2", s === "Gestion" ? "bi bi-briefcase" : "bi bi-pc-display")} />
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-3 small">
                <div className="text-muted">Année sélectionnée</div>
                <div className="fw-semibold">{academicYearLabel || "—"}</div>
              </div>
            </div>
          </div>
        </aside>

        {/* === CONTENU === */}
        <main className="col-12 col-md-9 col-lg-10">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div>
              <h2 className="mb-0">Émargements</h2>
              <div className="text-muted">Année : <strong>{academicYearLabel || "—"}</strong></div>
            </div>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedFiliere((f) => (f ? { ...f } : f))}>
              Actualiser vue
            </button>
          </div>

          {openedClasse ? (
            <ClasseEmargementsView
              classe={openedClasse}
              onBack={() => setOpenedClasse(null)}
              ok={ok}
              ko={ko}
            />
          ) : (
            <>
              {/* FILIERES */}
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                  <h5 className="mb-3">Filières — {section}</h5>

                  {filieres.length === 0 ? (
                    <div className="text-muted">Aucune filière.</div>
                  ) : (
                    <div className="filiere-grid">
                      {filieres.map((f) => {
                        const active = selectedFiliere?.id === f.id;
                        return (
                          <button
                            key={f.id}
                            className={clsx("filiere-card card shadow-sm border-2 rounded-4 text-start", active ? "border-primary" : "border-0")}
                            onClick={() => setSelectedFiliere(f)}
                          >
                            <div className="icon"><i className="bi bi-mortarboard fs-5 text-primary" /></div>
                            <div className="flex-grow-1">
                              <div className="fw-semibold filiere-title">{f.libelle}</div>
                              <div className="text-muted small">Année {academicYearLabel}</div>
                            </div>
                            {active && <i className="bi bi-check-circle-fill text-primary ms-2" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <style jsx>{`
                .filiere-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
                .filiere-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: #fff; min-height: 92px; }
                .icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: rgba(13,110,253,.1); flex: 0 0 44px; }
                .filiere-title { white-space: normal; word-break: break-word; }
              `}</style>

              {/* CLASSES */}
              <div className="card border-0 shadow-sm">
                <div className="card-body">
                  <h5 className="mb-3">{selectedFiliere ? `Classes — ${selectedFiliere.libelle}` : "Classes"}</h5>
                  {classes.length === 0 ? (
                    <div className="text-muted">Aucune classe.</div>
                  ) : (
                    <div className="row g-3">
                      {classes.map((c) => (
                        <div key={c.id} className="col-12 col-md-6 col-lg-4 d-flex align-items-stretch">
                          <div className="card shadow-sm border-0 rounded-3 p-3 h-100 w-100">
                            <div className="card-body d-flex flex-column">
                              <div className="mb-2">
                                <div className="fw-bold text-primary text-truncate" title={c.libelle}>{c.libelle}</div>
                                <div className="text-muted small">{c.niveau_libelle}</div>
                              </div>
                              <div className="mt-auto">
                                <button className="btn btn-outline-secondary w-100" onClick={() => setOpenedClasse(c)}>
                                  Ouvrir l’émargement
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* toasts */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}

/* ========================= Vue classe (EDT -> séances du jour -> absences par matricule[]) ========================= */

function ClasseEmargementsView({
  classe,
  onBack,
  ok,
  ko,
}: {
  classe: TClasse;
  onBack: () => void;
  ok: (m: string) => void;
  ko: (m: string) => void;
}) {
  const { selected } = useAcademicYear();
  const yearId = selected?.id || "";
  const yearLabel = selected?.label || "";

  const [semestre, setSemestre] = useState<TSemestre>("S1");
  const [dateStr, setDateStr] = useState<string>(() => toISODate(new Date())); // YYYY-MM-DD

  const [matieres, setMatieres] = useState<Record<string, TMatiere>>({});
  const [slots, setSlots] = useState<TEDTSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // sélection d’une séance (slot)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // étudiants + filtrage
  const [students, setStudents] = useState<TUser[]>([]);
  const [stuLoading, setStuLoading] = useState(false);
  const [search, setSearch] = useState("");

  // état présence: true = présent, false = absent
  const [presences, setPresences] = useState<Record<string, boolean>>({});
  const [seanceDocId, setSeanceDocId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const dayNumber = useMemo(() => dayOfWeekLundi1(fromISODate(dateStr)), [dateStr]);

  const sessionsOfTheDay = useMemo(() => {
    if (dayNumber === 7) return [] as TEDTSlot[];
    return [...slots.filter((s) => s.day === dayNumber)].sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
    );
  }, [slots, dayNumber]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter((s) => {
      const full = `${s.nom} ${s.prenom}`.toLowerCase();
      return full.includes(q) || (s.matricule || "").toLowerCase().includes(q);
    });
  }, [students, search]);

  /* ====== Charger matières + EDT ====== */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const snapM = await getDocs(
          query(
            collection(db, "matieres"),
            where("class_id", "==", classe.id),
            where("academic_year_id", "==", classe.academic_year_id)
          )
        );
        const m: Record<string, TMatiere> = {};
        snapM.forEach((d) => {
          const v = d.data() as any;
          m[d.id] = {
            id: d.id,
            class_id: v.class_id,
            libelle: String(v.libelle || ""),
            ue_id: v.ue_id ?? null,
            academic_year_id: String(v.academic_year_id || ""),
            assigned_prof_id: v.assigned_prof_id ?? null,
            assigned_prof_name: v.assigned_prof_name ?? null,
          };
        });

        const snapE = await getDocs(query(collection(db, "edts"), where("class_id", "==", classe.id)));
        const slotsAll: TEDTSlot[] = [];
        snapE.forEach((d) => {
          const v = d.data() as any;
          if (String(v.annee || "") !== yearId) return;
          if ((v.semestre as TSemestre) !== semestre) return;
          const ss: TEDTSlot[] = Array.isArray(v.slots) ? v.slots : [];
          ss.forEach((s) => slotsAll.push(s));
        });

        setMatieres(m);
        setSlots(slotsAll);
      } catch (e) { console.error(e); ko("Erreur de chargement (matières/EDT)."); }
      finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id, classe.academic_year_id, semestre, yearId]);

  /* ====== Charger étudiants de la classe ====== */
  useEffect(() => {
    const fetchStudents = async () => {
      setStuLoading(true);
      try {
        const bag = new Map<string, TUser>();
        const push = (d: any) => {
          const v = d.data() as any;
          bag.set(d.id, {
            id: d.id,
            prenom: String(v.prenom || ""),
            nom: String(v.nom || ""),
            email: String(v.email || ""),
            telephone: String(v.telephone || ""),
            matricule: String(v.matricule || ""),
            classe_id: v.classe_id ?? null,
            classe: String(v.classe || v.classe_libelle || ""),
            academic_year_id: String(v.academic_year_id || ""),
            annee_academique: String(v.annee_academique || ""),
            parcours: Array.isArray(v.parcours) ? v.parcours : [],
            parcours_keys: Array.isArray(v.parcours_keys) ? v.parcours_keys : [],
          });
        };

        // (mêmes stratégies que ta page Etudiants)
        {
          const snap = await getDocs(
            query(collection(db, "users"), where("classe_id", "==", classe.id), where("academic_year_id", "==", classe.academic_year_id))
          ); snap.forEach(push);
        }
        { const snap = await getDocs(query(collection(db, "users"), where("classe_id", "==", classe.id))); snap.forEach(push); }
        for (const field of ["classe", "classe_libelle"] as const) {
          const snap = await getDocs(query(collection(db, "users"), where(field, "==", classe.libelle))); snap.forEach(push);
        }
        {
          const key = keyForParcours(classe.academic_year_id, classe.id);
          const snap = await getDocs(query(collection(db, "users"), where("parcours_keys", "array-contains", key)));
          snap.forEach(push);
        }

        const list = Array.from(bag.values()).sort((x, y) =>
          (x.nom + " " + x.prenom).localeCompare(y.nom + " " + y.prenom, "fr", { sensitivity: "base" })
        );
        setStudents(list);
      } catch (e) { console.error(e); ko("Erreur de chargement des étudiants."); }
      finally { setStuLoading(false); }
    };
    fetchStudents();
  }, [classe.id, classe.academic_year_id, ko]);

  /* ====== Quand une séance est choisie, charger le doc et marquer les absents (par matricule[]) ====== */
  useEffect(() => {
    const run = async () => {
      // reset
      const baseAllPresent: Record<string, boolean> = {};
      students.forEach((s) => (baseAllPresent[s.id] = true)); // par défaut => présent
      setPresences(baseAllPresent);
      setSeanceDocId(null);

      if (selectedIndex === null) return;
      const slot = sessionsOfTheDay[selectedIndex];
      if (!slot) return;

      try {
        const dateObj = fromISODate(dateStr);
        // on cherche la séance (si déjà créée)
        const snap = await getDocs(
          query(
            collection(db, "emargements"),
            where("class_id", "==", classe.id),
            where("annee", "==", yearId),
            where("semestre", "==", semestre),
            where("date", "==", startOfDay(dateObj)),
            where("matiere_id", "==", slot.matiere_id),
            where("start", "==", slot.start),
            where("end", "==", slot.end)
          )
        );

        if (!snap.empty) {
          const d0 = snap.docs[0];
          setSeanceDocId(d0.id);
          const data = d0.data() as Record<string, any>;

          // Tous les champs array = matricules absents
          const absentMatricules = Object.keys(data).filter((k) => Array.isArray((data as any)[k]));
          // Passe les correspondants en "absent"
          const next = { ...baseAllPresent };
          absentMatricules.forEach((mat) => {
            const stu = students.find((s) => (s.matricule || "") === mat);
            if (stu) next[stu.id] = false;
          });
          setPresences(next);
        }
      } catch (e) { console.error(e); ko("Impossible de charger l’émargement."); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, dateStr, semestre, sessionsOfTheDay.length, students.length]);

  const togglePresence = (userId: string) =>
    setPresences((prev) => ({ ...prev, [userId]: !prev[userId] }));

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    (filteredStudents.length ? filteredStudents : students).forEach((s) => (next[s.id] = value));
    setPresences((prev) => ({ ...prev, ...next }));
  };

  const saveEmargement = async () => {
    if (selectedIndex === null) return;
    const slot = sessionsOfTheDay[selectedIndex];
    if (!slot) return;
    setSaveBusy(true);

    try {
      const dateObj = fromISODate(dateStr);
      const seanceId = makeSeanceId(yearId, classe.id, dateObj, slot.matiere_id, slot.start, slot.end);
      const seanceRef = doc(db, "emargements", seanceId);

      // 1) Upsert du "header" de séance (métadonnées racine)
      const header: TSeanceDoc = {
        annee: yearId,
        class_id: classe.id,
        class_libelle: classe.libelle,
        semestre,
        date: startOfDay(dateObj),
        day: dayNumber,
        start: slot.start,
        end: slot.end,
        salle: slot.salle,
        enseignant: matieres[slot.matiere_id]?.assigned_prof_name || slot.enseignant || "",
        matiere_id: slot.matiere_id,
        matiere_libelle: matieres[slot.matiere_id]?.libelle || slot.matiere_libelle || "",
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };
      await setDoc(seanceRef, header, { merge: true });
      setSeanceDocId(seanceId);

      // 2) Calcul absences/presences ➜ updates par matricule (champ tableau) / deleteField
      const updates: Record<string, any> = {};

      for (const s of students) {
        const present = !!presences[s.id];
        const mat = (s.matricule || "").trim();
        if (!mat) continue;

        if (present) {
          // présent => supprimer le champ si existe
          updates[mat] = deleteField();
        } else {
          // absent => écrire tableau avec une entrée (on peut en empiler plus tard si tu veux historiser plusieurs enregistrements)
          const entry: AbsenceEntry = {
            type: "absence",
            timestamp: new Date(), // coté client; root a serverTimestamp()
            annee: yearLabel,
            semestre,
            start: slot.start,
            end: slot.end,
            salle: slot.salle,
            enseignant: header.enseignant || "",
            matiereId: slot.matiere_id,
            matiere_libelle: header.matiere_libelle,
            matricule: mat,
            nom_complet: `${s.nom} ${s.prenom}`.trim(),
          };
          updates[mat] = [entry];
        }
      }

      if (Object.keys(updates).length) {
        await updateDoc(seanceRef, updates);
      }

      ok("Émargement enregistré (absences mises à jour).");
    } catch (e) {
      console.error(e);
      ko("Enregistrement impossible.");
    } finally {
      setSaveBusy(false);
    }
  };

  const exportPDF = () => {
    if (selectedIndex === null) return;
    const slot = sessionsOfTheDay[selectedIndex];
    if (!slot) return;

    const docx = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 48;
    const pageWidth = docx.internal.pageSize.getWidth();

    docx.setFont("helvetica", "bold");
    docx.setFontSize(16);
    docx.text("Feuille d’émargement", pageWidth / 2, margin, { align: "center" });

    docx.setFont("helvetica", "normal");
    docx.setFontSize(11);
    docx.text(
      `${classe.libelle} • ${semestre} • ${yearLabel}\n${dateStr} — ${formatFR(
        slot.start
      )} à ${formatFR(slot.end)} • ${matieres[slot.matiere_id]?.libelle || slot.matiere_libelle || ""}`,
      pageWidth / 2,
      margin + 18,
      { align: "center" }
    );

    const rows = students.map((s, i) => [
      String(i + 1),
      s.matricule || "—",
      `${s.nom} ${s.prenom}`,
      presences[s.id] ? "Présent" : "Absent",
      "",
    ]);

    autoTable(docx, {
      startY: margin + 54,
      margin: { left: margin, right: margin },
      head: [["#", "Matricule", "Nom & Prénom", "Présence", "Signature"]],
      body: rows,
      styles: { font: "helvetica", fontSize: 10, cellPadding: 6, lineColor: [210, 210, 210], lineWidth: 0.2 },
      headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 100 }, 2: { cellWidth: 240 }, 3: { cellWidth: 80 } },
      theme: "grid",
    });

    docx.save(`Emargement_${classe.libelle}_${dateStr}_${formatFR(slot.start)}-${formatFR(slot.end)}.pdf`);
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <button className="btn btn-link px-0 me-2" onClick={onBack}>
            <i className="bi bi-arrow-left" /> Retour
          </button>
          <h4 className="mb-0">{classe.libelle}</h4>
          <div className="text-muted small">
            {classe.niveau_libelle} • {classe.filiere_libelle} • Année : {yearLabel}
          </div>
        </div>
      </div>

      {/* Filtres séance */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label mb-1">Semestre</label>
              <select
                className="form-select"
                value={semestre}
                onChange={(e) => { setSemestre(e.target.value as TSemestre); setSelectedIndex(null); }}
              >
                {["S1", "S2", "S3", "S4", "S5", "S6"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label mb-1">Date</label>
              <input
                type="date"
                className="form-control"
                value={dateStr}
                onChange={(e) => { setDateStr(e.target.value); setSelectedIndex(null); }}
              />
              <div className="form-text">Les séances proviennent de l’EDT.</div>
            </div>
          </div>

          <hr />

          {/* Séances du jour */}
          <h6 className="mb-2">Séances — {dateStr}</h6>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border" /></div>
          ) : dayNumber === 7 ? (
            <div className="alert alert-secondary mb-0">Dimanche : aucune séance prévue.</div>
          ) : sessionsOfTheDay.length === 0 ? (
            <div className="text-muted">Aucune séance dans l’EDT pour ce jour/semestre.</div>
          ) : (
            <div className="row g-3">
              {sessionsOfTheDay.map((s, i) => {
                const mat = matieres[s.matiere_id];
                return (
                  <div className="col-md-4" key={`${s.matiere_id}-${s.start}-${s.end}-${i}`}>
                    <button
                      className={clsx("card border-2 shadow-sm text-start w-100", selectedIndex === i ? "border-primary" : "border-0")}
                      onClick={() => setSelectedIndex(i)}
                    >
                      <div className="card-body">
                        <div className="fw-semibold mb-1">{mat?.libelle || s.matiere_libelle || "Matière"}</div>
                        <div className="text-muted small">
                          {formatFR(s.start)} — {formatFR(s.end)}
                          {s.salle ? ` • Salle ${s.salle}` : ""}<br />
                          {(mat?.assigned_prof_name || s.enseignant) && (<span>Ens. {(mat?.assigned_prof_name || s.enseignant)}</span>)}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Table émargement */}
      {selectedIndex !== null && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div className="d-flex gap-2">
                <button className="btn btn-outline-success btn-sm" onClick={() => setAll(true)}>Tous présents</button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setAll(false)}>Tous absents</button>
                <button className="btn btn-outline-primary btn-sm" onClick={exportPDF}>Export PDF</button>
              </div>
              <div className="d-flex align-items-center gap-2">
                <input
                  className="form-control"
                  placeholder="Rechercher (nom, matricule)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ maxWidth: 260 }}
                />
                <button className="btn btn-primary" onClick={saveEmargement} disabled={saveBusy}>
                  {saveBusy ? (<><span className="spinner-border spinner-border-sm me-2" /> Enregistrement…</>) : "Enregistrer"}
                </button>
              </div>
            </div>

            <div className="table-responsive">
              {stuLoading ? (
                <div className="text-center py-5"><div className="spinner-border" /></div>
              ) : students.length === 0 ? (
                <div className="text-muted py-4">Aucun étudiant trouvé pour cette classe.</div>
              ) : (
                <table className="table align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 90 }}>Présent</th>
                      <th>Matricule</th>
                      <th>Nom & Prénom</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <div className="form-check form-switch">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={!!presences[s.id]}
                              onChange={() => togglePresence(s.id)}
                            />
                          </div>
                        </td>
                        <td className="text-muted">{s.matricule || "—"}</td>
                        <td className="fw-semibold">{s.nom} {s.prenom}</td>
                        <td className="text-muted">{s.email || "—"}</td>
                        <td className="text-muted">{s.telephone ? `+221 ${s.telephone}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
