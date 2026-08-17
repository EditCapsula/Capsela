"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { CATALOG, type CatalogItem } from "./catalog";
import { computeDefaultCapsule, currentSeasonKey, weatherSeasonBucket } from "./capsule";
import { fetchVestiaireUniversel } from "./vestiaire";
import { fetchWeatherByCoords, getBrowserPosition } from "./weather";
import { CATS, CITIES, PALETTE, PALETTE_BIJOU, SUBTYPE_REQUIRED, type Weather } from "./data";
import { generateOutfit, swapOutfitPiece, violatesOuterwearRule } from "./logic";
import { paletteHexes, type ProfilePrefs } from "./profile";
import {
  detectAccessoireType,
  detectBijouType,
  detectCoupe,
  detectMatiere,
  detectSacType,
  detectSubtype,
} from "./attributes";
import type {
  AccessoireType,
  AppState,
  BijouType,
  CapsuleSeason,
  CategoryKey,
  City,
  Coupe,
  DateContext,
  Item,
  Matiere,
  OccasionKey,
  SacType,
  SavedLook,
  Screen,
  Season,
  ShoeType,
  TravelMode,
  WorkMode,
} from "./types";

/** Occasion par défaut suggérée en arrivant sur "Tenue du jour" sans choix explicite (recette 13/08/2026) — toujours modifiable manuellement ensuite. */
const DAYS_S = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
function defaultOccasionToday(prefs: ProfilePrefs): OccasionKey {
  if (prefs.onVacation) return "cocooning";
  const todayKey = DAYS_S[new Date().getDay()];
  return prefs.workDays.includes(todayKey) ? "travail_formel" : "quotidien";
}

/** Dernière position géolocalisée avec succès (persistée) — fallback prioritaire sur la ville de profil si la géolocalisation échoue ensuite (recette 17/08/2026). */
const LAST_KNOWN_CITY_KEY = "capsela.lastKnownCity";

