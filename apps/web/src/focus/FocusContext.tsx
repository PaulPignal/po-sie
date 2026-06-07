import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "lafontaine.focusSlug";

interface FocusValue {
  slug: string | null;
  choose: (slug: string) => void;
  clear: () => void;
}

const FocusContext = createContext<FocusValue | null>(null);

function readInitial(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function FocusProvider({ children }: { children: ReactNode }) {
  const [slug, setSlug] = useState<string | null>(readInitial);

  const choose = useCallback((next: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode, etc.)
    }
    setSlug(next);
  }, []);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSlug(null);
  }, []);

  const value = useMemo(() => ({ slug, choose, clear }), [slug, choose, clear]);

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): FocusValue {
  const value = useContext(FocusContext);
  if (!value) {
    throw new Error("useFocus doit être utilisé dans un FocusProvider.");
  }
  return value;
}
