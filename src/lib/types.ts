import type { StyleId } from "./profile";
import type { TenuePlanifiee } from "./planifier";
import type { ValiseGardee } from "./valises";
import type { ItemOutfitVariation } from "./logic";
import type { FamilleLook } from "./ideesLooks";

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

/**
 * Le filtre de l'écran « Mes pièces » : par catégories (cartes du Dressing) ou par teinte (feuille d'un
 * accord de saison, 02/10/2026 ; `teinte` est un hex de PAL_COULEURS, lu par teinteDe). `retour: "tenue"` :
 * la flèche de retour ramène à la tenue d'où l'on vient, pas au Dressing.
 */
export interface FiltrePieces {
  libelle: string;
  categories?: CategoryKey[];
  teinte?: string;
  retour?: "tenue";
}

export type OccasionKey =
  | "all"
  | "quotidien"
  | "travail_formel"
  | "date"
  | "soiree"
  | "sport"
  | "cocooning"
  | "voyage"
  | "evenement_perso";

/**
 * Raison structurée d'un échec de génération de tenue (recette 22/08/2026,
 * brief design "empty state" — remplace l'empty state générique unique par
 * un message pertinent à la cause réelle) :
 * - "missing_required_category" : le pool n'a structurellement aucun
 *   haut+bas ni robe/combinaison, quels que soient occasion/météo/formalité
 *   — il manque une catégorie indispensable, pas seulement une pièce
 *   adaptée à cette occasion précise.
 * - "formality_gap" : une tenue complète existe au palier de formalité le
 *   plus bas (0, jamais tenté par la chaîne de repli habituelle pour une
 *   occasion non-sport) mais pas au palier le plus permissif réellement
 *   autorisé pour cette occasion — le pool manque spécifiquement de pièces
 *   assez habillées.
 * - "no_match" : repli générique — le pool a des catégories structurantes
 *   mais aucune combinaison compatible n'existe même à formalité 0 (le plus
 *   souvent occasion déclarée sur les pièces, ou conflit météo).
 */
export type OutfitFailureReason = "missing_required_category" | "formality_gap" | "no_match";

/** Sous-choix de l'occasion "travail_formel" — Présentiel relève le niveau de formalité minimum, Télétravail l'abaisse. */
/** Le sous-choix de « Travail / Bureau ». « Entretien » (08/10/2026) remplace l'ancienne occasion « Rendez-vous important » : même formalité, plus de veste (cf. logic.ts). */
export type WorkMode = "Présentiel" | "Télétravail" | "Entretien";
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
export type SacType = "Sac à main" | "Cabas" | "Bandoulière" | "Pochette" | "Sac à dos" | "Sac de sport";
export type BijouType = "Collier" | "Boucles d'oreilles" | "Bracelet" | "Bague" | "Montre";
export type AccessoireType =
  | "Ceinture"
  | "Foulard"
  | "Écharpe"
  | "Chapeau"
  | "Casquette"
  | "Lunettes"
  | "Collants"
  | "Chaussettes hautes"
  | "Gourde";