function buildInitialState(): AppState {
  return {
    // Le dressing réel démarre vide : la capsule par défaut prend le relais.
    items: [],
    suggestedExcluded: [],
    replacingId: null,
    screen: "welcome",
    profileReturn: "home",
    premiumReturn: "home",
    legalReturn: "profile",
    profileSetupStep: 0,
    profileSetupFromEdit: false,
    onbStep: 0,
    authName: "",
    activeId: 0,
    activeSuggested: false,
    pieceReturn: "wardrobe",
    catFilter: "all",
    addName: "",
    addBrand: "",
    addCat: "haut",
    addColor: { name: "Blanc cassé", hex: "#EDE4D6" },
    addSize: null,
    addPhotoUrl: null,
    // Pas de valeur par défaut : la saison doit être confirmée par l'utilisateur.
    addSeason: null,
    addOccasion: ["travail_formel"],
    addShoeType: null,
    addMatiere: null,
    addCoupe: null,
    addMatiereTouched: false,
    addCoupeTouched: false,
    addSacType: null,
    addBijouType: null,
    addAccessoireType: null,
    addSacTypeTouched: false,
    addBijouTypeTouched: false,
    addAccessoireTypeTouched: false,
    addSubtype: null,
    addSubtypeTouched: false,
    outfit: [],
    outfitMissingCats: [],
    outfitValidated: false,
    occasion: "all",
    occasionManual: false,
    dismissedSuggestions: [],
    workMode: "Présentiel",
    travelMode: "Court trajet",
    travelTipDismissed: false,
    dateContext: "Verre",
    capsuleSeason: null,
    lookCount: 0,
    isPremium: false,
    history: [],
    opinionContact: null,
    opinionStatus: null,
    opinionVia: null,
    savedLooks: [],
    lookDraftIds: [],
    lookDraftName: "",
    lookDraftOccasion: "all",
    lookDraftDismissed: [],
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
  goLegal: () => void;
  backFromLegal: () => void;
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
  setAddPhoto: (url: string | null) => void;
  setAddSeason: (s: Season) => void;
  /** Bascule l'occasion dans la sélection multiple. */
  setAddOccasion: (o: OccasionKey) => void;
  setAddShoeType: (t: ShoeType) => void;
  setAddMatiere: (m: Matiere) => void;
  setAddCoupe: (c: Coupe) => void;
  setAddSacType: (t: SacType) => void;
  setAddBijouType: (t: BijouType) => void;
  setAddAccessoireType: (t: AccessoireType) => void;
  setAddSubtype: (t: string) => void;
  saveItem: () => void;
  goPremium: () => void;
  subscribe: () => void;
  premiumBack: () => void;
  setOccasion: (o: OccasionKey) => void;
  /** Sous-choix affiché uniquement pour l'occasion "travail_formel" ; régénère la tenue. */
  setWorkMode: (m: WorkMode) => void;
  /** Sous-choix affiché uniquement pour l'occasion "voyage" ; régénère la tenue. */
  setTravelMode: (m: TravelMode) => void;
  dismissTravelTip: () => void;
  /** Sous-choix affiché uniquement pour l'occasion "date" ; seul déterminant de sa formalité, régénère la tenue. */
  setDateContext: (c: DateContext) => void;
  /** Saison parcourue sur l'écran Capsule uniquement ; n'affecte jamais la tenue du jour. */
  setCapsuleSeason: (s: CapsuleSeason) => void;
  /** Remplace une pièce de la tenue par une autre de la même famille. */
  swapPiece: (id: number, cat: CategoryKey) => void;
  regenOutfit: () => void;
  dismissOutfitSuggestion: (key: string) => void;
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
  setLookDraftOccasion: (o: OccasionKey) => void;
  dismissLookDraftSuggestion: (key: string) => void;
  saveLook: () => void;
  openLook: (id: string) => void;
  closeLookDetail: () => void;
  deleteActiveLook: () => void;
  wearLookToday: (id: string) => void;
}

interface CapselaContextValue {
  state: AppState;
  weather: Weather;
  /** Ville affichée : position géolocalisée en direct si disponible, sinon la dernière position connue, sinon la ville de profil. */
  geoCity: City;
  /** true tant que la géolocalisation est en cours — aucune ville ne doit être affichée comme "courante" pendant ce délai. */
  geoLoading: boolean;
  /** true si geoCity reflète une position géolocalisée en direct (pas un fallback à signaler comme tel). */
  geoIsLive: boolean;
  /** Capsule par défaut personnalisée (suggestions du catalogue). */
  defaultCapsule: Item[];
  /** Pool actif : le dressing réel s'il contient des pièces, sinon la capsule par défaut. */
  wardrobePool: Item[];
  /** Source des suggestions — vestiaire universel (Supabase) si disponible, sinon le catalogue statique de secours. Utilisé par l'écran Capsule pour recalculer une capsule sur une saison différente de la saison courante. */
  vestiairePool: CatalogItem[];
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

  // Dernière position géolocalisée avec succès, si une existe (survit aux
  // rechargements) — lue une seule fois après montage, jamais pendant le
  // rendu initial (mismatch d'hydratation, cf. auth.tsx).
  const [lastKnownCity, setLastKnownCity] = useState<City | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_KNOWN_CITY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLastKnownCity(JSON.parse(raw) as City);
    } catch {
      // stockage indisponible : pas de dernière position connue, on retombe sur la ville de profil.
    }
  }, []);

  // Géolocalisation en direct (OpenWeatherMap) quand "géolocalisation" +
  // "météo de ma position" sont activées (profile.prefs, écran "Localisation
  // & météo") — statut explicite (pas seulement liveWeather nullable) pour
  // distinguer "en cours" de "abandonnée sans résultat" : la ville et la
  // météo affichées ne doivent jamais rester sur une ancienne valeur pendant
  // que la vraie position se charge (recette 17/08/2026 "Règle de
  // géolocalisation sur la page Tenue du jour").
  const [liveWeather, setLiveWeather] = useState<City | null>(null);
  const [geoStatus, setGeoStatus] = useState<"disabled" | "loading" | "success" | "failed">("disabled");
  useEffect(() => {
    let cancelled = false;
    if (!profile.prefs.geoConsent || !profile.prefs.weatherFromGeo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLiveWeather(null);
      setGeoStatus("disabled");
      return;
    }
    setGeoStatus("loading");
    (async () => {
      const pos = await getBrowserPosition();
      if (cancelled) return;
      const w = pos ? await fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude) : null;
      if (cancelled) return;
      if (w) {
        setLiveWeather(w);
        setLastKnownCity(w);
        setGeoStatus("success");
        try {
          localStorage.setItem(LAST_KNOWN_CITY_KEY, JSON.stringify(w));
        } catch {
          // stockage indisponible : la position ne sera pas retrouvée hors ligne la prochaine fois, sans impact ici.
        }
      } else {
        setGeoStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.prefs.geoConsent, profile.prefs.weatherFromGeo]);

  // En cours : aucune ville affichée tant que la vraie position n'est pas
  // connue (jamais une ancienne ville affichée comme si elle était la
  // position courante). Résolu (succès, échec ou géoloc désactivée) : ville
  // en direct, sinon dernière position connue, sinon la ville de profil —
  // geoIsLive distingue ce cas pour l'indiquer clairement à l'écran.
  const geoLoading = geoStatus === "loading";
  const geoIsLive = geoStatus === "success";
  const profileCityFallback = CITIES.find((c) => c.city === profile.city) ?? CITIES[0];
  const geoCity: City = liveWeather ?? lastKnownCity ?? profileCityFallback;
  const weather: Weather = useMemo(() => {
    const season = weatherSeasonBucket(geoCity.temp);
    return { season, temp: geoCity.temp, label: geoCity.label, seasons: [season, "Toutes saisons"] };
  }, [geoCity]);

  // Vestiaire universel (Supabase) : remplace le catalogue statique dès qu'il
  // est disponible. En mode démo, si la requête échoue, ou si la table/les
  // colonnes ne sont pas encore en place, on retombe silencieusement sur le
  // catalogue statique (CATALOG) — jamais d'écran vide en attendant.
  const [vestiairePool, setVestiairePool] = useState<CatalogItem[]>(CATALOG);
  useEffect(() => {
    let cancelled = false;
    fetchVestiaireUniversel().then((rows) => {
      if (!cancelled && rows.length) setVestiairePool(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Toujours la saison calendaire courante — indépendante de la saison parcourue
  // sur l'écran Capsule (state.capsuleSeason), qui n'affecte que son affichage.
  const defaultCapsule = useMemo(
    () => computeDefaultCapsule(profile, weather, state.suggestedExcluded, currentSeasonKey(), vestiairePool),
    [profile, weather, state.suggestedExcluded, vestiairePool]
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

  const poolRef = useRef(wardrobePool);
  const weatherRef = useRef(weather);
  useEffect(() => {
    poolRef.current = wardrobePool;
    weatherRef.current = weather;
  }, [wardrobePool, weather]);

  const regen = (s: AppState): AppState => {
    const { ids, missingCats } = generateOutfit(
      poolRef.current,
      weatherRef.current,
      s.occasion || "all",
      s.workMode,
      s.dateContext,
      paletteHexes(profile)
    );
    return { ...s, outfit: ids, outfitMissingCats: missingCats, outfitValidated: false, dismissedSuggestions: [] };
  };

  // Première tenue : dès que le profil est chargé (la capsule par défaut en
  // dépend) ET que la géolocalisation a fini de se résoudre (succès, échec
  // ou désactivée) — jamais avant, sinon la toute première tenue générée
  // s'appuierait sur une météo de repli qui ne serait plus jamais
  // régénérée automatiquement par la suite (recette 17/08/2026).
  useEffect(() => {
    if (ready && !geoLoading && !stateRef.current.outfit.length) {
      setState((s) => regen(s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, geoLoading, defaultCapsule]);

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
    goTenues: () =>
      setState((s) => {
        let next: AppState = { ...s, screen: "tenues" };
        // Occasion par défaut du jour (recette 13/08/2026) : calculée une
        // seule fois, tant qu'aucune tenue n'a encore été générée et que
        // l'utilisatrice n'a jamais choisi d'occasion elle-même cette
        // session — toujours remplaçable ensuite via les chips d'occasion.
        if (!next.outfit.length) {
          if (!next.occasionManual) next = { ...next, occasion: defaultOccasionToday(profile.prefs) };
          next = regen(next);
        }
        return next;
      }),
    goHistory: () => go("history"),
    goNeverWorn: () => go("neverworn"),
    goProfile: () => setState((s) => ({ ...s, profileReturn: s.screen === "profile" ? s.profileReturn : s.screen, screen: "profile" })),
    goProfileEdit: () => go("profileEdit"),
    goLegal: () => setState((s) => ({ ...s, legalReturn: s.screen === "legal" ? s.legalReturn : s.screen, screen: "legal" })),
    backFromLegal: () => setState((s) => ({ ...s, screen: s.legalReturn || "profile" })),
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
      setState((s) => ({ ...s, activeId: id, activeSuggested: suggested, pieceReturn: s.screen, screen: "piece" })),
    removeActive: () =>
      setState((s) => {
        if (s.activeSuggested) {
          return { ...s, suggestedExcluded: [...s.suggestedExcluded, s.activeId], screen: s.pieceReturn };
        }
        return { ...s, items: s.items.filter((it) => it.id !== s.activeId), screen: s.pieceReturn };
      }),

    dismissSuggested: (id) =>
      setState((s) => ({ ...s, suggestedExcluded: [...s.suggestedExcluded, id] })),
    startReplace: (id, cat) =>
      setState((s) => ({ ...s, replacingId: id, addCat: cat, addSize: null, screen: "add" })),

    setCatFilter: (k) => setState((s) => ({ ...s, catFilter: k })),

    setAddName: (v) =>
      setState((s) => ({
        ...s,
        addName: v,
        addMatiere: s.addMatiereTouched ? s.addMatiere : detectMatiere(v),
        addCoupe: s.addCoupeTouched ? s.addCoupe : detectCoupe(v),
        addSacType: s.addSacTypeTouched ? s.addSacType : detectSacType(v),
        addBijouType: s.addBijouTypeTouched ? s.addBijouType : detectBijouType(v),
        addAccessoireType: s.addAccessoireTypeTouched ? s.addAccessoireType : detectAccessoireType(v),
        addSubtype: s.addSubtypeTouched ? s.addSubtype : detectSubtype(s.addCat, v),
      })),
    setAddBrand: (v) => setState((s) => ({ ...s, addBrand: v })),
    setAddCat: (k) =>
      setState((s) => {
        const wasBijou = s.addCat === "bijou";
        const isBijou = k === "bijou";
        const addColor = wasBijou !== isBijou
          ? isBijou
            ? { name: PALETTE_BIJOU[0][0], hex: PALETTE_BIJOU[0][1] }
            : { name: PALETTE[0][0], hex: PALETTE[0][1] }
          : s.addColor;
        return {
          ...s,
          addCat: k,
          addSize: null,
          addShoeType: null,
          addCoupe: k === "chaussures" ? null : s.addCoupe,
          addColor,
          addSubtype: detectSubtype(k, s.addName),
          addSubtypeTouched: false,
        };
      }),
    setAddColor: (c) => setState((s) => ({ ...s, addColor: c })),
    setAddSize: (v) => setState((s) => ({ ...s, addSize: v })),
    setAddPhoto: (v) => setState((s) => ({ ...s, addPhotoUrl: v })),
    setAddSeason: (season) => setState((s) => ({ ...s, addSeason: season })),
    setAddOccasion: (o) =>
      setState((s) => ({
        ...s,
        addOccasion: s.addOccasion.includes(o) ? s.addOccasion.filter((x) => x !== o) : [...s.addOccasion, o],
      })),
    setAddShoeType: (t) => setState((s) => ({ ...s, addShoeType: t })),
    setAddMatiere: (m) => setState((s) => ({ ...s, addMatiere: m, addMatiereTouched: true })),
    setAddCoupe: (c) => setState((s) => ({ ...s, addCoupe: c, addCoupeTouched: true })),
    setAddSacType: (t) => setState((s) => ({ ...s, addSacType: t, addSacTypeTouched: true })),
    setAddBijouType: (t) => setState((s) => ({ ...s, addBijouType: t, addBijouTypeTouched: true })),
    setAddAccessoireType: (t) => setState((s) => ({ ...s, addAccessoireType: t, addAccessoireTypeTouched: true })),
    setAddSubtype: (t) => setState((s) => ({ ...s, addSubtype: t, addSubtypeTouched: true })),
    saveItem: () =>
      setState((s) => {
        // Contrainte produit : pas de sauvegarde tant que la saison n'est pas confirmée,
        // ni tant que le type de chaussure n'est pas choisi pour cette catégorie (R-B6),
        // ni tant que le sous-type n'est pas choisi pour veste/manteau (SUBTYPE_REQUIRED).
        if (!s.addSeason) return s;
        if (s.addCat === "chaussures" && !s.addShoeType) return s;
        if (SUBTYPE_REQUIRED.includes(s.addCat) && !s.addSubtype) return s;
        const item: Item = {
          id: Math.max(0, ...s.items.map((i) => i.id)) + 1,
          name: (s.addName || "").trim() || "Nouvelle pièce",
          brand: (s.addBrand || "").trim() || undefined,
          cat: s.addCat,
          color: s.addColor.name,
          hex: s.addColor.hex,
          size: s.addSize,
          season: s.addSeason,
          occasion: s.addOccasion.length ? s.addOccasion : undefined,
          shoeType: s.addCat === "chaussures" ? s.addShoeType || undefined : undefined,
          matiere: s.addMatiere || undefined,
          coupe: s.addCoupe || undefined,
          sacType: s.addCat === "sac" ? s.addSacType || undefined : undefined,
          bijouType: s.addCat === "bijou" ? s.addBijouType || undefined : undefined,
          accessoireType: s.addCat === "accessoire" ? s.addAccessoireType || undefined : undefined,
          subtype: s.addSubtype || undefined,
          photoUrl: s.addPhotoUrl || undefined,
          worn: null,
        };
        return {
          ...s,
          items: [item, ...s.items],
          suggestedExcluded: s.replacingId ? [...s.suggestedExcluded, s.replacingId] : s.suggestedExcluded,
          replacingId: null,
          addName: "",
          addBrand: "",
          addPhotoUrl: null,
          addMatiere: null,
          addCoupe: null,
          addMatiereTouched: false,
          addCoupeTouched: false,
          addSacType: null,
          addBijouType: null,
          addAccessoireType: null,
          addSacTypeTouched: false,
          addBijouTypeTouched: false,
          addAccessoireTypeTouched: false,
          addSubtype: null,
          addSubtypeTouched: false,
          addSeason: null,
          addShoeType: null,
          addOccasion: ["travail_formel"],
          screen: "wardrobe",
        };
      }),

    goPremium: () => setState(toPremiumScreen),
    subscribe: () => setState((s) => ({ ...s, isPremium: true, screen: s.premiumReturn || "home" })),
    premiumBack: () => setState((s) => ({ ...s, screen: s.premiumReturn || "home" })),

    setOccasion: (o) => setState((s) => regen({ ...s, occasion: o, occasionManual: true })),
    setWorkMode: (m) => setState((s) => regen({ ...s, workMode: m })),
    setTravelMode: (m) => setState((s) => regen({ ...s, travelMode: m, travelTipDismissed: false })),
    dismissTravelTip: () => setState((s) => ({ ...s, travelTipDismissed: true })),
    setDateContext: (c) => setState((s) => regen({ ...s, dateContext: c })),
    setCapsuleSeason: (s) => setState((st) => ({ ...st, capsuleSeason: s })),
    swapPiece: (id, cat) =>
      setState((s) => {
        const outfitItems = s.outfit
          .map((oid) => findPiece(poolRef.current, oid))
          .filter((it): it is Item => Boolean(it));
        return {
          ...s,
          outfit: swapOutfitPiece(outfitItems, poolRef.current, id, cat, s.occasion || "all", s.workMode, s.dateContext, weatherRef.current),
          dismissedSuggestions: [],
        };
      }),
    regenOutfit: () => setState(regen),
    dismissOutfitSuggestion: (key) =>
      setState((s) => ({ ...s, dismissedSuggestions: [...s.dismissedSuggestions, key] })),
    wearOutfitToday: () =>
      setState((s) => {
        // R-B9 — défense en profondeur : une veste/un manteau seul sans base ne peut pas être validé comme porté.
        const outfitPieces = s.outfit.map((id) => findPiece(poolRef.current, id)).filter((it): it is Item => Boolean(it));
        if (violatesOuterwearRule(outfitPieces)) return s;
        return {
          ...s,
          items: s.items.map((it) => (s.outfit.includes(it.id) ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
          outfitValidated: true,
          lookCount: s.lookCount + 1,
          history: [
            { id: "h" + Date.now(), ts: Date.now(), pieceIds: [...s.outfit], occasion: s.occasion || "all" },
            ...s.history,
          ],
        };
      }),
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

    goCreateLook: () =>
      setState((s) => ({
        ...s,
        lookDraftIds: [],
        lookDraftName: "",
        lookDraftOccasion: "all",
        lookDraftDismissed: [],
        screen: "createLook",
      })),
    cancelCreateLook: () => go("wardrobe"),
    toggleLookDraftPiece: (id) =>
      setState((s) => {
        const piece = s.items.find((i) => i.id === id);
        if (!piece) return s;
        if (s.lookDraftIds.includes(id)) {
          return { ...s, lookDraftIds: s.lookDraftIds.filter((x) => x !== id), lookDraftDismissed: [] };
        }
        // Picker "Créer un look" (recette 13/08/2026) : Bijoux se sélectionne
        // à volonté (plusieurs pièces simultanées, sans plafond) ; hauts/pulls
        // gardent l'exception layering existante (2 pièces max, éviction FIFO
        // au-delà) ; toute autre catégorie reste à sélection unique — choisir
        // une nouvelle pièce y remplace celle déjà retenue dans la même catégorie.
        let next: number[];
        if (piece.cat === "bijou") {
          next = [...s.lookDraftIds, id];
        } else if (piece.cat === "haut" || piece.cat === "pull") {
          const layerIds = s.lookDraftIds.filter((x) => {
            const it = s.items.find((i) => i.id === x);
            return it && (it.cat === "haut" || it.cat === "pull");
          });
          const trimmed = layerIds.length >= 2 ? s.lookDraftIds.filter((x) => x !== layerIds[0]) : s.lookDraftIds;
          next = [...trimmed, id];
        } else {
          next = [...s.lookDraftIds.filter((x) => s.items.find((i) => i.id === x)?.cat !== piece.cat), id];
        }
        return { ...s, lookDraftIds: next, lookDraftDismissed: [] };
      }),
    setLookDraftName: (v) => setState((s) => ({ ...s, lookDraftName: v })),
    setLookDraftOccasion: (o) =>
      setState((s) => ({ ...s, lookDraftOccasion: s.lookDraftOccasion === o ? "all" : o, lookDraftDismissed: [] })),
    dismissLookDraftSuggestion: (key) =>
      setState((s) => ({ ...s, lookDraftDismissed: [...s.lookDraftDismissed, key] })),
    saveLook: () =>
      setState((s) => {
        // Un look doit rassembler au moins 2 pièces pour avoir du sens.
        if (s.lookDraftIds.length < 2) return s;
        // R-B9 — seule règle bloquante : une veste/un manteau seul sans pièce de base ne peut pas être enregistré.
        const draftPieces = s.lookDraftIds.map((id) => s.items.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
        if (violatesOuterwearRule(draftPieces)) return s;
        const now = new Date();
        const defaultName =
          "Look du " + now.getDate().toString().padStart(2, "0") + "/" + (now.getMonth() + 1).toString().padStart(2, "0");
        const look: SavedLook = {
          id: "look" + Date.now(),
          name: s.lookDraftName.trim() || defaultName,
          pieceIds: [...s.lookDraftIds],
          createdAt: Date.now(),
          occasion: s.lookDraftOccasion !== "all" ? s.lookDraftOccasion : undefined,
        };
        return {
          ...s,
          savedLooks: [look, ...s.savedLooks],
          lookDraftIds: [],
          lookDraftName: "",
          lookDraftOccasion: "all",
          lookDraftDismissed: [],
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
    geoCity,
    geoLoading,
    geoIsLive,
    defaultCapsule,
    wardrobePool,
    vestiairePool,
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
