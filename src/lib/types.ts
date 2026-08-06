export type CategoryKey = "haut" | "bas" | "robe" | "chaussures" | "accessoire";

export type Season = "Printemps" | "Été" | "Automne" | "Hiver" | "Toutes saisons";

export type OccasionKey =
  | "all"
  | "travail"
  | "weekend"
  | "sport"
  | "soiree"
  | "ceremonie"
  | "voyage";

export interface Item {
  id: number;
  name: string;
  cat: CategoryKey;
  color: string;
  hex: string;
  season: Season;
  /** Days since last worn. null = never worn. 0 = worn today. */
  worn: number | null;
  /** Value of `worn` before the most recent "worn today" action, for Corriger/undo. */
  wornPrev?: number | null;
}

export interface City {
  city: string;
  temp: number;
  label: string;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  pieceIds: number[];
  occasion: OccasionKey;
}

/** Capsule membership per season: season label -> item ids. */
export type CapsulesBySeason = Record<string, number[]>;

export interface AppState {
  items: Item[];
  capsules: CapsulesBySeason;
  activeSeason: string;
  seasonPickerOpen: boolean;

  screen: Screen;
  premiumReturn: Screen;
  onbStep: number;
  authName: string;
  activeId: number;

  catFilter: CategoryKey | "all";
  seasonFilter: Season | "all";

  addName: string;
  addCat: CategoryKey;
  addColor: { name: string; hex: string };
  addSeason: Season;

  capInfoOpen: boolean;
  geoIndex: number;

  outfit: number[];
  outfitValidated: boolean;
  lockedPieces: number[];
  occasion: OccasionKey;

  lookCount: number;
  isPremium: boolean;

  history: HistoryEntry[];
}

export type Screen =
  | "welcome"
  | "onboarding"
  | "auth"
  | "wardrobe"
  | "piece"
  | "add"
  | "capsule"
  | "tenues"
  | "premium"
  | "history"
  | "neverworn"
  | "profileSetup"
  | "profile";
