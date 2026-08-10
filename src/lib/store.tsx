"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { CATALOG } from "./catalog";
import { computeDefaultCapsule, weatherSeasonBucket } from "./capsule";
import { CATS, CITIES, type Weather } from "./data";
import { generateOutfit, swapOutfitPiece } from "./logic";
import type { AppState, CategoryKey, Item, OccasionKey, SavedLook, Screen, Season } from "./types";

function buildInitialState(): AppState {
  return {
    // Le dressing réel démarre vide : la capsule par défaut prend le relais.
    items: [],
    suggestedExcluded: [],
    replacingId: null,
    screen: "welcome",
    profileReturn: "home",
    premiumReturn: "home",
    profileSetupStep: 0,
    profileSetupFromEdit: false,
    onbStep: 0,
    authName: "",
    activeId: 0,
    activeSuggested: false,
    catFilter: "all",
    addName: "",
    addBrand: "",
    addCat: "haut",
    addColor: { name: "Blanc cassé", hex: "#EDE4D6" },
    addSize: null,
    // Pas de valeur par défaut : la saison doit être confirmée par l'utilisateur.
    addSeason: null,
    addOccasion: "travail",
    geoIndex: 0,
    outfit: [],
    outfitMissingCats: [],
    outfitValidated: false,
    occasion: "all",
    lookCount: 0,
    isPremium: false,
    history: [],
    opinionContact: null,
    opinionStatus: null,
    opinionVia: null,
    savedLooks: [],
    lookDraftIds: [],
    lookDraftName: "",
    activeLookId: null,
  };
}

export interface Actions {
  go: (screen: Screen) => void;
  startOnb: () => void;
  goWelcome: () => void;
  goAuth: () => void;
  enterApp: () => void;
  goHome: () => void;
  goWardrobe: () => void;
  goCapsule: () => void;
  goTenues: () => void;
  goHistory: () => void;
  goNeverWorn: () => void;
  goProfile: () => void;
  goProfileEdit: () => void;
  goLogin: () => void;
  /** Ouvre le questionnaire profil à une étape donnée (0 = début). fromEdit : retour vers l'édition à la fin. */
  goProfileSetup: (step?: number, fromEdit?: boolean) => void;
  openAdd: () => void;
  openAddBag: () => void;
  addBack: () => void;
  setAuthName: (v: string) => void;
  onbBack: () => void;
  onbNext: () => void;
  openItem: (id: number, suggested?: boolean) => void;
  removeActive: () => void;
  /** Pièce suggérée : l'adopte dans le dressing réel. Pièce réelle : la retire. */
  toggleActiveCapsule: () => void;
  /** Écarte une suggestion de la capsule par défaut. */
  dismissSuggested: (id: number) => void;
  /** Ouvre l'ajout d'une pièce pour remplacer une suggestion. */
  startReplace: (id: number, cat: CategoryKey) => void;
  setCatFilter: (k: CategoryKey | "all") => void;
  setAddName: (v: string) => void;
  setAddBrand: (v: string) => void;
  setAddCat: (k: CategoryKey) => void;
  setAddColor: (c: { name: string; hex: string }) => void;
  setAddSize: (v: string | null) => void;
  setAddSeason: (s: Season) => void;
  setAddOccasion: (o: OccasionKey) => void;
  saveItem: () => void;
  goPremium: () => void;
  subscribe: () => void;
  premiumBack: () => void;
  setOccasion: (o: OccasionKey) => void;
  /** Remplace une pièce de la tenue par une autre de la même famille. */
  swapPiece: (id: number, cat: CategoryKey) => void;
  cycleGeo: () => void;
  regenOutfit: () => void;
  wearOutfitToday: () => void;
  wearPieceToday: (id: number) => void;
  wearActiveToday: () => void;
  correctPiece: (id: number) => void;
  correctActive: () => void;
  reWear: (ids: number[]) => void;
  openOpinionShare: () => void;
  closeOpinionShare: () => void;
  setOpinionContact: (c: string) => void;
  sendOpinionRequest: (via: "message" | "whatsapp" | "social") => void;