export type Matiere =
  | "Coton"
  | "Lin"
  | "Laine"
  | "Cachemire"
  | "Soie"
  | "Viscose"
  | "Cuir"
  | "Daim"
  | "Denim"
  | "Velours"
  | "Polyester"
  | "Nylon"
  | "Synthétique";
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
  /** Les quatre saisons choisies par l'utilisatrice (27/09/2026, colonne `saisons`, migration 0040). Absent pour une pièce enregistrée avant, ou tant que la migration n'est pas exécutée : saisonsDe (saisons.ts) retombe alors sur `season`. Le moteur ne lit que `season`, qui en est déduite. */
  saisons?: CapsuleSeason[];
  /** Longueur des manches (01/10/2026, colonne `manches`, migration 0042). Absent = inconnue : le moteur se comporte alors comme avant. Jamais déduite d'un nom. */
  manches?: Manches;
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
  /** Visuel « hero » du catalogue (colonne url_image_hero, migration 0049) : la pièce posée à plat avec des plis naturels, pour le flat lay du hero de l'accueil. Ne remplace jamais imageUrl ; absent = on garde le visuel standard. */
  imageHeroUrl?: string;
  /** Niveau de tendance visuelle pour la génération d'image (source : vestiaire_universel, recette 19/08/2026) — "contemporain" si absent. */
  niveauTendance?: "intemporel" | "contemporain" | "tendance";
  /** Silhouette/détails éditoriaux explicites pour la génération d'image — priment sur toute règle tendances_mode déduite. */
  silhouetteMode?: string;
  detailsMode?: string;
  /** Échappatoire total : remplace la partie "design" du prompt de génération d'image quand renseigné. */
  promptImageOverride?: string;
  /** Valeurs brutes de saison_capsule (source : vestiaire_universel uniquement, jamais déduit du type de vêtement) — alimente le badge saison de "Les idées de tenues". Absent pour une pièce du dressing réel ou du catalogue statique de secours (catalog.ts), qui n'ont pas cette colonne. */
  capsuleSeasons?: CapsuleSeason[];
  /** Date d'ajout au dressing réel (recette 24/08/2026, module revente contextuel de PieceScreen) — timestamp ms, mappé depuis created_at (dressing_items). Absent pour une pièce du catalogue vestiaire_universel/catalog.ts, qui n'a pas cette notion. */
  createdAt?: number;
  /** Choix de l'utilisatrice face à une suggestion de revente du Journal (refonte 25/09/2026, colonne revente de dressing_items, migration 0035) — "gardee" : elle la garde, on ne la lui repropose plus ; "de_cote" : mise de côté pour vendre, la pièce reste dans son dressing. Absent = aucun choix. Jamais posé par l'app sans action explicite. */
  revente?: ChoixRevente;
}

export type Manches = "sans" | "courtes" | "longues";

export type ChoixRevente = "gardee" | "de_cote";

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

/**
 * Look enregistré dans Mes looks — deux origines distinctes (recette
 * 23/08/2026) : "created" = composé pièce par pièce via Créer un look
 * (dressing réel uniquement) ; "saved" = tenue du jour telle quelle via
 * Enregistrer cette tenue (peut mélanger pièces possédées et suggestions
 * capsule). "Wishlist" n'est pas une 3ᵉ origine mais un filtre calculé :
 * tout look, quelle que soit sa source, contenant au moins une pièce
 * suggérée pas encore possédée (cf. isWishlistLook, selectors.ts).
 */
export interface SavedLook {
  id: string;
  name: string;
  pieceIds: number[];
  createdAt: number;
  occasion?: OccasionKey;
  source: "saved" | "created";
}

/**
 * Suggestion extraite d'une photo de pièce réelle (recette 22/08/2026,
 * Edge Function analyze-dressing-photo) — tous les champs sont facultatifs,
 * un champ absent/imprécis n'est simplement pas suggéré (jamais une valeur
 * hasardée). Déjà validée contre les enums exacts côté Edge Function.
 */
export interface PhotoAnalysis {
  cat?: CategoryKey | null;
  colorName?: string;
  colorHex?: string;
  matiere?: Matiere;
  subtype?: string;
  shoeType?: ShoeType;
  sacType?: SacType;
  bijouType?: BijouType;
  accessoireType?: AccessoireType;
  /** Ce que montre la photo (05/10/2026) : l'article seul, porté, ou plusieurs articles. Absent quand le modèle n'est pas sûr. */
  photoType?: CadragePhoto;
  /** Longueur des manches lue sur la photo (09/10/2026), seulement pour une catégorie qui en a. */
  manches?: Manches;
  /** Saisons proposées d'après la photo (09/10/2026) : une suggestion modifiable, absente quand le modèle n'est pas sûr. */
  saisons?: CapsuleSeason[];
}

export type CadragePhoto = "seule" | "portee" | "plusieurs";

export interface AppState {
  /** Dressing réel de l'utilisateur. Vide au départ : la capsule par défaut prend le relais. */
  items: Item[];
  /** Ids de suggestions du catalogue écartées ("Retirer" sur une pièce suggérée). */
  suggestedExcluded: number[];
  /** Id de la suggestion en cours de remplacement via l'écran Ajouter. */
  replacingId: number | null;
  /** Id de la pièce réelle en cours de modification via l'écran Ajouter (recette 24/08/2026, PieceScreen "Modifier les informations") — distinct de replacingId : saveItem met à jour cette ligne existante plutôt que d'en insérer une nouvelle. */
  editingId: number | null;
  /** Écran vers lequel revenir en quittant l'ajout (recette 24/08/2026, tuile "Ajouter un/une..." de Créer un look) — prime sur le repli habituel (wardrobe/piece) quand renseigné ; null partout ailleurs (openAdd/startReplace/startEditItem/openAddBag), comportement inchangé. */
  addReturn: Screen | null;

