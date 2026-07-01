import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: "light" | "dark";
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  actualTheme: "light",
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
    return null;
  } catch {
    return null;
  }
}

function persistTheme(storageKey: string, theme: Theme): void {
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    /* private mode / disabled storage */
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "finance-tracker-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => readStoredTheme(storageKey) ?? defaultTheme
  );
  const [actualTheme, setActualTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove("light", "dark");

    let resolvedTheme: "light" | "dark";

    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = theme;
    }

    root.classList.add(resolvedTheme);
    setActualTheme(resolvedTheme);

    persistTheme(storageKey, theme);
  }, [theme, storageKey]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system") {
        const resolvedTheme = mediaQuery.matches ? "dark" : "light";
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(resolvedTheme);
        setActualTheme(resolvedTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setTheme(theme);
    },
    actualTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};