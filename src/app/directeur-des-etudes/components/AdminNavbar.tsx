// src/app/directeur-des-etudes/components/AdminNavbar.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../../firebaseConfig";
import { signOut, updatePassword, updateProfile } from "firebase/auth";
import NotificationsBell from "./NotificationsBell";
// déjà exporté `storage` depuis firebaseConfig :
import { storage } from "../../../../firebaseConfig";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  limit as fbLimit,
} from "firebase/firestore";

type MainItem =
  | "Accueil"
  | "EmargementsEtudiants"
  | "EmargementsProfesseurs"
  | "Etudiants"
  | "Professeurs"
  | "Filières"
  | "Personnel" 
  | "Evaluations";

const MAIN_MENU: MainItem[] = [
  "Accueil",
  "EmargementsEtudiants",
  "EmargementsProfesseurs",
  "Etudiants",
  "Professeurs",
  "Filières",
  "Personnel",
  "Evaluations",
];

const ICONS: Record<MainItem, string> = {
  Accueil: "bi-house-door",
  EmargementsEtudiants: "bi-clipboard-check",
  EmargementsProfesseurs: "bi-clipboard-data",
  Etudiants: "bi-people",
  Professeurs: "bi-person-badge",
  Filières: "bi-layers",
  Personnel: "bi-person-gear",
  Evaluations: "bi-bar-chart",
};

const LABELS: Record<MainItem, React.ReactNode> = {
  Accueil: "Accueil",
  EmargementsEtudiants: "Émargements des\n étudiants", // ⬅️ 2 lignes
  EmargementsProfesseurs: "Émargements des\n professeurs",
  Etudiants: "Étudiants",
  Professeurs: "Professeurs",
  "Filières": "Filières",
  Personnel: "Personnel",
  Evaluations: "Evaluations",
};


type UserInfo = {
  docId: string;
  prenom: string;
  nom: string;
  login: string;
  email: string;
  password?: string;
  avatar_url?: string; 
};


// --------- Helpers recherche ----------
type SearchResult =
  | { kind: "prof"; id: string; title: string; subtitle?: string }
  | { kind: "etudiant"; id: string; title: string; subtitle?: string }
  | { kind: "classe"; id: string; title: string; subtitle?: string };

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const includesLoose = (hay: string, needle: string) =>
  norm(hay).includes(norm(needle));

// --------------------------------------

export default function AdminNavbar({
  active,
  onChange,
  allowedTabs = [],
}: {
  active: MainItem | null;
  onChange: (item: MainItem) => void;
  allowedTabs?: string[]; 
}) {
  const router = useRouter();

  // Réserver la place de la sidebar en desktop
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.add("with-admin-sidebar");
      return () => document.body.classList.remove("with-admin-sidebar");
    }
  }, []);

  // Drawer mobile
  const [openDrawer, setOpenDrawer] = React.useState(false);

  // Édition infos
const [editFirst, setEditFirst] = React.useState("");
const [editLast, setEditLast] = React.useState("");
const [editLogin, setEditLogin] = React.useState("");

