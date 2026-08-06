"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CAP_SEASONS, CITIES, SEED_ITEMS, computeWeather, seedHistory, type Weather } from "./data";
import { generateOutfitIds } from "./logic";
import type { AppState, CategoryKey, Item, OccasionKey, Screen, Season } from "./types";

function buildInitialState(): AppState {
  const items: Item[] = SEED_ITEMS.map((s) => ({
    id: s.id,
    name: s.name,
    cat: s.cat,
    color: s.color,
    hex: s.hex,
    season: s.season,
    worn: s.worn,
  }));
  const capsules: AppState["capsules"] = {
    "Printemps 2026": [],
    "Été 2026": SEED_ITEMS.filter((i) => i.seed).map((i) => i.id),
    "Automne 2026": [],
    "Hiver 2026": [],
  };
  return {
    items,
    capsules,
    activeSeason: "Été 2026",
    seasonPickerOpen: false,
    screen: "welcome",
    premiumReturn: "tenues",
    onbStep: 0,
    authName: "",
    activeId: 1,
    catFilter: "all",
    seasonFilter: "all",
    addName: "",
    addCat: "haut",
    addColor: { name: "Blanc cassé", hex: "#EDE4D6" },
    addSeason: "Toutes saisons",
    capInfoOpen: false,
    geoIndex: 0,
    outfit: [],
    outfitValidated: false,
    lockedPieces: [],
    occasion: "all",
    lookCount: 24,
    isPremium: false,
    history: seedHistory(),
  };
}

export interface Actions {
  go: (screen: Screen) => void;
  startOnb: () => void;
  goWelcome: () => void;
  goAuth: () => void;
  enterApp: () => void;
  goWardrobe: () => void;
  goCapsule: () => void;
  goTenues: () => void;
  goHistory: () => void;
  goNeverWorn: () => void;
  goProfile: () => void;
  goProfileSetup: () => void;
  openAdd: () => void;
  openAddBag: () => void;
  addBack: () => void;
  setAuthName: (v: string) => void;
  onbBack: () => void;
  onbNext: () => void;
  openItem: (id: number) => void;
  removeActive: () => void;
  toggleCapsule: (id: number) => void;
  toggleActiveCapsule: () => void;
  toggleCapInfo: () => void;
  setCatFilter: (k: CategoryKey | "all") => void;
  setSeasonFilter: (k: Season | "all") => void;
  setAddName: (v: string) => void;
  setAddCat: (k: CategoryKey) => void;
  setAddColor: (c: { name: string; hex: string }) => void;
  setAddSeason: (s: Season) => void;
  saveItem: () => void;
  goPremium: () => void;
  subscribe: () => void;
  premiumBack: () => void;
  setOccasion: (o: OccasionKey) => void;
  toggleLock: (id: number) => void;
  cycleGeo: () => void;
  toggleSeasonPicker: () => void;
  setSeason: (name: string) => void;
  duplicateFrom: (src: string) => void;
  regenOutfit: () => void;
  wearOutfitToday: () => void;
  wearPieceToday: (id: number) => void;
  wearActiveToday: () => void;
  correctPiece: (id: number) => void;
  correctActive: () => void;
  reWear: (ids: number[]) => void;
}

interface CapselaContextValue {
  state: AppState;
  weather: Weather;
  actions: Actions;
  /** Wraps a handler so it only runs for Premium users; otherwise routes to the paywall. */
  requirePremium: (fn: () => void) => () => void;
}

const CapselaContext = createContext<CapselaContextValue | null>(null);

const toPremiumScreen = (s: AppState): AppState => ({
  ...s,
  premiumReturn: s.screen === "premium" ? s.premiumReturn : s.screen,
  screen: "premium",
});

