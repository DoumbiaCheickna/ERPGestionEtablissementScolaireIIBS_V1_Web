// src/app/directeur-des-etudes/layout.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IIBS | Directeur des Études",
  description: "Espace Directeur des Études",
};

export default function DirecteurLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-vh-100 d-flex flex-column">
      {children}
    </div>
  );
}