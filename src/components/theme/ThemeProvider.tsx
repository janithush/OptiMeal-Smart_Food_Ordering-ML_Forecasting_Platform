"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "cafesmart-theme";

interface ThemeContextValue {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (t: ThemeChoice) => void;
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  choice: "system",
  resolved: "dark",
  setChoice: () => {},
  cycle: () => {},
});

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

function resolveSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  // Brief global color transition (approved carve-out — colors only).
  root.classList.add("theme-transition");
  window.setTimeout(() => root.classList.remove("theme-transition"), 350);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializers read storage/media synchronously — no setState-in-effect,
  // and the pre-paint ThemeInit script already aligned the DOM attribute.
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    const initial = readStoredChoice();
    return initial === "system" ? resolveSystem() : initial;
  });

  // Follow OS changes while in system mode (subscription — effect-appropriate).
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  // Push resolved theme to the DOM (external-system sync — effect-appropriate).
  useEffect(() => {
    if (document.documentElement.dataset.theme !== resolved) applyTheme(resolved);
  }, [resolved]);

  const setChoice = useCallback((t: ThemeChoice) => {
    window.localStorage.setItem(STORAGE_KEY, t);
    setChoiceState(t);
    setResolved(t === "system" ? resolveSystem() : t);
  }, []);

  const cycle = useCallback(() => {
    setChoice(
      choice === "system" ? "light" : choice === "light" ? "dark" : "system"
    );
  }, [choice, setChoice]);

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice, cycle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Inline pre-paint script — sets data-theme before first render so the
 * correct theme applies with zero flash. Rendered once in <head>.
 */
export function ThemeInit() {
  const script = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var r=s==='light'||s==='dark'?s:(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r;}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
