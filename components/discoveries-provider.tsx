"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TravelerClueCard } from "@/components/traveler-clue-card";
import {
  DISCOVERIES_STORAGE_KEY,
  PAIMON_EGG_PENDING_KEY,
  PAIMON_TAP_STORAGE_KEY,
  discoverNode as discoverNodeState,
  emptyDiscoveries,
  hasUnlockedClueCard,
  parseDiscoveries,
  type TravelerDiscoveries,
} from "@/lib/traveler-discoveries";

interface DiscoveriesContextValue {
  discoveries: TravelerDiscoveries;
  discoverNode: (nodeId: string) => void;
  registerPaimonTap: () => boolean;
  dismissClueCard: () => void;
}

const DiscoveriesContext = createContext<DiscoveriesContextValue | null>(null);

export function DiscoveriesProvider({ children }: { children: React.ReactNode }) {
  const [discoveries, setDiscoveries] = useState<TravelerDiscoveries>(emptyDiscoveries);
  const [hydrated, setHydrated] = useState(false);
  const [clueCardVisible, setClueCardVisible] = useState(false);
  const paimonTapCount = useRef(0);
  const paimonEasterEggFound = useRef(false);

  useEffect(() => {
    try {
      const restored = parseDiscoveries(window.localStorage.getItem(DISCOVERIES_STORAGE_KEY));
      setDiscoveries(restored);
      paimonEasterEggFound.current = restored.paimonEasterEggFound;
    } catch {
      // A private or restricted browser can still use in-memory discoveries.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(DISCOVERIES_STORAGE_KEY, JSON.stringify(discoveries));
    } catch {
      // Keep the interaction available for this page session.
    }
  }, [discoveries, hydrated]);

  const discoverNode = useCallback((nodeId: string) => {
    setDiscoveries((current) => {
      const next = discoverNodeState(current, nodeId);
      if (!hasUnlockedClueCard(current) && hasUnlockedClueCard(next)) {
        setClueCardVisible(true);
      }
      return next;
    });
  }, []);

  const registerPaimonTap = useCallback(() => {
    if (paimonEasterEggFound.current) return false;
    try {
      const stored = Number.parseInt(
        window.sessionStorage.getItem(PAIMON_TAP_STORAGE_KEY) ?? "0",
        10,
      );
      paimonTapCount.current = Number.isFinite(stored) ? stored : 0;
    } catch {
      // Use the in-memory counter when session storage is unavailable.
    }
    paimonTapCount.current += 1;
    try {
      window.sessionStorage.setItem(
        PAIMON_TAP_STORAGE_KEY,
        String(paimonTapCount.current),
      );
    } catch {
      // The current page can still complete the easter egg.
    }
    if (paimonTapCount.current < 5) return false;
    paimonEasterEggFound.current = true;
    try {
      window.sessionStorage.removeItem(PAIMON_TAP_STORAGE_KEY);
      window.sessionStorage.setItem(PAIMON_EGG_PENDING_KEY, "true");
    } catch {
      // AppShell will open immediately when the same page remains mounted.
    }
    setDiscoveries((current) => {
      const next = { ...current, paimonEasterEggFound: true };
      try {
        window.localStorage.setItem(DISCOVERIES_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The in-memory state remains the fallback.
      }
      return next;
    });
    return true;
  }, []);

  const value: DiscoveriesContextValue = {
    discoveries,
    discoverNode,
    registerPaimonTap,
    dismissClueCard: () => setClueCardVisible(false),
  };

  return (
    <DiscoveriesContext.Provider value={value}>
      {children}
      {clueCardVisible ? <TravelerClueCard discoveries={discoveries} onDismiss={value.dismissClueCard} /> : null}
    </DiscoveriesContext.Provider>
  );
}

export function useDiscoveries() {
  const context = useContext(DiscoveriesContext);
  if (!context) throw new Error("useDiscoveries must be used inside DiscoveriesProvider");
  return context;
}
