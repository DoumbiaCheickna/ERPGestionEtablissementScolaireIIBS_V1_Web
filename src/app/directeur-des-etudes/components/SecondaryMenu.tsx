// src/app/directeur-des-etudes/components/SecondaryMenu.tsx
"use client";

import React from "react";

type MainItem =
  | "Accueil"
  | "Emargements"
  | "Etudiants"
  | "Professeurs"
  | "Filières"
  | "Evaluations"
  | null;

const menus: Record<Exclude<MainItem, null>, { label: string; href?: string }[]> = {
  Accueil: [
    { label: "Vue d’ensemble" },
    { label: "Statistiques clés" },
    { label: "Activités récentes" },
  ],
  Emargements: [
    { label: "Feuilles du jour" },
    { label: "Historique" },
    { label: "Validation" },
  ],
  Etudiants: [
    { label: "Liste" },
    { label: "Inscriptions" },
    { label: "Groupes / Classes" },
  ],
  Professeurs: [
    { label: "Liste" },
    { label: "Affectations" },
    { label: "Disponibilités" },
  ],
  "Filières": [
    { label: "Catalogue" },
    { label: "Unités d’enseignement" },
    { label: "Programmes" },
  ],
  Evaluations: [
    { label: "Contrôles" },
    { label: "Notes" },
    { label: "Rapports" },
  ],
};

export default function SecondaryMenu({ active }: { active: MainItem }) {
  if (!active || active === "Accueil") return null;
  const items = menus[active];
  return (
    <aside className="border-end bg-white" style={{ width: 260, minHeight: "calc(100vh - 64px)" }}>
      <div className="p-3 border-bottom">
        <strong className="text-uppercase small text-muted">Menu {active}</strong>
      </div>
      <ul className="list-group list-group-flush">
        {items.map((it, idx) => (
          <li key={idx} className="list-group-item d-flex align-items-center">
            <i className="bi bi-chevron-right me-2"></i>
            <a href={it.href ?? "#"} className="text-decoration-none text-body">
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
