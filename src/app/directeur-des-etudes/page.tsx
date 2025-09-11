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
import PersonnelPage from "./components/PersonnelPage";
import { visibleTabsForRole } from "@/lib/permissions";
import EmargementsProfsPage from "./components/EmargementsProfsPage";


type MainItem =
  | "Accueil"
  | "EmargementsEtudiants"
  | "EmargementsProfesseurs"
  | "Etudiants"
  | "Professeurs"
  | "Filières"
  | "Personnel"
  | "Evaluations"
  | null;

export default function DirecteurHomePage() {
  const [roleLabel, setRoleLabel] = React.useState<string>("");
  const [active, setActive] = React.useState<MainItem>("Accueil");

  // NEW: au montage, on lit userRole dans localStorage
  React.useEffect(() => {
    try { setRoleLabel(localStorage.getItem("userRole") || ""); } catch {}
  }, []);

  // NEW: calcule la liste d’onglets autorisés selon le rôle
  const allowedTabs = React.useMemo(() => visibleTabsForRole(roleLabel), [roleLabel]);

  // NEW: si un onglet devient masqué, on retombe sur "Accueil"
  React.useEffect(() => {
    if (active && !allowedTabs.includes(active)) setActive("Accueil");
  }, [allowedTabs, active]);

  // Tu peux réactiver le secondary menu pour d’autres onglets si besoin
  const HIDE_SECONDARY: Exclude<MainItem, null>[] = [
    "Accueil",
    "Professeurs",
    "Filières",
    "Etudiants",
    "EmargementsEtudiants",
    "EmargementsProfesseurs",
    "Personnel",
  ];
  const showSecondary = active !== null && !HIDE_SECONDARY.includes(active);

  return (
    <div className="page-root">
      {/* Topbar + Sidebar (dans AdminNavbar) */}
      <AdminNavbar active={active} onChange={setActive} allowedTabs={allowedTabs} />

      {/* Bande d’arrière-plan + conteneur centré */}
      <div className="content-container">
        <div className="content-card">
          {/* (Optionnel) Secondary menu à gauche */}
          {showSecondary && <SecondaryMenu active={active} />}

          {/* Zone principale */}
          <main className="main-area">
            {/* 👇 Ton contenu existant */}
            {active === "Accueil" && (
  <HomeDashboard onOpenEtudiants={() => setActive("Etudiants")} />
)}
            {active === "Professeurs" && <ProfessorsPage />}
            {active === "Filières" && <FilieresPage />}
            {active === "Etudiants" && <EtudiantsPage />}
            {active === "EmargementsEtudiants" && <EmargementsPage />}
            {active === "Personnel" && <PersonnelPage />}
            {active === "EmargementsProfesseurs" && <EmargementsProfsPage />}

            {/* Placeholder autres onglets */}
            {active &&
              active !== "Accueil" &&
              active !== "Professeurs" &&
              active !== "Filières" &&
              active !== "Etudiants" &&
              active !== "EmargementsEtudiants" &&
              active !== "EmargementsProfesseurs" &&
              active !== "Personnel" && (
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
