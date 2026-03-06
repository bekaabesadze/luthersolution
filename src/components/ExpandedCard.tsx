/**
 * ExpandedCard.tsx
 * Reusable wrapper component for expanded views with consistent styling and behavior.
 */

import { ReactNode } from "react";
import styles from "./ExpandedViews.module.css";

export interface ExpandedCardProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tabs?: { id: string; label: string }[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function ExpandedCard({
  title,
  onClose,
  children,
  tabs,
  activeTab,
  onTabChange,
}: ExpandedCardProps) {
  return (
    <>
      <div className={styles.expandedBackdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.expandedCard}>
        <div className={styles.expandedCardHeader}>
          <h2 className={styles.expandedCardTitle}>{title}</h2>
          <button
            type="button"
            className={styles.expandedCardCloseBtn}
            onClick={onClose}
            aria-label="Close expanded view"
            title="Close"
          >
            <span>×</span>
          </button>
        </div>
        {tabs && tabs.length > 0 && (
          <div className={styles.expandedCardTabs}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${styles.expandedCardTab} ${
                  activeTab === tab.id ? styles.expandedCardTabActive : ""
                }`}
                onClick={() => onTabChange?.(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div className={styles.expandedCardBody}>{children}</div>
      </div>
    </>
  );
}
