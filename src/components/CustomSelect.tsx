/**
 * CustomSelect.tsx
 * Custom-styled dropdown: trigger button + animated options panel.
 * Keeps form semantics via a hidden input for value/required.
 */

import { useState, useRef, useEffect } from "react";
import styles from "./CustomSelect.module.css";

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder: string;
  id?: string;
  ariaDescribedBy?: string;
  name?: string;
  required?: boolean;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  id,
  ariaDescribedBy,
  name,
  required,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const close = () => {
    setOpen(false);
    setHighlightIndex(-1);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || highlightIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlightIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        const idx = value ? options.findIndex((o) => o.value === value) : -1;
        setHighlightIndex(idx >= 0 ? idx : 0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < options.length - 1 ? i + 1 : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : options.length - 1));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (highlightIndex >= 0 && options[highlightIndex]) {
        onChange(options[highlightIndex].value);
        close();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.wrap} ${open ? styles.wrapOpen : ""}`}
      onKeyDown={handleKeyDown}
    >
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
        required={required}
        aria-hidden
        tabIndex={-1}
      />
      <button
        type="button"
        id={id}
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-describedby={ariaDescribedBy}
        aria-label={placeholder}
      >
        <span className={selectedOption ? styles.triggerValue : styles.triggerPlaceholder}>
          {displayLabel}
        </span>
        <span className={styles.chevron} aria-hidden />
      </button>
      <ul
        ref={listRef}
        role="listbox"
        className={styles.list}
        aria-hidden={!open}
        style={{ visibility: open ? "visible" : "hidden" }}
      >
        {options.map((opt, idx) => (
          <li
            key={opt.value}
            role="option"
            data-index={idx}
            className={`${styles.option} ${opt.value === value ? styles.optionSelected : ""} ${idx === highlightIndex ? styles.optionHighlight : ""}`}
            aria-selected={opt.value === value}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(opt.value);
              close();
            }}
            onMouseEnter={() => setHighlightIndex(idx)}
          >
            {opt.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