export function CapselaProvider({ children }: { children: React.ReactNode }) {
  const [weather] = useState<Weather>(() => computeWeather());
  const [state, setState] = useState<AppState>(() => {
    const base = buildInitialState();
    return { ...base, outfit: generateOutfitIds(base, weather) };
  });
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const go = (screen: Screen) => setState((s) => ({ ...s, screen }));

  const actions: Actions = {
    go,
    startOnb: () => setState((s) => ({ ...s, screen: "onboarding", onbStep: 0 })),
    goWelcome: () => go("welcome"),
    goAuth: () => go("auth"),
    enterApp: () => go("tenues"),
    goWardrobe: () => go("wardrobe"),
    goCapsule: () => go("capsule"),
    goTenues: () => go("tenues"),
    goHistory: () => go("history"),
    goNeverWorn: () => go("neverworn"),
    goProfile: () => go("profile"),
    goProfileSetup: () => go("profileSetup"),
    openAdd: () => go("add"),
    openAddBag: () => setState((s) => ({ ...s, screen: "add", addCat: "accessoire", addName: "Sac " })),
    addBack: () => go("wardrobe"),
    setAuthName: (v) => setState((s) => ({ ...s, authName: v })),

    onbBack: () =>
      setState((s) => (s.onbStep === 0 ? { ...s, screen: "welcome" } : { ...s, onbStep: s.onbStep - 1 })),
    onbNext: () =>
      setState((s) => (s.onbStep >= 2 ? { ...s, screen: "auth" } : { ...s, onbStep: s.onbStep + 1 })),

    openItem: (id) => setState((s) => ({ ...s, activeId: id, screen: "piece" })),
    removeActive: () =>
      setState((s) => {
        const caps: AppState["capsules"] = {};
        Object.keys(s.capsules).forEach((k) => {
          caps[k] = (s.capsules[k] || []).filter((id) => id !== s.activeId);
        });
        return { ...s, items: s.items.filter((it) => it.id !== s.activeId), capsules: caps, screen: "wardrobe" };
      }),

    toggleCapsule: (id) =>
      setState((s) => {
        const cur = s.capsules[s.activeSeason] || [];
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        return { ...s, capsules: { ...s.capsules, [s.activeSeason]: next } };
      }),
    toggleActiveCapsule: () =>
      setState((s) => {
        const cur = s.capsules[s.activeSeason] || [];
        const id = s.activeId;
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        return { ...s, capsules: { ...s.capsules, [s.activeSeason]: next } };
      }),
    toggleCapInfo: () => setState((s) => ({ ...s, capInfoOpen: !s.capInfoOpen })),

    setCatFilter: (k) => setState((s) => ({ ...s, catFilter: k })),
    setSeasonFilter: (k) => setState((s) => ({ ...s, seasonFilter: k })),

    setAddName: (v) => setState((s) => ({ ...s, addName: v })),
    setAddCat: (k) => setState((s) => ({ ...s, addCat: k })),
    setAddColor: (c) => setState((s) => ({ ...s, addColor: c })),
    setAddSeason: (season) => setState((s) => ({ ...s, addSeason: season })),
    saveItem: () =>
      setState((s) => {
        const item: Item = {
          id: Math.max(0, ...s.items.map((i) => i.id)) + 1,
          name: (s.addName || "").trim() || "Nouvelle pièce",
          cat: s.addCat,
          color: s.addColor.name,
          hex: s.addColor.hex,
          season: s.addSeason,
          worn: null,
        };
        return { ...s, items: [item, ...s.items], addName: "", screen: "wardrobe" };
      }),

    goPremium: () => setState(toPremiumScreen),
    subscribe: () => setState((s) => ({ ...s, isPremium: true, screen: s.premiumReturn || "tenues" })),
    premiumBack: () => setState((s) => ({ ...s, screen: s.premiumReturn || "tenues" })),

    setOccasion: (o) =>
      setState((s) => {
        const s2 = { ...s, occasion: o };
        return { ...s2, outfit: generateOutfitIds(s2, weather), outfitValidated: false };
      }),
    toggleLock: (id) =>
      setState((s) => {
        const cur = s.lockedPieces || [];
        return { ...s, lockedPieces: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
      }),
    cycleGeo: () => setState((s) => ({ ...s, geoIndex: ((s.geoIndex || 0) + 1) % CITIES.length })),

    toggleSeasonPicker: () => setState((s) => ({ ...s, seasonPickerOpen: !s.seasonPickerOpen })),
    setSeason: (name) =>
      setState((s) => {
        const s2 = { ...s, activeSeason: name, seasonPickerOpen: false };
        return { ...s2, outfit: generateOutfitIds(s2, weather), outfitValidated: false };
      }),
    duplicateFrom: (src) =>
      setState((s) => {
        const from = s.capsules[src] || [];
        const cur = s.capsules[s.activeSeason] || [];
        const merged = Array.from(new Set([...cur, ...from]));
        const s2 = { ...s, capsules: { ...s.capsules, [s.activeSeason]: merged } };
        return { ...s2, outfit: generateOutfitIds(s2, weather), outfitValidated: false };
      }),

    regenOutfit: () => setState((s) => ({ ...s, outfit: generateOutfitIds(s, weather), outfitValidated: false })),
    wearOutfitToday: () =>
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (s.outfit.includes(it.id) ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        outfitValidated: true,
        lookCount: s.lookCount + 1,
        history: [
          { id: "h" + Date.now(), ts: Date.now(), pieceIds: [...s.outfit], occasion: s.occasion || "all" },
          ...s.history,
        ],
      })),
    wearPieceToday: (id) =>
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === id ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        lookCount: s.lookCount + 1,
        history: [
          { id: "h" + Date.now(), ts: Date.now(), pieceIds: [id], occasion: s.occasion || "all" },
          ...s.history,
        ],
      })),
    wearActiveToday: () =>
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === s.activeId ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        lookCount: s.lookCount + 1,
        history: [
          { id: "h" + Date.now(), ts: Date.now(), pieceIds: [s.activeId], occasion: s.occasion || "all" },
          ...s.history,
        ],
      })),
    correctPiece: (id) =>
      setState((s) => ({
        ...s,
        items: s.items.map((it) => (it.id === id ? { ...it, worn: it.wornPrev === undefined ? null : it.wornPrev } : it)),
        lookCount: Math.max(0, s.lookCount - 1),
      })),
    correctActive: () =>
      setState((s) => ({
        ...s,
        items: s.items.map((it) =>
          it.id === s.activeId ? { ...it, worn: it.wornPrev === undefined ? null : it.wornPrev } : it
        ),
        lookCount: Math.max(0, s.lookCount - 1),
      })),
    reWear: (ids) =>
      setState((s) => ({
        ...s,
        outfit: ids.filter((id) => s.items.some((i) => i.id === id)),
        outfitValidated: false,
        screen: "tenues",
      })),
  };

  const requirePremium = (fn: () => void) => () => {
    if (stateRef.current.isPremium) fn();
    else setState(toPremiumScreen);
  };

  const value: CapselaContextValue = { state, weather, actions, requirePremium };

  return <CapselaContext.Provider value={value}>{children}</CapselaContext.Provider>;
}

export function useCapsela(): CapselaContextValue {
  const ctx = useContext(CapselaContext);
  if (!ctx) throw new Error("useCapsela must be used within a CapselaProvider");
  return ctx;
}

export { CAP_SEASONS };
