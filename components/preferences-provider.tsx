"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Preferences } from "@/lib/domain";

const defaultPreferences: Preferences = {
  language: "zh-CN",
  profile: "returning",
  progress: "fontaine",
  spoilerPreference: "low",
  focus: ["story", "overview"],
  allowQuestionTextStorage: false,
};

interface PreferencesContextValue {
  preferences: Preferences;
  setPreferences: (
    value: Preferences | ((current: Preferences) => Preferences),
  ) => void;
  hydrated: boolean;
  sessionId: string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [hydrated, setHydrated] = useState(false);
  const [sessionId, setSessionId] = useState("anonymous-session");

  useEffect(() => {
    const saved = window.localStorage.getItem("paimon-preferences");
    const storedSession = window.sessionStorage.getItem("paimon-session-id");
    if (saved) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(saved) });
      } catch {
        window.localStorage.removeItem("paimon-preferences");
      }
    }
    if (storedSession) {
      setSessionId(storedSession);
    } else {
      const nextSession = crypto.randomUUID();
      window.sessionStorage.setItem("paimon-session-id", nextSession);
      setSessionId(nextSession);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(
        "paimon-preferences",
        JSON.stringify(preferences),
      );
      document.documentElement.lang = preferences.language;
    }
  }, [hydrated, preferences]);

  const value = useMemo(
    () => ({ preferences, setPreferences, hydrated, sessionId }),
    [preferences, hydrated, sessionId],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }
  return context;
}
