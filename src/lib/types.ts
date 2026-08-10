export type CategoryKey =
  | "haut"
  | "bas"
  | "robe"
  | "manteau"
  | "pull"
  | "combinaison"
  | "jupe"
  | "chaussures"
  | "sac"
  | "bijou"
  | "accessoire";

export type Season = "Printemps / Été" | "Automne / Hiver" | "Toutes saisons";

export type OccasionKey =
  | "all"
  | "quotidien"
  | "travail_formel"
  | "entretien"
  | "date"
  | "soiree"
  | "evenement_pro"
  | "evenement_perso"
  | "sport"
  | "voyage"
  | "meteo"
  | "cocooning";

export type ShoeType = "Basket / sneaker" | "Escarpin" | "Mocassin" | "Botte / bottine" | "Sandale";

export type Matiere = "Coton" | "Lin" | "Laine" | "Soie" | "Cuir" | "Denim" | "Synthétique";
export type Coupe = "Serré" | "Ajusté" | "Ample";

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
  brand?: string;
  size?: string | null;
  /** Occasion principale déclarée à l'ajout. */
  occasion?: OccasionKey;
  /** Type de chaussure — obligatoire si cat === "chaussures" (nécessaire à R-B6). */
  shoeType?: ShoeType;
  /** Matière et coupe — pré-suggérées à la saisie du nom, jamais bloquantes. */
  matiere?: Matiere;
  coupe?: Coupe;
}

export interface City {
  city: string;
  country: string;
  temp: number;
  label: string;
}

export interface HistoryEntry {
  id: string;
  ts: number;
  pieceIds: number[];
  occasion: OccasionKey;
}

/** Look composé manuellement par l'utilisateur à partir de son dressing réel. */
export interface SavedLook {
  id: string;
  name: string;
  pieceIds: number[];
  createdAt: number;
  occasion?: OccasionKey;
}

export interface AppState {
  /** Dressing réel de l'utilisateur. Vide au départ : la capsule par défaut prend le relais. */
  items: Item[];
  /** Ids de suggestions du catalogue écartées ("Retirer" sur une pièce suggérée). */
  suggestedExcluded: number[];
  /** Id de la suggestion en cours de remplacement via l'écran Ajouter. */
  replacingId: number | null;

  screen: Screen;
  /** Écran vers lequel revenir en quittant le profil (ouvert depuis l'avatar). */
  profileReturn: Screen;
  premiumReturn: Screen;
  profileSetupStep: number;
  profileSetupFromEdit: boolean;
  onbStep: number;
  authName: string;
  activeId: number;
  /** La pièce actuellement ouverte est une suggestion du catalogue, pas une pièce réelle. */
  activeSuggested: boolean;

  catFilter: CategoryKey | "all";

  addName: string;
  addBrand: string;
  addCat: CategoryKey;
  addColor: { name: string; hex: string };
  addSize: string | null;
  /** null tant que l'utilisateur n'a pas confirmé — la sauvegarde est bloquée. */
  addSeason: Season | null;
  addOccasion: OccasionKey;
  /** Type de chaussure en cours de saisie — obligatoire si addCat === "chaussures" (R-B6). */
  addShoeType: ShoeType | null;
  /** Matière/coupe en cours de saisie — pré-suggérées au nom tant que non modifiées manuellement. */
  addMatiere: Matiere | null;
  addCoupe: Coupe | null;
  addMatiereTouched: boolean;
  addCoupeTouched: boolean;

  geoIndex: number;

  outfit: number[];
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). */
  outfitMissingCats: CategoryKey[];
  outfitValidated: boolean;
  occasion: OccasionKey;
  /** Clés des suggestions proactives (R-S12/R-S13) écartées pour la tenue affichée. */
  dismissedSuggestions: string[];

  lookCount: number;
  isPremium: boolean;

  history: HistoryEntry[];

  /** Écran « Demander un avis à un proche ». */
  opinionContact: string | null;
  opinionStatus: "sent" | null;
  opinionVia: "message" | "whatsapp" | "social" | null;

  /** Looks composés manuellement à partir du dressing réel. */
  savedLooks: SavedLook[];
  /** Pièces choisies dans l'écran de création de look, avant sauvegarde. */
  lookDraftIds: number[];
  lookDraftName: string;
  lookDraftOccasion: OccasionKey;
  /** Clés des suggestions proactives écartées pour le brouillon de look en cours. */
  lookDraftDismissed: string[];
  /** Id du look actuellement ouvert dans l'écran de détail. */
  activeLookId: string | null;
}

export type Screen =
  | "welcome"
  | "onboarding"
  | "auth"
  | "home"
  | "wardrobe"
  | "piece"
  | "add"
  | "capsule"
  | "tenues"
  | "premium"
  | "history"
  | "neverworn"
  | "profileSetup"
  | "profile"
  | "profileEdit"
  | "login"
  | "opinionShare"
  | "createLook"
  | "lookDetail";
