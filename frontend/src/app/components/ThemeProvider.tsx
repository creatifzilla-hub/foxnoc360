"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to light — the blocking script in layout.tsx ensures the DOM class
  // is applied immediately, so the initial state here just needs to match.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Read the theme that the blocking script already applied to <html>
    const saved = (localStorage.getItem("theme") as Theme) || "light";
    setTheme(saved);
    // Ensure class is correct (no-op if blocking script already set it)
    document.documentElement.classList.toggle("dark", saved === "dark");
    document.documentElement.classList.toggle("light", false); // remove legacy class
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
