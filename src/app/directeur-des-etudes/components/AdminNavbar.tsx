// src/app/directeur-des-etudes/components/AdminNavbar.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../../firebaseConfig";
import { signOut, updatePassword } from "firebase/auth";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";

type MainItem =
  | "Accueil"
  | "Emargements"
  | "Etudiants"
  | "Professeurs"
  | "Filières"
  | "Evaluations";

const MAIN_MENU: MainItem[] = ["Accueil","Emargements","Etudiants","Professeurs","Filières","Evaluations"];

const ICONS: Record<MainItem, string> = {
  Accueil: "bi-house-door",
  Emargements: "bi-clipboard-check",
  Etudiants: "bi-people",
  Professeurs: "bi-person-badge",
  Filières: "bi-layers",
  Evaluations: "bi-bar-chart",
};

type UserInfo = {
  docId: string;
  prenom: string;
  nom: string;
  login: string;
  email: string;
  password?: string;
};

export default function AdminNavbar({
  active,
  onChange,
}: {
  active: MainItem | null;
  onChange: (item: MainItem) => void;
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

  // Dropdown avatar (topbar)
  const [openMenu, setOpenMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenu(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpenMenu(false); setOpenDrawer(false); }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // Profil
  const [showProfile, setShowProfile] = React.useState(false);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [savingPwd, setSavingPwd] = React.useState(false);
  const [userInfo, setUserInfo] = React.useState<UserInfo | null>(null);
  const [newPwd, setNewPwd] = React.useState("");
  const [newPwd2, setNewPwd2] = React.useState("");
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = React.useState<string | null>(null);

  const openProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);
    setLoadingProfile(true);
    setShowProfile(true);
    setOpenMenu(false);

    try {
      const login = typeof window !== "undefined" ? localStorage.getItem("userLogin") : null;
      const email = auth.currentUser?.email || "";

      let snap;
      if (login) {
        snap = await getDocs(query(collection(db, "users"), where("login", "==", login)));
      } else if (email) {
        snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
      }

      if (!snap || snap.empty) {
        setProfileError("Utilisateur introuvable.");
      } else {
        const d = snap.docs[0];
        const data = d.data() as any;
        setUserInfo({
          docId: d.id,
          prenom: data.prenom || "",
          nom: data.nom || "",
          login: data.login || "",
          email: data.email || "",
          password: data.password || "",
        });
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
            setProfileError("Sécurité: reconnectez-vous pour changer le mot de passe.");
          } else {
            setProfileError("Erreur côté Auth lors du changement de mot de passe.");
          }
          setSavingPwd(false);
          return;
        }
      }
      setProfileSuccess("Mot de passe mis à jour avec succès.");
      setNewPwd(""); setNewPwd2("");
    } catch (e) {
      console.error(e);
      setProfileError("Erreur lors de l’enregistrement.");
    } finally {
      setSavingPwd(false);
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("userLogin");
        localStorage.removeItem("userRole");
      }
      router.replace("/admin/auth/login");
    }
  };

  return (
    <>
      {/* ===== TOPBAR ===== */}
      <header className="topbar">
        <div className="container-fluid h-100 d-flex align-items-center gap-2">
          {/* Burger mobile */}
          <button className="btn btn-light d-lg-none me-1" onClick={() => setOpenDrawer(true)} aria-label="Ouvrir le menu">
            <i className="bi bi-list" />
          </button>

          {/* Recherche (séparée) */}
          <form className="flex-grow-1" role="search" onSubmit={(e) => e.preventDefault()}>
            <div className="input-group search-pill">
              <span className="input-group-text border-0 bg-transparent ps-3"><i className="bi bi-search" /></span>
              <input className="form-control border-0 bg-transparent" placeholder="Rechercher…" />
            </div>
          </form>

          {/* Bouton notif séparé */}
          <button className="btn btn-icon" title="Notifications">
            <i className="bi bi-bell" />
          </button>

          {/* Avatar + menu */}
          <div className="position-relative" ref={menuRef}>
            <button
              className="btn btn-avatar"
              onClick={() => setOpenMenu((s) => !s)}
              aria-haspopup="menu"
              aria-expanded={openMenu}
            >
              <img src="/avatar-woman.png" alt="Profil" width={34} height={34} className="rounded-circle me-2" />
              <span className="d-none d-md-inline">Directeur</span>
              <i className="bi bi-caret-down-fill ms-2" />
            </button>

            {openMenu && (
              <div
                className="dropdown-menu dropdown-menu-end show shadow"
                style={{ position: "absolute", right: 0, top: "100%", zIndex: 1050, minWidth: 240 }}
                role="menu"
              >
                <button className="dropdown-item" onClick={openProfile}>
                  <i className="bi bi-person-badge me-2" /> Informations personnelles
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
          {MAIN_MENU.map((item) => (
            <button
              key={item}
              className={`sidebar-item ${active === item ? "active" : ""}`}
              onClick={() => { onChange(item); setOpenDrawer(false); }}
              role="menuitem"
            >
              <i className={`${ICONS[item]} me-2`} />
              <span>{item}</span>
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
          <div className="modal fade show" style={{ display: "block" }} aria-modal="true" role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title"><i className="bi bi-person-badge me-2" />Informations personnelles</h5>
                  <button type="button" className="btn-close" onClick={() => setShowProfile(false)} aria-label="Close" />
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
                      <div className="row g-3 mb-2">
                        <div className="col-md-6">
                          <label className="form-label">Prénom</label>
                          <input className="form-control" value={userInfo.prenom} readOnly />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Nom</label>
                          <input className="form-control" value={userInfo.nom} readOnly />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Login</label>
                          <input className="form-control" value={userInfo.login} readOnly />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Email</label>
                          <input className="form-control" value={userInfo.email} readOnly />
                        </div>
                      </div>

                      <hr className="my-3" />

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

                        {profileError && <div className="alert alert-danger py-2">{profileError}</div>}
                        {profileSuccess && <div className="alert alert-success py-2">{profileSuccess}</div>}

                        <div className="d-flex justify-content-end gap-2">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => setShowProfile(false)}>
                            Fermer
                          </button>
                          <button type="submit" className="btn btn-primary" disabled={savingPwd}>
                            {savingPwd ? (<><span className="spinner-border spinner-border-sm me-2" />Enregistrement…</>) : "Enregistrer"}
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
        /* Fond d'application assorti au thème (très clair) + coins arrondis visibles */
        :global(html, body) {
          background: #eaf2ff;  /* dérivé de #0D6EFD très clair */
        }

        /* Espace réservé pour la sidebar en desktop (230px + 24px de marge latérale) */
        :global(body.with-admin-sidebar) {
          padding-left: calc(230px + 24px);
        }

        /* TOPBAR arrondie */
        /* TOPBAR — FIXE */
        .topbar {
          position: fixed;
          top: 12px;
          /* = sidebar 230 + marge latérale 24 + marge visuelle 12 */
          left: calc(230px + 24px + 12px);
          right: 12px;
          height: 64px;
          background: #ffffff;
          border: 1px solid #e6ebf3;
          border-radius: 16px;
          box-shadow: 0 2px 8px rgba(13,110,253,0.05);
          z-index: 1050; /* au-dessus du contenu */
          margin: 0;     /* les margins n'agissent pas sur fixed */
        }

        /* Cale pour laisser la place à la topbar (64 + 24 de respiration) */
        .topbar-spacer { height: 88px; }

        /* Mobile / tablette : la sidebar se replie, la topbar prend tout */
        @media (max-width: 991.98px) {
          .topbar {
            left: 12px;
            right: 12px;
            top: 8px;
            border-radius: 12px;
          }
          .topbar-spacer { height: 80px; }
        }

        .search-pill {
          background: #f7f9fc;
          border: 1px solid #e6ebf3;
          border-radius: 9999px;
          overflow: hidden;
        }
        .search-pill .form-control { box-shadow: none; padding-top: .6rem; padding-bottom: .6rem; }
        .btn-icon {
          background: #fff; border: 1px solid #e6ebf3; border-radius: 12px; padding: .5rem .65rem;
        }
        .btn-icon:hover { background: #f3f6fb; }
        .btn-avatar { background: #fff; border: 1px solid #e6ebf3; border-radius: 12px; padding: .35rem .6rem; }
        .btn-avatar:hover { background: #f3f6fb; }

        /* SIDEBAR avec coins arrondis et même fond autour */
        .admin-sidebar {
          position: fixed;
          top: 12px; left: 12px; bottom: 12px;   /* marges pour afficher l'arrondi */
          width: 230px;
          background: linear-gradient(180deg, #0D6EFD 0%, #0b5ed7 100%);
          color: #fff;
          display: flex;
          flex-direction: column;
          z-index: 1045;
          border: 0;
          border-radius: 18px;
          overflow: hidden;                       /* pour que l'arrondi s'applique à l'intérieur */
          transition: transform .25s ease;
          box-shadow: 0 10px 24px rgba(13,110,253,.12); /* doux, pas “moche” */
        }

        .sidebar-header {
          padding: 1rem .9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 104px;
          border-bottom: 1px solid rgba(255,255,255,.12);
        }
        .sidebar-logo {
          height: 92px;   /* logo bien visible */
          width: auto;
          object-fit: contain;
        }

        .sidebar-menu {
          padding: .6rem;
          display: flex;
          flex-direction: column;
          gap: .35rem;
          overflow: auto;
        }

        .sidebar-item {
          appearance: none;
          border: 1px solid transparent;
          background: rgba(255,255,255,.06);
          color: #e7eeff;
          text-align: left;
          padding: .48rem .72rem;         /* plus compact */
          border-radius: 12px;
          font-weight: 500;
          font-size: .93rem;               /* texte un peu plus petit */
          cursor: pointer;
          transition: background .2s ease, color .2s ease, border-color .2s ease;
          display: flex; align-items: center; gap: .5rem;
        }
        .sidebar-item:hover { background: rgba(255,255,255,.12); color: #ffffff; }
        .sidebar-item.active {
          background: #ffffff;
          color: #0D6EFD;
          border-color: #e8f0ff;
        }

        .sidebar-footer {
          margin-top: auto;
          padding: .75rem;
          border-top: 1px solid rgba(255,255,255,.15);
          display: grid; gap: .5rem;
          background: transparent;
        }
        .sidebar-utility {
          background: rgba(255,255,255,.1);
          color: #fff;
          border: 1px solid rgba(255,255,255,.15);
          padding: .5rem .75rem;
          border-radius: 12px;
          text-align: left;
        }
        .sidebar-utility:hover { background: rgba(255,255,255,.18); }

        /* Arrondis et fond pour le contenu principal — ajoute className="app-main" à ton <main> */
        :global(main.app-main) {
          background: #ffffff;
          border: 1px solid #e6ebf3;
          border-radius: 16px;
          margin: 12px;                   /* même marge que topbar et sidebar */
          padding: 16px;
          box-shadow: 0 6px 20px rgba(13,110,253,0.06);
        }



        /* Drawer mobile */
        @media (max-width: 991.98px) {
          :global(body.with-admin-sidebar) { padding-left: 0; }
          .admin-sidebar { transform: translateX(-100%); left: 0; right: auto; width: 82vw; max-width: 320px; border-radius: 0; top: 0; bottom: 0; margin: 0; }
          .admin-sidebar.open { transform: translateX(0); }
          .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1040; }
          .sidebar-overlay.show { display: block; }
          .topbar { margin: 0; border-radius: 0; }
          :global(main.app-main) { margin: 8px; border-radius: 12px; }
        }
      `}</style>
    </>
  );
}
