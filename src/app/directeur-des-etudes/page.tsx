// src/app/directeur-des-etudes/page.tsx
"use client";

import React from "react";
import AdminNavbar from "./components/AdminNavbar";
import SecondaryMenu from "./components/SecondaryMenu";
import HomeDashboard from "./components/HomeDashboard";
import ProfessorsPage from "./components/ProfessorsPage";

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

  const showSecondary = active !== "Professeurs";

  return (
    <div className="d-flex flex-column flex-grow-1">
      <AdminNavbar active={active} onChange={setActive} />
      <div className="d-flex flex-grow-1">
        {showSecondary && <SecondaryMenu active={active} />}
        <main className="flex-grow-1 p-3">
          {active === "Accueil" && <HomeDashboard />}

          {active === "Professeurs" && <ProfessorsPage />}

          {active &&
            active !== "Accueil" &&
            active !== "Professeurs" && (
              <div className="card shadow-sm">
                <div className="card-body">
                  <h5 className="card-title mb-3">{active}</h5>
                  <p className="text-muted mb-0">
                    Contenu placeholder pour <strong>{active}</strong>. Les
                    données seront branchées plus tard (Firestore/Auth).
                  </p>
                </div>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