  goCreateLook: () => void;
  cancelCreateLook: () => void;
  toggleLookDraftPiece: (id: number) => void;
  setLookDraftName: (v: string) => void;
  saveLook: () => void;
  openLook: (id: string) => void;
  closeLookDetail: () => void;
  deleteActiveLook: () => void;
  wearLookToday: (id: string) => void;
}

interface CapselaContextValue {
  state: AppState;
  weather: Weather;
  /** Capsule par défaut personnalisée (suggestions du catalogue). */
  defaultCapsule: Item[];
  /** Pool actif : le dressing réel s'il contient des pièces, sinon la capsule par défaut. */
  wardrobePool: Item[];
  /** La tenue du jour vient de vraies pièces (par opposition aux suggestions de la capsule). */
  outfitFromDressing: boolean;
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

/** Retrouve une pièce par id dans un pool, puis dans le catalogue (pour l'historique). */
export function findPiece(pool: Item[], id: number): Item | undefined {
  return pool.find((i) => i.id === id) ?? CATALOG.find((i) => i.id === id);
}

export function CapselaProvider({ children }: { children: React.ReactNode }) {
  const { profile, ready } = useAuth();
  const [state, setState] = useState<AppState>(buildInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const geoCity = CITIES[(state.geoIndex || 0) % CITIES.length];
  const weather: Weather = useMemo(() => {
    const season = weatherSeasonBucket(geoCity.temp);
    return { season, temp: geoCity.temp, label: geoCity.label, seasons: [season, "Toutes saisons"] };
  }, [geoCity]);

  const defaultCapsule = useMemo(
    () => computeDefaultCapsule(profile, geoCity.temp, state.suggestedExcluded),
    [profile, geoCity.temp, state.suggestedExcluded]
  );
  // Pool effectif : par catégorie, tes pièces réelles si tu en as, sinon les
  // suggestions de la capsule par défaut — jamais un mélange à l'intérieur
  // d'une même catégorie, mais jamais "tout ou rien" non plus (ajouter une
  // seule pièce réelle ne doit pas faire disparaître les suggestions des
  // autres catégories).
  const wardrobePool = useMemo(
    () =>
      CATS.flatMap(([key]) => {
        const real = state.items.filter((i) => i.cat === key);
        return real.length ? real : defaultCapsule.filter((i) => i.cat === key);
      }),
    [state.items, defaultCapsule]
  );
  const outfitFromDressing = state.items.length > 0;

  const poolRef = useRef(wardrobePool);
  const weatherRef = useRef(weather);
  useEffect(() => {
    poolRef.current = wardrobePool;
    weatherRef.current = weather;
  }, [wardrobePool, weather]);

  const regen = (s: AppState): AppState => {
    const { ids, missingCats } = generateOutfit(poolRef.current, weatherRef.current, s.occasion || "all");
    return { ...s, outfit: ids, outfitMissingCats: missingCats, outfitValidated: false };
  };

  // Première tenue : dès que le profil est chargé (la capsule par défaut en dépend).
  useEffect(() => {
    if (ready && !stateRef.current.outfit.length) {
      setState((s) => regen(s));
    }
  }, [ready, defaultCapsule]);

  const go = (screen: Screen) => setState((s) => ({ ...s, screen }));

  const actions: Actions = {
    go,
    startOnb: () => setState((s) => ({ ...s, screen: "onboarding", onbStep: 0 })),
    goWelcome: () => go("welcome"),
    goAuth: () => go("auth"),
    enterApp: () => go("home"),
    goHome: () => go("home"),
    goWardrobe: () => go("wardrobe"),
    goCapsule: () => go("capsule"),
    goTenues: () => go("tenues"),
    goHistory: () => go("history"),
    goNeverWorn: () => go("neverworn"),
    goProfile: () => setState((s) => ({ ...s, profileReturn: s.screen === "profile" ? s.profileReturn : s.screen, screen: "profile" })),
    goProfileEdit: () => go("profileEdit"),
    goLogin: () => go("login"),
    goProfileSetup: (step = 0, fromEdit = false) =>
      setState((s) => ({ ...s, screen: "profileSetup", profileSetupStep: step, profileSetupFromEdit: fromEdit })),
    openAdd: () => go("add"),
    openAddBag: () => setState((s) => ({ ...s, screen: "add", addCat: "sac", addName: "Sac " })),
    addBack: () => setState((s) => ({ ...s, replacingId: null, screen: "wardrobe" })),
    setAuthName: (v) => setState((s) => ({ ...s, authName: v })),

    onbBack: () =>
      setState((s) => (s.onbStep === 0 ? { ...s, screen: "welcome" } : { ...s, onbStep: s.onbStep - 1 })),
    onbNext: () =>
      setState((s) => (s.onbStep >= 2 ? { ...s, screen: "auth" } : { ...s, onbStep: s.onbStep + 1 })),

    openItem: (id, suggested = false) =>
      setState((s) => ({ ...s, activeId: id, activeSuggested: suggested, screen: "piece" })),
    removeActive: () =>
      setState((s) => {
        if (s.activeSuggested) {
          return { ...s, suggestedExcluded: [...s.suggestedExcluded, s.activeId], screen: "wardrobe" };
        }
        return { ...s, items: s.items.filter((it) => it.id !== s.activeId), screen: "wardrobe" };
      }),

    toggleActiveCapsule: () =>
      setState((s) => {
        if (s.activeSuggested) {
          const found = CATALOG.find((i) => i.id === s.activeId);
          if (!found) return s;
          // Adopter la suggestion : elle devient une pièce réelle du dressing.
          const { genre: _genre, ...piece } = found;
          void _genre;
          return { ...s, items: [{ ...piece }, ...s.items], activeSuggested: false };
        }
        return { ...s, items: s.items.filter((it) => it.id !== s.activeId), screen: "wardrobe" };
      }),

    dismissSuggested: (id) =>
      setState((s) => ({ ...s, suggestedExcluded: [...s.suggestedExcluded, id] })),
    startReplace: (id, cat) =>
      setState((s) => ({ ...s, replacingId: id, addCat: cat, addSize: null, screen: "add" })),

    setCatFilter: (k) => setState((s) => ({ ...s, catFilter: k })),

    setAddName: (v) => setState((s) => ({ ...s, addName: v })),
    setAddBrand: (v) => setState((s) => ({ ...s, addBrand: v })),
    setAddCat: (k) => setState((s) => ({ ...s, addCat: k, addSize: null })),
    setAddColor: (c) => setState((s) => ({ ...s, addColor: c })),
    setAddSize: (v) => setState((s) => ({ ...s, addSize: v })),
    setAddSeason: (season) => setState((s) => ({ ...s, addSeason: season })),
    setAddOccasion: (o) => setState((s) => ({ ...s, addOccasion: o })),
    saveItem: () =>
      setState((s) => {
        // Contrainte produit : pas de sauvegarde tant que la saison n'est pas confirmée.
        if (!s.addSeason) return s;
        const item: Item = {
          id: Math.max(0, ...s.items.map((i) => i.id)) + 1,
          name: (s.addName || "").trim() || "Nouvelle pièce",
          brand: (s.addBrand || "").trim() || undefined,
          cat: s.addCat,
          color: s.addColor.name,
          hex: s.addColor.hex,
          size: s.addSize,
          season: s.addSeason,
          occasion: s.addOccasion,
          worn: null,
        };
        return {
          ...s,
          items: [item, ...s.items],
          suggestedExcluded: s.replacingId ? [...s.suggestedExcluded, s.replacingId] : s.suggestedExcluded,
          replacingId: null,
          addName: "",
          addBrand: "",
          addSeason: null,
          screen: "wardrobe",
        };
      }),

    goPremium: () => setState(toPremiumScreen),
    subscribe: () => setState((s) => ({ ...s, isPremium: true, screen: s.premiumReturn || "home" })),
    premiumBack: () => setState((s) => ({ ...s, screen: s.premiumReturn || "home" })),

    setOccasion: (o) => setState((s) => regen({ ...s, occasion: o })),
    swapPiece: (id, cat) =>
      setState((s) => {
        const outfitItems = s.outfit
          .map((oid) => findPiece(poolRef.current, oid))
          .filter((it): it is Item => Boolean(it));
        return { ...s, outfit: swapOutfitPiece(outfitItems, poolRef.current, id, cat) };
      }),
    cycleGeo: () => setState((s) => ({ ...s, geoIndex: ((s.geoIndex || 0) + 1) % CITIES.length })),

    regenOutfit: () => setState(regen),
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
        outfit: ids.filter((id) => findPiece(poolRef.current, id)),
        outfitValidated: false,
        screen: "tenues",
      })),

