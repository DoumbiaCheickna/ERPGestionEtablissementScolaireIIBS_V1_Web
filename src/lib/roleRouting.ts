// src/lib/roleRouting.ts
export function normalize(str: string) {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function routeForRole(roleLabel: string): string {
  const n = normalize(roleLabel);

  const isDirector =
    n.includes("directeur des etudes") ||
    n.includes("directeur") ||
    n.includes("director");

  if (isDirector) return "/directeur-des-etudes";
  if (n === "admin" || n.includes("administrateur")) return "/admin/home";

  // ✅ plus de /notReady — on renvoie par défaut sur /admin/home
  return "/admin/home";
}
