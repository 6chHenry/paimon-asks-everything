"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TravelerClueCard } from "@/components/traveler-clue-card";
import {
  DISCOVERIES_STORAGE_KEY,
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
    paimonTapCount.current += 1;
    if (paimonTapCount.current < 5) return false;
    paimonEasterEggFound.current = true;
    setDiscoveries((current) => ({ ...current, paimonEasterEggFound: true }));
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
