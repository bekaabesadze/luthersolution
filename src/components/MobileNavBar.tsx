import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { logout } from "../api/client";
import styles from "./MobileNavBar.module.css";

const primaryNavItems = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/camels", label: "CAMELS", icon: "camel" },
  { to: "/reports", label: "Reports", icon: "reports" },
];

const adminNavItems = [
  { to: "/outlook", label: "Outlook", icon: "outlook" },
  { to: "/upload", label: "Upload", icon: "upload" },
  { to: "/files", label: "Files", icon: "files" },
];

function useIsAuthenticated() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = localStorage.getItem("admin_token");
    return !!token && token !== "null" && token !== "undefined";
  });

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("admin_token");
      setIsAuthenticated(!!token && token !== "null" && token !== "undefined");
    };

    checkAuth();
    window.addEventListener("auth-change", checkAuth);
    window.addEventListener("storage", checkAuth);

    return () => {
      window.removeEventListener("auth-change", checkAuth);
      window.removeEventListener("storage", checkAuth);
    };
  }, [location.pathname]);

  return isAuthenticated;
}

function Icon({ name }: { name: string }) {
  switch (name) {
    case "dashboard":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="5" rx="2" />
            <rect x="14" y="11" width="7" height="10" rx="2" />
            <rect x="3" y="13" width="7" height="8" rx="2" />
          </svg>
        </span>
      );
    case "camel":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 18c3-6 5-9 9-9s6 3 9 9" />
            <circle cx="9" cy="10" r="1" />
            <circle cx="15" cy="10" r="1" />
          </svg>
        </span>
      );
    case "reports":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h10l6 6v10H4z" />
            <path d="M14 4v6h6" />
            <path d="M8 16h8M8 12h2" />
          </svg>
        </span>
      );
    case "outlook":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 13a8 8 0 1 1 16 0" />
            <path d="M12 13l5-5" />
            <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </span>
      );
    case "upload":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v13" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 19h14" />
          </svg>
        </span>
      );
    case "files":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h11l5 5v11H4z" />
            <path d="M15 4v5h5" />
          </svg>
        </span>
      );
    case "login":
      return (
        <span className={styles.icon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
          </svg>
        </span>
      );
    default:
      return null;
  }
}

export function MobileNavBar() {
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  const itemsToRender = isAuthenticated
    ? [...primaryNavItems, ...adminNavItems]
    : [...primaryNavItems];

  return (
    <nav className={styles.mobileNav} aria-label="Primary navigation">
      <ul className={styles.navList}>
        {itemsToRender.map(({ to, label, icon }) => (
          <li key={to} className={styles.navItem}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              <Icon name={icon} />
              <span className={styles.label}>{label}</span>
            </NavLink>
          </li>
        ))}

        <li className={styles.navItem}>
          {isAuthenticated ? (
            <button
              type="button"
              className={styles.navLink}
              onClick={() => {
                logout();
                navigate("/dashboard");
              }}
            >
              <Icon name="login" />
              <span className={styles.label}>Logout</span>
            </button>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              <Icon name="login" />
              <span className={styles.label}>Admin</span>
            </NavLink>
          )}
        </li>
      </ul>
    </nav>
  );
}
