// src/app/directeur-des-etudes/components/EmargementsPage.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "../../../../firebaseConfig";
import { useAcademicYear } from "../context/AcademicYearContext";
import Toast from "../../admin/components/ui/Toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import {
  evaluateNeutralization,
  TClosureRule,
  TSessionOverride,
  startOfDay as calStartOfDay,
  endOfDay as calEndOfDay,
} from "../lib/calendarRules";

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
  annee: string;               // libellé "2024-2025"
  semestre: TSemestre;
  start: string;
  end: string;
  salle?: string;
  enseignant?: string;
  matiereId?: string;
  matiere_id?: string;
  matiere_libelle: string;
  matricule: string;
  nom_complet: string;
};

type SeanceDoc = {
  annee: string;               // id année
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

type TMakeup = {
  id: string;
  class_id: string;
  matiere_id: string;
  matiere_libelle?: string;
  date: Date;
  start: string;
  end: string;
  salle?: string;
  enseignant?: string;
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
const endOfDay   = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const formatFR = (hhmm: string) => {
  const [hh, mm] = hhmm.split(":");
  return `${hh}h${mm === "00" ? "" : mm}`;
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const parseHHMMtoMinutes = (s?: string) => {
  if (!s) return 0;
  const [h, m] = s.split(":").map((x) => parseInt(x || "0", 10));
  return (h || 0) * 60 + (m || 0);
};
const formatMinutes = (mins: number) => {
  if (mins <= 0) return "0 h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

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

  // Modal fermeture (optionnel, laissé vide ici)
  const [showClosure, setShowClosure] = useState(false);

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
      </div>

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
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedFiliere((f) => (f ? { ...f } : f))}>
                Actualiser vue
              </button>
              <button className="btn btn-outline-danger btn-sm" onClick={() => setShowClosure(true)}>
                <i className="bi bi-slash-circle me-1" /> Pas de cours (fermeture)
              </button>
            </div>
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
                                Ouvrir (absents & bilan)
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

      {/* toasts */}
      <Toast message={toastMsg} type="success" show={okShow} onClose={() => setOkShow(false)} />
      <Toast message={toastMsg} type="error" show={errShow} onClose={() => setErrShow(false)} />

      {/* (squelette du modal Fermeture laissé vide exprès ici) */}
      {showClosure && (
        <>
          <div className="modal fade show" style={{display:'block'}} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-slash-circle me-2" />Déclarer une fermeture (pas de cours)</h5>
                  <button className="btn-close" onClick={()=>setShowClosure(false)} />
                </div>
                <div className="modal-body">
                  {/* À brancher si tu veux persister dans years/{yearId}/closures */}
                  <div className="text-muted">À implémenter : formulaire de période + portée.</div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={()=>setShowClosure(false)}>Fermer</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={()=>setShowClosure(false)} />
        </>
      )}
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

/* ========================= Séances ➜ absents + rattrapages ========================= */

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

  // Métadonnées année + neutralisations
  const [yearMeta, setYearMeta] = useState<{start?:Date; end?:Date}>({});
  const [closures, setClosures] = useState<TClosureRule[]>([]);
  const [overrides, setOverrides] = useState<TSessionOverride[]>([]);
  const [makeups, setMakeups] = useState<TMakeup[]>([]);

  const dayNumber = useMemo(() => {
    const d = fromISODate(dateStr);
    return dayOfWeekLundi1(d); // 1..7
  }, [dateStr]);

  const baseSessionsOfTheDay = useMemo(() => {
    if (dayNumber === 7) return [] as TEDTSlot[]; // dimanche
    return [...slots.filter((s) => s.day === dayNumber)].sort(
      (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
    );
  }, [slots, dayNumber]);

  // combine EDT + rattrapages du jour
  const combinedSessions = useMemo(() => {
    const edt = baseSessionsOfTheDay.map(s => ({ source: "edt" as const, slot: s }));
    const mk  = makeups
      .filter(m => toISODate(m.date) === dateStr)
      .map(m => ({
        source: "makeup" as const,
        slot: {
          day: dayNumber,
          matiere_id: m.matiere_id,
          matiere_libelle: m.matiere_libelle || "",
          start: m.start,
          end: m.end,
          salle: m.salle || "",
          enseignant: m.enseignant || "",
        } as TEDTSlot,
      }));
    return [...edt, ...mk].sort(
      (a, b) => a.slot.start.localeCompare(b.slot.start) || a.slot.end.localeCompare(b.slot.end)
    );
  }, [baseSessionsOfTheDay, makeups, dayNumber, dateStr]);

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

  /* ====== Métadonnées année ====== */
  useEffect(() => {
    const loadYearMeta = async () => {
      if (!yearId) return setYearMeta({});
      const yref = doc(db, "annees_scolaires", yearId);
      const ydoc = await getDoc(yref);
      if (ydoc.exists()) {
        const v = ydoc.data() as any;
        const sd = v.date_debut?.toDate?.() ?? null;
        const ed = v.date_fin?.toDate?.() ?? null;
        setYearMeta({ start: sd || undefined, end: ed || undefined });
      } else {
        setYearMeta({});
      }
    };
    loadYearMeta();
  }, [yearId]);

  /* ====== Closures (fermetures) ====== */
  useEffect(() => {
    const loadClosures = async () => {
      try {
        const arr: TClosureRule[] = [];
        const snap = await getDocs(collection(db, `years/${yearId}/closures`));
        snap.forEach((d) => {
          const v = d.data() as any;
          arr.push({
            id: d.id,
            scope: v.scope,
            filiere_id: v.filiere_id,
            class_id: v.class_id,
            matiere_id: v.matiere_id,
            start: (v.start?.toDate?.() ?? v.start) as Date,
            end: (v.end?.toDate?.() ?? v.end) as Date,
            start_time: v.start_time || undefined,
            end_time: v.end_time || undefined,
            label: v.label || undefined,
          });
        });
        setClosures(arr);
      } catch (e) { console.error(e); setClosures([]); }
    };
    if (yearId) loadClosures();
  }, [yearId]);

  /* ====== Overrides (cancel / reschedule / makeup) ====== */
  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const arr: TSessionOverride[] = [];
        const snap = await getDocs(collection(db, `years/${yearId}/session_overrides`));
        snap.forEach((d) => {
          const v = d.data() as any;
          // on transforme les dates Firestore en Date JS
          const base = {
            id: d.id,
            class_id: String(v.class_id),
            matiere_id: String(v.matiere_id),
            reason: v.reason,
          } as any;

          if (v.type === "cancel") {
            arr.push({
              ...base,
              type: "cancel",
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start),
              end: String(v.end),
            });
          } else if (v.type === "reschedule") {
            arr.push({
              ...base,
              type: "reschedule",
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start),
              end: String(v.end),
              new_date: (v.new_date?.toDate?.() ?? v.new_date) as Date,
              new_start: String(v.new_start),
              new_end: String(v.new_end),
            });
          } else if (v.type === "makeup") {
            arr.push({
              ...base,
              type: "makeup",
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start),
              end: String(v.end),
              salle: v.salle || undefined,
              enseignant: v.enseignant || undefined,
              matiere_libelle: v.matiere_libelle || undefined,
            } as any);
          }
        });
        setOverrides(arr);
      } catch (e) { console.error(e); setOverrides([]); }
    };
    if (yearId) loadOverrides();
  }, [yearId]);

  /* ====== Makeups du jour (rattrapages) ======
     On peut les récupérer depuis overrides (type="makeup") déjà chargés,
     mais on filtre par date et classe pour ce jour. */
  useEffect(() => {
    const d0 = startOfDay(fromISODate(dateStr));
    const d1 = endOfDay(fromISODate(dateStr));
    const list: TMakeup[] = overrides
      .filter(o =>
        o.type === "makeup" &&
        o.class_id === classe.id &&
        (o.date >= d0 && o.date <= d1)
      )
      .map((o: any) => ({
        id: o.id,
        class_id: o.class_id,
        matiere_id: o.matiere_id,
        matiere_libelle: o.matiere_libelle,
        date: o.date,
        start: o.start,
        end: o.end,
        salle: o.salle,
        enseignant: o.enseignant,
      }));
    setMakeups(list);
  }, [overrides, classe.id, dateStr]);

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

  /* ===== Statut neutralisation (EDT + makeups) ===== */
  const sessionsWithStatus = useMemo(() => {
    const dayDate = startOfDay(fromISODate(dateStr));
    return combinedSessions.map((obj) => {
      const res = evaluateNeutralization({
        date: dayDate,
        class_id: classe.id,
        matiere_id: obj.slot.matiere_id,
        start: obj.slot.start,
        end: obj.slot.end,
        closures,
        overrides,
        yearStart: yearMeta.start,
        yearEnd: yearMeta.end,
      });
      return { ...obj, neutralized: res.neutralized, reason: res.reason, replaced: res.replaced };
    });
  }, [combinedSessions, closures, overrides, yearMeta.start, yearMeta.end, dateStr, classe.id]);

  /* ===== Lecture absents de la séance sélectionnée (ignore si neutralisée) ===== */
  useEffect(() => {
    const run = async () => {
      setAbsents([]);
      if (selectedIndex === null) return;
      const st = sessionsWithStatus[selectedIndex];
      if (!st || st.neutralized) return;

      const slot = st.slot;
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
  }, [selectedIndex, dateStr, semestre, sessionsWithStatus.length, students.length]);

  /* ===== Création d’un RATTRAPAGE (makeup) ===== */
  const [showMakeup, setShowMakeup] = useState(false);
  const [mkDate, setMkDate]   = useState<string>(() => dateStr);
  const [mkStart, setMkStart] = useState<string>("");
  const [mkEnd, setMkEnd]     = useState<string>("");
  const [mkMat, setMkMat]     = useState<string>("");
  const [mkSalle, setMkSalle] = useState<string>("");
  const [mkEns, setMkEns]     = useState<string>("");

  const saveMakeup = async () => {
    if (!yearId || !mkDate || !mkStart || !mkEnd || !mkMat) return;
    try {
      const m = matieres[mkMat];
      await addDoc(collection(db, `years/${yearId}/session_overrides`), {
        type: "makeup",
        class_id: classe.id,
        matiere_id: mkMat,
        matiere_libelle: m?.libelle || null,
        date: startOfDay(fromISODate(mkDate)), // date jour (00:00)
        start: mkStart,
        end: mkEnd,
        salle: mkSalle || null,
        enseignant: mkEns || m?.assigned_prof_name || null,
        reason: "Rattrapage",
        created_at: Date.now(),
      });
      setShowMakeup(false);
      // on force la vue sur la date du rattrapage et on réinitialise la sélection
      setDateStr(mkDate);
      setSelectedIndex(null);
    } catch (e) {
      console.error(e);
      // (tu peux brancher un toast local ici si tu veux)
    }
  };

  /* ===== Export PDF ===== */
  const exportPDF = () => {
    if (selectedIndex === null) return;
    const st = sessionsWithStatus[selectedIndex];
    if (!st || st.neutralized) return;
    const slot = st.slot;

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

  const selectedStatus = selectedIndex !== null ? sessionsWithStatus[selectedIndex] : null;

  return (
    <>
      {/* Filtres séance */}
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-3 align-items-end">
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
            </div>

            <div className="col-md-6 text-md-end">
              <button className="btn btn-outline-info btn-sm" onClick={() => {
                // pré-remplir le form de rattrapage
                setMkDate(dateStr);
                setMkStart(""); setMkEnd("");
                setMkMat(Object.keys(matieres)[0] || "");
                setMkSalle(""); setMkEns("");
                setShowMakeup(true);
              }}>
                <i className="bi bi-plus-circle me-1" /> Rattraper un cours
              </button>
            </div>
          </div>

          <hr />

          {/* Séances du jour = EDT + makeups */}
          <h6 className="mb-2">Séances — {dateStr}</h6>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border" /></div>
          ) : dayNumber === 7 ? (
            <div className="alert alert-secondary mb-0">Dimanche : aucune séance prévue.</div>
          ) : combinedSessions.length === 0 ? (
            <div className="text-muted">Aucune séance dans l’EDT / rattrapage pour ce jour/semestre.</div>
          ) : (
            <div className="row g-3">
              {sessionsWithStatus.map(({source, slot, neutralized, reason}, i) => {
                const mat = matieres[slot.matiere_id];
                return (
                  <div className="col-md-4" key={`${source}-${slot.matiere_id}-${slot.start}-${slot.end}-${i}`}>
                    <button
                      className={clsx("card border-2 shadow-sm text-start w-100", selectedIndex === i ? "border-primary" : "border-0")}
                      onClick={() => !neutralized && setSelectedIndex(i)}
                      disabled={neutralized}
                      title={neutralized ? (reason || "Neutralisée") : "Ouvrir"}
                    >
                      <div className="card-body">
                        <div className="fw-semibold mb-1 d-flex align-items-center gap-2">
                          <span>{mat?.libelle || slot.matiere_libelle || "Matière"}</span>
                          {source === "makeup" && <span className="badge bg-info-subtle text-info">Rattrapage</span>}
                        </div>
                        <div className="text-muted small">
                          {formatFR(slot.start)} — {formatFR(slot.end)} {slot.salle ? `• Salle ${slot.salle}` : ""}<br />
                          {(mat?.assigned_prof_name || slot.enseignant) && (<span>Ens. {(mat?.assigned_prof_name || slot.enseignant)}</span>)}
                        </div>
                        {neutralized && (
                          <div className="mt-2">
                            <span className="badge bg-secondary">{reason || "Neutralisée"}</span>
                          </div>
                        )}
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
              <button className="btn btn-outline-primary btn-sm" onClick={exportPDF} disabled={exportBusy || !!selectedStatus?.neutralized}>
                {exportBusy ? (<><span className="spinner-border spinner-border-sm me-2" />Export…</>) : "Exporter PDF"}
              </button>
            </div>

            {selectedStatus?.neutralized ? (
              <div className="alert alert-secondary mb-0">
                Séance neutralisée — {selectedStatus.reason || "pas de cours"} : aucune absence attendue.
              </div>
            ) : stuLoading ? (
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

      {/* Modal Rattrapage */}
      {showMakeup && (
        <>
          <div className="modal fade show" style={{display:'block'}} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-plus-circle me-2" /> Programmer un rattrapage</h5>
                  <button className="btn-close" onClick={()=>setShowMakeup(false)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label">Date</label>
                      <input type="date" className="form-control" value={mkDate} onChange={(e)=>setMkDate(e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Début</label>
                      <input type="time" className="form-control" value={mkStart} onChange={(e)=>setMkStart(e.target.value)} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Fin</label>
                      <input type="time" className="form-control" value={mkEnd} onChange={(e)=>setMkEnd(e.target.value)} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Matière</label>
                      <select className="form-select" value={mkMat} onChange={(e)=>setMkMat(e.target.value)}>
                        <option value="">— choisir —</option>
                        {Object.values(matieres).map(m => (
                          <option key={m.id} value={m.id}>{m.libelle}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Salle</label>
                      <input className="form-control" value={mkSalle} onChange={(e)=>setMkSalle(e.target.value)} placeholder="ex: B12" />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Enseignant</label>
                      <input className="form-control" value={mkEns} onChange={(e)=>setMkEns(e.target.value)} placeholder="(optionnel)" />
                    </div>
                  </div>
                  <div className="form-text mt-2">
                    Le rattrapage apparaît pour les étudiants de <b>{classe.libelle}</b> uniquement à la date indiquée.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline-secondary" onClick={()=>setShowMakeup(false)}>Annuler</button>
                  <button className="btn btn-primary" onClick={saveMakeup} disabled={!mkDate || !mkStart || !mkEnd || !mkMat}>Enregistrer</button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={()=>setShowMakeup(false)} />
        </>
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
  const [dateStart, setDateStart] = useState<string>(() => toISODate(addDays(today, -6))); // 7 derniers jours
  const [dateEnd, setDateEnd] = useState<string>(() => toISODate(today));

  type AbsenceEntryWithMeta = AbsenceEntry & { class_libelle: string; date: Date };

  const [rows, setRows] = useState<Array<{
    matricule:string; nom:string; prenom?:string;
    cours:number; minutes:number; details:AbsenceEntryWithMeta[];
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<{matricule:string; nom:string; items:AbsenceEntryWithMeta[]}|null>(null);

  const [students, setStudents] = useState<TUser[]>([]);
  const [stuLoading, setStuLoading] = useState(false);

  // Métadonnées année + neutralisations
  const [yearMeta, setYearMeta] = useState<{start?:Date; end?:Date}>({});
  const [closures, setClosures] = useState<TClosureRule[]>([]);
  const [overrides, setOverrides] = useState<TSessionOverride[]>([]);

  // Charger tous les étudiants de la classe (pour afficher aussi ceux à 0)
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

        {
          const snap = await getDocs(
            query(collection(db, "users"), where("classe_id", "==", classe.id), where("academic_year_id", "==", classe.academic_year_id))
          );
          snap.forEach(push);
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
      } finally { setStuLoading(false); }
    };
    fetchStudents();
  }, [classe.id, classe.academic_year_id]);

  /* ====== Métadonnées année / closures / overrides ====== */
  useEffect(() => {
    const loadYearMeta = async () => {
      if (!yearId) return setYearMeta({});
      const yref = doc(db, "annees_scolaires", yearId);
      const ydoc = await getDoc(yref);
      if (ydoc.exists()) {
        const v = ydoc.data() as any;
        const sd = v.date_debut?.toDate?.() ?? null;
        const ed = v.date_fin?.toDate?.() ?? null;
        setYearMeta({ start: sd || undefined, end: ed || undefined });
      } else {
        setYearMeta({});
      }
    };
    loadYearMeta();
  }, [yearId]);

  useEffect(() => {
    const loadClosures = async () => {
      try {
        const arr: TClosureRule[] = [];
        const snap = await getDocs(collection(db, `years/${yearId}/closures`));
        snap.forEach((d) => {
          const v = d.data() as any;
          arr.push({
            id: d.id,
            scope: v.scope,
            filiere_id: v.filiere_id,
            class_id: v.class_id,
            matiere_id: v.matiere_id,
            start: (v.start?.toDate?.() ?? v.start) as Date,
            end: (v.end?.toDate?.() ?? v.end) as Date,
            start_time: v.start_time || undefined,
            end_time: v.end_time || undefined,
            label: v.label || undefined,
          });
        });
        setClosures(arr);
      } catch { setClosures([]); }
    };
    if (yearId) loadClosures();
  }, [yearId]);

  useEffect(() => {
    const loadOverrides = async () => {
      try {
        const arr: TSessionOverride[] = [];
        const snap = await getDocs(collection(db, `years/${yearId}/session_overrides`));
        snap.forEach((d) => {
          const v = d.data() as any;
          if (v.type === "cancel") {
            arr.push({
              id: d.id, type: "cancel",
              class_id: String(v.class_id), matiere_id: String(v.matiere_id),
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start), end: String(v.end),
              reason: v.reason,
            });
          } else if (v.type === "reschedule") {
            arr.push({
              id: d.id, type: "reschedule",
              class_id: String(v.class_id), matiere_id: String(v.matiere_id),
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start), end: String(v.end),
              new_date: (v.new_date?.toDate?.() ?? v.new_date) as Date,
              new_start: String(v.new_start), new_end: String(v.new_end),
              reason: v.reason,
            });
          } else if (v.type === "makeup") {
            arr.push({
              id: d.id, type: "makeup",
              class_id: String(v.class_id), matiere_id: String(v.matiere_id),
              date: (v.date?.toDate?.() ?? v.date) as Date,
              start: String(v.start), end: String(v.end),
              salle: v.salle || undefined,
              enseignant: v.enseignant || undefined,
              matiere_libelle: v.matiere_libelle || undefined,
              reason: v.reason,
            } as any);
          }
        });
        setOverrides(arr);
      } catch { setOverrides([]); }
    };
    if (yearId) loadOverrides();
  }, [yearId]);

  const load = async () => {
    setLoading(true);
    try {
      const s = startOfDay(fromISODate(dateStart));
      const e = endOfDay(fromISODate(dateEnd));

      // Sous-collection optimisée (si présente)
      let docs: Array<SeanceDoc & Record<string, any>> = [];
      try {
        const subSnap = await getDocs(
          query(
            collection(db, `years/${yearId}/classes/${classe.id}/emargements`),
            where("date", ">=", s),
            where("date", "<=", e)
          )
        );
        subSnap.forEach((d) => docs.push(d.data() as any));
      } catch {}

      // Fallback root
      if (docs.length === 0) {
        const rootSnap = await getDocs(
          query(
            collection(db, "emargements"),
            where("date", ">=", s),
            where("date", "<=", e)
          )
        );
        rootSnap.forEach((d) => {
          const data = d.data() as any;
          if (String(data.annee) === yearId && String(data.class_id) === classe.id) {
            docs.push(data);
          }
        });
      }

      // Agrégation par matricule
      type AbsenceEntryWithMetaX = AbsenceEntry & { class_libelle: string; date: Date };
      type Agg = { nom:string; prenom?:string; cours:number; minutes:number; details:AbsenceEntryWithMetaX[] };
      const byMat: Record<string, Agg> = {};

      for (const data of docs) {
        const classLib = data.class_libelle;
        const dateVal: Date = (data.date?.toDate?.() ?? data.date) as Date;
        const docStart = String(data.start || "");
        const docEnd = String(data.end || "");
        const matId = String(data.matiere_id || data.matiereId || "");

        // 🔎 Ignorer si neutralisée (annulée / fermée / hors année)
        const evalRes = evaluateNeutralization({
          date: calStartOfDay(dateVal),
          class_id: classe.id,
          matiere_id: matId,
          start: docStart,
          end: docEnd,
          closures,
          overrides,
          yearStart: yearMeta.start,
          yearEnd: yearMeta.end,
        });
        if (evalRes.neutralized) continue;

        for (const k of Object.keys(data)) {
          const val = (data as any)[k];
          if (Array.isArray(val)) {
            const list = val as AbsenceEntry[];

            if (!byMat[k]) {
              // essayer de retrouver nom/prenom via students
              const stu = students.find((s) => (s.matricule || "") === k);
              const nomComplet = list[0]?.nom_complet || (stu ? `${stu.nom} ${stu.prenom}` : "—");
              let nom = nomComplet;
              let prenom: string | undefined = undefined;
              if (stu) { nom = `${stu.nom} ${stu.prenom}`; prenom = stu.prenom; }
              byMat[k] = { nom, prenom, cours: 0, minutes: 0, details: [] };
            }

            for (const x of list) {
              const st = x.start || docStart;
              const en = x.end || docEnd;
              const minutes = Math.max(0, parseHHMMtoMinutes(en) - parseHHMMtoMinutes(st));
              byMat[k].cours += 1;
              byMat[k].minutes += minutes;
              byMat[k].details.push({
                ...x,
                matiereId: x.matiereId ?? x.matiere_id,
                class_libelle: classLib,
                date: dateVal,
              });
            }
          }
        }
      }

      // Construire la table finale (inclure tous les étudiants avec 0)
      const mapRows = new Map<string, { matricule:string; nom:string; prenom?:string; cours:number; minutes:number; details:AbsenceEntryWithMeta[] }>();
      for (const s0 of students) {
        const nom = `${s0.nom} ${s0.prenom}`.trim();
        if (s0.matricule) {
          mapRows.set(s0.matricule, { matricule: s0.matricule, nom, prenom: s0.prenom, cours: 0, minutes: 0, details: [] });
        }
      }
      for (const [mat, ag] of Object.entries(byMat)) {
        const prev = mapRows.get(mat);
        if (prev) {
          prev.cours = ag.cours;
          prev.minutes = ag.minutes;
          prev.details = ag.details;
          if (ag.nom && ag.nom !== "—") prev.nom = ag.nom;
        } else {
          mapRows.set(mat, { matricule: mat, nom: ag.nom || "—", cours: ag.cours, minutes: ag.minutes, details: ag.details });
        }
      }

      const arr = Array.from(mapRows.values());
      arr.sort((a, b) =>
        b.cours - a.cours ||
        b.minutes - a.minutes ||
        a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" })
      );
      setRows(arr);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [dateStart, dateEnd, classe.id, yearId, students.length, closures.length, overrides.length, yearMeta.start, yearMeta.end]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      r.matricule.toLowerCase().includes(q) ||
      r.nom.toLowerCase().includes(q)
    );
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
              <div className="ms-auto" />
              <input
                className="form-control"
                placeholder="Rechercher (matricule, nom)"
                value={search}
                onChange={(e)=>setSearch(e.target.value)}
                style={{maxWidth:260}}
              />
              <button className="btn btn-outline-primary btn-sm" onClick={load} disabled={loading || stuLoading}>
                {loading ? (<><span className="spinner-border spinner-border-sm me-2" />Calcul…</>) : "Actualiser"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {(loading || stuLoading) ? (
            <div className="text-center py-5"><div className="spinner-border" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-muted">Aucun étudiant.</div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Matricule</th>
                    <th>Nom & Prénom</th>
                    <th>Cours manqués</th>
                    <th>Heures manquées</th>
                    <th style={{width:120}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const disabled = r.cours === 0;
                    return (
                      <tr key={r.matricule || i}>
                        <td className="text-muted">{i+1}</td>
                        <td className="text-muted">{r.matricule || "—"}</td>
                        <td className="fw-semibold">{r.nom}</td>
                        <td><span className={clsx("badge", r.cours>0 ? "bg-danger-subtle text-danger":"bg-secondary-subtle text-secondary")}>{r.cours}</span></td>
                        <td className="text-muted">{formatMinutes(r.minutes)}</td>
                        <td>
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            disabled={disabled}
                            onClick={()=>!disabled && setDetailFor({ matricule:r.matricule, nom:r.nom, items:r.details })}
                            title={disabled ? "Aucun détail à afficher" : "Voir détails"}
                          >
                            Détails
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

/* ========================= Modal Détails ========================= */

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
