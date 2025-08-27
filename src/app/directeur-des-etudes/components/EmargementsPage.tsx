// src/app/directeur-des-etudes/components/EmargementsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
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
  day: number; // 1..6 (Lundi=1)
  matiere_id: string;
  matiere_libelle: string;
  start: string; // "08:00"
  end: string;   // "10:00"
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

type AbsenceEntry = {
  type: "absence";
  timestamp?: any;
  annee: string;               // libellé "2024-2025" (dans tes objets)
  semestre: TSemestre;
  start: string;
  end: string;
  salle?: string;
  enseignant?: string;
  matiereId: string;
  matiere_libelle: string;
  matricule: string;
  nom_complet: string;
};

type SeanceDoc = {
  // métadonnées au root de chaque doc emargements
  annee: string;               // id année (clé)
  class_id: string;
  class_libelle: string;
  semestre: TSemestre;
  date: any;                   // Timestamp/Date = début de journée
  day: number;                 // 1..6
  start: string;
  end: string;
  salle?: string;
  enseignant?: string;
  matiere_id: string;
  matiere_libelle: string;
  // + champs dynamiques: "<matricule>": AbsenceEntry[]
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

function dayOfWeekLundi1(date: Date): number {
  const js = date.getDay(); // 0..6 (0=dim)
  return ((js + 6) % 7) + 1; // 1..7
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const formatFR = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":");
  return `${hh}h${mm === "00" ? "" : mm}`;
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ========================= Page ========================= */

export default function EmargementsPage() {
  const { selected } = useAcademicYear();
  const academicYearId = selected?.id || "";
  const academicYearLabel = selected?.label || "";

  // UI : section & sélections
  const [section, setSection] = useState<SectionKey>("Gestion");
  const [mode, setMode] = useState<"classes" | "global">("classes");

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
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-0">Émargements</h2>
          <div className="text-muted">Année : <strong>{academicYearLabel || "—"}</strong></div>
        </div>
        <div className="btn-group" role="group" aria-label="Vue">
          <button className={clsx("btn btn-sm", mode==="classes"?"btn-primary":"btn-outline-primary")} onClick={()=>setMode("classes")}>Par classe</button>
          <button className={clsx("btn btn-sm", mode==="global"?"btn-primary":"btn-outline-primary")} onClick={()=>{ setMode("global"); setOpenedClasse(null); }}>Bilan global</button>
        </div>
      </div>

      {mode === "global" ? (
        <GlobalBilanView academicYearId={academicYearId} academicYearLabel={academicYearLabel} />
      ) : (
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
              <h5 className="mb-0">{selectedFiliere ? `Filière — ${selectedFiliere.libelle}` : "Filière"}</h5>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedFiliere((f) => (f ? { ...f } : f))}>
                Actualiser vue
              </button>
            </div>

            {/* CLASSES */}
            {!openedClasse ? (
              <div className="card border-0 shadow-sm">
                <div className="card-body">
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
                                  Ouvrir (absences & bilan)
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
            ) : (
              <ClasseView
                classe={openedClasse}
                onBack={() => setOpenedClasse(null)}
              />
            )}
          </main>
        </div>
      )}

      {/* toasts */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />
    </div>
  );
}

/* ========================= ClasseView: onglets Séances (absents) / Bilan ========================= */

function ClasseView({ classe, onBack }: { classe: TClasse; onBack: () => void }) {
  const { selected } = useAcademicYear();
  const yearId = selected?.id || "";
  const yearLabel = selected?.label || "";

  const [tab, setTab] = useState<"seances" | "bilan">("seances");

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
        <div className="btn-group">
          <button className={clsx("btn btn-sm", tab==="seances"?"btn-primary":"btn-outline-primary")} onClick={()=>setTab("seances")}>Séances (absents)</button>
          <button className={clsx("btn btn-sm", tab==="bilan"?"btn-primary":"btn-outline-primary")} onClick={()=>setTab("bilan")}>Bilan classe</button>
        </div>
      </div>

      {tab === "seances" ? (
        <ClasseSeancesAbsents classe={classe} yearId={yearId} yearLabel={yearLabel} />
      ) : (
        <BilanClasse classe={classe} yearId={yearId} yearLabel={yearLabel} />
      )}
    </div>
  );
}

/* ========================= Séances ➜ liste uniquement des absents ========================= */

