"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { isSupabaseConfigured } from "./supabase";
import { CATALOG, type CatalogItem } from "./catalog";
import { computeDefaultCapsule, currentSeasonKey, weatherSeasonBucket } from "./capsule";
import { fetchVestiaireUniversel } from "./vestiaire";
import {
  analyzeDressingPhoto,
  deleteDressingItem,
  fetchDressingItems,
  fetchOutfitHistory,
  insertDressingItem,
  insertOutfitHistoryEntry,
  updateDressingItemWorn,
  uploadDressingPhoto,
} from "./dressing";
import { ensureCatalogImage } from "./catalogImages";
import { fetchWeatherByCoords, getBrowserPosition } from "./weather";
import { CATS, CITIES, PALETTE, PALETTE_BIJOU, SUBTYPE_REQUIRED, type Weather } from "./data";
import { generateOutfitWithFallback, swapOutfitPiece, violatesOuterwearRule } from "./logic";
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
  HistoryEntry,
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
export function defaultOccasionToday(prefs: ProfilePrefs): OccasionKey {
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
    profileSetupStep: "genre",
    profileSetupFromEdit: false,
    profileSetupReturn: "profileEdit",
    onbStep: 0,
    authName: "",
    activeId: 0,
    activeSuggested: false,
    pieceReturn: "wardrobe",
    itemOutfitsReturn: "capsule",
    catFilter: "all",
    addName: "",
    addBrand: "",
    addCat: "haut",
    addCatTouched: false,
    addColor: { name: "Blanc cassé", hex: "#EDE4D6" },
    addColorTouched: false,
    addSize: null,
    addPhotoUrl: null,
    addPhotoUploading: false,
    addPhotoAnalyzing: false,
    // Pas de valeur par défaut : la saison doit être confirmée par l'utilisateur.
    addSeason: null,
    addOccasion: ["travail_formel"],
    addShoeType: null,
    addShoeTypeTouched: false,
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
    outfitFormalityDowngraded: false,
    outfitNoCompleteOutfit: false,
    outfitFailureReason: null,
    outfitValidated: false,
    dressingError: null,
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
  /**
   * Ouvre le questionnaire profil à une étape donnée, identifiée par sa clé
   * (ex. "taille") plutôt qu'un index numérique — le nombre et l'ordre des
   * étapes ne sont plus fixes depuis la Tâche 4 (étape Morphologie
   * conditionnée au genre), un index absolu deviendrait rapidement faux.
   * fromEdit : retour vers l'édition à la fin.
   */
  goProfileSetup: (stepKey?: string, fromEdit?: boolean) => void;
  openAdd: () => void;
  openAddBag: () => void;
  addBack: () => void;
  setAuthName: (v: string) => void;
  onbBack: () => void;
  onbNext: () => void;
  openItem: (id: number, suggested?: boolean) => void;
  /** Ouvre le module "Comment porter cette pièce ?" pour une pièce de la capsule. */
  openItemOutfits: (id: number) => void;
  /** Affiche une combinaison choisie depuis ce module sur l'écran Tenue — jamais un enregistrement automatique comme portée. */
  viewItemOutfit: (ids: number[], occasion: OccasionKey) => void;
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
  /** Aperçu local immédiat puis upload réel vers Supabase Storage (bucket dressing-photos) — remplace addPhotoUrl par l'URL définitive une fois terminé. */
  uploadAddPhoto: (file: File) => void;
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
  /** Ferme le bandeau de diagnostic temporaire dressingError (correctif 22/08/2026). */
  dismissDressingError: () => void;
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
  /** Déclenche la génération du visuel d'une pièce du catalogue si elle n'en a pas encore (sans effet sinon). */
  requestCatalogImage: (itemId: number) => void;
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
  const { profile, ready, userId } = useAuth();
  const [state, setState] = useState<AppState>(buildInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Bandeau de diagnostic temporaire (correctif 22/08/2026, signalé : pièces
  // ajoutées au dressing non conservées, silencieusement jusqu'ici) — logue
  // en console ET affiche le message dans l'UI, utile sur mobile où la
  // console développeur n'est pas accessible. À retirer une fois la cause
  // du problème de persistance identifiée et corrigée.
  const reportDressingError = (context: string, err: unknown) => {
    console.error("[dressing] échec " + context, err);
    const message = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
    setState((s) => ({ ...s, dressingError: context + " : " + message }));
  };

  // Dressing réel + historique (Supabase) — remplace le state []/[] initial
  // dès que la session est prête. En mode démo (ou déconnecté), rien à
  // charger : le state en mémoire reste la seule source, comme aujourd'hui.
  // dressingLoaded gate l'effet "première tenue" ci-dessous : sans ça, la
  // toute première génération se ferait sur un wardrobePool vide alors que
  // des pièces existent en base, le temps que la requête réponde.
  const [dressingLoaded, setDressingLoaded] = useState(false);
  useEffect(() => {
    if (!ready) return;
    if (!isSupabaseConfigured || !userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDressingLoaded(true);
      return;
    }
    let cancelled = false;
    Promise.all([fetchDressingItems(userId), fetchOutfitHistory(userId)]).then(([items, history]) => {
      if (cancelled) return;
      setState((s) => ({ ...s, items, history }));
      setDressingLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, userId]);

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

  // Déclenche la génération du visuel d'une pièce du catalogue quand elle
  // n'en a pas encore (recette 18/08/2026, gestion automatique des images
  // produit) — optimiste (image_status passe à "generating" immédiatement
  // pour l'affichage) puis met à jour vestiairePool à la réponse de l'Edge
  // Function ; jamais deux appels pour le même id (cf. ensureCatalogImage).
  const requestCatalogImage = (itemId: number) => {
    let alreadyHandled = false;
    setVestiairePool((pool) => {
      const idx = pool.findIndex((it) => it.id === itemId);
      const current = pool[idx];
      const hasReadyImage = current?.imageUrl && current.imageStatus === "ready";
      if (idx === -1 || hasReadyImage || current.imageStatus === "generating") {
        alreadyHandled = true;
        return pool;
      }
      const next = [...pool];
      next[idx] = { ...next[idx], imageStatus: "generating" };
      return next;
    });
    if (alreadyHandled) return;
    ensureCatalogImage(itemId).then((url) => {
      setVestiairePool((pool) => {
        const idx = pool.findIndex((it) => it.id === itemId);
        if (idx === -1) return pool;
        const next = [...pool];
        next[idx] = url
          ? { ...next[idx], imageUrl: url, imageStatus: "ready", imageSource: "generated" }
          : { ...next[idx], imageStatus: "error" };
        return next;
      });
    });
  };

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
    const result = generateOutfitWithFallback(
      poolRef.current,
      weatherRef.current,
      s.occasion || "all",
      s.workMode,
      s.dateContext,
      paletteHexes(profile),
      profile.gender
    );
    // Tracking (repli progressif de formalité, section 8 du brief 21/08/2026)
    // — pas de pipeline analytics dans ce prototype : log console en
    // attendant, pour repérer les couples occasion×style×genre×saison qui
    // déclenchent fréquemment un repli et signalent un trou de couverture
    // catalogue (le repli est une sécurité produit, pas un remplacement de
    // l'enrichissement du catalogue).
    if (result.formalityDowngraded || result.noCompleteOutfit) {
      console.info("[formality-fallback]", {
        occasion: s.occasion,
        subOccasion: s.occasion === "date" ? s.dateContext : s.occasion === "travail_formel" ? s.workMode : null,
        styles: profile.styles,
        genre: profile.gender,
        saison: currentSeasonKey(),
        requestedFormality: result.requestedFormality,
        resolvedFormality: result.resolvedFormality,
        levelsDropped: result.requestedFormality - result.resolvedFormality,
        noCompleteOutfit: result.noCompleteOutfit,
      });
    }
    return {
      ...s,
      outfit: result.ids,
      outfitMissingCats: result.missingCats,
      outfitFormalityDowngraded: result.formalityDowngraded,
      outfitNoCompleteOutfit: result.noCompleteOutfit,
      outfitFailureReason: result.reason ?? null,
      outfitValidated: false,
      dismissedSuggestions: [],
    };
  };

  // Occasion par défaut du jour (recette 13/08/2026) — calculée une seule
  // fois, tant qu'aucune tenue n'a encore été générée et que l'utilisatrice
  // n'a jamais choisi d'occasion elle-même cette session, et appliquée
  // avant génération pour que la card correspondante apparaisse déjà cochée
  // dans le sélecteur (précision 13/08/2026 : jamais juste une valeur
  // interne sans retour visuel) — toujours remplaçable ensuite via les
  // chips d'occasion. Factorisé pour rester identique quel que soit le
  // déclencheur de la toute première génération (goTenues ci-dessous, ou
  // l'effet "première tenue" indépendant de l'écran affiché).
  const withDefaultOccasion = (s: AppState): AppState =>
    s.occasionManual ? s : { ...s, occasion: defaultOccasionToday(profile.prefs) };

  // Première tenue : dès que le profil est chargé (la capsule par défaut en
  // dépend) ET que la géolocalisation a fini de se résoudre (succès, échec
  // ou désactivée) — jamais avant, sinon la toute première tenue générée
  // s'appuierait sur une météo de repli qui ne serait plus jamais
  // régénérée automatiquement par la suite (recette 17/08/2026). Ce
  // déclenchement ne dépend pas de l'écran affiché (la redirection post-
  // connexion mène désormais à Accueil, pas à Tenue) : sans
  // withDefaultOccasion ici, l'occasion resterait sur "all" et aucune card
  // n'apparaîtrait cochée à l'ouverture de Tenue.
  useEffect(() => {
    if (ready && dressingLoaded && !geoLoading && !stateRef.current.outfit.length) {
      setState((s) => regen(withDefaultOccasion(s)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dressingLoaded, geoLoading, defaultCapsule]);

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
        const next: AppState = { ...s, screen: "tenues" };
        return next.outfit.length ? next : regen(withDefaultOccasion(next));
      }),
    goHistory: () => go("history"),
    goNeverWorn: () => go("neverworn"),
    goProfile: () => setState((s) => ({ ...s, profileReturn: s.screen === "profile" ? s.profileReturn : s.screen, screen: "profile" })),
    goProfileEdit: () => go("profileEdit"),
    goLegal: () => setState((s) => ({ ...s, legalReturn: s.screen === "legal" ? s.legalReturn : s.screen, screen: "legal" })),
    backFromLegal: () => setState((s) => ({ ...s, screen: s.legalReturn || "profile" })),
    goLogin: () => go("login"),
    goProfileSetup: (stepKey = "genre", fromEdit = false) =>
      setState((s) => ({
        ...s,
        screen: "profileSetup",
        profileSetupStep: stepKey,
        profileSetupFromEdit: fromEdit,
        profileSetupReturn: s.screen,
      })),
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
    openItemOutfits: (id) =>
      setState((s) => ({ ...s, activeId: id, activeSuggested: true, itemOutfitsReturn: s.screen, screen: "itemOutfits" })),
    // Affiche la combinaison choisie sur l'écran Tenue (recette 19/08/2026) :
    // conserve l'occasion correspondante, jamais d'enregistrement comme
    // portée ni de remplacement automatique en dehors de ce clic explicite.
    viewItemOutfit: (ids, occasion) =>
      setState((s) => ({
        ...s,
        outfit: ids,
        outfitMissingCats: [],
        outfitFormalityDowngraded: false,
        outfitNoCompleteOutfit: false,
        outfitFailureReason: null,
        outfitValidated: false,
        occasion,
        occasionManual: true,
        dismissedSuggestions: [],
        screen: "tenues",
      })),
    removeActive: () => {
      // Correctif 22/08/2026 (même bug que saveItem) : lit stateRef.current
      // directement plutôt qu'une variable remplie par l'updater setState,
      // dont l'exécution n'est pas garantie synchrone.
      const s = stateRef.current;
      if (s.activeSuggested) {
        setState((st) => ({ ...st, suggestedExcluded: [...st.suggestedExcluded, st.activeId], screen: st.pieceReturn }));
        return;
      }
      const deletedId = s.activeId;
      setState((st) => ({ ...st, items: st.items.filter((it) => it.id !== deletedId), screen: st.pieceReturn }));
      if (isSupabaseConfigured && userId) {
        // Suppression best-effort : la pièce reste retirée localement même en cas d'échec réseau.
        deleteDressingItem(deletedId).catch((err) => reportDressingError("deleteDressingItem", err));
      }
    },

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
          addCatTouched: true,
          addSize: null,
          addShoeType: null,
          addCoupe: k === "chaussures" ? null : s.addCoupe,
          addColor,
          addSubtype: detectSubtype(k, s.addName),
          addSubtypeTouched: false,
        };
      }),
    setAddColor: (c) => setState((s) => ({ ...s, addColor: c, addColorTouched: true })),
    setAddSize: (v) => setState((s) => ({ ...s, addSize: v })),
    setAddPhoto: (v) => setState((s) => ({ ...s, addPhotoUrl: v })),
    uploadAddPhoto: (file) => {
      // Aperçu local instantané (URL.createObjectURL) pendant l'upload —
      // jamais ce qui sera persisté au final (cf. photoUrl côté
      // insertDressingItem, uniquement rempli une fois l'URL définitive
      // obtenue ci-dessous).
      setState((s) => ({ ...s, addPhotoUrl: URL.createObjectURL(file), addPhotoUploading: true }));
      if (!isSupabaseConfigured || !userId) {
        // Mode démo : pas de Storage à interroger, l'aperçu local reste tel quel.
        setState((s) => ({ ...s, addPhotoUploading: false }));
        return;
      }
      uploadDressingPhoto(userId, file)
        .then((url) => {
          setState((s) => ({ ...s, addPhotoUrl: url, addPhotoUploading: false, addPhotoAnalyzing: true }));
          // Pré-remplissage par photo (recette 22/08/2026, "comment faire pour
          // que l'article ajouté soit pré rempli selon les informations de la
          // photo") — jamais bloquant, jamais imposé : chaque champ n'est
          // appliqué que si l'utilisatrice ne l'a pas déjà modifié elle-même
          // (mêmes drapeaux *Touched que la détection par nom, cf.
          // setAddName ci-dessus). Sous-type/type de chaussure/sac/bijou/
          // accessoire ne sont appliqués que si la catégorie finalement
          // retenue est bien celle que l'IA a analysée (catMatches) — sinon
          // une catégorie choisie manuellement entre-temps hériterait d'un
          // sous-type d'une autre catégorie (ex. "Bermuda" sur une "veste").
          analyzeDressingPhoto(url)
            .then((a) => {
              setState((s) => {
                // La photo a déjà changé pendant l'analyse (nouvelle prise/
                // import) : suggestion périmée, jamais appliquée à la nouvelle.
                if (s.addPhotoUrl !== url) return { ...s, addPhotoAnalyzing: false };
                const finalCat = s.addCatTouched ? s.addCat : a.cat ?? s.addCat;
                const catMatches = Boolean(a.cat) && a.cat === finalCat;
                return {
                  ...s,
                  addPhotoAnalyzing: false,
                  addCat: finalCat,
                  addColor: s.addColorTouched || !a.colorName || !a.colorHex ? s.addColor : { name: a.colorName, hex: a.colorHex },
                  addMatiere: s.addMatiereTouched ? s.addMatiere : a.matiere ?? s.addMatiere,
                  addSubtype: s.addSubtypeTouched || !catMatches ? s.addSubtype : a.subtype ?? s.addSubtype,
                  addShoeType: s.addShoeTypeTouched || !catMatches ? s.addShoeType : a.shoeType ?? s.addShoeType,
                  addSacType: s.addSacTypeTouched || !catMatches ? s.addSacType : a.sacType ?? s.addSacType,
                  addBijouType: s.addBijouTypeTouched || !catMatches ? s.addBijouType : a.bijouType ?? s.addBijouType,
                  addAccessoireType:
                    s.addAccessoireTypeTouched || !catMatches ? s.addAccessoireType : a.accessoireType ?? s.addAccessoireType,
                };
              });
            })
            .catch(() => setState((s) => ({ ...s, addPhotoAnalyzing: false })));
        })
        .catch((err) => {
          // Échec : jamais persister l'aperçu blob (invalide au rechargement,
          // cf. bug signalé) — repasse à "pas de photo" plutôt qu'une photo cassée.
          setState((s) => ({ ...s, addPhotoUrl: null, addPhotoUploading: false }));
          reportDressingError("uploadDressingPhoto", err);
        });
    },
    setAddSeason: (season) => setState((s) => ({ ...s, addSeason: season })),
    setAddOccasion: (o) =>
      setState((s) => ({
        ...s,
        addOccasion: s.addOccasion.includes(o) ? s.addOccasion.filter((x) => x !== o) : [...s.addOccasion, o],
      })),
    setAddShoeType: (t) => setState((s) => ({ ...s, addShoeType: t, addShoeTypeTouched: true })),
    setAddMatiere: (m) => setState((s) => ({ ...s, addMatiere: m, addMatiereTouched: true })),
    setAddCoupe: (c) => setState((s) => ({ ...s, addCoupe: c, addCoupeTouched: true })),
    setAddSacType: (t) => setState((s) => ({ ...s, addSacType: t, addSacTypeTouched: true })),
    setAddBijouType: (t) => setState((s) => ({ ...s, addBijouType: t, addBijouTypeTouched: true })),
    setAddAccessoireType: (t) => setState((s) => ({ ...s, addAccessoireType: t, addAccessoireTypeTouched: true })),
    setAddSubtype: (t) => setState((s) => ({ ...s, addSubtype: t, addSubtypeTouched: true })),
    saveItem: () => {
      // Correctif 22/08/2026 (signalé : pièces ajoutées jamais conservées,
      // même sans recharger) — l'ancienne version lisait une variable
      // "pending" censée être remplie PAR l'updater passé à setState, juste
      // après l'appel à setState : React ne garantit pas que l'updater ait
      // déjà tourné à ce moment précis (traitement différé/batché), donc
      // "pending" restait null et insertDressingItem n'était jamais appelée
      // — aucune requête réseau, aucune erreur, la pièce disparaissait
      // silencieusement alors que le formulaire se réinitialisait quand
      // même (d'où le retour à l'écran Dressing qui donnait l'illusion que
      // l'ajout avait fonctionné). Lit maintenant stateRef.current
      // directement (même pattern que poolRef/weatherRef) : aucune
      // dépendance au timing de setState.
      const s = stateRef.current;
      // Contrainte produit : pas de sauvegarde tant que la saison n'est pas confirmée,
      // ni tant que le type de chaussure n'est pas choisi pour cette catégorie (R-B6),
      // ni tant que le sous-type n'est pas choisi pour veste/manteau (SUBTYPE_REQUIRED).
      if (!s.addSeason) return;
      if (s.addCat === "chaussures" && !s.addShoeType) return;
      if (SUBTYPE_REQUIRED.includes(s.addCat) && !s.addSubtype) return;
      // Jamais persister l'aperçu local (blob:) : attendre la fin de l'upload
      // Storage plutôt que de sauvegarder une URL qui redeviendrait invalide.
      if (s.addPhotoUploading) return;
      const base: Omit<Item, "id"> = {
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
      const resetFields = (st: AppState): AppState => ({
        ...st,
        suggestedExcluded: st.replacingId ? [...st.suggestedExcluded, st.replacingId] : st.suggestedExcluded,
        replacingId: null,
        addName: "",
        addBrand: "",
        addPhotoUrl: null,
        addPhotoUploading: false,
        addPhotoAnalyzing: false,
        addCatTouched: false,
        addColorTouched: false,
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
        addShoeTypeTouched: false,
        addOccasion: ["travail_formel"],
        screen: "wardrobe",
      });
      if (isSupabaseConfigured && userId) {
        setState(resetFields);
        insertDressingItem(userId, base)
          .then((item) => setState((st) => ({ ...st, items: [item, ...st.items] })))
          .catch((err) => {
            // Échec réseau/RLS/contrainte : la pièce n'apparaît pas dans le dressing
            // plutôt que d'y exister avec un id local qui ne correspondrait à aucune
            // ligne en base — mais loguée et affichée (reportDressingError).
            reportDressingError("insertDressingItem", err);
          });
        return;
      }
      setState((st) => {
        const item: Item = { id: Math.max(0, ...st.items.map((i) => i.id)) + 1, ...base };
        return { ...resetFields(st), items: [item, ...st.items] };
      });
    },
    dismissDressingError: () => setState((s) => ({ ...s, dressingError: null })),

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
    requestCatalogImage,
    // "Régénérer" = proposer une autre combinaison, jamais générer de
    // nouveaux visuels (recette 19/08/2026) : conserve météo/occasion/
    // présentiel-télétravail/capsule/profil (déjà les seules entrées de
    // regen()), et essaie plusieurs tirages pour éviter de retomber tout de
    // suite sur exactement la même combinaison (comparaison par ensemble
    // d'ids, ordre indifférent) — sans garantie absolue si peu d'options
    // existent, jamais bloquant.
    regenOutfit: () =>
      setState((s) => {
        const prevIds = new Set(s.outfit);
        let next = regen(s);
        let attempts = 0;
        const sameAsBefore = (ids: number[]) => ids.length === prevIds.size && ids.every((id) => prevIds.has(id));
        while (attempts < 5 && sameAsBefore(next.outfit)) {
          next = regen(s);
          attempts++;
        }
        return next;
      }),
    dismissOutfitSuggestion: (key) =>
      setState((s) => ({ ...s, dismissedSuggestions: [...s.dismissedSuggestions, key] })),
    wearOutfitToday: () => {
      // Correctif 22/08/2026 (même bug que saveItem, cf. son commentaire) :
      // tout est lu depuis stateRef.current avant l'appel à setState, jamais
      // depuis une variable remplie par l'updater lui-même.
      const s = stateRef.current;
      // Garde anti double-clic (recette 19/08/2026) : une fois déjà
      // validée, un second appel n'enregistre jamais une deuxième entrée.
      if (s.outfitValidated) return;
      // R-B9 — défense en profondeur : une veste/un manteau seul sans base ne peut pas être validé comme porté.
      const outfitPieces = s.outfit.map((id) => findPiece(poolRef.current, id)).filter((it): it is Item => Boolean(it));
      if (violatesOuterwearRule(outfitPieces)) return;
      const wornUpdates = s.items
        .filter((it) => s.outfit.includes(it.id))
        .map((it) => ({ id: it.id, worn: 0, wornPrev: it.worn }));
      const entry: HistoryEntry = {
        id: "h" + Date.now(),
        ts: Date.now(),
        pieceIds: [...s.outfit],
        occasion: s.occasion || "all",
        temp: weatherRef.current.temp,
        weatherLabel: weatherRef.current.label,
      };
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (st.outfit.includes(it.id) ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        outfitValidated: true,
        lookCount: st.lookCount + 1,
        history: [entry, ...st.history],
      }));
      if (isSupabaseConfigured && userId) {
        // Persistance best-effort, en parallèle du state déjà mis à jour ci-dessus :
        // un échec réseau ne doit jamais bloquer la validation de la tenue à l'écran.
        if (wornUpdates.length) updateDressingItemWorn(wornUpdates).catch((err) => reportDressingError("updateDressingItemWorn", err));
        insertOutfitHistoryEntry(userId, entry).catch((err) => reportDressingError("insertOutfitHistoryEntry", err));
      }
    },
    wearPieceToday: (id) => {
      const s = stateRef.current;
      const target = s.items.find((it) => it.id === id);
      const wornUpdate = target ? { id: target.id, worn: 0, wornPrev: target.worn } : null;
      const entry: HistoryEntry = { id: "h" + Date.now(), ts: Date.now(), pieceIds: [id], occasion: s.occasion || "all" };
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (it.id === id ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        lookCount: st.lookCount + 1,
        history: [entry, ...st.history],
      }));
      if (isSupabaseConfigured && userId) {
        if (wornUpdate) updateDressingItemWorn([wornUpdate]).catch((err) => reportDressingError("updateDressingItemWorn", err));
        insertOutfitHistoryEntry(userId, entry).catch((err) => reportDressingError("insertOutfitHistoryEntry", err));
      }
    },
    wearActiveToday: () => {
      const s = stateRef.current;
      const target = s.items.find((it) => it.id === s.activeId);
      const wornUpdate = target ? { id: target.id, worn: 0, wornPrev: target.worn } : null;
      const entry: HistoryEntry = { id: "h" + Date.now(), ts: Date.now(), pieceIds: [s.activeId], occasion: s.occasion || "all" };
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (it.id === st.activeId ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        lookCount: st.lookCount + 1,
        history: [entry, ...st.history],
      }));
      if (isSupabaseConfigured && userId) {
        if (wornUpdate) updateDressingItemWorn([wornUpdate]).catch((err) => reportDressingError("updateDressingItemWorn", err));
        insertOutfitHistoryEntry(userId, entry).catch((err) => reportDressingError("insertOutfitHistoryEntry", err));
      }
    },
    correctPiece: (id) => {
      const s = stateRef.current;
      const target = s.items.find((it) => it.id === id);
      const worn = target ? (target.wornPrev === undefined ? null : target.wornPrev) : null;
      const wornUpdate = target ? { id, worn } : null;
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (it.id === id ? { ...it, worn } : it)),
        lookCount: Math.max(0, st.lookCount - 1),
      }));
      if (wornUpdate && isSupabaseConfigured && userId) updateDressingItemWorn([wornUpdate]).catch((err) => reportDressingError("updateDressingItemWorn", err));
    },
    correctActive: () => {
      const s = stateRef.current;
      const target = s.items.find((it) => it.id === s.activeId);
      const worn = target ? (target.wornPrev === undefined ? null : target.wornPrev) : null;
      const wornUpdate = target ? { id: s.activeId, worn } : null;
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (it.id === st.activeId ? { ...it, worn } : it)),
        lookCount: Math.max(0, st.lookCount - 1),
      }));
      if (wornUpdate && isSupabaseConfigured && userId) updateDressingItemWorn([wornUpdate]).catch((err) => reportDressingError("updateDressingItemWorn", err));
    },
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
    wearLookToday: (id) => {
      // Hors périmètre dressing_items/outfit_history (système "Mes Looks") —
      // seule la cohérence de worn est maintenue côté base.
      const s = stateRef.current;
      const look = s.savedLooks.find((l) => l.id === id);
      if (!look) return;
      const wornUpdates = s.items
        .filter((it) => look.pieceIds.includes(it.id))
        .map((it) => ({ id: it.id, worn: 0, wornPrev: it.worn }));
      setState((st) => ({
        ...st,
        items: st.items.map((it) => (look.pieceIds.includes(it.id) ? { ...it, wornPrev: it.worn, worn: 0 } : it)),
        lookCount: st.lookCount + 1,
        history: [
          { id: "h" + Date.now(), ts: Date.now(), pieceIds: [...look.pieceIds], occasion: "all" },
          ...st.history,
        ],
      }));
      if (wornUpdates.length && isSupabaseConfigured && userId) updateDressingItemWorn(wornUpdates).catch((err) => reportDressingError("updateDressingItemWorn", err));
    },
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
