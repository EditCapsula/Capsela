"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth";
import { isSupabaseConfigured } from "./supabase";
import { CATALOG, type CatalogItem } from "./catalog";
import { computeDefaultCapsule, currentSeasonKey, saisonCapsulePourMeteo, weatherForDay } from "./capsule";
import { fetchVestiaireUniversel } from "./vestiaire";
import {
  analyzeDressingPhoto,
  deleteDressingItem,
  deleteDressingPhotos,
  deleteOutfitFeedback,
  deleteSavedLook,
  dressingPhotoPath,
  fetchDressingItems,
  fetchOutfitHistory,
  fetchOutfitFeedbackDuJour,
  fetchSavedLooks,
  insertDressingItem,
  insertOutfitHistoryEntry,
  insertSavedLook,
  upsertOutfitFeedback,
  updateDressingItem,
  updateDressingItemRevente,
  updateDressingItemWorn,
  updateSavedLook,
  uploadDressingPhoto,
} from "./dressing";
import { ensureCatalogImage, resolveItemImage } from "./catalogImages";
import { choisirMeteo, fetchWeatherByCity, fetchWeatherByCoords, getBrowserPosition, type SourceMeteo } from "./weather";
import { CATS, CITIES, PALETTE, PALETTE_BIJOU, SUBTYPE_REQUIRED, type Weather } from "./data";
import { composeWardrobePool } from "./selectors";
import { fetchEtatPremium, peutAjouter, type EtatPremium } from "./premium";
import { etatSimule, lireProfilSimule } from "./simulationPremium";
import { contexteDepuisProfil, demanderAvis, type AvisStyliste, type PieceSuggeree, type ResultatDemande } from "./avisStylisteClient";
import { enregistrerAvis, enregistrerReconnaissanceAvis, listerAvis, supprimerAvis, type AvisEnregistre } from "./avisJournal";
import { corrigerReconnaissance, type VetementReconnu } from "./reconnaissance";
import { type Verdict, appliquerAvis, clePieces, jourLocal } from "./outfitFeedback";
import {
  choisirVariation,
  clePrincipale,
  generateOutfitWithFallback,
  piecesPrincipales,
  swapOutfitPiece,
  violatesOuterwearRule,
  type ItemOutfitVariation,
} from "./logic";
import { exposedStyleIds, paletteHexes, type ProfilePrefs, type StyleId } from "./profile";
import {
  accessoireTypeFor,
  detectAccessoireType,
  detectBijouType,
  detectCoupe,
  detectMatiere,
  detectSacType,
  detectSubtype,
  suggestName,
  suggestOccasions,
} from "./attributes";
import type {
  AccessoireType,
  AppState,
  BijouType,
  CapsuleSeason,
  CategoryKey,
  ChoixRevente,
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

/** Photo préparée de l'Avis de styliste (cf. photoAvis.ts) — URL locale blob:, jamais envoyée hors analyse. */
export interface PhotoAvis {
  fichier: File;
  url: string;
  largeur: number;
  hauteur: number;
}
export type AnalyseAvis =
  | { etat: "inactive" }
  | { etat: "en_cours" }
  | {
      etat: "reussie";
      analyseId: string;
      avis: AvisStyliste;
      dressing: PieceSuggeree[];
      /** Pièces du dressing reconnues sur la photo, corrections comprises (reconnaissance.ts) — la composition que lisent toutes les actions. */
      reconnaissance: VetementReconnu[];
    }
  | { etat: "echouee"; code: Extract<ResultatDemande, { ok: false }>["code"]; raison?: Extract<ResultatDemande, { ok: false }>["raison"] };
export interface SessionAvisStyliste {
  photo: PhotoAvis | null;
  analyse: AnalyseAvis;
  /** Enregistrement du résultat dans le Journal — automatique à la réception (26/09/2026). */
  enregistrement: "aucun" | "en_cours" | "fait" | "echec";
  /** Identifiant de l'avis une fois enregistré : c'est lui que la reconnaissance met à jour. */
  avisEnregistreId?: string;
  /**
   * Report de la reconnaissance (et de ses corrections) sur l'avis enregistré
   * — écriture isolée, qui échoue seule avant la migration 0037.
   */
  reconnaissanceJournal?: "en_cours" | "faite" | "echec";
}

/** Écrans qui s'ouvrent depuis le profil : jamais retenus comme « retour » du profil. */
const SOUS_ECRANS_PROFIL = new Set<Screen>(["profile", "profileSetup", "preferences", "account", "legal"]);

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
    editingId: null,
    addReturn: null,
    screen: "welcome",
    profileReturn: "home",
    legalReturn: "profile",
    premiumReturn: "home",
    premiumOrigine: null,
    profileSetupStep: "genre",
    profileSetupFromEdit: false,
    profileSetupReturn: "profile",
    onbStep: 0,
    authName: "",
    activeId: 0,
    activeSuggested: false,
    pieceReturn: "wardrobe",
    itemOutfitsReturn: "capsule",
    ideesTenuesPretes: null,
    catFilter: "all",
    addName: "",
    addNameTouched: false,
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
    addOccasionTouched: false,
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
    outfitOccasionRelachee: false,
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
    exploredStyleId: null,
    lookCount: 0,
    history: [],
    outfitFeedbackDuJour: [],
    tenuesVues: [],
    avisSource: null,
    planARouvrir: null,
    planComposition: null,
    savedLooks: [],
    lookDraftIds: [],
    lookDraftName: "",
    lookDraftOccasion: "all",
    lookDraftDismissed: [],
    activeLookId: null,
    lookReturn: "wardrobe",
    filtrePieces: null,
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
  goPlanifier: () => void;
  goNeverWorn: () => void;
  /** `filtre` : carte du vestiaire — n'affiche que les pièces de ses catégories techniques. */
  goWardrobePieces: (filtre?: { libelle: string; categories: CategoryKey[] }) => void;
  goLooks: () => void;
  goProfile: () => void;
  /** Réglages de fonctionnement de l'application (notifications, météo, rythme). */
  goPreferences: () => void;
  /** Compte : e-mail, confidentialité et données, légal, suppression, déconnexion. */
  goAccount: () => void;
  goLegal: () => void;
  /** Ouvre la page Premium en mémorisant d'où l'on vient. */
  goPremium: (origine?: "valise") => void;
  /** Écran « Avis de styliste » (docs/avis-de-styliste.md). Réservé Premium : l'accueil ouvre le Premium Gate à la place pour tout autre statut. */
  goAvisStyliste: () => void;
  /**
   * Relit le statut Premium quand il est encore inconnu, avant de trancher un
   * accès (arbitrage du 25/09/2026, point 7). Rend le statut obtenu — jamais
   * "premium" par défaut : sans Supabase, sans session, ou au-delà de 5 s, il
   * reste "inconnu", et la règle d'accès montre alors le Premium Gate.
   */
  verifierEtatPremium: () => Promise<EtatPremium>;
  /**
   * Pose (ou retire, avec null) la photo de l'Avis de styliste. Toute
   * nouvelle photo remet l'analyse à zéro ; l'URL locale de la précédente est
   * libérée. Sert aussi à « Nouvelle analyse » et à la suppression.
   */
  definirPhotoAvis: (photo: PhotoAvis | null) => void;
  /** Revient à l'aperçu de la photo actuelle, sans la perdre (après une erreur). */
  revenirAApercuAvis: () => void;
  /**
   * Lance l'analyse de la photo posée — uniquement sur « Analyser ma tenue »
   * [DÉCIDÉ]. Ignorée si une analyse est déjà en cours (pas de double
   * envoi). Elle continue si l'on quitte l'écran (point 16).
   */
  lancerAvisStyliste: () => void;
  /**
   * Enregistre dans le Journal le résultat affiché et sa photo. Appelée
   * automatiquement à la réception de l'avis (26/09/2026), et par
   * « Réessayer » après un échec ; ignorée pendant un enregistrement ou après
   * un succès (pas de doublon, §14).
   */
  enregistrerAvisStyliste: () => void;
  /** L'utilisatrice associe une autre pièce (ou aucune) au vêtement `index` de l'avis affiché ; reportée sur l'avis enregistré. */
  corrigerReconnaissanceAvis: (index: number, pieceId: number | null) => void;
  /** Nouvel essai du report de la reconnaissance dans le Journal. */
  reessayerReconnaissanceJournal: () => void;
  /** Même correction, sur un avis rouvert depuis le Journal. false : non gardée (et retirée de l'écran). */
  corrigerReconnaissanceEnregistree: (avisId: string, index: number, pieceId: number | null) => Promise<boolean>;
  /** Charge les avis enregistrés (Journal). */
  chargerAvisEnregistres: () => void;
  /** Ouvre un avis enregistré en consultation (depuis le Journal ou la liste complète, qui est retenue pour le retour). */
  ouvrirAvisEnregistre: (id: string) => void;
  /** Referme un avis enregistré : retour à l'écran d'où il a été ouvert. */
  fermerAvisEnregistre: () => void;
  /** Tous les avis enregistrés (« Voir tout » du Journal). */
  goAvisTous: () => void;
  /** Supprime un avis enregistré et sa photo (§14). Rend false en cas d'échec — l'avis reste alors affiché. */
  supprimerAvisEnregistre: (id: string) => Promise<boolean>;
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
  /** Ouvre l'ajout pré-rempli sur une catégorie donnée, en mémorisant l'écran d'origine pour y revenir (recette 24/08/2026, tuile "Ajouter un/une..." de Créer un look) — jamais utilisé pour openAdd/startReplace/startEditItem, qui gardent leur repli habituel. */
  openAddForCategory: (cat: CategoryKey) => void;
  /**
   * « Ajouter cette pièce à mon dressing » depuis un vêtement NON RECONNU
   * d'un avis de styliste (26/09/2026) : le formulaire d'ajout s'ouvre sur sa
   * catégorie, le nom repris de ce que la styliste a vu (« Sandales noir »),
   * modifiable. L'enregistrement ramène à l'avis, où la pièce peut être
   * associée.
   */
  ajouterPieceNonReconnue: (cat: CategoryKey, nom: string) => void;
  addBack: () => void;
  setAuthName: (v: string) => void;
  onbBack: () => void;
  onbNext: () => void;
  openItem: (id: number, suggested?: boolean) => void;
  /**
   * Ouvre le module "Comment porter cette pièce ?" — pour une pièce de la
   * capsule (suggested = true, valeur par défaut, comportement historique)
   * ou, depuis la refonte PieceScreen (recette 24/08/2026, CTA "Voir des
   * tenues avec cette pièce"), pour une pièce réelle du dressing
   * (suggested = false) — sans quoi activeSuggested resterait figé à true
   * au retour sur PieceScreen et l'afficherait à tort comme une suggestion.
   */
  /** `variations` : idées déjà calculées pour cette pièce (calculerIdeesTenues), reprises telles quelles à l'arrivée. */
  openItemOutfits: (id: number, suggested?: boolean, variations?: ItemOutfitVariation[]) => void;
  /** Affiche une combinaison choisie depuis ce module sur l'écran Tenue — jamais un enregistrement automatique comme portée. */
  viewItemOutfit: (ids: number[], occasion: OccasionKey) => void;
  removeActive: () => void;
  /**
   * Enregistre le choix de l'utilisatrice face à une suggestion de revente
   * du Journal (« Garder dans mon dressing » / « Mettre de côté pour
   * vendre », null pour revenir sur son choix). Ne retire JAMAIS la pièce
   * du dressing. Résout à false si l'écriture échoue — l'état local est
   * alors remis comme avant, pour ne pas afficher un choix qui disparaîtrait
   * au prochain chargement.
   */
  choisirRevente: (id: number, choix: ChoixRevente | null) => Promise<boolean>;
  /** Retire plusieurs pièces du dressing d'un coup (sélection multiple depuis "Mes pièces"). Les pièces suggérées ne passent jamais par ici. */
  removeItems: (ids: number[]) => void;
  /** Écarte une suggestion de la capsule par défaut. */
  dismissSuggested: (id: number) => void;
  /**
   * Ouvre l'ajout d'une pièce pour remplacer une suggestion ("J'ai déjà
   * ça") — préremplit le formulaire avec tout ce que Capsela connaît déjà
   * sur cette pièce catalogue (brief design 22/08/2026, "Comment porter
   * cette pièce" section 4 : ne jamais redemander une information déjà
   * disponible). Chaque champ reste modifiable normalement ensuite (mêmes
   * drapeaux *Touched que la détection par nom/photo).
   *
   * `retour` (25/09/2026, « Je possède déjà cette pièce » de l'écran
   * Capsule) : écran où revenir après l'enregistrement ou l'abandon. Omis,
   * le repli habituel s'applique — ItemOutfits et Pièce n'en changent pas.
   */
  startReplace: (item: Item, retour?: Screen) => void;
  /** Ouvre l'écran Ajouter en mode édition pour une pièce réelle du dressing ("Modifier les informations"/"Changer la photo", recette 24/08/2026) — préremplit tous les champs, saveItem met alors à jour cette ligne plutôt que d'en créer une nouvelle. */
  startEditItem: (item: Item) => void;
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
  setAddMatiere: (m: Matiere | null) => void;
  setAddCoupe: (c: Coupe) => void;
  setAddSacType: (t: SacType) => void;
  setAddBijouType: (t: BijouType) => void;
  setAddAccessoireType: (t: AccessoireType) => void;
  setAddSubtype: (t: string) => void;
  saveItem: () => void;
  /** Ferme le bandeau de diagnostic temporaire dressingError (correctif 22/08/2026). */
  dismissDressingError: () => void;
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
  /** Explore un style autre que celui du profil sur l'écran Capsule ("Explorer d'autres styles", recette 24/08/2026) — jamais persisté dans profile.styles, ne modifie jamais le style principal. */
  setExploredStyle: (id: StyleId) => void;
  /** Quitte le mode exploration ("Revenir à mon style"). */
  clearExploredStyle: () => void;
  /** Génère (ou régénère) la tenue du jour à partir de la capsule du style exploré, pour l'occasion/le sous-choix courants — jamais via wardrobePool/regen() standard (recette 24/08/2026, "Voir ma tenue" depuis Capsule, et "Autre tenue" pendant l'exploration). Sans effet si exploredStyleId est null. */
  viewExploredOutfit: () => void;
  /** Remplace une pièce de la tenue par une autre de la même famille. */
  swapPiece: (id: number, cat: CategoryKey) => void;
  /** Ajoute une pièce à l'affichage de la tenue du jour (recette 23/08/2026, "Ajouter à la tenue" des suggestions R-S13/R-S14) — aperçu de composition, jamais une acquisition ; sans effet si déjà présente. */
  addPieceToOutfit: (id: number) => void;
  /** Annule un addPieceToOutfit (toast "Annuler", recette 23/08/2026) — retire une pièce de l'affichage de la tenue du jour ; sans effet si absente. */
  removePieceFromOutfit: (id: number) => void;
  /** Déclenche la génération du visuel d'une pièce du catalogue si elle n'en a pas encore (sans effet sinon). */
  requestCatalogImage: (itemId: number) => void;
  regenOutfit: () => void;
  dismissOutfitSuggestion: (key: string) => void;
  wearOutfitToday: () => void;
  wearPieceToday: (id: number) => void;
  wearActiveToday: () => void;
  correctPiece: (id: number) => void;
  correctActive: () => void;
  /**
   * Fait de ces pièces la tenue du jour, à valider sur l'écran Tenue. Par
   * défaut, ouvre cet écran ; `rester` garde l'écran courant (« Porter
   * aujourd'hui » d'un avis de styliste, qui confirme sur place).
   */
  reWear: (ids: number[], options?: { rester?: boolean }) => void;
  /** Sans argument : la tenue du jour. Avec : une tenue planifiée (cf. AppState.avisSource). */
  openOpinionShare: (source?: AppState["avisSource"]) => void;
  closeOpinionShare: () => void;
  /** Planifier a rouvert le plan au retour du partage. */
  oublierPlanARouvrir: () => void;
  /** Ouvre Planifier avec cette composition déjà faite (avis de styliste), pour demain ou une date à choisir. */
  planifierComposition: (ids: number[], demain: boolean) => void;
  /** Planifier a repris la composition. */
  oublierPlanComposition: () => void;

  /** seedId : préremplit lookDraftIds avec cette pièce (recette 24/08/2026, PieceScreen "Ajouter à un look → Créer un nouveau look") — jamais renseigné hors de ce parcours. */
  goCreateLook: (seedId?: number) => void;
  cancelCreateLook: () => void;
  toggleLookDraftPiece: (id: number) => void;
  setLookDraftName: (v: string) => void;
  setLookDraftOccasion: (o: OccasionKey) => void;
  dismissLookDraftSuggestion: (key: string) => void;
  /** Avis rapide sur la tenue du jour — repasser le même verdict le retire. */
  setOutfitFeedback: (verdict: Verdict) => void;
  saveLook: () => void;
  toggleSaveOutfitLook: () => void;
  openLook: (id: string) => void;
  closeLookDetail: () => void;
  deleteActiveLook: () => void;
  wearLookToday: (id: string) => void;
  /** Ajoute une pièce du dressing réel à un look existant (recette 24/08/2026, PieceScreen "Ajouter à un look") — persistance best-effort, jamais bloquant. */
  addPieceToLook: (lookId: string, pieceId: number) => void;
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
  /** D'où vient geoCity : position en direct, météo réelle de la ville du profil, dernière position connue, ou valeurs par défaut (cf. choisirMeteo). */
  sourceMeteo: SourceMeteo;
  /** Capsule par défaut personnalisée (suggestions du catalogue). */
  defaultCapsule: Item[];
  /** Pool actif : le dressing réel s'il contient des pièces, sinon la capsule par défaut. */
  wardrobePool: Item[];
  /** Source des suggestions — vestiaire universel (Supabase) si disponible, sinon le catalogue statique de secours. Utilisé par l'écran Capsule pour recalculer une capsule sur une saison différente de la saison courante. */
  vestiairePool: CatalogItem[];
  /**
   * true une fois les pièces, l'historique et les looks chargés.
   *
   * Exposé le 23/09/2026 pour l'état de chargement du Dressing : le drapeau
   * existait déjà en interne, mais l'écran ne pouvait pas distinguer « pas
   * encore chargé » de « dressing vide » — une utilisatrice qui a des pièces
   * voyait donc l'empty state le temps du fetch, avec son « Ajoute ta
   * première pièce ». Aucun comportement de chargement n'est modifié : la
   * valeur est seulement rendue lisible.
   */
  dressingLoaded: boolean;
  /**
   * Droit Premium. Dans le store et non dans un écran : le Dressing en a
   * besoin pour son compteur et son bouton d'ajout, le store lui-même pour
   * refuser une pièce de trop, et la page Premium pour se situer. Trois
   * lecteurs, donc une seule source.
   *
   * "inconnu" tant que la vérification n'a pas eu lieu OU n'a pas pu aboutir
   * — et dans cet état AUCUNE limite ne s'applique (cf. premium.ts).
   */
  etatPremium: EtatPremium;
  /**
   * Session de l'Avis de styliste (arbitrage du 25/09/2026, point 16) :
   * photo préparée, état de l'analyse, résultat. Dans le store et non dans
   * l'écran pour qu'une analyse lancée continue si l'on quitte l'écran, et
   * soit retrouvée — en cours, réussie ou échouée — en y revenant. EN MÉMOIRE
   * SEULEMENT : rien n'est persisté, tout disparaît à la fermeture de l'app.
   */
  avisStyliste: SessionAvisStyliste;
  /**
   * Avis enregistrés dans le Journal (migration 0036) — null tant qu'ils
   * n'ont pas été chargés (au premier affichage du Journal). Liste vide
   * avant la migration : la section reste masquée.
   */
  avisEnregistres: AvisEnregistre[] | null;
  /** Avis enregistré ouvert en consultation. */
  avisEnregistreActif: AvisEnregistre | null;
  actions: Actions;
}