// Avatar
const [avatarSrc, setAvatarSrc] = React.useState<string>("/avatar-woman.png");
const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
const [savingProfile, setSavingProfile] = React.useState(false);
const fileRef = React.useRef<HTMLInputElement | null>(null);


  // Dropdown avatar (topbar)
  const [openMenu, setOpenMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenu(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(false);
        setOpenDrawer(false);
        setOpenSearch(false);
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // --------- Profil ----------
  const [showProfile, setShowProfile] = React.useState(false);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [savingPwd, setSavingPwd] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState<UserInfo | null>(null);
  const [newPwd, setNewPwd] = React.useState("");
  const [newPwd2, setNewPwd2] = React.useState("");
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(
    null
  );

  const openProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    setLoadingProfile(true);
    setShowProfile(true);
    setOpenMenu(false);

    try {
      const login =
        typeof window !== "undefined" ? localStorage.getItem("userLogin") : null;
      const email = auth.currentUser?.email || "";

      let snap;
      if (login) {
        snap = await getDocs(
          query(collection(db, "users"), where("login", "==", login))
        );
      } else if (email) {
        snap = await getDocs(
          query(collection(db, "users"), where("email", "==", email))
        );
      }

      if (!snap || snap.empty) {
        setProfileError("Utilisateur introuvable.");
      } else {
        const d = snap.docs[0];
        const data = d.data() as any;
        const avatar = data.avatar_url || auth.currentUser?.photoURL || "/avatar-woman.png";
        setUserInfo({
          docId: d.id,
          prenom: data.prenom || "",
          nom: data.nom || "",
          login: data.login || "",
          email: data.email || "",
          password: data.password || "",
          avatar_url: data.avatar_url || "",
        });
        setEditFirst(data.prenom || "");
        setEditLast(data.nom || "");
        setEditLogin(data.login || "");
        setAvatarSrc(avatar);
      }
    } catch (e) {
      console.error(e);
      setProfileError("Erreur lors du chargement du profil.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    if (!userInfo) return;

    if (!newPwd || newPwd.length < 6) {
      setProfileError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPwd !== newPwd2) {
      setProfileError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    try {
      setSavingPwd(true);
      await updateDoc(doc(db, "users", userInfo.docId), { password: newPwd });
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, newPwd);
        } catch (err: any) {
          if (err?.code === "auth/requires-recent-login") {
            setProfileError(
              "Sécurité: reconnectez-vous pour changer le mot de passe."
            );
          } else {
            setProfileError(
              "Erreur côté Auth lors du changement de mot de passe."
            );
          }
          setSavingPwd(false);
          return;
        }
      }
      setProfileSuccess("Mot de passe mis à jour avec succès.");
      setNewPwd("");
      setNewPwd2("");
    } catch (e) {
      console.error(e);
      setProfileError("Erreur lors de l’enregistrement.");
    } finally {
      setSavingPwd(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo) return;
    setProfileError(null);
    setProfileSuccess(null);
    try {
      setSavingProfile(true);
      await updateDoc(doc(db, "users", userInfo.docId), {
        prenom: editFirst.trim(),
        nom: editLast.trim(),
        login: editLogin.trim(),
      });
      setUserInfo({
        ...userInfo,
        prenom: editFirst.trim(),
        nom: editLast.trim(),
        login: editLogin.trim(),
      });
      setProfileSuccess("Profil mis à jour.");
    } catch (err) {
      console.error(err);
      setProfileError("Impossible de mettre à jour le profil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePickAvatar = () => fileRef.current?.click();

  const handleUploadAvatar: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userInfo) return;
    setProfileError(null);
    setProfileSuccess(null);
    setUploadingAvatar(true);
    try {
      // Chemin : avatars/<userId>/<nom-fichier>
      const path = `avatars/${userInfo.docId}/${file.name}`;
      const r = storageRef(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);

      // Enregistre Firestore + Auth photoURL
      await updateDoc(doc(db, "users", userInfo.docId), { avatar_url: url });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: url });
      }

      setAvatarSrc(url);
      setUserInfo({ ...userInfo, avatar_url: url });
      setProfileSuccess("Photo de profil mise à jour.");
    } catch (err) {
      console.error(err);
      setProfileError("Échec de l’upload de la photo.");
    } finally {
      setUploadingAvatar(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleResetAvatar = async () => {
    if (!userInfo) return;
    setProfileError(null);
    setProfileSuccess(null);
    try {
      // Réinitialise le champ dans Firestore + Auth
      await updateDoc(doc(db, "users", userInfo.docId), { avatar_url: "" });

      const def = "/avatar-woman.png";
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: def });
      }

      setAvatarSrc(def);
      setUserInfo({ ...userInfo, avatar_url: "" });
      setProfileSuccess("Avatar réinitialisé.");
    } catch (err) {
      console.error(err);
      setProfileError("Impossible de réinitialiser l’avatar.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("userLogin");
        localStorage.removeItem("userRole");
      }
      router.replace("/admin/auth/login");
    }
  };

  // --------- RECHERCHE GLOBALE ----------
  const [search, setSearch] = React.useState("");
  const [openSearch, setOpenSearch] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [highlight, setHighlight] = React.useState(0);
  const searchRef = React.useRef<HTMLFormElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const debounceRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(e.target as Node)) {
        setOpenSearch(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const runSearch = React.useCallback(
    async (term: string) => {
      const q = term.trim();
      if (!q) {
        setResults([]);
        setOpenSearch(false);
        setSearching(false);
        return;
      }
      setSearching(true);

      try {
        const out: SearchResult[] = [];

        // --- Professeurs ---
        // On récupère quelques profs et on filtre côté client (schémas variés).
        const profSnap = await getDocs(
          query(
            collection(db, "users"),
            where("role_key", "==", "prof"),
            fbLimit(25)
          )
        );
        profSnap.forEach((d) => {
          const v = d.data() as any;
          const full = `${v.nom || ""} ${v.prenom || ""} ${v.specialite || v.specialty || ""}`;
          if (includesLoose(full, q)) {
            out.push({
              kind: "prof",
              id: d.id,
              title: `${v.nom || ""} ${v.prenom || ""}`.trim() || d.id,
              subtitle: v.specialite || v.specialty || "Professeur",
            });
          }
        });

        // --- Étudiants ---
        // On couvre plusieurs clés possibles : etudiant / student / eleve
        const studentKeys = ["etudiant", "student", "eleve"];
        for (const k of studentKeys) {
          const stuSnap = await getDocs(
            query(
              collection(db, "users"),
              where("role_key", "==", k),
              fbLimit(25)
            )
          );
          stuSnap.forEach((d) => {
            const v = d.data() as any;
            const full = `${v.nom || ""} ${v.prenom || ""} ${v.matricule || ""} ${v.email || ""}`;
            if (includesLoose(full, q)) {
              out.push({
                kind: "etudiant",
                id: d.id,
                title: `${v.nom || ""} ${v.prenom || ""}`.trim() || d.id,
                subtitle: v.matricule || v.email || "Etudiant",
              });
            }
          });
        }

        // --- Classes ---
        const clsSnap = await getDocs(query(collection(db, "classes"), fbLimit(25)));
        clsSnap.forEach((d) => {
          const v = d.data() as any;
          const full = `${v.libelle || ""} ${v.filiere_libelle || ""}`;
          if (includesLoose(full, q)) {
            out.push({
              kind: "classe",
              id: d.id,
              title: v.libelle || d.id,
              subtitle: v.filiere_libelle || "Classe",
            });
          }
        });

        // Tri simple: prof/étudiant/classe groupés + ordre alphabétique
        const order = { prof: 0, etudiant: 1, classe: 2 } as const;
        out.sort((a, b) => {
          const ka = order[a.kind];
          const kb = order[b.kind];
          if (ka !== kb) return ka - kb;
          return (a.title || "").localeCompare(b.title || "", "fr", {
            sensitivity: "base",
          });
        });

        setResults(out.slice(0, 20));
        setOpenSearch(true);
        setHighlight(0);
      } catch (e) {
        console.error("search error", e);
        setResults([]);
        setOpenSearch(false);
      } finally {
        setSearching(false);
      }
    },
    [db]
  );

  const onChangeSearch = (val: string) => {
    setSearch(val);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(val), 300);
  };

   const goToResult = (r: SearchResult | undefined) => {
      if (!r) return;
      setOpenSearch(false);
      setSearch("");
      setResults([]);
      setHighlight(0);

      if (r.kind === "prof") {
        onChange("Professeurs");   // ✅ comme si on avait cliqué dans le menu
      } else if (r.kind === "etudiant") {
        onChange("Etudiants");
      } else if (r.kind === "classe") {
        onChange("Filières");      // ou la section qui liste tes classes
      }
      setOpenDrawer(false);        // ferme le drawer mobile si ouvert
    };


  const onKeyDownSearch: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!openSearch || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goToResult(results[highlight]);
    } else if (e.key === "Escape") {
      setOpenSearch(false);
    }
  };

  const TABS: MainItem[] = allowedTabs.length
  ? (MAIN_MENU.filter(t => allowedTabs.includes(t)) as MainItem[])
  : MAIN_MENU;

  React.useEffect(() => {
    if (active && !TABS.includes(active)) {
      onChange("Accueil");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TABS]);

  return (
    <>
      {/* ===== TOPBAR ===== */}
      <header className="topbar">
        <div className="container-fluid h-100 d-flex align-items-center gap-2">
          {/* Burger mobile */}
          <button
            className="btn btn-light d-lg-none me-1"
            onClick={() => setOpenDrawer(true)}
            aria-label="Ouvrir le menu"
          >
            <i className="bi bi-list" />
          </button>

          {/* Recherche */}
          <form
            className="flex-grow-1"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setOpenSearch(false);
              setSearch("");
              setResults([]);
              onChange("Professeurs");   // ✅ montre la vue profs
              setOpenDrawer(false);
            }}
            ref={searchRef}
          >
            <div className="input-group search-pill position-relative">
              <button
                type="button"
                className="input-group-text border-0 bg-transparent ps-3"
                onClick={() => {
                  setOpenSearch(false);
                  setSearch("");
                  setResults([]);
                  onChange("Professeurs"); // ✅ idem
                  setOpenDrawer(false);
                }}
                title="Rechercher"
              >
                <i className="bi bi-search" />
              </button>

                <input
                  ref={inputRef}
                  className="form-control border-0 bg-transparent"
                  placeholder="Rechercher un professeur, une classe…"
                  value={search}
                  onChange={(e) => onChangeSearch(e.target.value)}
                  onFocus={() => search && setOpenSearch(true)}
                  onKeyDown={onKeyDownSearch}
                />

              {/* Dropdown résultats */}
              {openSearch && (
                <div className="search-dropdown shadow">
                  {searching && (
                    <div className="px-3 py-2 text-muted small">
                      <span className="spinner-border spinner-border-sm me-2" />
                      Recherche…
                    </div>
                  )}
                  {!searching && results.length === 0 && (
                    <div className="px-3 py-2 text-muted small">
                      Aucun résultat.
                    </div>
                  )}
                  {!searching &&
                    results.map((r, i) => (
                      <button
                        key={`${r.kind}-${r.id}`}
                        type="button"
                        className={`search-item ${
                          i === highlight ? "active" : ""
                        }`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => goToResult(r)}
                        title={
                          r.kind === "prof"
                            ? "Professeur"
                            : r.kind === "etudiant"
                            ? "Étudiant"
                            : "Classe"
                        }
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span
                            className={`badge ${
                              r.kind === "prof"
                                ? "bg-primary-subtle text-primary-emphasis"
                                : r.kind === "etudiant"
                                ? "bg-success-subtle text-success-emphasis"
                                : "bg-warning-subtle text-warning-emphasis"
                            }`}
                            style={{ minWidth: 86, justifyContent: "center" }}
                          >
                            {r.kind === "prof"
                              ? "Professeur"
                              : r.kind === "etudiant"
                              ? "Étudiant"
                              : "Classe"}
                          </span>
                          <div className="text-start">
                            <div className="fw-semibold">{r.title}</div>
                            {r.subtitle && (
                              <div className="small text-muted">{r.subtitle}</div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </form>

          {/* Bouton notif séparé */}
          <NotificationsBell />

          {/* Avatar + menu */}
          <div className="position-relative" ref={menuRef}>
            <button
              className="btn btn-avatar"
              onClick={() => setOpenMenu((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={openMenu}
            >
              <img
                src={avatarSrc || auth.currentUser?.photoURL || "/avatar-woman.png"}
                alt="Profil"
                width={34}
                height={34}
                className="rounded-circle me-2"
              />

              <span className="d-none d-md-inline">Directeur</span>
              <i className="bi bi-caret-down-fill ms-2" />
            </button>

            {openMenu && (
              <div
                className="dropdown-menu dropdown-menu-end show shadow"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  zIndex: 1050,
                  minWidth: 240,
                }}
                role="menu"
              >
                <button className="dropdown-item" onClick={openProfile}>
                  <i className="bi bi-person-badge me-2" /> Informations
                  personnelles
                </button>
                <button className="dropdown-item" disabled>
                  <i className="bi bi-sliders me-2" /> Préférences
                </button>
                <button className="dropdown-item" disabled>
                  <i className="bi bi-life-preserver me-2" /> Assistance
                </button>
                <div className="dropdown-divider" />
                <button className="dropdown-item text-danger" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2" /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="topbar-spacer" />

      {/* ===== SIDEBAR (primaire) ===== */}
      <aside className={`admin-sidebar ${openDrawer ? "open" : ""}`} aria-label="Sidebar">
        <div className="sidebar-header">
          <img src="/iibs-logo.png" alt="IIBS" className="sidebar-logo" />
        </div>

        <nav className="sidebar-menu" role="menu">
        {/* NEW: map sur TABS au lieu de MAIN_MENU */}
        {TABS.map((item) => (
          <button
            key={item}
            className={`sidebar-item ${active === item ? "active" : ""}`}
            onClick={() => {
              onChange(item);
              setOpenDrawer(false);
            }}
            role="menuitem"
          >
            <i className={`${ICONS[item]} me-2`} />
            <span className="tab-label">{LABELS[item]}</span>
            {active === item && <i className="bi bi-chevron-right ms-auto" />}
          </button>
        ))}
      </nav>

        <div className="sidebar-footer">
          <button className="sidebar-utility w-100" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right me-2" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      <div
        className={`sidebar-overlay ${openDrawer ? "show" : ""}`}
        onClick={() => setOpenDrawer(false)}
        aria-hidden={!openDrawer}
      />

      {/* ===== Modal profil ===== */}
      {showProfile && (
        <>
          <div
            className="modal fade show"
            style={{ display: "block" }}
            aria-modal="true"
            role="dialog"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="bi bi-person-badge me-2" />
                    Informations personnelles
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowProfile(false)}
                    aria-label="Close"
                  />
                </div>
                <div className="modal-body">
                  {loadingProfile && (
                    <div className="text-center py-4">
                      <div className="spinner-border" role="status" />
                      <div className="text-muted mt-2">Chargement…</div>
                    </div>
                  )}

                  {!loadingProfile && userInfo && (
                  <>
                    {/* ---- Avatar ---- */}
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <img
                        src={avatarSrc}
                        alt="Avatar"
                        width={64}
                        height={64}
                        className="rounded-circle border"
                      />
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={handlePickAvatar}
                          disabled={uploadingAvatar}
                        >
                          {uploadingAvatar ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Upload…
                            </>
                          ) : (
                            <>
                              <i className="bi bi-upload me-1" />
                              Changer la photo
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={handleResetAvatar}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1" />
                          Avatar par défaut
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="d-none"
                          onChange={handleUploadAvatar}
                        />
                      </div>
                    </div>

                    {/* ---- Form infos ---- */}
                    <form onSubmit={handleSaveProfile} className="mb-3">
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Prénom</label>
                          <input
                            className="form-control"
                            value={editFirst}
                            onChange={(e) => setEditFirst(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Nom</label>
                          <input
                            className="form-control"
                            value={editLast}
                            onChange={(e) => setEditLast(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Login</label>
                          <input
                            className="form-control"
                            value={editLogin}
                            onChange={(e) => setEditLogin(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Email</label>
                          <input className="form-control" value={userInfo.email} readOnly />
                        </div>
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-3">
                        <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                          {savingProfile ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Enregistrement…
                            </>
                          ) : (
                            "Enregistrer le profil"
                          )}
                        </button>
                      </div>
                    </form>

                    <hr className="my-3" />

                    {/* ---- Form mot de passe (inchangé) ---- */}
                    <form onSubmit={handleSavePassword}>
                      <div className="mb-2">
                        <label className="form-label">Nouveau mot de passe</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPwd}
                          onChange={(e) => setNewPwd(e.target.value)}
                          placeholder="Au moins 6 caractères"
                          minLength={6}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Confirmer le mot de passe</label>
                        <input
                          type="password"
                          className="form-control"
                          value={newPwd2}
                          onChange={(e) => setNewPwd2(e.target.value)}
                          minLength={6}
                          required
                        />
                      </div>

                      {profileError && (
                        <div className="alert alert-danger py-2">{profileError}</div>
                      )}
                      {profileSuccess && (
                        <div className="alert alert-success py-2">{profileSuccess}</div>
                      )}

                      <div className="d-flex justify-content-end gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setShowProfile(false)}
                        >
                          Fermer
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={savingPwd}>
                          {savingPwd ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2" />
                              Enregistrement…
                            </>
                          ) : (
                            "Enregistrer"
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}

                  {!loadingProfile && !userInfo && !profileError && (
                    <div className="text-muted">Aucune donnée à afficher.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setShowProfile(false)} />
        </>
      )}

      {/* ======= Styles ======= */}
      <style jsx>{`
        :global(html, body) {
          background: #eaf2ff;
        }
        :global(body.with-admin-sidebar) {
          padding-left: calc(230px + 24px);
        }
        .topbar {
          position: fixed;
          top: 12px;
          left: calc(230px + 24px + 12px);
          right: 12px;
          height: 64px;
          background: #ffffff;
          border: 1px solid #e6ebf3;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(13, 110, 253, 0.05);
          z-index: 1050;
          margin: 0;
        }
        .topbar-spacer {
          height: 88px;
        }
        @media (max-width: 991.98px) {
          .topbar {
            left: 12px;
            right: 12px;
            top: 8px;
            border-radius: 12px;
          }
          .topbar-spacer {
            height: 80px;
          }
        }
        .search-pill {
          background: #f7f9fc;
          border: 1px solid #e6ebf3;
          border-radius: 9999px;
          overflow: visible;
        }
        .search-pill .form-control {
          box-shadow: none;
          padding-top: 0.6rem;
          padding-bottom: 0.6rem;
        }
        .search-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #e6ebf3;
          border-radius: 12px;
          max-height: 380px;
          overflow: auto;
          z-index: 2000;
        }
        .search-item {
          display: block;
          width: 100%;
          padding: 10px 12px;
          text-align: left;
          background: transparent;
          border: 0;
          border-bottom: 1px solid #f2f4f8;
        }
        .search-item:last-child {
          border-bottom: 0;
        }
        .search-item:hover,
        .search-item.active {
          background: #f6f9ff;
        }
        .btn-icon {
          background: #fff;
          border: 1px solid #e6ebf3;
          border-radius: 12px;
          padding: 0.5rem 0.65rem;
        }
        .btn-icon:hover {
          background: #f3f6fb;
        }
        .btn-avatar {
          background: #fff;
          border: 1px solid #e6ebf3;
          border-radius: 12px;
          padding: 0.35rem 0.6rem;
        }
        .btn-avatar:hover {
          background: #f3f6fb;
        }
        .admin-sidebar {
          position: fixed;
          top: 12px;
          left: 12px;
          bottom: 12px;
          width: 230px;
          background: linear-gradient(180deg, #3274E0 0%, #0b5ed7 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          z-index: 1045;
          border: 0;
          border-radius: 18px;
          overflow: hidden;
          transition: transform 0.25s ease;
          box-shadow: 0 10px 24px rgba(13, 110, 253, 0.12);
        }
        .sidebar-header {
          padding: 1rem 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 104px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }
        .sidebar-logo {
          height: 92px;
          width: auto;
          object-fit: contain;
        }
        .sidebar-menu {
          padding: .5rem .5rem;
          display: flex;
          flex-direction: column;
          gap: .28rem;
          overflow: auto;
        }
        .sidebar-item {
          appearance: none;
          border: 1px solid transparent;
          background: rgba(255, 255, 255, 0.06);
          color: #e7eeff;
          text-align: left;
          padding: .42rem .64rem;;
          border-radius: 11px;
          font-weight: 500;
          font-size: .90rem;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          line-height: 1.15;
        }
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }
        .tab-label { white-space: pre-line; display: inline-block; word-break: break-word; }
        :global(.btn-outline-primary.btn-sm), :global(.btn-outline-secondary.btn-sm) {
          border-radius: 10px;
        }
        .sidebar-item.active {
          background: #ffffff;
          color: #029DFE;
          border-color: #e8f0ff;
        }
        .sidebar-footer {
          margin-top: auto;
          padding: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.15);
          display: grid;
          gap: 0.5rem;
          background: transparent;
        }
        .sidebar-utility {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
          text-align: left;
        }
        .sidebar-utility:hover {
          background: rgba(255, 255, 255, 0.18);
        }
        :global(main.app-main) {
          background: #ffffff;
          border: 1px solid #e6ebf3;
          border-radius: 16px;
          margin: 12px;
          padding: 16px;
          box-shadow: 0 6px 20px rgba(13, 110, 253, 0.06);
        }
        @media (max-width: 991.98px) {
          :global(body.with-admin-sidebar) {
            padding-left: 0;
          }
          .admin-sidebar {
            transform: translateX(-100%);
            left: 0;
            right: auto;
            width: 82vw;
            max-width: 320px;
            border-radius: 0;
            top: 0;
            bottom: 0;
            margin: 0;
          }
          .admin-sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.35);
            z-index: 1040;
          }
          .sidebar-overlay.show {
            display: block;
          }
          .topbar {
            margin: 0;
            border-radius: 0;
          }
          :global(main.app-main) {
            margin: 8px;
            border-radius: 12px;
          }
        }
      `}</style>
    </>
  );
}
