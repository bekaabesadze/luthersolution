import styles from "./ThemeSwitcher.module.css";

export type Theme = "light" | "slate" | "dark";

interface Props {
  theme: Theme;
  onChange: (t: Theme) => void;
}

const SunIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2"  x2="12" y2="5"  />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2"  y1="12" x2="5"  y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93"   x2="6.34" y2="6.34"   />
    <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
    <line x1="4.93"  y1="19.07" x2="6.34"  y2="17.66" />
    <line x1="17.66" y1="6.34"  x2="19.07" y2="4.93"  />
  </svg>
);

const SlateIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z" />
    <path d="M12 3v18" />
    <path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" fillOpacity="0.3" stroke="none" />
  </svg>
);

const MoonIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const OPTIONS: { key: Theme; label: string; icon: React.ReactNode }[] = [
  { key: "light", label: "Light", icon: <SunIcon /> },
  { key: "slate", label: "Slate", icon: <SlateIcon /> },
  { key: "dark",  label: "Dark",  icon: <MoonIcon /> },
];

export function ThemeSwitcher({ theme, onChange }: Props) {
  const activeIndex = OPTIONS.findIndex((o) => o.key === theme);

  return (
    <div className={styles.switcher} role="radiogroup" aria-label="Theme">
      {/* Sliding pill indicator */}
      <div
        className={styles.indicator}
        style={{ transform: `translateX(calc(${activeIndex} * 100%))` }}
        aria-hidden="true"
      />
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={opt.key === theme}
          className={`${styles.option} ${opt.key === theme ? styles.optionActive : ""}`}
          onClick={() => onChange(opt.key)}
          title={opt.label}
        >
          <span className={styles.icon}>{opt.icon}</span>
          <span className={styles.label}>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