    openOpinionShare: () => setState((s) => ({ ...s, screen: "opinionShare", opinionContact: null, opinionStatus: null })),
    closeOpinionShare: () => go("tenues"),
    setOpinionContact: (c) => setState((s) => ({ ...s, opinionContact: s.opinionContact === c ? null : c })),
    sendOpinionRequest: (via) => setState((s) => ({ ...s, opinionStatus: "sent", opinionVia: via })),

    goCreateLook: () => setState((s) => ({ ...s, lookDraftIds: [], lookDraftName: "", screen: "createLook" })),
    cancelCreateLook: () => go("wardrobe"),
    toggleLookDraftPiece: (id) =>
      setState((s) => ({
        ...s,
        lookDraftIds: s.lookDraftIds.includes(id) ? s.lookDraftIds.filter((x) => x !== id) : [...s.lookDraftIds, id],
      })),
    setLookDraftName: (v) => setState((s) => ({ ...s, lookDraftName: v })),
    saveLook: () =>
      setState((s) => {
        // Un look doit rassembler au moins 2 pièces pour avoir du sens.
        if (s.lookDraftIds.length < 2) return s;
        const now = new Date();
        const defaultName =
          "Look du " + now.getDate().toString().padStart(2, "0") + "/" + (now.getMonth() + 1).toString().padStart(2, "0");
        const look: SavedLook = {
          id: "look" + Date.now(),
          name: s.lookDraftName.trim() || defaultName,
          pieceIds: [...s.lookDraftIds],
          createdAt: Date.now(),
        };
        return {
          ...s,
          savedLooks: [look, ...s.savedLooks],
          lookDraftIds: [],
          lookDraftName: "",
          screen: "wardrobe",
        };
      }),
    openLook: (id) => setState((s) => ({ ...s, activeLookId: id, screen: "lookDetail" })),
    closeLookDetail: () => setState((s) => ({ ...s, activeLookId: null, screen: "wardrobe" })),
    deleteActiveLook: () =>
      setState((s) => ({
        ...s,
        savedLooks: s.savedLooks.filter((l) => l.id !== s.activeLookId),
        activeLookId: null,
        screen: "wardrobe",
      })),
    wearLookToday: (id) =>
      setState((s) => {
        const look = s.savedLooks.find((l) => l.id === id);
        if (!look) return s;
        return {
          ...s,
          items: s.items.map((it) => (look.pieceIds.includes(it.id) ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
          lookCount: s.lookCount + 1,
          history: [
            { id: "h" + Date.now(), ts: Date.now(), pieceIds: [...look.pieceIds], occasion: "all" },
            ...s.history,
          ],
        };
      }),
  };

  const requirePremium = (fn: () => void) => () => {
    if (stateRef.current.isPremium) fn();
    else setState(toPremiumScreen);
  };

  const value: CapselaContextValue = {
    state,
    weather,
    defaultCapsule,
    wardrobePool,
    outfitFromDressing,
    actions,
    requirePremium,
  };

  return <CapselaContext.Provider value={value}>{children}</CapselaContext.Provider>;
}

export function useCapsela(): CapselaContextValue {
  const ctx = useContext(CapselaContext);
  if (!ctx) throw new Error("useCapsela must be used within a CapselaProvider");
  return ctx;
}