function ClasseSeancesAbsents({ classe, yearId, yearLabel }:{
  classe: TClasse; yearId: string; yearLabel: string;
}) {
  const [semestre, setSemestre] = useState<TSemestre>("S1");
  const [dateStr, setDateStr] = useState<string>(() => toISODate(new Date())); // YYYY-MM-DD

  const [matieres, setMatieres] = useState<Record<string, TMatiere>>({});
  const [slots, setSlots] = useState<TEDTSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // étudiants (pour enrichir nom/email si besoin)
  const [students, setStudents] = useState<TUser[]>([]);
  const [stuLoading, setStuLoading] = useState(false);

  // absents de la séance sélectionnée
  const [absents, setAbsents] = useState<Array<{matricule:string; nom:string; email?:string; telephone?:string; entries:AbsenceEntry[];}>>([]);
  const [exportBusy, setExportBusy] = useState(false);

  const dayNumber = useMemo(() => {
    const d = fromISODate(dateStr);
    return dayOfWeekLundi1(d); // 1..7
  }, [dateStr]);

  const sessionsOfTheDay = useMemo(() => {
    if (dayNumber === 7) return [] as TEDTSlot[];
    return [...slots.filter((s) => s.day === dayNumber)].sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
    );
  }, [slots, dayNumber]);

  /* ====== Charger matières + EDT ====== */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // matières
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
            id: d.id, class_id: v.class_id, libelle: String(v.libelle || ""),
            ue_id: v.ue_id ?? null, academic_year_id: String(v.academic_year_id || ""),
            assigned_prof_id: v.assigned_prof_id ?? null, assigned_prof_name: v.assigned_prof_name ?? null,
          };
        });

        // EDT
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
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classe.id, classe.academic_year_id, semestre, yearId]);

  /* ====== Charger étudiants de la classe (pour enrichir infos) ====== */
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

        // mêmes stratégies robustes que EtudiantsPage
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

        const list = Array.from(bag.values());
        setStudents(list);
      } catch (e) { console.error(e); }
      finally { setStuLoading(false); }
    };
    fetchStudents();
  }, [classe.id, classe.academic_year_id]);

  /* ====== Quand une séance est sélectionnée ➜ lire absents ====== */
  useEffect(() => {
    const run = async () => {
      setAbsents([]);
      if (selectedIndex === null) return;
      const slot = sessionsOfTheDay[selectedIndex];
      if (!slot) return;

      try {
        const d = startOfDay(fromISODate(dateStr));

        const snap = await getDocs(
          query(
            collection(db, "emargements"),
            where("class_id", "==", classe.id),
            where("annee", "==", yearId),
            where("semestre", "==", semestre),
            where("date", "==", d),
            where("matiere_id", "==", slot.matiere_id),
            where("start", "==", slot.start),
            where("end", "==", slot.end)
          )
        );

        if (snap.empty) { setAbsents([]); return; }

        const doc0 = snap.docs[0];
        const data = doc0.data() as SeanceDoc & Record<string, any>;

        const rows: Array<{matricule:string; nom:string; email?:string; telephone?:string; entries:AbsenceEntry[]}> = [];

        // Tous les champs array = matricules absents
        for (const k of Object.keys(data)) {
          const val = (data as any)[k];
          if (Array.isArray(val)) {
            const entries = val as AbsenceEntry[];
            const stu = students.find((s) => (s.matricule || "") === k);
            rows.push({
              matricule: k,
              nom: stu ? `${stu.nom} ${stu.prenom}` : (entries[0]?.nom_complet || "—"),
              email: stu?.email || "",
              telephone: stu?.telephone || "",
              entries,
            });
          }
        }

        rows.sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
        setAbsents(rows);
      } catch (e) { console.error(e); }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, dateStr, semestre, sessionsOfTheDay.length, students.length]);

  const exportPDF = () => {
    if (selectedIndex === null) return;
    const slot = sessionsOfTheDay[selectedIndex];
    if (!slot) return;

    setExportBusy(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Liste des absents", pageWidth / 2, margin, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(
        `${classe.libelle} • ${semestre} • ${yearLabel}\n${dateStr} — ${formatFR(
          slot.start
        )} à ${formatFR(slot.end)} • ${matieres[slot.matiere_id]?.libelle || slot.matiere_libelle || ""}`,
        pageWidth / 2,
        margin + 18,
        { align: "center" }
      );

      const rows = absents.map((a, i) => [String(i + 1), a.matricule, a.nom, a.email || "—", a.telephone ? `+221 ${a.telephone}` : "—"]);

      autoTable(doc, {
        startY: margin + 54,
        margin: { left: margin, right: margin },
        head: [["#", "Matricule", "Nom & Prénom", "Email", "Téléphone"]],
        body: rows,
        styles: { font: "helvetica", fontSize: 10, cellPadding: 6, lineColor: [210, 210, 210], lineWidth: 0.2 },
        headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: "bold" },
        theme: "grid",
      });

      doc.save(`Absents_${classe.libelle}_${dateStr}_${formatFR(slot.start)}-${formatFR(slot.end)}.pdf`);
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <>
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
                {["S1","S2","S3","S4","S5","S6"].map((s)=> <option key={s} value={s}>{s}</option>)}
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
              <div className="form-text">Séances extraites de l’EDT.</div>
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
                          {formatFR(s.start)} — {formatFR(s.end)} {s.salle ? `• Salle ${s.salle}` : ""}<br />
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

      {/* Liste des absents pour la séance sélectionnée */}
      {selectedIndex !== null && (
        <div className="card border-0 shadow-sm">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="mb-0">Absents</h6>
              <button className="btn btn-outline-primary btn-sm" onClick={exportPDF} disabled={exportBusy}>
                {exportBusy ? (<><span className="spinner-border spinner-border-sm me-2" />Export…</>) : "Exporter PDF"}
              </button>
            </div>

            {stuLoading ? (
              <div className="text-center py-4"><div className="spinner-border" /></div>
            ) : absents.length === 0 ? (
              <div className="text-muted">Aucun absent enregistré pour cette séance.</div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Matricule</th>
                      <th>Nom & Prénom</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absents.map((a, i) => (
                      <tr key={a.matricule}>
                        <td className="text-muted">{i+1}</td>
                        <td className="text-muted">{a.matricule}</td>
                        <td className="fw-semibold">{a.nom}</td>
                        <td className="text-muted">{a.email || "—"}</td>
                        <td className="text-muted">{a.telephone ? `+221 ${a.telephone}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ========================= Bilan classe (intervalle de dates) ========================= */

function BilanClasse({ classe, yearId, yearLabel }:{
  classe: TClasse; yearId: string; yearLabel: string;
}) {
  // période
  const today = new Date();
  const [dateStart, setDateStart] = useState<string>(() => toISODate(addDays(today, -6))); // semaine -6..0
  const [dateEnd, setDateEnd] = useState<string>(() => toISODate(today));

  const [rows, setRows] = useState<Array<{matricule:string; nom:string; classe:string; count:number; details:AbsenceEntryWithMeta[]}>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<{matricule:string; nom:string; classe:string; items:AbsenceEntryWithMeta[]}|null>(null);

  type AbsenceEntryWithMeta = AbsenceEntry & { class_libelle: string; date: Date };

  const quick = {
    semaine: () => {
      const d = new Date(); const dow = dayOfWeekLundi1(d); // 1..7
      const start = addDays(startOfDay(d), -(dow-1));
      const end = addDays(start, 6);
      setDateStart(toISODate(start)); setDateEnd(toISODate(end));
    },
    "30j": () => { setDateStart(toISODate(addDays(today, -29))); setDateEnd(toISODate(today)); },
    "3m": () => { const s = new Date(today); s.setMonth(s.getMonth()-3); setDateStart(toISODate(s)); setDateEnd(toISODate(today)); },
    "6m": () => { const s = new Date(today); s.setMonth(s.getMonth()-6); setDateStart(toISODate(s)); setDateEnd(toISODate(today)); },
    annee: () => { // année scolaire supposée connue par label: "YYYY-YYYY"
      const [y1, y2] = yearLabel.split("-").map(Number);
      const start = new Date(y1, 8, 1); // 1er Sept N
      const end = new Date(y2, 7, 31);  // 31 Août N+1
      setDateStart(toISODate(start)); setDateEnd(toISODate(end));
    }
  };

  const load = async () => {
    setLoading(true);
    try{
      const s = startOfDay(fromISODate(dateStart));
      const e = endOfDay(fromISODate(dateEnd));

      const snap = await getDocs(
        query(
          collection(db, "emargements"),
          where("annee", "==", yearId),
          where("class_id", "==", classe.id),
          where("date", ">=", s),
          where("date", "<=", e)
        )
      );

      // agrégation
      const byMat: Record<string, { nom:string; classe:string; count:number; details:AbsenceEntryWithMeta[] }> = {};

      snap.forEach((d) => {
        const data = d.data() as SeanceDoc & Record<string, any>;
        const classLib = data.class_libelle;
        const dateVal = (data.date?.toDate?.() ?? data.date) as Date;

        for (const k of Object.keys(data)) {
          const val = (data as any)[k];
          if (Array.isArray(val)) {
            const list = val as AbsenceEntry[];
            if (!byMat[k]) byMat[k] = { nom: list[0]?.nom_complet || "—", classe: classLib, count: 0, details: [] };
            byMat[k].count += list.length;
            byMat[k].details.push(...list.map(x => ({ ...x, class_libelle: classLib, date: dateVal })));
          }
        }
      });

      const arr = Object.entries(byMat).map(([mat, v]) => ({ matricule: mat, nom: v.nom, classe: v.classe, count: v.count, details: v.details }));
      arr.sort((a,b)=> b.count - a.count || a.nom.localeCompare(b.nom,"fr",{sensitivity:"base"}));
      setRows(arr);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [dateStart, dateEnd, classe.id, yearId]);

  const filtered = useMemo(()=>{
    if(!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.matricule.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <>
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label mb-1">Du</label>
              <input type="date" className="form-control" value={dateStart} onChange={(e)=>setDateStart(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1">Au</label>
              <input type="date" className="form-control" value={dateEnd} onChange={(e)=>setDateEnd(e.target.value)} />
            </div>
            <div className="col-md-6 d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={quick.semaine}>Semaine</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["30j"]}>30 jours</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["3m"]}>3 mois</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["6m"]}>6 mois</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick.annee}>Année scolaire</button>
              <div className="ms-auto" />
              <input className="form-control" placeholder="Rechercher (matricule, nom)" value={search} onChange={(e)=>setSearch(e.target.value)} style={{maxWidth:260}} />
              <button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading}>
                {loading ? (<><span className="spinner-border spinner-border-sm me-2" />Calcul…</>) : "Actualiser"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucune absence sur la période.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Matricule</th>
                    <th>Nom & Prénom</th>
                    <th>Classe</th>
                    <th>Absences</th>
                    <th style={{width:120}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.matricule}>
                      <td className="text-muted">{i+1}</td>
                      <td className="text-muted">{r.matricule}</td>
                      <td className="fw-semibold">{r.nom}</td>
                      <td className="text-muted">{r.classe}</td>
                      <td><span className="badge bg-danger-subtle text-danger">{r.count}</span></td>
                      <td>
                        <button className="btn btn-outline-secondary btn-sm" onClick={()=>setDetailFor({ matricule:r.matricule, nom:r.nom, classe:r.classe, items:r.details })}>
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal détails */}
      {detailFor && (
        <DetailsModal
          title={`Détails — ${detailFor.nom} (${detailFor.matricule})`}
          onClose={()=>setDetailFor(null)}
          items={detailFor.items}
        />
      )}
    </>
  );
}

/* ========================= Bilan global (toutes classes) ========================= */

function GlobalBilanView({ academicYearId, academicYearLabel }:{ academicYearId:string; academicYearLabel:string; }) {
  const today = new Date();
  const [dateStart, setDateStart] = useState<string>(() => toISODate(addDays(today, -6)));
  const [dateEnd, setDateEnd] = useState<string>(() => toISODate(today));
  const [rows, setRows] = useState<Array<{matricule:string; nom:string; classe:string; count:number; details:(AbsenceEntry & {class_libelle:string; date:Date;})[]}>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<{matricule:string; nom:string; classe:string; items:(AbsenceEntry & {class_libelle:string; date:Date;})[]}|null>(null);

  const quick = {
    semaine: () => {
      const d = new Date(); const dow = dayOfWeekLundi1(d);
      const start = addDays(startOfDay(d), -(dow-1));
      const end = addDays(start, 6);
      setDateStart(toISODate(start)); setDateEnd(toISODate(end));
    },
    "30j": () => { setDateStart(toISODate(addDays(today, -29))); setDateEnd(toISODate(today)); },
    "3m": () => { const s = new Date(today); s.setMonth(s.getMonth()-3); setDateStart(toISODate(s)); setDateEnd(toISODate(today)); },
    "6m": () => { const s = new Date(today); s.setMonth(s.getMonth()-6); setDateStart(toISODate(s)); setDateEnd(toISODate(today)); },
    annee: () => {
      const [y1, y2] = academicYearLabel.split("-").map(Number);
      const start = new Date(y1, 8, 1);
      const end = new Date(y2, 7, 31);
      setDateStart(toISODate(start)); setDateEnd(toISODate(end));
    }
  };

  const load = async () => {
    setLoading(true);
    try{
      const s = startOfDay(fromISODate(dateStart));
      const e = endOfDay(fromISODate(dateEnd));

      const snap = await getDocs(
        query(
          collection(db, "emargements"),
          where("annee", "==", academicYearId),
          where("date", ">=", s),
          where("date", "<=", e)
        )
      );

      const byMat: Record<string, { nom:string; classe:string; count:number; details:(AbsenceEntry & {class_libelle:string; date:Date;})[] }> = {};

      snap.forEach((d) => {
        const data = d.data() as SeanceDoc & Record<string, any>;
        const classLib = data.class_libelle;
        const dateVal = (data.date?.toDate?.() ?? data.date) as Date;

        for (const k of Object.keys(data)) {
          const val = (data as any)[k];
          if (Array.isArray(val)) {
            const list = val as AbsenceEntry[];
            if (!byMat[k]) byMat[k] = { nom: list[0]?.nom_complet || "—", classe: classLib, count: 0, details: [] };
            byMat[k].count += list.length;
            byMat[k].details.push(...list.map(x => ({ ...x, class_libelle: classLib, date: dateVal })));
          }
        }
      });

      const arr = Object.entries(byMat).map(([mat, v]) => ({ matricule: mat, nom: v.nom, classe: v.classe, count: v.count, details: v.details }));
      arr.sort((a,b)=> b.count - a.count || a.nom.localeCompare(b.nom,"fr",{sensitivity:"base"}));
      setRows(arr);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [dateStart, dateEnd, academicYearId]);

  const filtered = useMemo(()=>{
    if(!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => r.matricule.toLowerCase().includes(q) || r.nom.toLowerCase().includes(q) || r.classe.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label mb-1">Du</label>
              <input type="date" className="form-control" value={dateStart} onChange={(e)=>setDateStart(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label mb-1">Au</label>
              <input type="date" className="form-control" value={dateEnd} onChange={(e)=>setDateEnd(e.target.value)} />
            </div>
            <div className="col-md-6 d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={quick.semaine}>Semaine</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["30j"]}>30 jours</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["3m"]}>3 mois</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick["6m"]}>6 mois</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={quick.annee}>Année scolaire</button>
              <div className="ms-auto" />
              <input className="form-control" placeholder="Rechercher (matricule, nom, classe)" value={search} onChange={(e)=>setSearch(e.target.value)} style={{maxWidth:280}} />
              <button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading}>
                {loading ? (<><span className="spinner-border spinner-border-sm me-2" />Calcul…</>) : "Actualiser"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucune absence sur la période.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Matricule</th>
                    <th>Nom & Prénom</th>
                    <th>Classe (dernière vue)</th>
                    <th>Absences</th>
                    <th style={{width:120}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.matricule}>
                      <td className="text-muted">{i+1}</td>
                      <td className="text-muted">{r.matricule}</td>
                      <td className="fw-semibold">{r.nom}</td>
                      <td className="text-muted">{r.classe}</td>
                      <td><span className="badge bg-danger-subtle text-danger">{r.count}</span></td>
                      <td>
                        <button className="btn btn-outline-secondary btn-sm" onClick={()=>setDetailFor({ matricule:r.matricule, nom:r.nom, classe:r.classe, items:r.details })}>
                          Détails
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detailFor && (
        <DetailsModal
          title={`Détails — ${detailFor.nom} (${detailFor.matricule})`}
          onClose={()=>setDetailFor(null)}
          items={detailFor.items}
        />
      )}
    </>
  );
}

/* ========================= Modal Détails (liste des séances d’absence) ========================= */

function DetailsModal({ title, items, onClose }:{
  title: string;
  items: (AbsenceEntry & { class_libelle?: string; date?: Date })[];
  onClose: () => void;
}) {
  return (
    <>
      <div className="modal fade show" style={{display:'block'}} aria-modal="true" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button className="btn-close" onClick={onClose}/>
            </div>
            <div className="modal-body">
              {items.length === 0 ? (
                <div className="text-muted">Aucun élément.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Heure</th>
                        <th>Matière</th>
                        <th>Prof</th>
                        <th>Salle</th>
                        {items.some(i=>i.class_libelle) && <th>Classe</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items
                        .slice()
                        .sort((a,b)=> (a.date?.getTime?.()||0) - (b.date?.getTime?.()||0))
                        .map((it, idx)=>(
                        <tr key={idx}>
                          <td className="text-muted">{it.date ? toISODate(it.date) : "—"}</td>
                          <td className="text-muted">{formatFR(it.start)}–{formatFR(it.end)}</td>
                          <td className="fw-semibold">{it.matiere_libelle}</td>
                          <td className="text-muted">{it.enseignant || "—"}</td>
                          <td className="text-muted">{it.salle || "—"}</td>
                          {it.class_libelle && <td className="text-muted">{it.class_libelle}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose}/>
    </>
  );
}
