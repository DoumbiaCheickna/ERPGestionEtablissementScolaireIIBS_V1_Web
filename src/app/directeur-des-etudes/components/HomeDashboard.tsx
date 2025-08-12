// src/app/directeur-des-etudes/components/HomeDashboard.tsx
"use client";

import React from "react";

type Year = "2024-2025" | "2023-2024" | "2022-2023";

export default function HomeDashboard() {
  const [year, setYear] = React.useState<Year>("2024-2025");

  // Données fictives
  const stats = {
    totalEtudiants: 820,
    fillesPct: 42,
    garconsPct: 58,
    tauxReussiteGlobal: 78,
    tauxInsertion6Mois: 64,
    tauxAssiduite: 90,
  };

  const reussiteParClasse = [
    { classe: "L1", taux: 72 },
    { classe: "L2", taux: 79 },
    { classe: "L3", taux: 84 },
    { classe: "M1", taux: 76 },
    { classe: "M2", taux: 81 },
  ];

  const reussiteParFiliere = [
    { filiere: "Informatique", taux: 85 },
    { filiere: "Réseaux", taux: 73 },
    { filiere: "Gestion", taux: 76 },
    { filiere: "Comptabilité", taux: 80 },
    { filiere: "Marketing", taux: 74 },
  ];

  const shortcuts = [
    { label: "Emargements", icon: "bi-clipboard-check", href: "#" },
    { label: "Étudiants", icon: "bi-people", href: "#" },
    { label: "Professeurs", icon: "bi-person-badge", href: "#" },
    { label: "Filières", icon: "bi-diagram-3", href: "#" },
    { label: "Évaluations", icon: "bi-journal-check", href: "#" },
  ];

  // Charts (Chart.js dynamique)
  const classeChartRef = React.useRef<any>(null);
  const genreChartRef = React.useRef<any>(null);
  const filiereChartRef = React.useRef<any>(null);

  React.useEffect(() => {
    let mounted = true;
    async function render() {
      const ChartMod = await import("chart.js/auto");
      const Chart = ChartMod.default;

      // Classe
      const ctx1 = document.getElementById("chartClasse") as HTMLCanvasElement | null;
      if (ctx1) {
        if (classeChartRef.current) classeChartRef.current.destroy();
        classeChartRef.current = new Chart(ctx1, {
          type: "bar",
          data: {
            labels: reussiteParClasse.map((c) => c.classe),
            datasets: [{ label: "Taux de réussite (%)", data: reussiteParClasse.map((c) => c.taux) }],
          },
          options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } },
        });
      }

      // Genre
      const ctx2 = document.getElementById("chartGenre") as HTMLCanvasElement | null;
      if (ctx2) {
        if (genreChartRef.current) genreChartRef.current.destroy();
        genreChartRef.current = new Chart(ctx2, {
          type: "doughnut",
          data: {
            labels: ["Filles", "Garçons"],
            datasets: [{ label: "Répartition", data: [stats.fillesPct, stats.garconsPct] }],
          },
          options: { responsive: true },
        });
      }

      // Filière
      const ctx3 = document.getElementById("chartFiliere") as HTMLCanvasElement | null;
      if (ctx3) {
        if (filiereChartRef.current) filiereChartRef.current.destroy();
        filiereChartRef.current = new Chart(ctx3, {
          type: "bar",
          data: {
            labels: reussiteParFiliere.map((f) => f.filiere),
            datasets: [{ label: "Réussite (%)", data: reussiteParFiliere.map((f) => f.taux) }],
          },
          options: {
            responsive: true,
            indexAxis: "y",
            scales: { x: { beginAtZero: true, max: 100 } },
          },
        });
      }
    }
    if (mounted) render();
    return () => {
      mounted = false;
      if (classeChartRef.current) classeChartRef.current.destroy();
      if (genreChartRef.current) genreChartRef.current.destroy();
      if (filiereChartRef.current) filiereChartRef.current.destroy();
    };
  }, [year]);

  return (
    <div className="container-fluid px-0">
      {/* Entête + sélecteur d'année */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1">Bienvenue sur le tableau de bord</h4>
          <small className="text-muted">Vue globale de l’année académique</small>
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="text-muted">Année</label>
          <select
            className="form-select"
            style={{ width: 200 }}
            value={year}
            onChange={(e) => setYear(e.target.value as Year)}
          >
            <option>2024-2025</option>
            <option>2023-2024</option>
            <option>2022-2023</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <div className="card card-kpi kpi-purple rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="kpi-icon"><i className="bi bi-mortarboard"></i></div>
                <span className="badge text-bg-light">Année {year}</span>
              </div>
              <div className="text-muted small">Total étudiants</div>
              <div className="display-6">{stats.totalEtudiants}</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-kpi kpi-green rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="kpi-icon"><i className="bi bi-graph-up-arrow"></i></div>
                <span className="badge text-bg-success-subtle">+2.1%</span>
              </div>
              <div className="text-muted small">Réussite globale</div>
              <div className="display-6">{stats.tauxReussiteGlobal}%</div>
              <div className="progress mt-2" role="progressbar"
                   aria-valuenow={stats.tauxReussiteGlobal} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar" style={{ width: `${stats.tauxReussiteGlobal}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-kpi kpi-amber rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="kpi-icon"><i className="bi bi-briefcase"></i></div>
                <span className="badge text-bg-warning-subtle">estimation</span>
              </div>
              <div className="text-muted small">Insertion à 6 mois</div>
              <div className="display-6">{stats.tauxInsertion6Mois}%</div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-3">
          <div className="card card-kpi rounded-4 h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="kpi-icon"><i className="bi bi-calendar-check"></i></div>
                <span className="badge text-bg-light">présence</span>
              </div>
              <div className="text-muted small">Assiduité</div>
              <div className="display-6">{stats.tauxAssiduite}%</div>
              <div className="progress mt-2" role="progressbar"
                   aria-valuenow={stats.tauxAssiduite} aria-valuemin={0} aria-valuemax={100}>
                <div className="progress-bar" style={{ width: `${stats.tauxAssiduite}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Raccourcis */}
      <div className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h6 className="mb-0">Raccourcis</h6>
          <small className="text-muted">accès rapide</small>
        </div>
        <div className="row g-3">
          {shortcuts.map((s) => (
            <div className="col-6 col-md-3 col-lg-2" key={s.label}>
              <a className="shortcut-tile d-block text-decoration-none" href={s.href}>
                <i className={`bi ${s.icon} mb-2`}></i>
                <div className="fw-semibold">{s.label}</div>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Graphiques */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card card-chart rounded-4 h-100">
            <div className="card-header card-header-soft d-flex justify-content-between align-items-center rounded-top-4">
              <h6 className="mb-0">Taux de réussite par classe</h6>
              <i className="bi bi-bar-chart"></i>
            </div>
            <div className="card-body">
              <canvas id="chartClasse" height={180}></canvas>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card card-chart rounded-4 h-100">
            <div className="card-header card-header-soft d-flex justify-content-between align-items-center rounded-top-4">
              <h6 className="mb-0">Répartition filles / garçons</h6>
              <i className="bi bi-pie-chart"></i>
            </div>
            <div className="card-body">
              <canvas id="chartGenre" height={180}></canvas>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card card-chart rounded-4 h-100">
            <div className="card-header card-header-soft d-flex justify-content-between align-items-center rounded-top-4">
              <h6 className="mb-0">Taux de réussite par filière</h6>
              <i className="bi bi-graph-up"></i>
            </div>
            <div className="card-body">
              <canvas id="chartFiliere" height={200}></canvas>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .card-kpi { border:0; box-shadow: 0 6px 20px rgba(0,0,0,.06); }
        .card-kpi .kpi-icon {
          width: 44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;
          background: #edf2ff;
        }
        .card-kpi.kpi-green .kpi-icon { background:#e6fcf5; }
        .card-kpi.kpi-amber .kpi-icon { background:#fff3bf; }
        .card-kpi.kpi-purple .kpi-icon { background:#f3f0ff; }
        .card-kpi .display-6 { font-weight: 700; }

        .shortcut-tile {
          border:0; text-align:center; padding:1.25rem;
          border-radius:16px; transition: transform .15s ease, box-shadow .15s ease;
          box-shadow: 0 6px 16px rgba(0,0,0,.05);
        }
        .shortcut-tile:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0,0,0,.08); }

        .card-chart { border:0; box-shadow: 0 6px 20px rgba(0,0,0,.06); }
        .card-header-soft {
          border-bottom:0;
          background: linear-gradient(180deg, #f8f9fa, #fff);
          border-top-left-radius: .75rem;
          border-top-right-radius: .75rem;
        }
      `}</style>
    </div>
  );
}
