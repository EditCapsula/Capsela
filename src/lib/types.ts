export type CategoryKey =
  | "haut"
  | "pull"
  | "pantalon"
  | "jean"
  | "jupe"
  | "short"
  | "robe"
  | "combinaison"
  | "veste"
  | "manteau"
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
  | "festive"
  | "sport"
  | "cocooning"
  | "voyage"
  | "evenement_perso";

/** Sous-choix de l'occasion "travail_formel" — Présentiel relève le niveau de formalité minimum, Télétravail l'abaisse. */
export type WorkMode = "Présentiel" | "Télétravail";
/** Sous-choix de l'occasion "voyage" — n'affecte pas la formalité, seule la Longue distance affiche une carte conseil. */
export type TravelMode = "Court trajet" | "Longue distance";
/** Sous-choix de l'occasion "date" — seul déterminant de sa formalité, variable contrairement aux autres occasions (recette 12/08/2026). */
export type DateContext = "Restaurant / date romantique" | "Verre" | "Cinéma / balade" | "Activité" | "Soirée festive";

export type ShoeType =
  | "Baskets"
  | "Bottines"
  | "Bottes"
  | "Escarpins"
  | "Sandales"
  | "Mocassins"
  | "Ballerines"
  | "Chaussures d'intérieur";
export type SacType = "Sac à main" | "Cabas" | "Bandoulière" | "Pochette" | "Sac à dos";
export type BijouType = "Collier" | "Boucles d'oreilles" | "Bracelet" | "Bague" | "Montre";
export type AccessoireType =
  | "Ceinture"
  | "Foulard"
  | "Écharpe"
  | "Chapeau"
  | "Casquette"
  | "Lunettes"
  | "Collants"
  | "Chaussettes hautes";

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
  /** Occasions déclarées à l'ajout — plusieurs choix possibles. */
  occasion?: OccasionKey[];
  /** Type de chaussure — obligatoire si cat === "chaussures" (nécessaire à R-B6). */
  shoeType?: ShoeType;
  /** Matière et coupe — pré-suggérées à la saisie du nom, jamais bloquantes. */
  matiere?: Matiere;
  coupe?: Coupe;
  /** Sous-types — pré-suggérés à la saisie du nom, jamais bloquants. */
  sacType?: SacType;
  bijouType?: BijouType;
  accessoireType?: AccessoireType;
  /** Sous-type générique (haut, pull, bas, robe, veste, manteau...) — toujours facultatif (seul le type de chaussure est bloquant, cf. shoeType). */
  subtype?: string;
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
  /** Écran vers lequel revenir en quittant Informations légales (toujours "profile" en pratique). */
  legalReturn: Screen;
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
  /** Plusieurs choix possibles. */
  addOccasion: OccasionKey[];
  /** Type de chaussure en cours de saisie — obligatoire si addCat === "chaussures" (R-B6). */
  addShoeType: ShoeType | null;
  /** Matière/coupe/sous-types en cours de saisie — pré-suggérés au nom tant que non modifiés manuellement. */
  addMatiere: Matiere | null;
  addCoupe: Coupe | null;
  addMatiereTouched: boolean;
  addCoupeTouched: boolean;
  addSacType: SacType | null;
  addBijouType: BijouType | null;
  addAccessoireType: AccessoireType | null;
  addSacTypeTouched: boolean;
  addBijouTypeTouched: boolean;
  addAccessoireTypeTouched: boolean;
  /** Sous-type générique en cours de saisie — toujours facultatif. */
  addSubtype: string | null;
  addSubtypeTouched: boolean;

  geoIndex: number;

  outfit: number[];
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). "bas" regroupe pantalon/jean/short. */
  outfitMissingCats: (CategoryKey | "bas")[];
  outfitValidated: boolean;
  occasion: OccasionKey;
  /** Clés des suggestions proactives (R-S12/R-S13/R-S14) écartées pour la tenue affichée — indépendantes, plusieurs peuvent être affichées à la fois. */
  dismissedSuggestions: string[];
  /** Sous-choix affiché uniquement quand occasion === "travail_formel" ; affecte la formalité minimum requise. */
  workMode: WorkMode;
  /** Sous-choix affiché uniquement quand occasion === "voyage" ; n'affecte que l'affichage de la carte conseil longue distance. */
  travelMode: TravelMode;
  travelTipDismissed: boolean;
  /** Sous-choix affiché uniquement quand occasion === "date" ; seul déterminant de sa formalité. */
  dateContext: DateContext;

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
  | "legal"
  | "login"
  | "opinionShare"
  | "createLook"
  | "lookDetail";
