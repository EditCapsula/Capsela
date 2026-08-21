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

/** Saison calendaire des 4 capsules par défaut (recette 12/08/2026) — distincte de Season (saison météo d'une pièce). */
export type CapsuleSeason = "Printemps" | "Été" | "Automne" | "Hiver";

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
  | "Sandales à talons"
  | "Espadrilles"
  | "Mocassins"
  | "Ballerines"
  | "Mules"
  | "Slingbacks"
  | "Derbies"
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

/** Ton dominant de la couleur d'une pièce — alimente le rapprochement avec l'affinité de palette du profil (Tons chauds/froids/Les deux). */
export type Tons = "chauds" | "froids" | "les_deux";
/** Intensité de la couleur d'une pièce — alimente le rapprochement avec l'intensité de palette du profil. */
export type IntensiteCouleur = "douce" | "intense" | "lumineuse" | "melange";

/** Cycle de vie du visuel produit généré pour une pièce du catalogue (recette 18/08/2026). */
export type ImageStatus = "missing" | "generating" | "ready" | "error" | "invalid";
/** Provenance du visuel produit — priorité d'affichage : photo dressing réel > affiliate > generated/manual. */
export type ImageSource = "generated" | "manual" | "affiliate" | "user";

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
  /** Photo prise/importée à l'ajout — pour l'instant une URL locale (blob:), perdue au rechargement tant que l'upload vers Supabase Storage n'est pas branché. Sans photo, l'app retombe sur la pastille de couleur (hex). */
  photoUrl?: string;
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
  /** Lien affilié (pièces suggérées uniquement) — absent tant qu'aucune source de données affiliées n'est branchée ; le bouton "Trouver cette pièce" ne s'affiche que si présent. */
  affLink?: string;
  /** Formalité stockée (0 sport / 1 décontracté / 3 business casual / 4 habillé) — prime sur la déduction par regex quand présente (source : vestiaire_universel). */
  niveauFormalite?: number;
  /** Rôle de superposition stocké — prime sur la déduction par coupe quand présent (source : vestiaire_universel). */
  rolePiece?: "base" | "calque" | "piece_unique";
  /** Styles auxquels la pièce est rattachée (source : vestiaire_universel) — prime sur la détection par regex du nom quand présent. */
  styleTags?: string[];
  /** Morphologies favorisées par la pièce (source : vestiaire_universel) — prime sur la détection par regex du nom quand présent. */
  morphologyTags?: string[];
  /** true pour une pièce indispensable de capsule (source : vestiaire_universel) — priorisée dans la sélection de la capsule par défaut. */
  estBasiqueCapsule?: boolean;
  /** Ton et intensité de couleur stockés (source : vestiaire_universel) — priment sur la déduction depuis le hex quand présents ; alimentent le rapprochement avec la palette personnelle du profil dans la capsule par défaut. */
  tonsCouleur?: Tons;
  intensiteCouleur?: IntensiteCouleur;
  /** Pièce "statement" stockée (source : vestiaire_universel) — prime sur la déduction par regex/couleur non neutre quand présente. */
  statement?: boolean;
  /** Métal dominant stocké (source : vestiaire_universel, bijou/accessoire uniquement) — prime sur la déduction par regex quand présent. */
  metalDominant?: "or" | "argent";
  /** Rôle de la couleur dans la palette personnelle (source : vestiaire_universel) — base/neutre/accent, reflète la structure de l'onboarding Palette. Pas encore consommé par le moteur de sélection de capsule. */
  paletteRole?: "base" | "neutre" | "accent";
  /** true si la pièce ne doit être suggérée que par temps ensoleillé (ex. lunettes de soleil, source : vestiaire_universel) — R-B15, jamais bloquant pour une catégorie essentielle. */
  necessiteSoleil?: boolean;
  /** true si la veste/le manteau résiste à la pluie (source : vestiaire_universel, colonne resiste_pluie) — R-B16, préférence molle jamais exclusive : ne fait que privilégier ce choix quand il pleut. */
  resistePluie?: boolean;
  /** Plage de température (°C) dans laquelle la pièce est adaptée (source : vestiaire_universel) — exclue si la météo du jour est hors plage, quelle que soit la catégorie. */
  meteoMinTemp?: number;
  meteoMaxTemp?: number;
  /** Photo produit générique du catalogue (source : vestiaire_universel, colonne url_image) — jamais utilisée pour une pièce du dressing réel (cf. photoUrl), qui garde toujours sa propre photo. Priorité d'affichage : photoUrl > affiliateImageUrl > imageUrl > placeholder. */
  imageUrl?: string;
  imageSource?: ImageSource;
  /** Prompt anglais construit automatiquement pour la génération — conservé pour audit/regénération, jamais affiché à l'utilisatrice. */
  imagePrompt?: string;
  /** "missing" tant qu'aucune image n'a été générée/posée — déclenche l'appel à l'Edge Function generate-catalog-image ; jamais régénéré si déjà "ready". */
  imageStatus?: ImageStatus;
  imageGeneratedAt?: string;
  imageVersion?: number;
  /** Vraie photo du produit affilié (distincte du simple lien de clic affLink) — prime sur imageUrl : jamais remplacée par un visuel généré artificiellement. */
  affiliateImageUrl?: string;
  /** Niveau de tendance visuelle pour la génération d'image (source : vestiaire_universel, recette 19/08/2026) — "contemporain" si absent. */
  niveauTendance?: "intemporel" | "contemporain" | "tendance";
  /** Silhouette/détails éditoriaux explicites pour la génération d'image — priment sur toute règle tendances_mode déduite. */
  silhouetteMode?: string;
  detailsMode?: string;
  /** Échappatoire total : remplace la partie "design" du prompt de génération d'image quand renseigné. */
  promptImageOverride?: string;
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
  /** Météo au moment de la validation (recette 19/08/2026) — absente sur les entrées antérieures. */
  temp?: number;
  weatherLabel?: string;
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
  /** Clé de l'étape (ex. "taille"), pas un index — le nombre d'étapes n'est plus fixe (Tâche 4, arbitrages 20/08/2026). */
  profileSetupStep: string;
  profileSetupFromEdit: boolean;
  onbStep: number;
  authName: string;
  activeId: number;
  /** La pièce actuellement ouverte est une suggestion du catalogue, pas une pièce réelle. */
  activeSuggested: boolean;
  /** Écran vers lequel revenir en quittant la vue détail d'une pièce (dressing, capsule, jamais-portées...). */
  pieceReturn: Screen;
  /** Écran vers lequel revenir en quittant le module "Comment porter cette pièce ?". */
  itemOutfitsReturn: Screen;

  catFilter: CategoryKey | "all";

  addName: string;
  addBrand: string;
  addCat: CategoryKey;
  addColor: { name: string; hex: string };
  addSize: string | null;
  /** Photo prise/importée en cours de saisie — jamais bloquante, toujours facultative. */
  addPhotoUrl: string | null;
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

  outfit: number[];
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). "bas" regroupe pantalon/jean/short. */
  outfitMissingCats: (CategoryKey | "bas" | "chaud")[];
  /** true si la tenue affichée est un repli de formalité (ex. business_casual faute d'habillé) — badge "Meilleure alternative" plutôt que "Recommandé". */
  outfitFormalityDowngraded: boolean;
  /** true si aucun palier de formalité autorisé n'a permis de constituer une tenue complète — état vide à afficher, jamais une tenue chaussures/accessoires seuls. */
  outfitNoCompleteOutfit: boolean;
  outfitValidated: boolean;
  occasion: OccasionKey;
  /** true dès que l'utilisatrice a choisi une occasion elle-même (même pour revenir à "all") — désactive alors l'occasion par défaut auto-calculée (recette 13/08/2026) pour le reste de la session. */
  occasionManual: boolean;
  /** Clés des suggestions proactives (R-S12/R-S13/R-S14) écartées pour la tenue affichée — indépendantes, plusieurs peuvent être affichées à la fois. */
  dismissedSuggestions: string[];
  /** Sous-choix affiché uniquement quand occasion === "travail_formel" ; affecte la formalité minimum requise. */
  workMode: WorkMode;
  /** Sous-choix affiché uniquement quand occasion === "voyage" ; n'affecte que l'affichage de la carte conseil longue distance. */
  travelMode: TravelMode;
  travelTipDismissed: boolean;
  /** Sous-choix affiché uniquement quand occasion === "date" ; seul déterminant de sa formalité. */
  dateContext: DateContext;
  /** Saison parcourue sur l'écran Capsule — n'affecte que ce qui y est affiché, jamais la génération de la tenue du jour (toujours la saison calendaire courante). null = saison courante. */
  capsuleSeason: CapsuleSeason | null;

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
  | "lookDetail"
  | "itemOutfits";
