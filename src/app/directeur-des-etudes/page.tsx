// src/app/directeur-des-etudes/page.tsx
"use client";

import React from "react";
import AdminNavbar from "./components/AdminNavbar";
import SecondaryMenu from "./components/SecondaryMenu";
import HomeDashboard from "./components/HomeDashboard";
import ProfessorsPage from "./components/ProfessorsPage";
import FilieresPage from "./components/FilieresPage";
import EtudiantsPage from "./components/EtudiantsPage";
import EmargementsPage from "./components/EmargementsPage";

type MainItem =
  | "Accueil"
  | "Emargements"
  | "Etudiants"
  | "Professeurs"
  | "Filières"
  | "Evaluations"
  | null;

export default function DirecteurHomePage() {
  const [active, setActive] = React.useState<MainItem>("Accueil");

  // Tu peux réactiver le secondary menu pour d’autres onglets si besoin
  const HIDE_SECONDARY: Exclude<MainItem, null>[] = [
    "Accueil",
    "Professeurs",
    "Filières",
    "Etudiants",
    "Emargements",
  ];
  const showSecondary = active !== null && !HIDE_SECONDARY.includes(active);

  return (
    <div className="page-root">
      {/* Topbar + Sidebar (dans AdminNavbar) */}
      <AdminNavbar active={active} onChange={setActive} />

      {/* Bande d’arrière-plan + conteneur centré */}
      <div className="content-container">
        <div className="content-card">
          {/* (Optionnel) Secondary menu à gauche */}
          {showSecondary && <SecondaryMenu active={active} />}

          {/* Zone principale */}
          <main className="main-area">
            {/* 👇 Ton contenu existant */}
            {active === "Accueil" && <HomeDashboard />}
            {active === "Professeurs" && <ProfessorsPage />}
            {active === "Filières" && <FilieresPage />}
            {active === "Etudiants" && <EtudiantsPage />}
            {active === "Emargements" && <EmargementsPage />}

            {/* Placeholder autres onglets */}
            {active &&
              active !== "Accueil" &&
              active !== "Professeurs" &&
              active !== "Filières" &&
              active !== "Etudiants" &&
              active !== "Emargements" && (
                <div className="card shadow-sm">
                  <div className="card-body">
                    <h5 className="card-title mb-3">{active}</h5>
                    <p className="text-muted mb-0">
                      Contenu placeholder pour <strong>{active}</strong>
                    </p>
                  </div>
                </div>
              )}
          </main>
        </div>
      </div>

      <style jsx>{`
        /* La sidebar fixe à gauche est gérée par AdminNavbar (230px).
           Ici on s'occupe juste du bloc central. */

        .page-root {
          min-height: 100vh;
          background: #eaf1ff; /* même ton que la topbar / ambiance douce */
        }

        /* Conteneur centré : limite de largeur pour éviter de coller le bord droit */
        .content-container {
          padding: 16px 18px;        /* air autour de la grande carte */
        }

        /* Grande carte blanche arrondie qui contient TOUT le contenu */
        .content-card {
          max-width: 1180px;         /* <<< règle la largeur max du contenu */
          margin: 0 auto;            /* centre la carte */
          background: #fff;
          border: 1px solid #e9eef5;
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(13, 110, 253, 0.06);
          padding: 20px 22px;
          display: flex;
          gap: 16px;
        }

        /* Zone principale (à droite si SecondaryMenu est affiché) */
        .main-area {
          flex: 1;
          min-width: 0; /* évite les débordements flex */
        }

        /* Responsive */
        @media (max-width: 1400px) {
          .content-card {
            max-width: 1080px;
          }
        }
        @media (max-width: 1200px) {
          .content-card {
            max-width: 960px;
            padding: 18px;
          }
        }
        @media (max-width: 991.98px) {
          .content-card {
            max-width: 92vw;        /* garde des marges sur mobile/tablette */
            padding: 14px;
          }
        }
      `}</style>
    </div>
  );
}
