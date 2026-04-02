/**
 * Layout.tsx
 * Main app shell: top header bar and sidebar navigation wrapping page content.
 * Provides a consistent, professional layout across all dashboard pages.
 */

import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Sidebar, SidebarPosition } from "./Sidebar";
import { ThemeSwitcher, type Theme } from "./ThemeSwitcher";
import { logout } from "../api/client";
import styles from "./Layout.module.css";

import logoPng from "../../CBA_logo.png";

const DoorIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {/* Door frame */}
    <rect x="3" y="2" width="13" height="20" rx="1" />
    {/* Door knob */}
    <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
    {/* Arrow exiting right */}
    <line x1="17" y1="12" x2="21" y2="12" />
    <polyline points="19 10 21 12 19 14" />
  </svg>
);

export function Layout() {
  const navigate = useNavigate();

  const checkAuth = () => {
    const token = localStorage.getItem("admin_token");
    return !!token && token !== "null" && token !== "undefined";
  };

  const [isAuthenticated, setIsAuthenticated] = useState(checkAuth);

  useEffect(() => {
    const update = () => setIsAuthenticated(checkAuth());
    window.addEventListener("auth-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("auth-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => {
    const saved = localStorage.getItem("sidebarPosition") as SidebarPosition;
    return (saved === 'left' || saved === 'right' || saved === 'top') ? saved : 'left';
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme") as Theme;
    return (saved === "light" || saved === "slate" || saved === "dark") ? saved : "slate";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [dragOverZone, setDragOverZone] = useState<SidebarPosition | null>(null);

  useEffect(() => {
    localStorage.setItem("sidebarPosition", sidebarPosition);
  }, [sidebarPosition]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", "sidebar");
  };

  const handleDragOver = (e: React.DragEvent, zone: SidebarPosition) => {
    e.preventDefault();
    setDragOverZone(zone);
  };

  const handleDragLeave = () => {
    setDragOverZone(null);
  };

  const handleDrop = (e: React.DragEvent, zone: SidebarPosition) => {
    e.preventDefault();
    setDragOverZone(null);
    setSidebarPosition(zone);
  };

  return (
    <div className={styles.app}>
      <header
        className={`${styles.header} ${sidebarPosition === 'top' ? styles.headerWithNav : ''} ${dragOverZone === 'top' ? styles.dragOverActive : ''}`}
        role="banner"
        onDragOver={(e) => handleDragOver(e, 'top')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 'top')}
      >
        <div className={styles.headerIsland}>
          <h1 className={styles.logo}>
            <img
              className={styles.logoImg}
              src={logoPng}
              alt="Competitor Bank Analytics logo"
            />
            <span className={styles.logoText}>Competitor Bank Analytics</span>
          </h1>
          {sidebarPosition === 'top' ? (
            <>
              <div className={styles.headerNav}>
                <Sidebar position="top" onDragStart={handleDragStart} />
              </div>
              <div className={styles.headerRight}>
                <ThemeSwitcher theme={theme} onChange={setTheme} />
                {isAuthenticated && (
                  <button
                    type="button"
                    className={`${styles.logoutBtn} ${styles.logoutBtnInline}`}
                    onClick={() => { logout(); navigate("/dashboard"); }}
                    aria-label="Logout"
                    title="Logout"
                  >
                    <DoorIcon />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className={styles.headerRight}>
              <ThemeSwitcher theme={theme} onChange={setTheme} />
            </div>
          )}
        </div>
      </header>

      {isAuthenticated && sidebarPosition !== 'top' && (
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={() => { logout(); navigate("/dashboard"); }}
          aria-label="Logout"
          title="Logout"
        >
          <DoorIcon />
        </button>
      )}

      <div className={styles.body}>

        {/* Left Drop Target overlays */}
        {sidebarPosition !== 'left' && (
          <div
            className={`${styles.dropOverlay} ${dragOverZone === 'left' ? styles.dragOverActiveOverlay : ''}`}
            onDragOver={(e) => handleDragOver(e, 'left')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'left')}
          >
            {dragOverZone === 'left' && <div className={styles.dropIndicator}>Move to Left</div>}
          </div>
        )}

        {sidebarPosition === 'left' && (
          <div className={styles.sideZone}>
            <Sidebar position="left" onDragStart={handleDragStart} />
          </div>
        )}

        <main className={styles.main} role="main">
          <Outlet />
          <footer className={styles.footer} role="contentinfo">
            <span className={styles.footerCredit}>
              Created by <Link to="/about" className={styles.footerLink}>Beka Abesadze</Link>
            </span>
            <span className={styles.footerSep}>·</span>
            <Link to="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <span className={styles.footerSep}>·</span>
            <Link to="/terms" className={styles.footerLink}>Terms of Service</Link>
          </footer>
        </main>

        {sidebarPosition === 'right' && (
          <div className={styles.sideZone}>
            <Sidebar position="right" onDragStart={handleDragStart} />
          </div>
        )}

        {/* Right Drop Target overlays */}
        {sidebarPosition !== 'right' && (
          <div
            className={`${styles.dropOverlay} ${dragOverZone === 'right' ? styles.dragOverActiveOverlay : ''}`}
            onDragOver={(e) => handleDragOver(e, 'right')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'right')}
          >
            {dragOverZone === 'right' && <div className={styles.dropIndicator}>Move to Right</div>}
          </div>
        )}

      </div>
    </div>
  );
}