/**
 * Photos personnelles devenues orphelines par le retrait de pièces
 * (09/09/2026, signalé) : jusqu'ici le fichier restait dans le bucket pour
 * toujours, sans plus rien pour le désigner — invisible, mais comptant dans
 * le quota de stockage.
 *
 * Deux garde-fous, et ils comptent autant que la suppression elle-même.
 * `dressingPhotoPath` écarte tout ce qui n'est pas une photo personnelle :
 * `startEditItem` retombe sur l'image de catalogue quand la pièce n'a pas de
 * photo propre, et ce visuel est PARTAGÉ par toutes les utilisatrices — le
 * supprimer le casserait pour tout le monde. Et une URL encore référencée
 * par une pièce conservée n'est jamais supprimée : deux pièces peuvent
 * pointer le même fichier.
 */
function photosDevenuesOrphelines(retirees: Item[], conservees: Item[]): string[] {
  const encoreUtilisees = new Set(conservees.map((it) => it.photoUrl).filter(Boolean));
  const chemins = new Set<string>();
  for (const it of retirees) {
    if (encoreUtilisees.has(it.photoUrl)) continue;
    const chemin = dressingPhotoPath(it.photoUrl);
    if (chemin) chemins.add(chemin);
  }
  return [...chemins];
}

const CapselaContext = createContext<CapselaContextValue | null>(null);