  screen: Screen;
  /** Écran vers lequel revenir en quittant le profil (ouvert depuis l'avatar). */
  profileReturn: Screen;
  /**
   * Le jour consulté (navigation par date, 27/09/2026 — docs/navigation-par-date.md) :
   * 0 aujourd'hui, 1 demain… jusqu'à JOUR_MAX (jourConsulte.ts). La tenue
   * affichée (outfit et ses drapeaux) est celle de ce jour.
   */
  jourDecalage: number;
  /** Écran vers lequel revenir en quittant Préférences Capsela (Profil, ou l’Accueil et Tenue depuis la ligne météo). */
  preferencesReturn: Screen;
  /** Rubrique à amener dans la vue à l'ouverture des Préférences — consommée une fois. */
  preferencesSection: "localisation" | null;
  /** Écran vers lequel revenir en quittant Informations légales (toujours "profile" en pratique). */
  legalReturn: Screen;
  /**
   * Texte légal ouvert (slug de legal/documents.ts), ou null. Affiché en
   * calque par-dessus l'écran courant (01/10/2026, demandé : « dans la même
   * fenêtre que l'app ») : l'écran dessous reste monté, une inscription en
   * cours ne perd pas sa saisie.
   */
  legalDoc: string | null;
  /** Écran d'où l'on est entré dans Premium — on y revient en fermant. */
  premiumReturn: Screen;
  /**
   * Fonctionnalité qui a conduit à l'écran Premium, ou null quand on y est
   * venu de soi-même (la pastille ✦ de l'accueil).
   *
   * Sert à la ligne « Ce que tu voulais faire » de la maquette Premium Gates :
   * quelqu'un qui arrive là après avoir touché « Préparer une valise » n'a pas
   * la même question en tête que quelqu'un qui explore l'offre.
   */
  premiumOrigine: "valise" | null;
  /** Clé de l'étape (ex. "taille"), pas un index — le nombre d'étapes n'est plus fixe (Tâche 4, arbitrages 20/08/2026). */
  profileSetupStep: string;
  profileSetupFromEdit: boolean;
  /** Écran vers lequel revenir en terminant une édition ciblée (ex. "profile" depuis Mon profil, "account" depuis Mon compte). */
  profileSetupReturn: Screen;
  onbStep: number;
  authName: string;
  activeId: number;
  /** La pièce actuellement ouverte est une suggestion du catalogue, pas une pièce réelle. */
  activeSuggested: boolean;
  /** Écran vers lequel revenir en quittant la vue détail d'une pièce (dressing, capsule, jamais-portées...). */
  pieceReturn: Screen;
  /** Écran vers lequel revenir en quittant le module "Comment porter cette pièce ?". */
  itemOutfitsReturn: Screen;
  /**
   * Idées de tenues déjà calculées pour une pièce (Jamais portées, 26/09/2026)
   * : l'écran d'arrivée les reprend telles quelles au lieu de retirer au
   * sort — « 4 tenues possibles » sur la carte, les quatre mêmes ensuite.
   */
  ideesTenuesPretes: { pivotId: number; variations: ItemOutfitVariation[]; famille?: FamilleLook | null } | null;
  /**
   * Le look ouvert depuis « Comment porter … ? » (Détail du look, 27/09/2026).
   * Les idées de la page précédente sont gardées dans ideesTenuesPretes, pour
   * qu'un retour retrouve les mêmes looks, sous la même pastille.
   */
  ideeLookActive: {
    pivotId: number;
    ids: number[];
    occasion: OccasionKey;
    numero: number;
    /** La fiche d'une pièce ouverte depuis le détail remplace activeId et pieceReturn : on les rend au retour. */
    avant: { activeSuggested: boolean; pieceReturn: Screen };
  } | null;

