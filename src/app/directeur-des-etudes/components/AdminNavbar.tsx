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

  // ---------- Dropdown avatar (100% React) ----------
  const [openMenu, setOpenMenu] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenu(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(false);
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  // ---------- Modal "Informations personnelles" ----------
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
      <nav className="navbar navbar-expand-lg bg-white border-bottom sticky-top" style={{ height: 64 }}>
        <div className="container-fluid">
          {/* Logo */}
          <a className="navbar-brand d-flex align-items-center" href="#">
            <img src="/iibs-logo-without-bg.png" alt="IIBS" width={100} height={100}
              className="me-2" style={{ height: 80, width: "auto", objectFit: "contain" }} />
          </a>

          {/* Burger */}
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbarContent">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse" id="adminNavbarContent">
            {/* Menu principal */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0 nav-main">
              {MAIN_MENU.map((item) => (
                <li className="nav-item" key={item}>
                  <button
                    className={`btn nav-link px-3 ${active === item ? "active" : ""}`}
                    onClick={() => onChange(item)}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>

            {/* Recherche */}
            <form className="d-flex me-3" role="search" onSubmit={(e) => e.preventDefault()}>
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search"></i>
                </span>
                <input className="form-control" type="search" placeholder="Rechercher…" aria-label="Search" />
              </div>
            </form>

            {/* Notifications */}
            <button className="btn btn-outline-secondary me-3" title="Notifications">
              <i className="bi bi-bell"></i>
            </button>

            {/* Avatar dropdown (React) */}
            <div className="position-relative" ref={menuRef}>
              <button
                className="btn btn-light d-flex align-items-center"
                onClick={() => setOpenMenu((s) => !s)}
                aria-haspopup="menu"
                aria-expanded={openMenu}
              >
                <img src="/avatar-placeholder.png" alt="Profil" width={32} height={32} className="rounded-circle me-2" />
                <span className="d-none d-sm-inline">Directeur</span>
                <i className="bi bi-caret-down-fill ms-2"></i>
              </button>

              {openMenu && (
                <div
                  className="dropdown-menu dropdown-menu-end show shadow"
                  style={{ position: "absolute", right: 0, top: "100%", zIndex: 1050 }}
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
        </div>

        <style jsx>{`
          .nav-main .nav-link { border-radius: 10px; padding: .5rem 1rem; color: #495057; transition: all .2s ease; }
          .nav-main .nav-link:hover { background: #f1f3f5; }
          .nav-main .nav-link.active { background: #0d6efd10; color: #0d6efd; font-weight: 600; position: relative; }
          .nav-main .nav-link.active::after {
            content: ""; position: absolute; left: 10%; right: 10%; bottom: -14px; height: 3px;
            border-radius: 3px; background: #0d6efd;
          }
        `}</style>
      </nav>

      {/* Modal profil contrôlé en React (pas de JS Bootstrap requis) */}
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
    </>
  );
}