/**
 * Retrouve une pièce par id dans un pool, puis dans le catalogue (pour
 * l'historique). `fallback` doit être le vestiaire vivant (vestiairePool),
 * pas la constante CATALOG : celle-ci n'est que le catalogue statique de
 * secours, remplacé par les lignes vestiaire_universel dès qu'elles sont
 * chargées. S'en tenir à CATALOG faisait échouer la résolution de toute
 * pièce catalogue chargée dynamiquement (ids 100000+) — notamment celles
 * d'une capsule de style exploré. CATALOG reste le défaut pour les appels
 * hors provider, où le vestiaire vivant n'est pas accessible.
 */
export function findPiece(pool: Item[], id: number, fallback: Item[] = CATALOG): Item | undefined {
  return pool.find((i) => i.id === id) ?? fallback.find((i) => i.id === id);
}

export function CapselaProvider({ children }: { children: React.ReactNode }) {
  const { profile, ready, userId } = useAuth();
  const [state, setState] = useState<AppState>(buildInitialState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Garde-fou exploration de style (recette 24/08/2026) : un style exploré
  // devient invalide si le profil change de genre (styles exposés différents)
  // ou si le style principal devient lui-même ce style exploré — jamais
  // laissé actif par erreur après un changement de profil fait ailleurs
  // (ProfileSetupScreen/ProfileEditScreen, hors de ce store). Ajustement
  // pendant le rendu (pattern React officiel, pas un effet) : évite un aller-
  // retour de rendu inutile pour une simple invalidation dérivée du profil.
  const profileStyleKey = `${profile.gender ?? ""}|${profile.styles.join(",")}`;
  const [lastProfileStyleKey, setLastProfileStyleKey] = useState(profileStyleKey);
  if (profileStyleKey !== lastProfileStyleKey) {
    setLastProfileStyleKey(profileStyleKey);
    if (state.exploredStyleId) {
      const stillValid = state.exploredStyleId !== profile.styles[0] && exposedStyleIds(profile.gender).includes(state.exploredStyleId);
      if (!stillValid) setState((s) => ({ ...s, exploredStyleId: null }));
    }
  }

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
  const [etatPremium, setEtatPremium] = useState<EtatPremium>("inconnu");
  /* Comme poolRef/weatherRef : saveItem lit stateRef.current et non le rendu
     courant, il lui faut donc une référence et pas la valeur capturée. */
  const etatPremiumRef = useRef<EtatPremium>("inconnu");
  const [avisStyliste, setAvisStyliste] = useState<SessionAvisStyliste>({ photo: null, analyse: { etat: "inactive" }, enregistrement: "aucun" });
  const avisStylisteRef = useRef(avisStyliste);
  useEffect(() => {
    avisStylisteRef.current = avisStyliste;
  }, [avisStyliste]);
  /* Jeton de la session en cours : une réponse qui arrive après un
     changement de photo (ou « Nouvelle analyse ») est ignorée. */
  const jetonAvisRef = useRef(0);
  /* Posé de façon synchrone au clic : deux clics rapprochés n'envoient
     qu'une analyse, même avant le rendu suivant. */
  const analyseAvisEnCoursRef = useRef(false);
  const [avisEnregistres, setAvisEnregistres] = useState<AvisEnregistre[] | null>(null);
  const [avisEnregistreActifId, setAvisEnregistreActifId] = useState<string | null>(null);
  const [avisEnregistreRetour, setAvisEnregistreRetour] = useState<Screen>("history");
  const avisEnregistreActif = avisEnregistres?.find((a) => a.id === avisEnregistreActifId) ?? null;
  /** Numéro de la dernière écriture de reconnaissance : seule sa réponse fait foi. */
  const ecritureReconnaissanceRef = useRef(0);
  /**
   * Reporte la reconnaissance actuelle sur l'avis enregistré — sans effet
   * tant qu'il ne l'est pas (l'enregistrement la reportera à son tour). Deux
   * corrections rapides : la dernière écriture seule décide de l'état affiché.
   */
  const synchroniserReconnaissance = () => {
    const session = avisStylisteRef.current;
    if (session.analyse.etat !== "reussie" || !session.avisEnregistreId) return;
    const numero = ++ecritureReconnaissanceRef.current;
    const jeton = jetonAvisRef.current;
    const avisId = session.avisEnregistreId;
    const reconnaissance = session.analyse.reconnaissance;
    avisStylisteRef.current = { ...session, reconnaissanceJournal: "en_cours" };
    setAvisStyliste(avisStylisteRef.current);
    void enregistrerReconnaissanceAvis(avisId, reconnaissance).then((ok) => {
      if (numero !== ecritureReconnaissanceRef.current || jeton !== jetonAvisRef.current) return;
      if (ok) setAvisEnregistres((l) => (l ? l.map((a) => (a.id === avisId ? { ...a, reconnaissance } : a)) : l));
      avisStylisteRef.current = { ...avisStylisteRef.current, reconnaissanceJournal: ok ? "faite" : "echec" };
      setAvisStyliste(avisStylisteRef.current);
    });
  };
  useEffect(() => {
    etatPremiumRef.current = etatPremium;
  }, [etatPremium]);
  useEffect(() => {
    if (!ready) return;
    // Simulation du statut Premium : développement uniquement (null en
    // production, cf. simulationPremium.ts) — elle prime sur la base, y
    // compris en mode démo, pour parcourir chaque cas d'accès.
    // La condition sur NODE_ENV est écrite ICI, en constante, et pas seulement
    // dans lireProfilSimule : Next la remplace par "production" au build, le
    // minifieur réduit `simule` à null et retire tout le code de simulation du
    // bundle (vérifié le 25/09/2026 : plus aucune chaîne de simulation dans out/).
    const simule = process.env.NODE_ENV !== "production" ? lireProfilSimule() : null;
    if (!isSupabaseConfigured || !userId) {
      /* eslint-disable react-hooks/set-state-in-effect */
      if (simule) setEtatPremium(etatSimule(simule));
      setDressingLoaded(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchDressingItems(userId),
      fetchOutfitHistory(userId),
      fetchSavedLooks(userId),
      // Les avis du jour sont chargés en bloc : la tenue n'est pas encore
      // générée ici, donc on ne peut pas cibler la sienne. Un échec ne doit
      // PAS priver l'utilisatrice de son dressing — l'avis est accessoire,
      // le dressing ne l'est pas.
      fetchOutfitFeedbackDuJour(userId).catch((err) => {
        reportDressingError("fetchOutfitFeedbackDuJour", err);
        return [];
      }),
      // Le droit Premium ne jette jamais : il rend "inconnu" quand il ne sait
      // pas, et cet état n'applique aucune limite. Un échec ici ne doit pas
      // enfermer quelqu'un hors de son propre dressing.
      fetchEtatPremium(userId),
    ]).then(([items, history, savedLooks, avis, premium]) => {
      if (cancelled) return;
      setEtatPremium(simule ? etatSimule(simule) : premium);
      setState((s) => ({
        ...s,
        items,
        history,
        savedLooks,
        outfitFeedbackDuJour: avis.map((a) => ({ jour: a.jour, pieceIds: a.piece_ids, verdict: a.verdict })),
      }));
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
  // MÉTÉO RÉELLE DE LA VILLE DU PROFIL (correctif du 25/09/2026). Elle
  // n'était jamais demandée : le repli était une entrée de CITIES, à
  // température écrite en dur. Demandée à chaque changement de ville, une
  // fois le profil chargé (sinon on interrogerait la ville par défaut avant
  // la vraie).
  const [meteoVille, setMeteoVille] = useState<City | null>(null);
  const [villeStatus, setVilleStatus] = useState<"loading" | "done">("loading");
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    if (!isSupabaseConfigured || !profile.city.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMeteoVille(null);
      setVilleStatus("done");
      return;
    }
    setVilleStatus("loading");
    // 4 s au plus : la tenue attend cette réponse quand aucune position
    // n'est disponible (cf. geoLoading) — un service lent ne doit pas la
    // bloquer. Passé ce délai, repli annoncé comme tel à l'écran.
    Promise.race([
      fetchWeatherByCity(profile.city),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]).then((w) => {
      if (cancelled) return;
      setMeteoVille(w);
      setVilleStatus("done");
    });
    return () => {
      cancelled = true;
    };
  }, [ready, profile.city]);

  const geoIsLive = geoStatus === "success";
  // En attente tant que la position se cherche, OU tant que la météo de la
  // ville se cherche alors qu'aucune position n'est là pour la remplacer :
  // la tenue n'est jamais composée sur des valeurs par défaut puis changée
  // sous les yeux quand la vraie météo arrive.
  const geoLoading = geoStatus === "loading" || (!liveWeather && villeStatus === "loading");
  const { city: geoCity, source: sourceMeteo } = choisirMeteo({
    live: liveWeather,
    ville: meteoVille,
    derniere: lastKnownCity,
    geoActive: profile.prefs.geoConsent && profile.prefs.weatherFromGeo,
    villeProfil: profile.city,
    defauts: CITIES,
  });
  // La capsule par défaut (defaultCapsule ci-dessous) est composée pour la
  // saison CALENDAIRE courante (currentSeasonKey(), ex. "Été" en août),
  // volontairement indépendante de la météo réelle du jour — décidé, cf. son
  // commentaire plus bas. Filtrer ensuite ses pièces avec seulement le bucket
  // météo réel (weather.seasons) revenait donc à écarter une bonne partie de
  // cette même capsule dès que la météo du jour sort de sa saison calendaire
  // (ex. 15° et nuageux en plein août) — jusqu'à vider entièrement le pool
  // vêtement pour certaines occasions, malgré une capsule par ailleurs bien
  // fournie (signalé 23/08/2026). weather.seasons inclut donc aussi le bucket
  // de la saison calendaire : la température précise (meteoMinTemp/
  // meteoMaxTemp, cf. applyTempFilter dans logic.ts) reste le filtre fin qui
  // protège contre une pièce réellement inadaptée (ex. un short par 5°) —
  // ce bucket grossier n'est qu'un premier tri, pas la protection météo réelle.
  const weather: Weather = useMemo(
    () => weatherForDay(geoCity.temp, geoCity.label, currentSeasonKey()),
    [geoCity]
  );

  // Vestiaire universel (Supabase) : remplace le catalogue statique dès qu'il
  // est disponible. En mode démo, si la requête échoue, ou si la table/les
  // colonnes ne sont pas encore en place, on retombe silencieusement sur le
  // catalogue statique (CATALOG) — jamais d'écran vide en attendant.
  const [vestiairePool, setVestiairePool] = useState<CatalogItem[]>(CATALOG);
  /**
   * Le vestiaire Supabase a répondu (lignes, vide ou échec). La première
   * tenue l'attend (recette du 26/09/2026) : générée sur CATALOG, le repli
   * statique, elle référençait des ids qui n'existent plus une fois le
   * vestiaire chargé — l'accueil n'affichait alors que les pièces réelles,
   * parfois un sac seul.
   */
  const [vestiaireResolu, setVestiaireResolu] = useState(!isSupabaseConfigured);
  useEffect(() => {
    let cancelled = false;
    fetchVestiaireUniversel().then((rows) => {
      if (cancelled) return;
      if (rows.length) setVestiairePool(rows);
      setVestiaireResolu(true);
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

  // Le vivier de la TENUE DU JOUR suit la MÉTÉO, pas le calendrier (arbitré le
  // 15/09/2026, cf. saisonCapsulePourMeteo). Une capsule bâtie pour l'automne à
  // 14° ne contient rien de portable à 28° : le filtre de température vidait
  // alors chaque catégorie, et l'échelle de repli ressortait un trench.
  //
  // L'écran Capsule, lui, reste calendaire — il calcule sa propre capsule
  // depuis `state.capsuleSeason || currentSeasonKey()` et n'utilise pas celle-ci.
  const saisonTenue = saisonCapsulePourMeteo(weather.temp);
  const defaultCapsule = useMemo(
    () => computeDefaultCapsule(profile, weather, state.suggestedExcluded, saisonTenue, vestiairePool),
    [profile, weather, state.suggestedExcluded, saisonTenue, vestiairePool]
  );
  // Pool effectif : par catégorie, tes pièces réelles si tu en as, sinon les
  // suggestions de la capsule par défaut — jamais un mélange à l'intérieur
  // d'une même catégorie, mais jamais "tout ou rien" non plus (ajouter une
  // seule pièce réelle ne doit pas faire disparaître les suggestions des
  // autres catégories).
  /** Les clés de catégorie, dans l'ordre de `CATS` — l'ordre du pool reste celui d'avant l'extraction. */
  const CAT_KEYS = useMemo(() => CATS.map(([key]) => key), []);

  // Composition déléguée à `composeWardrobePool` (selectors.ts) plutôt que
  // recopiée ici : c'est la même fonction que les audits mesurent, si bien
  // qu'aucune dérive n'est possible entre ce que le moteur fait et ce qu'on
  // croit mesurer. Sans occasion, le comportement est celui d'avant — les
  // vraies pièces priment, catégorie par catégorie.
  const wardrobePool = useMemo(
    () => composeWardrobePool(state.items, defaultCapsule, CAT_KEYS),
    [state.items, defaultCapsule, CAT_KEYS]
  );

  const poolRef = useRef(wardrobePool);
  const weatherRef = useRef(weather);
  // Repli de résolution des actions (findPiece) : poolRef ne sert qu'à la
  // génération et ne contient, par catégorie, que les pièces réelles ou les
  // suggestions de la capsule du profil courant. vestiaireRef couvre en plus
  // toute pièce catalogue référencée par l'historique ou un look enregistré,
  // y compris celles d'une capsule de style exploré. Les pièces réelles sont
  // déjà toutes dans poolRef (cf. wardrobePool), inutile de les redoubler.
  const vestiaireRef = useRef<Item[]>(vestiairePool);
  // La capsule sert à COMPLÉTER le pool au moment de générer (cf. regen) :
  // il faut donc la garder sous la main, comme le pool et la météo.
  const capsuleRef = useRef<Item[]>(defaultCapsule);
  useEffect(() => {
    poolRef.current = wardrobePool;
    weatherRef.current = weather;
    vestiaireRef.current = vestiairePool;
    capsuleRef.current = defaultCapsule;
  }, [wardrobePool, weather, vestiairePool, defaultCapsule]);

  // pool/meteo surchargeables : les références ne sont mises à jour que par
  // un effet, donc encore périmées pendant le rendu où le profil vient de
  // changer. L'ajustement de style plus bas passe les valeurs fraîches.
  /**
   * Enregistre une tenue dans « Mes looks » SI AUCUN look ne rassemble déjà
   * exactement ces pièces, quelle que soit sa source (recette du 26/09/2026,
   * « J'adore cette tenue »). Contrairement à toggleSaveOutfitLook, jamais de
   * suppression. Un double tap avant la réponse du réseau ne crée pas deux
   * lignes : la clé est tenue « en cours » jusqu'au retour de l'insertion.
   */
  const looksEnCours = useRef(new Set<string>());
  const enregistrerTenueSiAbsente = (outfit: number[], occasion: AppState["occasion"]) => {
    const ids = clePieces(outfit);
    if (ids.length < 2) return;
    const cle = ids.join(",");
    if (looksEnCours.current.has(cle)) return;
    if (stateRef.current.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cle)) return;
    const pieces = ids.map((id) => findPiece(poolRef.current, id, vestiaireRef.current)).filter((it): it is Item => Boolean(it));
    if (violatesOuterwearRule(pieces)) return;
    const now = new Date();
    const base: Omit<SavedLook, "id"> = {
      name: "Tenue du " + now.getDate().toString().padStart(2, "0") + "/" + (now.getMonth() + 1).toString().padStart(2, "0"),
      pieceIds: ids,
      createdAt: Date.now(),
      occasion: occasion && occasion !== "all" ? occasion : undefined,
      source: "saved",
    };
    if (isSupabaseConfigured && userId) {
      looksEnCours.current.add(cle);
      insertSavedLook(userId, base)
        .then((look) => setState((st) => ({ ...st, savedLooks: [look, ...st.savedLooks] })))
        .catch((err) => reportDressingError("insertSavedLook", err))
        .finally(() => looksEnCours.current.delete(cle));
      return;
    }
    const look: SavedLook = { id: "look" + Date.now(), ...base };
    setState((st) => ({ ...st, savedLooks: [look, ...st.savedLooks] }));
  };

  const regen = (
    s: AppState,
    pool: Item[] = poolRef.current,
    w: Weather = weatherRef.current,
    capsule: Item[] = capsuleRef.current,
    /**
     * Tirage de secours de « Autre tenue » (recette du 26/09/2026) : pool
     * déjà composé par l'appelant, à ne pas recomposer. Absent : comportement
     * d'origine.
     */
    secours?: { poolDejaCompose: true }
  ): AppState => {
    // Complétion par occasion (correctif 10/09/2026, signalé : « pourquoi je
    // n'ai pas de tenues de sport »). Une catégorie dont aucune pièce réelle
    // ne sert l'occasion du jour se voit rendre les pièces de la capsule qui,
    // elles, la déclarent — sans jamais retirer une pièce réelle. Mesuré : le
    // sport passait de 100 % à 0 % de tenue dès qu'un dressing contenait des
    // pièces, parce qu'il est la seule occasion sans repli de formalité.
    // `composeWardrobePool` est idempotente sur un pool déjà composé : sur un
    // dressing vide, elle ne change rien.
    const poolGeneration =
      s.occasion && !secours ? composeWardrobePool(pool, capsule, CAT_KEYS, { completerPourOccasion: s.occasion }) : pool;
    const result = generateOutfitWithFallback(
      poolGeneration,
      w,
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
      outfitOccasionRelachee: result.occasionRelachee,
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
    if (ready && dressingLoaded && !geoLoading && vestiaireResolu && !stateRef.current.outfit.length) {
      setState((s) => regen(withDefaultOccasion(s)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dressingLoaded, geoLoading, vestiaireResolu, defaultCapsule]);

  // RÉPARATION D'UNE TENUE DEVENUE INCOMPLÈTE (recette du 26/09/2026). Si des
  // pièces de la tenue affichée ne se retrouvent plus — vestiaire rechargé,
  // pièce supprimée du dressing —, elle n'est plus la tenue proposée : on en
  // compose une nouvelle, sur le vivier à jour. Ce n'est pas une alternative
  // demandée, elle ne passe donc pas par le quota. L'exploration d'un style
  // garde sa tenue (elle a son propre tirage).
  useEffect(() => {
    if (!ready || !dressingLoaded || geoLoading || !vestiaireResolu) return;
    const s = stateRef.current;
    if (!s.outfit.length || s.exploredStyleId) return;
    const resolution = [...s.items, ...vestiairePool];
    const perdue = s.outfit.some((id) => !resolution.some((p) => p.id === id));
    if (perdue) setState((st) => regen(st, wardrobePool, weather, defaultCapsule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vestiairePool, state.items, ready, dressingLoaded, geoLoading, vestiaireResolu]);

  // Changer de style (ou de genre) redéfinit la capsule par défaut, donc le
  // vivier de suggestions : la tenue affichée doit suivre immédiatement.
  // Sans ça, elle restait celle de l'ancien style jusqu'à la prochaine
  // action — l'effet d'amorçage ci-dessus ne régénère que lorsque
  // state.outfit est vide, ce qui n'est plus le cas après le premier
  // chargement (signalé le 28/08/2026).
  //
  // Ajustement pendant le rendu, comme l'invalidation de l'exploration plus
  // haut, et non un effet : la régénération reçoit wardrobePool et weather
  // directement, déjà recalculés pour le nouveau style. Les références
  // poolRef/weatherRef, elles, ne sont mises à jour que par un effet — s'en
  // servir ici régénérerait la tenue sur l'ancien vivier.
  const [dernierStyleRegenKey, setDernierStyleRegenKey] = useState(profileStyleKey);
  if (profileStyleKey !== dernierStyleRegenKey) {
    setDernierStyleRegenKey(profileStyleKey);
    if (ready && dressingLoaded && !geoLoading) {
      setState((s) => {
        // Aucune tenue encore générée : l'effet d'amorçage s'en charge.
        if (!s.outfit.length) return s;
        // Exploration en cours : la tenue affichée vient délibérément d'un
        // autre style que celui du profil, la remplacer serait un contresens.
        // Si l'exploration est devenue caduque, le bloc ligne ~350 l'a déjà
        // annulée et ce garde-fou ne s'applique donc plus.
        if (s.exploredStyleId) return s;
        return regen(s, wardrobePool, weather, defaultCapsule);
      });
    }
  }

  const go = (screen: Screen) => setState((s) => ({ ...s, screen }));
  /** Ouvre le formulaire d'ajout, ou Premium quand la limite gratuite est atteinte (cf. openAdd). */
  const ouvrirAjout = (ouvrir: (s: AppState) => AppState) =>
    setState((s) =>
      peutAjouter(etatPremiumRef.current, s.items.length)
        ? ouvrir(s)
        : { ...s, premiumReturn: s.screen, premiumOrigine: null, screen: "premium" }
    );

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
    goPlanifier: () => go("planifier"),
    goNeverWorn: () => go("neverworn"),
    goWardrobePieces: (filtre) => setState((s) => ({ ...s, filtrePieces: filtre ?? null, screen: "wardrobePieces" })),
    goLooks: () => go("looks"),
    // LE RETOUR DU PROFIL NE MÉMORISE JAMAIS UN DE SES SOUS-ÉCRANS (25/09).
    // Avant : revenir de « Modifier » au profil enregistrait « Modifier »
    // comme écran de retour, et le chevron du profil y renvoyait — profil →
    // édition → profil → édition, en boucle. Depuis un sous-écran du profil,
    // on garde l'écran d'où l'on était venu au départ.
    goProfile: () =>
      setState((s) => ({
        ...s,
        profileReturn: SOUS_ECRANS_PROFIL.has(s.screen) ? s.profileReturn : s.screen,
        screen: "profile",
      })),
    goPreferences: () => go("preferences"),
    goAccount: () => go("account"),
    goLegal: () => setState((s) => ({ ...s, legalReturn: s.screen === "legal" ? s.legalReturn : s.screen, screen: "legal" })),
    goPremium: (origine) =>
      setState((s) => ({
        ...s,
        premiumReturn: s.screen === "premium" ? s.premiumReturn : s.screen,
        premiumOrigine: origine ?? null,
        screen: "premium",
      })),
    goAvisStyliste: () => go("avisStyliste"),
    definirPhotoAvis: (photo) => {
      const avant = avisStylisteRef.current.photo;
      if (avant && avant.url !== photo?.url) URL.revokeObjectURL(avant.url);
      jetonAvisRef.current += 1;
      analyseAvisEnCoursRef.current = false;
      const suivant: SessionAvisStyliste = { photo, analyse: { etat: "inactive" }, enregistrement: "aucun" };
      avisStylisteRef.current = suivant;
      setAvisStyliste(suivant);
    },
    revenirAApercuAvis: () => {
      if (analyseAvisEnCoursRef.current) return;
      const suivant: SessionAvisStyliste = { photo: avisStylisteRef.current.photo, analyse: { etat: "inactive" }, enregistrement: "aucun" };
      avisStylisteRef.current = suivant;
      setAvisStyliste(suivant);
    },
    lancerAvisStyliste: () => {
      const photo = avisStylisteRef.current.photo;
      if (!photo || analyseAvisEnCoursRef.current) return;
      analyseAvisEnCoursRef.current = true;
      const jeton = ++jetonAvisRef.current;
      avisStylisteRef.current = { photo, analyse: { etat: "en_cours" }, enregistrement: "aucun" };
      setAvisStyliste(avisStylisteRef.current);
      void demanderAvis(photo.fichier, contexteDepuisProfil(profile)).then((r) => {
        if (jeton !== jetonAvisRef.current) return;
        analyseAvisEnCoursRef.current = false;
        const suivant: SessionAvisStyliste = {
          photo,
          enregistrement: "aucun",
          analyse: r.ok
            ? { etat: "reussie", analyseId: r.analyseId, avis: r.avis, dressing: r.dressing, reconnaissance: r.reconnaissance }
            : { etat: "echouee", code: r.code, raison: r.raison },
        };
        avisStylisteRef.current = suivant;
        setAvisStyliste(suivant);
        // ENREGISTREMENT AUTOMATIQUE (26/09/2026, brief « Mes avis de
        // styliste ») : un avis reçu rejoint le Journal sans geste de plus —
        // il apparaît en tête de la section. La décision d'origine (§14,
        // action volontaire) est levée ; l'avis reste supprimable depuis son
        // détail, photo comprise. Un échec est dit à l'écran, avec Réessayer.
        if (r.ok) actions.enregistrerAvisStyliste();
      });
    },
    enregistrerAvisStyliste: () => {
      const session = avisStylisteRef.current;
      if (session.analyse.etat !== "reussie" || session.enregistrement === "en_cours" || session.enregistrement === "fait") return;
      if (!userId) {
        avisStylisteRef.current = { ...session, enregistrement: "echec" };
        setAvisStyliste(avisStylisteRef.current);
        return;
      }
      const analyse = session.analyse;
      const jeton = jetonAvisRef.current;
      avisStylisteRef.current = { ...session, enregistrement: "en_cours" };
      setAvisStyliste(avisStylisteRef.current);
      void enregistrerAvis(userId, {
        analyseId: analyse.analyseId,
        avis: analyse.avis,
        pieces: analyse.dressing,
        photo: session.photo?.fichier ?? null,
      }).then((enregistre) => {
        if (enregistre) setAvisEnregistres(null); // relu au prochain affichage du Journal
        if (jeton !== jetonAvisRef.current) return;
        avisStylisteRef.current = { ...avisStylisteRef.current, enregistrement: enregistre ? "fait" : "echec", avisEnregistreId: enregistre?.id };
        setAvisStyliste(avisStylisteRef.current);
        // La reconnaissance suit l'avis, dans une écriture à part.
        if (enregistre && analyse.reconnaissance.length) synchroniserReconnaissance();
      });
    },
    corrigerReconnaissanceAvis: (index, pieceId) => {
      const session = avisStylisteRef.current;
      if (session.analyse.etat !== "reussie") return;
      avisStylisteRef.current = { ...session, analyse: { ...session.analyse, reconnaissance: corrigerReconnaissance(session.analyse.reconnaissance, index, pieceId) } };
      setAvisStyliste(avisStylisteRef.current);
      synchroniserReconnaissance();
    },
    reessayerReconnaissanceJournal: () => synchroniserReconnaissance(),
    corrigerReconnaissanceEnregistree: async (avisId, index, pieceId) => {
      const avis = avisEnregistres?.find((a) => a.id === avisId);
      if (!avis) return false;
      const corrigee = corrigerReconnaissance(avis.reconnaissance, index, pieceId);
      const remplacer = (r: VetementReconnu[]) => setAvisEnregistres((l) => (l ? l.map((a) => (a.id === avisId ? { ...a, reconnaissance: r } : a)) : l));
      remplacer(corrigee);
      const ok = await enregistrerReconnaissanceAvis(avisId, corrigee);
      // Refusée : la correction est retirée — l'écran ne montre jamais ce qui n'est pas gardé.
      if (!ok) remplacer(avis.reconnaissance);
      return ok;
    },
    chargerAvisEnregistres: () => {
      if (!userId) {
        setAvisEnregistres([]);
        return;
      }
      void listerAvis(userId).then(setAvisEnregistres);
    },
    ouvrirAvisEnregistre: (id) => {
      setAvisEnregistreActifId(id);
      setAvisEnregistreRetour(stateRef.current.screen === "avisTous" ? "avisTous" : "history");
      go("avisEnregistre");
    },
    fermerAvisEnregistre: () => go(avisEnregistreRetour),
    goAvisTous: () => go("avisTous"),
    supprimerAvisEnregistre: async (id) => {
      const avis = avisEnregistres?.find((a) => a.id === id);
      if (!avis) return false;
      const ok = await supprimerAvis(avis);
      if (ok) setAvisEnregistres((l) => (l ? l.filter((a) => a.id !== id) : l));
      return ok;
    },
    verifierEtatPremium: async () => {
      const simule = process.env.NODE_ENV !== "production" ? lireProfilSimule() : null;
      if (simule) return etatSimule(simule);
      if (!isSupabaseConfigured || !userId) return "inconnu";
      // À ARBITRER: délai maximal de la vérification (valeur réversible : 5 s).
      const delai = new Promise<EtatPremium>((resolve) => setTimeout(() => resolve("inconnu"), 5000));
      const etat = await Promise.race([fetchEtatPremium(userId), delai]);
      if (etat !== "inconnu") setEtatPremium(etat);
      return etat;
    },
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
    // LIMITE DU DRESSING GRATUIT À L'OUVERTURE DU FORMULAIRE (25/09/2026,
    // refonte Dressing : « aucune possibilité silencieuse d'ajouter une 21e
    // pièce »). saveItem refusait déjà la 21e pièce, mais EN SILENCE, après
    // la photo et la saisie : depuis l'Accueil, la Tenue, la Capsule, « Mes
    // pièces » ou la création de look, le formulaire s'ouvrait puis
    // n'enregistrait rien. Les trois portes d'entrée du formulaire mènent
    // désormais à Premium d'emblée. Même règle, même source (peutAjouter) :
    // un droit inconnu n'applique aucune limite ; la garde de saveItem reste.
    openAdd: () => ouvrirAjout((s) => ({ ...s, screen: "add" })),
    openAddBag: () => ouvrirAjout((s) => ({ ...s, screen: "add", addCat: "sac", addName: "Sac " })),
    openAddForCategory: (cat) =>
      ouvrirAjout((s) => ({ ...s, addCat: cat, addCatTouched: true, addReturn: s.screen, screen: "add" })),
    ajouterPieceNonReconnue: (cat, nom) =>
      ouvrirAjout((s) => ({
        ...s,
        addCat: cat,
        addCatTouched: true,
        // Touché : la suggestion automatique de nom ne l'écrase pas.
        addName: nom,
        addNameTouched: nom.length > 0,
        addReturn: s.screen,
        screen: "add",
      })),
    addBack: () =>
      setState((s) => ({
        ...s,
        replacingId: null,
        editingId: null,
        addReturn: null,
        // Un nom prérempli depuis un avis ne survit pas à l'abandon : il
        // réapparaîtrait au prochain ajout, sans rapport avec lui.
        ...(s.addReturn === "avisStyliste" || s.addReturn === "avisEnregistre" ? { addName: "", addNameTouched: false } : {}),
        screen: s.addReturn || (s.editingId != null ? "piece" : "wardrobe"),
      })),
    setAuthName: (v) => setState((s) => ({ ...s, authName: v })),

    onbBack: () =>
      setState((s) => (s.onbStep === 0 ? { ...s, screen: "welcome" } : { ...s, onbStep: s.onbStep - 1 })),
    onbNext: () =>
      setState((s) => (s.onbStep >= 2 ? { ...s, screen: "auth" } : { ...s, onbStep: s.onbStep + 1 })),

    openItem: (id, suggested = false) =>
      setState((s) => ({ ...s, activeId: id, activeSuggested: suggested, pieceReturn: s.screen, screen: "piece" })),
    openItemOutfits: (id, suggested = true, variations) =>
      setState((s) => ({
        ...s,
        activeId: id,
        activeSuggested: suggested,
        itemOutfitsReturn: s.screen,
        ideesTenuesPretes: variations ? { pivotId: id, variations } : null,
        screen: "itemOutfits",
      })),
    // Affiche la combinaison choisie sur l'écran Tenue (recette 19/08/2026) :
    // conserve l'occasion correspondante, jamais d'enregistrement comme
    // portée ni de remplacement automatique en dehors de ce clic explicite.
    viewItemOutfit: (ids, occasion) =>
      setState((s) => ({
        ...s,
        outfit: ids,
        outfitMissingCats: [],
        outfitFormalityDowngraded: false,
        outfitOccasionRelachee: false,
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
      const retiree = s.items.filter((it) => it.id === deletedId);
      const photos = photosDevenuesOrphelines(retiree, s.items.filter((it) => it.id !== deletedId));
      setState((st) => ({ ...st, items: st.items.filter((it) => it.id !== deletedId), screen: st.pieceReturn }));
      if (isSupabaseConfigured && userId) {
        // Suppression best-effort : la pièce reste retirée localement même en cas d'échec réseau.
        deleteDressingItem(deletedId).catch((err) => reportDressingError("deleteDressingItem", err));
        deleteDressingPhotos(photos).catch((err) => reportDressingError("deleteDressingPhotos", err));
      }
    },

    removeItems: (ids) => {
      // Même contrat que removeActive, appliqué à une sélection : retrait
      // local immédiat, puis suppression best-effort en base pièce par pièce.
      // Un échec réseau sur l'une n'empêche pas les autres — et la pièce
      // reste retirée localement, comme pour une suppression unitaire.
      const aRetirer = new Set(ids);
      if (!aRetirer.size) return;
      const avant = stateRef.current.items;
      const photos = photosDevenuesOrphelines(
        avant.filter((it) => aRetirer.has(it.id)),
        avant.filter((it) => !aRetirer.has(it.id))
      );
      setState((st) => ({ ...st, items: st.items.filter((it) => !aRetirer.has(it.id)) }));
      if (isSupabaseConfigured && userId) {
        for (const id of aRetirer) {
          deleteDressingItem(id).catch((err) => reportDressingError("deleteDressingItem", err));
        }
        deleteDressingPhotos(photos).catch((err) => reportDressingError("deleteDressingPhotos", err));
      }
    },

    dismissSuggested: (id) =>
      setState((s) => ({ ...s, suggestedExcluded: [...s.suggestedExcluded, id] })),
    startReplace: (item, retour) =>
      setState((s) => {
        const img = resolveItemImage(item);
        return {
          ...s,
          ...(retour ? { addReturn: retour } : {}),
          replacingId: item.id,
          addName: item.name,
          addNameTouched: true,
          addBrand: item.brand ?? "",
          addCat: item.cat,
          addCatTouched: true,
          addColor: { name: item.color, hex: item.hex },
          addColorTouched: true,
          addSize: null,
          addPhotoUrl: img.url ?? null,
          addSeason: item.season,
          addOccasion: item.occasion?.length ? item.occasion : s.addOccasion,
          addOccasionTouched: true,
          addShoeType: item.cat === "chaussures" ? item.shoeType ?? null : null,
          addShoeTypeTouched: Boolean(item.shoeType),
          addMatiere: item.matiere ?? null,
          addMatiereTouched: Boolean(item.matiere),
          addCoupe: item.coupe ?? null,
          addCoupeTouched: Boolean(item.coupe),
          addSacType: item.cat === "sac" ? item.sacType ?? null : null,
          addSacTypeTouched: Boolean(item.sacType),
          addBijouType: item.cat === "bijou" ? item.bijouType ?? null : null,
          addBijouTypeTouched: Boolean(item.bijouType),
          addAccessoireType: item.cat === "accessoire" ? item.accessoireType ?? null : null,
          addAccessoireTypeTouched: Boolean(item.accessoireType),
          addSubtype: item.subtype ?? null,
          addSubtypeTouched: Boolean(item.subtype),
          screen: "add",
        };
      }),
    startEditItem: (item) =>
      setState((s) => {
        const img = resolveItemImage(item);
        return {
          ...s,
          editingId: item.id,
          addName: item.name,
          addNameTouched: true,
          addBrand: item.brand ?? "",
          addCat: item.cat,
          addCatTouched: true,
          addColor: { name: item.color, hex: item.hex },
          addColorTouched: true,
          addSize: item.size ?? null,
          addPhotoUrl: item.photoUrl ?? img.url ?? null,
          addSeason: item.season,
          addOccasion: item.occasion?.length ? item.occasion : s.addOccasion,
          addOccasionTouched: true,
          addShoeType: item.cat === "chaussures" ? item.shoeType ?? null : null,
          addShoeTypeTouched: Boolean(item.shoeType),
          addMatiere: item.matiere ?? null,
          addMatiereTouched: Boolean(item.matiere),
          addCoupe: item.coupe ?? null,
          addCoupeTouched: Boolean(item.coupe),
          addSacType: item.cat === "sac" ? item.sacType ?? null : null,
          addSacTypeTouched: Boolean(item.sacType),
          addBijouType: item.cat === "bijou" ? item.bijouType ?? null : null,
          addBijouTypeTouched: Boolean(item.bijouType),
          addAccessoireType: item.cat === "accessoire" ? item.accessoireType ?? null : null,
          addAccessoireTypeTouched: Boolean(item.accessoireType),
          addSubtype: item.subtype ?? null,
          addSubtypeTouched: Boolean(item.subtype),
          screen: "add",
        };
      }),

    setCatFilter: (k) => setState((s) => ({ ...s, catFilter: k })),

    setAddName: (v) =>
      setState((s) => ({
        ...s,
        addName: v,
        addNameTouched: true,
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
          addOccasion: s.addOccasionTouched ? s.addOccasion : suggestOccasions(k),
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
                const finalColor = s.addColorTouched || !a.colorName || !a.colorHex ? s.addColor : { name: a.colorName, hex: a.colorHex };
                const finalMatiere = s.addMatiereTouched ? s.addMatiere : a.matiere ?? s.addMatiere;
                const finalSubtype = s.addSubtypeTouched || !catMatches ? s.addSubtype : a.subtype ?? s.addSubtype;
                const finalShoeType = s.addShoeTypeTouched || !catMatches ? s.addShoeType : a.shoeType ?? s.addShoeType;
                return {
                  ...s,
                  addPhotoAnalyzing: false,
                  addCat: finalCat,
                  addColor: finalColor,
                  addMatiere: finalMatiere,
                  addSubtype: finalSubtype,
                  addShoeType: finalShoeType,
                  addSacType: s.addSacTypeTouched || !catMatches ? s.addSacType : a.sacType ?? s.addSacType,
                  addBijouType: s.addBijouTypeTouched || !catMatches ? s.addBijouType : a.bijouType ?? s.addBijouType,
                  addAccessoireType:
                    s.addAccessoireTypeTouched || !catMatches ? s.addAccessoireType : a.accessoireType ?? s.addAccessoireType,
                  // Nom composé et occasions recommandées (recette 24/08/2026,
                  // écran "Ajouter une pièce" repensé) — jamais imposés, cf.
                  // addNameTouched/addOccasionTouched.
                  addName: !s.addNameTouched && !s.addName ? suggestName(finalCat, finalSubtype, finalMatiere, finalColor.name) : s.addName,
                  addOccasion: s.addOccasionTouched ? s.addOccasion : suggestOccasions(finalCat, finalShoeType),
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
        addOccasionTouched: true,
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
      // LIMITE DU DRESSING GRATUIT (24/09/2026). Dernière ligne de défense :
      // l'écran Dressing renvoie déjà vers Premium avant d'ouvrir le
      // formulaire, mais on peut arriver ici par d'autres chemins.
      //
      // Ne s'applique QU'À LA CRÉATION : `editingId` non nul veut dire
      // qu'on modifie une pièce existante, et corriger une pièce déjà saisie
      // n'ajoute rien au dressing. Fermer la modification d'un dressing
      // au-dessus du plafond serait punir quelqu'un pour des pièces qu'il
      // possédait avant la limite.
      if (!s.editingId && !peutAjouter(etatPremiumRef.current, s.items.length)) return;
      // Contrainte produit : pas de sauvegarde tant que la saison n'est pas confirmée,
      // ni tant que le type de chaussure n'est pas choisi pour cette catégorie (R-B6),
      // ni tant que le sous-type n'est pas choisi pour veste/manteau (SUBTYPE_REQUIRED).
      if (!s.addSeason) return;
      if (s.addCat === "chaussures" && !s.addShoeType) return;
      if (SUBTYPE_REQUIRED.includes(s.addCat) && !s.addSubtype) return;
      // Jamais persister l'aperçu local (blob:) : attendre la fin de l'upload
      // Storage plutôt que de sauvegarder une URL qui redeviendrait invalide.
      if (s.addPhotoUploading) return;
      // Modification d'une pièce existante (recette 24/08/2026, PieceScreen
      // "Modifier les informations"/"Changer la photo") : worn/wornPrev/
      // createdAt viennent toujours de la pièce d'origine, jamais du
      // formulaire (qui n'en a pas connaissance) — sinon "Modifier"
      // effacerait silencieusement le statut de port.
      const editingId = s.editingId;
      const addReturn = s.addReturn;
      const original = editingId != null ? s.items.find((i) => i.id === editingId) : undefined;
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
        // Même déduction qu'à la relecture depuis Supabase (accessoireTypeFor) :
        // sans elle, la même casquette n'aurait pas le même type avant et après
        // un rechargement.
        accessoireType: accessoireTypeFor(s.addCat, s.addAccessoireType, (s.addName || "").trim() || "Nouvelle pièce"),
        subtype: s.addSubtype || undefined,
        photoUrl: s.addPhotoUrl || undefined,
        worn: original ? original.worn : null,
        wornPrev: original?.wornPrev,
      };
      const resetFields = (st: AppState): AppState => ({
        ...st,
        suggestedExcluded: st.replacingId ? [...st.suggestedExcluded, st.replacingId] : st.suggestedExcluded,
        replacingId: null,
        editingId: null,
        addReturn: null,
        addName: "",
        addNameTouched: false,
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
        addOccasionTouched: false,
        screen: addReturn || (editingId != null ? "piece" : "wardrobe"),
      });
      if (editingId != null) {
        // "Changer la photo" laissait l'ancienne dans le bucket, elle aussi
        // sans plus rien pour la désigner. Même règle que pour un retrait :
        // seule une photo personnelle que plus aucune pièce ne référence
        // s'en va.
        const avant = stateRef.current.items;
        const ancienne = avant.find((it) => it.id === editingId);
        const photos =
          ancienne && ancienne.photoUrl !== base.photoUrl
            ? photosDevenuesOrphelines([ancienne], avant.filter((it) => it.id !== editingId))
            : [];
        setState((st) => ({
          ...resetFields(st),
          items: st.items.map((it) => (it.id === editingId ? { ...it, ...base, id: editingId, createdAt: it.createdAt } : it)),
        }));
        if (isSupabaseConfigured && userId) {
          updateDressingItem(editingId, base).catch((err) => reportDressingError("updateDressingItem", err));
          deleteDressingPhotos(photos).catch((err) => reportDressingError("deleteDressingPhotos", err));
        }
        return;
      }
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

    setOccasion: (o) => setState((s) => regen({ ...s, occasion: o, occasionManual: true })),
    setWorkMode: (m) => setState((s) => regen({ ...s, workMode: m })),
    setTravelMode: (m) => setState((s) => regen({ ...s, travelMode: m, travelTipDismissed: false })),
    dismissTravelTip: () => setState((s) => ({ ...s, travelTipDismissed: true })),
    setDateContext: (c) => setState((s) => regen({ ...s, dateContext: c })),
    setCapsuleSeason: (s) => setState((st) => ({ ...st, capsuleSeason: s })),
    setExploredStyle: (id) => setState((st) => ({ ...st, exploredStyleId: id })),
    clearExploredStyle: () => setState((st) => ({ ...st, exploredStyleId: null })),
    // "Voir ma tenue" (Capsule → Tenue) et "Autre tenue" pendant l'exploration
    // (recette 24/08/2026) : même pipeline pur que regen() (computeDefaultCapsule
    // → generateOutfitWithFallback), mais sur la capsule du style exploré —
    // jamais wardrobePool/profile.styles, jamais regen() lui-même. Un seul
    // tirage aléatoire par appel (comme generateOutfit) : rappelé tel quel,
    // "Autre tenue" produit donc naturellement un nouveau tirage.
    viewExploredOutfit: () =>
      setState((s) => {
        if (!s.exploredStyleId) return s;
        const exploredProfile = { ...profile, styles: [s.exploredStyleId] };
        // Même règle que la tenue du jour : à défaut de saison explicitement
        // choisie sur l'écran Capsule, c'est la météo qui décide, pas le
        // calendrier — une tenue explorée est une tenue, elle ne doit pas
        // échapper au correctif du 15/09.
        const season = s.capsuleSeason || saisonCapsulePourMeteo(weatherRef.current.temp);
        const capsulePool = computeDefaultCapsule(exploredProfile, weatherRef.current, s.suggestedExcluded, season, vestiairePool);
        const tirer = () =>
          generateOutfitWithFallback(
            capsulePool,
            weatherRef.current,
            s.occasion || "all",
            s.workMode,
            s.dateContext,
            paletteHexes(profile),
            profile.gender,
            // Même saison que la capsule construite juste au-dessus : sans elle,
            // la génération redérivait son bucket de la température réelle et
            // pouvait écarter les pièces de la capsule qu'elle vient de recevoir
            // (correctif 29/08/2026).
            season
          );
        // « Autre tenue » en exploration : même variation réelle que la tenue
        // du jour (recette du 26/09/2026). Première ouverture : aucune tenue
        // courante du style exploré, la première candidate convient.
        const { choix: result } = choisirVariation(tirer, (r) => r.ids, s.outfit, new Set(s.tenuesVues), capsulePool);
        return {
          ...s,
          outfit: result.ids,
          outfitMissingCats: result.missingCats,
          outfitFormalityDowngraded: result.formalityDowngraded,
          outfitOccasionRelachee: result.occasionRelachee,
          outfitNoCompleteOutfit: result.noCompleteOutfit,
          outfitFailureReason: result.reason ?? null,
          outfitValidated: false,
          dismissedSuggestions: [],
          screen: "tenues",
        };
      }),
    swapPiece: (id, cat) =>
      setState((s) => {
        const outfitItems = s.outfit
          .map((oid) => findPiece(poolRef.current, oid, vestiaireRef.current))
          .filter((it): it is Item => Boolean(it));
        return {
          ...s,
          outfit: swapOutfitPiece(outfitItems, poolRef.current, id, cat, s.occasion || "all", s.workMode, s.dateContext, weatherRef.current),
          dismissedSuggestions: [],
        };
      }),
    addPieceToOutfit: (id) =>
      setState((s) => (s.outfit.includes(id) ? s : { ...s, outfit: [...s.outfit, id] })),
    removePieceFromOutfit: (id) =>
      setState((s) => ({ ...s, outfit: s.outfit.filter((oid) => oid !== id) })),
    requestCatalogImage,
    // "Régénérer" = proposer une autre combinaison, jamais générer de
    // nouveaux visuels (recette 19/08/2026) : conserve météo/occasion/
    // présentiel-télétravail/capsule/profil (déjà les seules entrées de
    // regen()), et essaie plusieurs tirages pour éviter de retomber tout de
    // suite sur exactement la même combinaison (comparaison par ensemble
    // d'ids, ordre indifférent) — sans garantie absolue si peu d'options
    // existent, jamais bloquant.
    // VARIATION RÉELLE (recette du 26/09/2026). La garde d'avant — identité
    // stricte des ids, 5 essais — laissait passer la même tenue avec un autre
    // bijou. `choisirVariation` juge sur les pièces principales et évite les
    // tenues déjà vues dans la session ou refusées aujourd'hui (« Pas pour
    // moi »). Chaque candidate reste produite par le moteur, toutes règles
    // comprises.
    //
    // SECOURS PAR LA CAPSULE (arbitrage de la propriétaire, même jour) : si le
    // dressing seul ne permet aucune autre base — la priorité au réel verrouille
    // le socle dès qu'une catégorie a une pièce réelle —, un second tour tire
    // dans le dressing PRIVÉ des pièces principales réelles de la tenue quittée,
    // complété par la capsule entière. Là où il reste d'autres pièces réelles,
    // elles priment toujours (priorité au réel intacte, moteur inchangé) ; là
    // où il n'en reste pas, la capsule prend le relais. Les filtres durs
    // (météo, occasion, formalité, R-B*) ne bougent pas.
    regenOutfit: () =>
      setState((s) => {
        const resolution = [...s.items, ...vestiaireRef.current];
        const jour = jourLocal();
        const evitees = new Set([
          ...s.tenuesVues,
          ...s.outfitFeedbackDuJour
            .filter((a) => a.jour === jour && a.verdict === "pas_aujourdhui")
            .map((a) => clePrincipale(a.pieceIds, resolution)),
        ]);
        const idsDe = (st: AppState) => st.outfit;
        const premier = choisirVariation(() => regen(s), idsDe, s.outfit, evitees, resolution);
        let choix = premier.choix;
        if (!premier.substantielle) {
          const quittees = new Set(piecesPrincipales(s.outfit, resolution));
          const poolSecours = [...s.items.filter((i) => !quittees.has(i.id)), ...capsuleRef.current];
          const secours = choisirVariation(
            () => regen(s, poolSecours, weatherRef.current, capsuleRef.current, { poolDejaCompose: true }),
            idsDe,
            s.outfit,
            evitees,
            resolution
          );
          if (secours.substantielle) choix = secours.choix;
        }
        const quittee = clePrincipale(s.outfit, resolution);
        return { ...choix, tenuesVues: quittee ? [...s.tenuesVues, quittee].slice(-30) : s.tenuesVues };
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
      const outfitPieces = s.outfit.map((id) => findPiece(poolRef.current, id, vestiaireRef.current)).filter((it): it is Item => Boolean(it));
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
    choisirRevente: async (id, choix) => {
      const avant = stateRef.current.items.find((it) => it.id === id);
      if (!avant) return false;
      const precedent = avant.revente;
      const poser = (valeur: ChoixRevente | undefined) =>
        setState((st) => ({ ...st, items: st.items.map((it) => (it.id === id ? { ...it, revente: valeur } : it)) }));
      poser(choix ?? undefined);
      if (!isSupabaseConfigured || !userId) return true;
      try {
        await updateDressingItemRevente(id, choix);
        return true;
      } catch (err) {
        // Cas attendu tant que la migration 0035 n'est pas exécutée : la
        // colonne n'existe pas. Pas de bandeau global — l'écran le dit.
        console.error("[dressing] échec updateDressingItemRevente", err);
        poser(precedent);
        return false;
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
    reWear: (ids, options) =>
      setState((s) => ({
        ...s,
        outfit: ids.filter((id) => findPiece(poolRef.current, id, vestiaireRef.current)),
        outfitValidated: false,
        screen: options?.rester ? s.screen : "tenues",
      })),

    openOpinionShare: (source) => setState((s) => ({ ...s, avisSource: source ?? null, screen: "opinionShare" })),
    // Retour à l'écran d'où l'on vient : la tenue du jour, ou le plan partagé.
    closeOpinionShare: () =>
      setState((s) =>
        s.avisSource
          ? { ...s, planARouvrir: s.avisSource.plan, avisSource: null, screen: "planifier" }
          : { ...s, screen: "tenues" }
      ),
    oublierPlanARouvrir: () => setState((s) => (s.planARouvrir ? { ...s, planARouvrir: null } : s)),
    planifierComposition: (ids, demain) => setState((s) => ({ ...s, planComposition: { pieceIds: ids, demain }, screen: "planifier" })),
    oublierPlanComposition: () => setState((s) => (s.planComposition ? { ...s, planComposition: null } : s)),

    goCreateLook: (seedId) =>
      setState((s) => ({
        ...s,
        lookDraftIds: seedId != null ? [seedId] : [],
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
    // Persistance saved_looks (recette 23/08/2026, signalé : les looks
    // enregistrés disparaissaient au rechargement — jamais persistés jusque
    // là, contrairement à dressing_items/outfit_history). Même prudence que
    // saveItem : on attend l'id réel renvoyé par Supabase avant d'ajouter le
    // look au state, pour qu'une suppression dans la même session (id encore
    // local) ne cible jamais une ligne qui n'existe pas encore en base.
    /**
     * Avis rapide sur la tenue du jour.
     *
     * OPTIMISTE, ET C'EST DÉLIBÉRÉ : le state passe avant l'appel réseau,
     * parce qu'un avis est un geste d'une seconde et qu'attendre la base
     * ferait clignoter le bouton. En cas d'échec, l'état local est REVENU en
     * arrière plutôt que laissé à mentir — c'est exactement le défaut que
     * cette fonctionnalité corrige.
     *
     * Repasser le même verdict le RETIRE : un avis se révise, et sans ce
     * geste il n'existerait aucun moyen de revenir sur un tap involontaire.
     *
     * Hors Supabase (mode démo), l'avis vit en mémoire : la tenue s'affiche,
     * le bouton répond, rien n'est écrit. Pas de faux message d'erreur pour
     * une session qui n'a pas de compte.
     */
    setOutfitFeedback: (verdict) => {
      const s = stateRef.current;
      if (!s.outfit.length) return;
      const pieceIds = clePieces(s.outfit);
      const jour = jourLocal();
      const avant = s.outfitFeedbackDuJour;
      const { liste: apres, retire } = appliquerAvis(avant, { jour, pieceIds, verdict });
      setState((st) => ({ ...st, outfitFeedbackDuJour: apres }));
      // « J'adore » ENREGISTRE LE LOOK (recette du 26/09/2026) : un avis sans
      // conséquence n'en était pas un. Idempotent — jamais deux copies —, et
      // retirer l'avis ne supprime pas le look : il vit désormais dans « Mes
      // looks », où elle peut le retirer elle-même.
      if (verdict === "adore" && !retire) enregistrerTenueSiAbsente(s.outfit, s.occasion);
      if (!isSupabaseConfigured || !userId) return;
      const occasion = s.occasion && s.occasion !== "all" ? s.occasion : null;
      const ecriture = retire
        ? deleteOutfitFeedback(userId, jour, pieceIds)
        : upsertOutfitFeedback(userId, { pieceIds, occasion, verdict });
      ecriture.catch((err) => {
        reportDressingError(retire ? "deleteOutfitFeedback" : "upsertOutfitFeedback", err);
        // Retour en arrière : mieux vaut un bouton qui n'a pas pris que la
        // trace d'un avis jamais enregistré.
        setState((st) => ({ ...st, outfitFeedbackDuJour: avant }));
      });
    },
    saveLook: () => {
      const s = stateRef.current;
      // Un look doit rassembler au moins 2 pièces pour avoir du sens.
      if (s.lookDraftIds.length < 2) return;
      // R-B9 — seule règle bloquante : une veste/un manteau seul sans pièce de base ne peut pas être enregistré.
      const draftPieces = s.lookDraftIds.map((id) => s.items.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
      if (violatesOuterwearRule(draftPieces)) return;
      const now = new Date();
      const defaultName =
        "Look du " + now.getDate().toString().padStart(2, "0") + "/" + (now.getMonth() + 1).toString().padStart(2, "0");
      const base: Omit<SavedLook, "id"> = {
        name: s.lookDraftName.trim() || defaultName,
        pieceIds: [...s.lookDraftIds],
        createdAt: Date.now(),
        occasion: s.lookDraftOccasion !== "all" ? s.lookDraftOccasion : undefined,
        source: "created",
      };
      const resetDraft = (st: AppState): AppState => ({
        ...st,
        lookDraftIds: [],
        lookDraftName: "",
        lookDraftOccasion: "all",
        lookDraftDismissed: [],
        screen: "wardrobe",
      });
      if (isSupabaseConfigured && userId) {
        setState(resetDraft);
        insertSavedLook(userId, base)
          .then((look) => setState((st) => ({ ...st, savedLooks: [look, ...st.savedLooks] })))
          .catch((err) => reportDressingError("insertSavedLook", err));
        return;
      }
      const look: SavedLook = { id: "look" + Date.now(), ...base };
      setState((st) => ({ ...resetDraft(st), savedLooks: [look, ...st.savedLooks] }));
    },
    // "Enregistrer cette tenue" (Tenue du jour, recette 23/08/2026) — atterrit
    // dans Dressing → Mes looks, mais à la différence de "Créer un look"
    // (dressing réel uniquement), peut mélanger pièces possédées et
    // suggestions capsule non encore achetées : c'est la tenue du jour
    // telle quelle qu'on enregistre, pas une sélection filtrée (décision
    // 23/08/2026). Toggle : un second clic sur une tenue déjà enregistrée
    // retire le look correspondant plutôt que d'en créer un doublon.
    toggleSaveOutfitLook: () => {
      const s = stateRef.current;
      const ids = [...s.outfit];
      if (ids.length < 2) return;
      const key = [...ids].sort((a, b) => a - b).join(",");
      const existing = s.savedLooks.find(
        (l) => l.source === "saved" && [...l.pieceIds].sort((a, b) => a - b).join(",") === key
      );
      if (existing) {
        setState((st) => ({ ...st, savedLooks: st.savedLooks.filter((l) => l.id !== existing.id) }));
        if (isSupabaseConfigured && userId) {
          deleteSavedLook(existing.id).catch((err) => reportDressingError("deleteSavedLook", err));
        }
        return;
      }
      const draftPieces = ids.map((id) => findPiece(poolRef.current, id, vestiaireRef.current)).filter((it): it is Item => Boolean(it));
      if (violatesOuterwearRule(draftPieces)) return;
      const now = new Date();
      const defaultName =
        "Tenue du " + now.getDate().toString().padStart(2, "0") + "/" + (now.getMonth() + 1).toString().padStart(2, "0");
      const base: Omit<SavedLook, "id"> = {
        name: defaultName,
        pieceIds: ids,
        createdAt: Date.now(),
        occasion: s.occasion && s.occasion !== "all" ? s.occasion : undefined,
        source: "saved",
      };
      if (isSupabaseConfigured && userId) {
        insertSavedLook(userId, base)
          .then((look) => setState((st) => ({ ...st, savedLooks: [look, ...st.savedLooks] })))
          .catch((err) => reportDressingError("insertSavedLook", err));
        return;
      }
      const look: SavedLook = { id: "look" + Date.now(), ...base };
      setState((st) => ({ ...st, savedLooks: [look, ...st.savedLooks] }));
    },
    openLook: (id) =>
      setState((s) => ({ ...s, activeLookId: id, lookReturn: s.screen === "looks" ? "looks" : "wardrobe", screen: "lookDetail" })),
    closeLookDetail: () => setState((s) => ({ ...s, activeLookId: null, screen: s.lookReturn })),
    deleteActiveLook: () => {
      const s = stateRef.current;
      const deletedId = s.activeLookId;
      setState((st) => ({
        ...st,
        savedLooks: st.savedLooks.filter((l) => l.id !== deletedId),
        activeLookId: null,
        screen: st.lookReturn,
      }));
      if (deletedId && isSupabaseConfigured && userId) {
        deleteSavedLook(deletedId).catch((err) => reportDressingError("deleteSavedLook", err));
      }
    },
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
    addPieceToLook: (lookId, pieceId) => {
      const s = stateRef.current;
      const look = s.savedLooks.find((l) => l.id === lookId);
      if (!look || look.pieceIds.includes(pieceId)) return;
      const nextPieceIds = [...look.pieceIds, pieceId];
      setState((st) => ({
        ...st,
        savedLooks: st.savedLooks.map((l) => (l.id === lookId ? { ...l, pieceIds: nextPieceIds } : l)),
      }));
      if (isSupabaseConfigured && userId) {
        updateSavedLook(lookId, nextPieceIds).catch((err) => reportDressingError("updateSavedLook", err));
      }
    },
  };

  const value: CapselaContextValue = {
    state,
    weather,
    geoCity,
    geoLoading,
    geoIsLive,
    sourceMeteo,
    defaultCapsule,
    wardrobePool,
    vestiairePool,
    dressingLoaded,
    etatPremium,
    avisStyliste,
    avisEnregistres,
    avisEnregistreActif,
    actions,
  };

  return <CapselaContext.Provider value={value}>{children}</CapselaContext.Provider>;
}

export function useCapsela(): CapselaContextValue {
  const ctx = useContext(CapselaContext);
  if (!ctx) throw new Error("useCapsela must be used within a CapselaProvider");
  return ctx;
}