  catFilter: CategoryKey | "all";

  addName: string;
  /** true dès que l'utilisatrice modifie le nom elle-même — au-delà, le nom auto-composé par l'analyse photo (recette 24/08/2026, "Manteau en laine chocolat") ne s'applique plus. */
  addNameTouched: boolean;
  addBrand: string;
  addCat: CategoryKey;
  /** true dès que l'utilisatrice choisit la catégorie elle-même — au-delà, la suggestion par photo (analyzeDressingPhoto) ne la modifie plus. */
  addCatTouched: boolean;
  addColor: { name: string; hex: string };
  /** true dès que l'utilisatrice choisit la couleur elle-même — même logique que addCatTouched. */
  addColorTouched: boolean;
  addSize: string | null;
  /** Photo prise/importée en cours de saisie — jamais bloquante, toujours facultative. Aperçu local (blob:) le temps de l'upload, puis URL définitive du bucket dressing-photos. */
  addPhotoUrl: string | null;
  /** true pendant l'upload vers Supabase Storage (correctif 22/08/2026, remplace l'ancien aperçu blob: jamais persisté) — bloque la sauvegarde le temps d'obtenir l'URL définitive. */
  addPhotoUploading: boolean;
  /** Enregistrement en cours (insertion en base) : le bouton est désactivé, le formulaire conservé. */
  addSaving: boolean;
  /** Échec du dernier enregistrement, affiché près du bouton — null sinon. */
  addErreur: string | null;
  /** true pendant l'analyse de la photo par l'IA (recette 22/08/2026, pré-remplissage catégorie/couleur/matière...) — jamais bloquant pour la sauvegarde, juste un indicateur. */
  addPhotoAnalyzing: boolean;
  /** true quand l'analyse de la photo a réellement rendu un résultat (27/09/2026) — seule condition des mentions « Capsela a analysé ta pièce » et « détectées ». addPhotoAnalyzing redevient false aussi en mode démo (aucune analyse) et sur un échec. */
  addPhotoAnalysee: boolean;
  /** Ce que l'analyse a vu sur la photo (05/10/2026) : null tant qu'elle ne l'a pas dit, ou si elle n'est pas sûre. Sert seulement à avertir à l'ajout ; jamais stocké, aucune colonne. */
  addPhotoCadrage: CadragePhoto | null;
  /** Le détourage de la photo (04/10/2026) : "en_cours" pendant l'appel, "fait" quand la photo affichée est la détourée. Jamais bloquant : un échec, ou un détourage non branché, redonne "repos" et la photo d'origine reste. */
  addPhotoDetourage: "repos" | "en_cours" | "fait";
  /** null tant que l'utilisatrice n'a rien touché — la sauvegarde retient alors saisonsParDefaut (saisons.ts), affichées présélectionnées. Quatre saisons au choix depuis le 27/09/2026, jamais bloquantes. */
  addSaisons: CapsuleSeason[] | null;
  /** Vrai quand les saisons affichées viennent de l'analyse de la photo et que l'utilisatrice n'y a pas touché. */
  addSaisonsLues: boolean;
  /** Longueur des manches choisie dans le formulaire (01/10/2026) ; null tant qu'elle n'est pas renseignée. */
  addManches: Manches | null;
  /** Plusieurs choix possibles. */
  addOccasion: OccasionKey[];
  /** true dès que l'utilisatrice modifie la sélection elle-même (recette 24/08/2026) — au-delà, ni suggestOccasions(cat) ni une nouvelle catégorie ne remplacent plus la sélection. */
  addOccasionTouched: boolean;
  /** Type de chaussure en cours de saisie — obligatoire si addCat === "chaussures" (R-B6). */
  addShoeType: ShoeType | null;
  /** true dès que l'utilisatrice choisit le type de chaussure elle-même — même logique que addCatTouched. */
  addShoeTypeTouched: boolean;
  /** Matière/coupe/sous-types en cours de saisie — pré-suggérés au nom tant que non modifiés manuellement. */
  addMatiere: Matiere | null;
  addCoupe: Coupe | null;
  addMatiereTouched: boolean;
  /** Vrai dès que l'utilisatrice a touché aux manches : l'analyse de la photo ne les remplace plus. */
  addManchesTouched: boolean;
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
  /** Au moins une catégorie a été servie par un barreau qui abandonne l'occasion déclarée (cf. GeneratedOutfit.occasionRelachee) — bannière dédiée, distincte du repli de formalité. */
  outfitOccasionRelachee: boolean;
  /** true si aucun palier de formalité autorisé n'a permis de constituer une tenue complète — état vide à afficher, jamais une tenue chaussures/accessoires seuls. */
  outfitNoCompleteOutfit: boolean;
  /** Raison structurée de l'échec (recette 22/08/2026, brief design "empty state") — null quand outfitNoCompleteOutfit est false. Dérivée de signaux déjà calculés par le moteur (présence de catégories dans le pool, probe à formalité 0), jamais un diagnostic inventé côté UI. */
  outfitFailureReason: OutfitFailureReason | null;
  outfitValidated: boolean;
  /**
   * La tenue planifiée devenue tenue du jour (planDuJour.ts, 30/09/2026) —
   * son identifiant, ou null quand la tenue affichée est la proposition de
   * Capsela. Gardée avec la tenue de chaque jour consulté.
   */
  planAppliqueId: string | null;
  /** Plans écartés par « Voir une autre proposition » : ils ne reviennent plus imposer leur tenue. */
  plansEcartes: string[];
  /** Bandeau de diagnostic temporaire (correctif 22/08/2026, signalé : pièces ajoutées au dressing non conservées) — dernier échec Supabase dressing_items/outfit_history, affiché tel quel pour permettre le diagnostic sans console développeur (utile sur mobile). À retirer une fois la cause identifiée et corrigée. */
  dressingError: string | null;
  /** Nom de la pièce qui vient d'entrer au dressing (27/09/2026) — affiche la confirmation « Pièce ajoutée à ton dressing » au-dessus de l'écran d'arrivée, jusqu'à sa fermeture ou son délai. Posé seulement une fois l'ajout réussi, jamais pour une modification. */
  pieceAjoutee: { nom: string; jeton: number } | null;
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
  /** Style exploré ponctuellement depuis "Explorer d'autres styles" (état vide Tenues) — ne remplace jamais profile.styles, n'affecte que la Capsule tant que ce mode est actif. null = pas d'exploration en cours, toujours le style du profil. */
  exploredStyleId: StyleId | null;

