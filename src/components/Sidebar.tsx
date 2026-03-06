/**
 * Sidebar.tsx
 * Left navigation menu with links to Upload Data, Dashboard, and Reports.
 * Highlights the active route for clear orientation.
 */

import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { logout } from "../api/client";
import styles from "./Sidebar.module.css";

const navItems = [
  { to: "/upload", label: "Upload Data" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/camel", label: "CAMEL" },
  { to: "/files", label: "Files" },
  { to: "/reports", label: "Reports" },
];

export type SidebarPosition = 'left' | 'right' | 'top';

interface SidebarProps {
  position: SidebarPosition;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function Sidebar({ position, onDragStart, onDragEnd }: SidebarProps) {
  const isTop = position === 'top';
  const [dragEnabled, setDragEnabled] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const checkAuth = () => {
    const token = localStorage.getItem("admin_token");
    return !!token && token !== "null" && token !== "undefined";
  };

  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth);

  // Force a re-render when location changes or custom auth event fires
  useEffect(() => {
    const updateAuth = () => setIsAuthenticated(checkAuth());
    updateAuth(); // Ensure we're up to date

    window.addEventListener("auth-change", updateAuth);
    // Handle cross-tab login/logout
    window.addEventListener("storage", updateAuth);

    return () => {
      window.removeEventListener("auth-change", updateAuth);
      window.removeEventListener("storage", updateAuth);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const syncDragState = () => setDragEnabled(!mediaQuery.matches);
    syncDragState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncDragState);
      return () => mediaQuery.removeEventListener("change", syncDragState);
    }

    mediaQuery.addListener(syncDragState);
    return () => mediaQuery.removeListener(syncDragState);
  }, []);

  const handleDragStartInternal = (e: React.DragEvent<HTMLDivElement>) => {
    // Create a collapsed icon style for the drag image instead of the full ghost
    const dragIcon = document.createElement("div");
    dragIcon.style.width = "48px";
    dragIcon.style.height = "48px";
    dragIcon.style.backgroundColor = "#22262e"; // var(--color-surface)
    dragIcon.style.border = "1px solid #363b45"; // var(--color-border)
    dragIcon.style.borderRadius = "24px";
    dragIcon.style.boxShadow = "0 12px 40px -8px rgba(0, 0, 0, 0.4)"; // var(--shadow-lg)
    dragIcon.style.display = "flex";
    dragIcon.style.alignItems = "center";
    dragIcon.style.justifyContent = "center";
    dragIcon.style.position = "absolute";
    dragIcon.style.top = "-1000px";
    dragIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b0b3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="19 9 22 12 19 15"></polyline><polyline points="9 19 12 22 15 19"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>`;

    document.body.appendChild(dragIcon);
    // Center the drag icon on cursor
    e.dataTransfer.setDragImage(dragIcon, 24, 24);

    if (onDragStart) {
      onDragStart(e);
    }

    // Cleanup node immediately after drag image is set
    setTimeout(() => {
      if (document.body.contains(dragIcon)) {
        document.body.removeChild(dragIcon);
      }
    }, 0);
  };

  return (
    <div
      className={`${styles.sidebarWrapper} ${styles[position]}`}
      draggable={dragEnabled}
      onDragStart={dragEnabled ? handleDragStartInternal : undefined}
      onDragEnd={onDragEnd}
    >
      <nav className={`${styles.sidebar} ${isTop ? styles.sidebarTop : ''}`} aria-label="Main navigation">
        <div className={styles.dragHandle} title="Drag to move sidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 9 2 12 5 15"></polyline>
            <polyline points="9 5 12 2 15 5"></polyline>
            <polyline points="19 9 22 12 19 15"></polyline>
            <polyline points="9 19 12 22 15 19"></polyline>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="12" y1="2" x2="12" y2="22"></line>
          </svg>
        </div>
        <ul className={`${styles.navList} ${isTop ? styles.navListTop : ''}`}>
          {navItems.map(({ to, label }) => {
            // Hide admin routes from non-admins
            if (!isAuthenticated && (to === "/upload" || to === "/files")) {
              return null;
            }
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                  }
                  end={to === "/" ? true : undefined}
                >
                  {label}
                </NavLink>
              </li>
            );
          })}

          <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
            {isAuthenticated ? (
              <li>
                <button
                  type="button"
                  className={styles.navLink}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-danger)" }}
                  onClick={() => {
                    logout();
                    navigate("/dashboard");
                  }}
                >
                  Logout
                </button>
              </li>
            ) : (
              <li>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                  }
                >
                  Admin Login
                </NavLink>
              </li>
            )}
          </div>
        </ul>
      </nav>
    </div>
  );
}
