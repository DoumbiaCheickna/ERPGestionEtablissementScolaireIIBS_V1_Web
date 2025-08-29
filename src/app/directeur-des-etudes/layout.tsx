// src/app/directeur-des-etudes/layout.tsx
import type { Metadata } from "next";
import { AcademicYearProvider } from "./context/AcademicYearContext";

export const metadata: Metadata = {
  title: "IIBS | Directeur des Études",
  description: "Espace Directeur des Études",
};

export default function DirecteurLayout({ children }: { children: React.ReactNode }) {
  return (
    <AcademicYearProvider>
      <div className="min-vh-100 d-flex flex-column">
        {children}
      </div>
    </AcademicYearProvider>
  );
}
