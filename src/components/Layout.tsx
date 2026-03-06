/**
 * Layout.tsx
 * Main app shell: top header bar and sidebar navigation wrapping page content.
 * Provides a consistent, professional layout across all dashboard pages.
 */

import { useState, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { Sidebar, SidebarPosition } from "./Sidebar";
import styles from "./Layout.module.css";

export function Layout() {
  const [sidebarPosition, setSidebarPosition] = useState<SidebarPosition>(() => {
    const saved = localStorage.getItem("sidebarPosition") as SidebarPosition;
    return (saved === 'left' || saved === 'right' || saved === 'top') ? saved : 'left';
  });

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
          <h1 className={styles.logo}>Competitor Bank Analytics</h1>
          {sidebarPosition === 'top' && (
            <Sidebar position="top" onDragStart={handleDragStart} />
          )}
        </div>
      </header>

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