  lookCount: number;

  history: HistoryEntry[];

  /** Écran « Demander un avis à un proche ». */

  /** Looks composés manuellement à partir du dressing réel. */
  /**
   * Les avis déjà donnés AUJOURD'HUI, toutes tenues confondues (0029).
   * Chargés en bloc au démarrage : la tenue n'est pas encore générée à ce
   * moment-là. L'écran retrouve la ligne qui correspond à ses pièces.
   */
  outfitFeedbackDuJour: { jour: string; pieceIds: number[]; verdict: "adore" | "pas_aujourdhui" }[];
  /**
   * Clés principales (clePrincipale, logic.ts) des tenues déjà proposées puis
   * quittées par « Autre tenue » ou « Pas pour moi », pour la session : la
   * suivante n'y retombe pas (A → B → A). En mémoire seulement.
   */
  tenuesVues: string[];
  /**
   * « Demander l'avis d'un proche » depuis une tenue PLANIFIÉE (recette du
   * 26/09/2026) : ce que l'écran de partage décrit à la place de la tenue du
   * jour, et le plan à rouvrir au retour. null : la tenue du jour, comme avant.
   */
  avisSource: {
    pieceIds: number[];
    occasion: OccasionKey;
    temp: number | null;
    label: string | null;
    /** Le jour J dans le message, ex. « pour samedi 4 octobre » (« … ton avis sur sa tenue pour samedi 4 octobre »). */
    moment: string;
    /** Le plan à rouvrir au retour ; absent pour la tenue d'un jour consulté depuis Tenue (retour à Tenue). */
    plan?: TenuePlanifiee;
  } | null;
  /** Plan à rouvrir en revenant sur Planifier après le partage ; consommé à l'ouverture. */
  planARouvrir: TenuePlanifiee | null;
  /**
   * Composition à planifier, venue d'un avis de styliste (V2, 26/09/2026) :
   * les pièces reconnues sur la photo, et « demain » si c'est l'action
   * choisie. Planifier la reprend telle quelle, sans passer par le moteur ;
   * consommée à l'ouverture, comme planARouvrir.
   */
  planComposition: { pieceIds: number[]; demain: boolean } | null;
  /**
   * TENUES PLANIFIÉES (planned_outfits), montées dans le store le 27/09/2026 :
   * elles ont désormais deux lecteurs — Planifier, et l'Accueil / Tenue qui
   * rappellent celles du jour consulté. Vides en mode démo.
   */
  tenuesPlanifiees: TenuePlanifiee[];
  /**
   * Écran d'où Planifier a été ouvert sur un plan ou sur une date (Accueil,
   * Tenue) : revenir de cette entrée y ramène au lieu du hub. Oublié dès que
   * le hub de Planifier s'affiche, ou à l'ouverture ordinaire de Planifier.
   */
  planRetour: "home" | "tenues" | "calendrier" | null;
  /** Date préremplie (décalage en jours) par « Planifier une tenue pour … » de Tenue ; consommée à l'ouverture. */
  planJour: number | null;
  /**
   * LES VALISES (27/09/2026, docs/valise.md) : plusieurs, gardées sur
   * l'appareil et dans le compte, rappelées dans « Mes planifications ».
   */
  valises: ValiseGardee[];
  /** Valise affichée par l'écran Valise ; null : une nouvelle valise (les questions). */
  valiseOuverte: string | null;
  /** Écran d'où la valise a été ouverte (Accueil, Planifier) : « retour » y ramène. */
  valiseRetour: Screen | null;
  /** Où la dernière modification a été gardée — dit à l'écran, jamais supposé. */
  valiseStatut: "compte" | "appareil" | null;
  savedLooks: SavedLook[];
  /** Pièces choisies dans l'écran de création de look, avant sauvegarde. */
  lookDraftIds: number[];
  lookDraftName: string;
  lookDraftOccasion: OccasionKey;
  /** Clés des suggestions proactives écartées pour le brouillon de look en cours. */
  lookDraftDismissed: string[];
  /** Id du look actuellement ouvert dans l'écran de détail. */
  activeLookId: string | null;
  /** Écran où revient le détail d'un look : le Dressing, ou « Mes looks » d'où il a été ouvert. */
  lookReturn: "wardrobe" | "looks";
  /** Carte du vestiaire qui filtre « Mes pièces » sur ses catégories techniques ; null = toutes les pièces. */
  filtrePieces: FiltrePieces | null;
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
  | "calendrier"
  | "history"
  | "neverworn"
  | "profileSetup"
  | "profile"
  // Architecture du profil (25/09/2026) : quatre espaces distincts — Ton
  // profil (consulter), Personnaliser (profileEdit, modifier), Préférences
  // Capsela (régler l'application), Mon compte (gérer compte et données).
  | "preferences"
  | "account"
  | "legal"
  | "login"
  | "opinionShare"
  | "createLook"
  | "lookDetail"
  | "itemOutfits"
  // Détail d'une idée de look (27/09/2026), ouvert depuis « Comment porter … ? ».
  | "ideeLook"
  | "wardrobePieces"
  // « Tes dernières pièces » (08/10/2026) — « Voir tout » de « Ajoutées récemment ».
  | "dernieresPieces"
  // Tous les looks (refonte Dressing, 25/09/2026) — « Mes looks · Voir tout ».
  | "looks"
  // Destinations Premium (brief Accueil 22/09/2026) — écrans d'attente
  // assumés, branchés pour que la carte ne mène pas dans le vide.
  | "planifier"
  | "premium"
  // Préparer sa valise (lot 1, 27/09/2026, docs/valise.md).
  | "valise"
  // Avis de styliste (Premium, 25/09/2026, docs/avis-de-styliste.md) —
  // ouvert depuis la carte « Besoin d'un regard ? » de l'accueil.
  | "avisStyliste"
  // Avis de styliste enregistré, rouvert depuis le Journal.
  | "avisEnregistre"
  // Tous les avis enregistrés (« Voir tout » de « Mes avis de styliste »).
  | "avisTous";
