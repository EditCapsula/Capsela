"use client";

import { useContexteRepris, useDefilementRepris, useGarderContexte } from "@/lib/memoireEcrans";
import { SejourEnCours } from "@/components/SejourEnCours";
import { sejourEnCours } from "@/lib/valiseDuJour";
import TitrePage from "@/components/TitrePage";
import { t } from "@/lib/langue";
import { styleDuLook, texteEditorialLook } from "@/lib/editorialLook";
import { useContexteLook, useRemplacementPiece } from "@/components/RemplacementPiece";
import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { demanderChoixChaussures } from "@/lib/intentionTenue";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { StatutComposition, ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";
import { texteHeroPlan, texteHeroValise, titreDuPlan } from "@/lib/heroPlan";
import { estPlanValise } from "@/lib/valiseDuJour";
import { useQuotaTenues } from "@/components/QuotaTenues";
import { clePieces, jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { OCC_LABELS } from "@/lib/data";
import { clePrincipale, computeLookScore, SEUIL_MANTEAU, estContexteMaison, tenueAUnSocle } from "@/lib/logic";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { applyGenderChange, paletteHexes, type Gender } from "@/lib/profile";
import { GenderModal } from "@/components/ProfilUI";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BarreDuJour from "@/components/BarreDuJour";
import { CarteProchainDepart, useRappelValise } from "@/components/RappelValise";
import BadgePremium from "@/components/BadgePremium";
import { retourPrecedent, retourSuivant, retoursAvecTenue, tenuePassee } from "@/lib/retro";
import { dateDuJour, momentMessage } from "@/lib/jourConsulte";
import { AlerteMeteoLook, PlansDuJour, usePlanApplique } from "@/components/PlansDuJour";
import { occasionParDefaut } from "@/lib/jourConsulte";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";
import Button from "@/components/Button";
import { CarrouselHero, CarteHero } from "@/components/CarrouselHero";
import PourLExterieur, { ConseilManteauPlusLong } from "@/components/PourLExterieur";
import { manteauxPourLaCouche, separerCoucheExterieure, temperatureReelle } from "@/lib/coucheExterieure";
import AccesAccueil from "@/components/AccesAccueil";
import { momentDeLaCouche, phraseManteauTropLeger } from "@/lib/plafondManteau";
import { composerSlides, cleTenue as cleSlide, slidesDuSejour, typeDeJour, type SlideCarrousel, type SlideId } from "@/lib/carrousel";
import { annoncerTenueSauvegardee } from "@/components/ToastCapsela";
import { masquerMenuActions } from "@/lib/menuActions";

// Les glyphes des accès vivent avec la rangée des accès (AccesAccueil.tsx, 19/11/2026) ; réexportés pour l'écran d'essai.
export { glypheUnivers, D_DRESSING, D_CAPSULE, D_AGENDA, D_VALISE } from "@/components/AccesAccueil";

/**
 * Une carte de la grille « Tout pour ton style » : un glyphe, un titre en deux lignes, une phrase, un visuel éditorial en
 * colonne à droite et une flèche simple. Toute la carte est le bouton. Polish du 07/10/2026 : moins « tableau de bord » —
 * pas de pastille sous le glyphe ni de rond autour de la flèche, un visuel plus discret ; `surtitre` dit ce que la carte
 * contient (« Mes pièces » / « Par Capsela »), pour que le dressing et la capsule ne se confondent pas.
 */
export function CarteUnivers({
  onClick, glyphe, ligne1, ligne2, texte, accent, visuel, position = "center", surtitre, label, busy, premium,
}: {
  onClick: () => void;
  glyphe: React.ReactNode;
  ligne1: string;
  ligne2: string;
  texte: string;
  /** Les styles de la personne, en terracotta après la phrase (carte capsule). */
  accent?: string;
  visuel: string;
  /** `object-position` du visuel dans sa colonne : garde le sujet principal quand le cadre est plus étroit que l'image. */
  position?: string;
  surtitre?: string;
  label: string;
  busy?: boolean;
  /** Le badge « Premium », posé en bas à gauche de la carte. */
  premium?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-busy={busy}
      className="relative flex items-start min-w-0 text-left bg-card border border-border rounded-carte overflow-hidden cursor-pointer motion-safe:transition-[transform,opacity] motion-safe:active:scale-[.985] active:opacity-90"
      style={{ minHeight: 156 }}
    >
      <span className="absolute top-0 right-0 bottom-0 bg-cream" style={{ width: "clamp(56px, 38%, 92px)" }} aria-hidden="true">
        {/* Les visuels éditoriaux du 08/10/2026 (zip « Capsela_visuels_editoriaux ») : recadrés sur le sujet, jamais étirés ni bordés de blanc. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={visuel} alt="" width={460} height={940} loading="lazy" decoding="async" className="w-full h-full object-cover block" style={{ objectPosition: position }} />
      </span>
      <span
        aria-hidden="true"
        className="absolute right-[8px] bottom-[8px] w-7 h-7 rounded-full bg-card text-ink flex items-center justify-center"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" style={{ display: "block" }}>
          <path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {premium && (
        <span className="absolute left-3 bottom-3">
          <BadgePremium fond="carte" />
        </span>
      )}
      <span className="flex flex-col pt-3 pb-10 pl-3 pr-2" style={{ width: "calc(100% - clamp(56px, 38%, 92px))" }}>
        <span className="flex items-center h-[22px] text-terracotta-deep">{glyphe}</span>
        {surtitre && <span className="t-surtitre text-muted-3 mt-[8px] !text-[9px] whitespace-nowrap">{surtitre}</span>}
        <span className={"block t-titre-vignette leading-[1.15] text-ink " + (surtitre ? "mt-[3px]" : "mt-3")}>
          {ligne1}
          <br />
          {ligne2}
        </span>
        <span className="block text-[11px] text-muted-3 leading-[1.4] mt-1" style={{ textWrap: "pretty" }}>
          {texte}
          {accent && <span className="text-terracotta-deep font-semibold"> {accent}</span>}
        </span>
      </span>
    </button>
  );
}

// Constantes : une liste recréée à chaque rendu relancerait la composition du flat lay.
const FANTOME_CHAUSSURES: CategoryKey[] = ["chaussures"];
const AUCUN_FANTOME: CategoryKey[] = [];

/** Le surtitre d'une tenue sans le jour en tête (« Aujourd'hui · », « Demain · », « Mar. 18 · ») : l'en-tête de la carte le dit (17/11/2026). */
function sansLeJour(surtitre: string): string {
  return surtitre.replace(/^(Aujourd'hui|Demain|Hier|Today|Tomorrow|Yesterday|[A-Z][a-zé]{2,3}\.? \d{1,2})\s·\s/, "");
}

export default function HomeScreen() {
  const { state, vestiairePool, wardrobePool, defaultCapsule, meteoDuJour, jourConsulte, valiseConsultee, actions, weather, sourceMeteo } = useCapsela();
  const rappelValise = useRappelValise();

  // LE RETOUR RETROUVE LA POSITION (13/11/2026, fiches harmonisées : la fiche complète est une page, son retour ramène ici au même
  // endroit) — memoireEcrans.ts, comme le Dressing et la Capsule ; un onglet de la barre du bas l'oublie (TabBar).
  const zoneAccueil = useRef<HTMLDivElement>(null);
  const reprisAccueil = useContexteRepris<{ defilement: number }>("home");
  const defilementAccueil = useDefilementRepris(zoneAccueil, reprisAccueil?.defilement);
  useGarderContexte("home", () => ({ defilement: defilementAccueil.position.current }));
  // Navigation par date (27/09/2026) : la tenue et sa météo sont celles du jour consulté.
  const jourAVenir = jourConsulte.decalage > 0;
  const planApplique = usePlanApplique();
  const ouvrirPiece = useOuvrirPiece();
  // LE FLAT LAY INTERACTIF (12/11/2026, RemplacementPiece) : la tenue du jour proposée et les propositions du carrousel. Une tenue
  // venue d'un plan ou d'une valise en séjour garde la fiche directe : la remplacer ici ne changerait ni le plan ni la valise.
  const remplacement = useRemplacementPiece();
  // UNE TENUE SANS CHAUSSURES (14/10/2026) : leur silhouette se pose dans la composition, comme sur la page Tenue.
  const sansChaussures = (pieces: Item[]): CategoryKey[] => (pieces.length > 0 && !pieces.some((p) => p.cat === "chaussures") ? FANTOME_CHAUSSURES : AUCUN_FANTOME);

  /**
   * « PAS POUR MOI » PROPOSE UNE AUTRE TENUE (recette du 26/09/2026) — et
   * c'est un avis : le refus est enregistré (outfit_feedback), puis la
   * tenue suivante l'évite (regenOutfit). Le tirage compte comme une
   * alternative du quota gratuit, exactement comme « Autre tenue »
   * (arbitrage de la propriétaire) : même quota, même Gate (QuotaTenues).
   */
  const quota = useQuotaTenues();
  /**
   * PRÉPARER UNE VALISE (27/09/2026, docs/valise.md) — la décision d'accès
   * (règle PREPARER_VALISE) vit dans le store (`ouvrirValise`), partagée avec
   * Planifier. Depuis l'accueil : une nouvelle valise.
   */
  const ouvrirValise = () => void actions.ouvrirValise(null);

  /**
   * L'avis du jour vient désormais du store, donc de la base (0029), et non
   * plus d'un useState local qui disparaissait au rechargement.
   *
   * Le verdict n'est affiché que si une ligne correspond aux pièces AFFICHÉES
   * — pas seulement à la date. Une tenue régénérée dans la journée repart donc
   * sans avis, ce qui est juste : l'avis portait sur l'autre tenue.
   *
   * « pas_pour_moi » de l'ancienne version locale n'existe pas côté base : la
   * contrainte CHECK dit « pas_aujourdhui ». C'est ce vocabulaire qui est
   * repris ici, pour qu'il n'y ait pas deux noms pour un même verdict.
   */
  const avisDuJour = useMemo(() => {
    const jour = jourLocal();
    return (
      state.outfitFeedbackDuJour.find((a) => a.jour === jour && memeTenue(a.pieceIds, state.outfit))?.verdict ?? null
    );
  }, [state.outfitFeedbackDuJour, state.outfit]);

  // QUOTA D'ABORD (08/10/2026, demandé : quota dépassé, « Autre idée » ouvre la feuille de quota). Avant, l'avis était écrit — ou
  // RETIRÉ, un second appui sur le même verdict l'annulant — avant même que le quota ne réponde : la feuille s'ouvrait, mais l'avis
  // avait bougé. L'avis n'est maintenant enregistré qu'une fois le tirage accordé, juste avant de regénérer (il porte sur la tenue
  // qu'on quitte), et jamais s'il y est déjà.
  const pasPourMoi = () => {
    quota.demander(() => {
      if (avisDuJour !== "pas_aujourdhui") actions.setOutfitFeedback("pas_aujourdhui");
      actions.regenOutfit();
    });
  };
  const { profile, saveProfile } = useAuth();
  const firstNameOrYou = profile.displayName || t("toi");

  // Lecture seule des données déjà disponibles ailleurs dans l'app
  // (météo/localisation, occasion auto-sélectionnée, tenue déjà déterminée) —
  // jamais de génération de tenue ni d'appel image depuis cet écran.
  // Pool de résolution stable : wardrobePool ne contient, par catégorie, que
  // les pièces réelles ou les suggestions de la capsule du profil courant,
  // alors que state.outfit peut venir d'un style exploré ou d'une entrée
  // d'historique rejouée.
  const resolvePool = [...state.items, ...vestiairePool];
  // LE SÉJOUR EN COURS (17/11/2026, SejourEnCours.tsx) : pendant un séjour, la carte du séjour remplace la ligne « Ta valise · La journée ».
  const sejour = sejourEnCours(state.valises, jourLocal(jourConsulte.date), resolvePool);
  const piecesResolues = state.outfit
    .map((id) => resolvePool.find((i) => i.id === id))
    .filter((it): it is Item => Boolean(it));
  // « Ta tenue est prête » exige un SOCLE résolu — haut + bas, ou robe
  // (recette du 26/09/2026) : une tenue réduite à un sac, parce que ses
  // autres pièces ne se résolvaient plus, s'affichait comme prête. Le store
  // la recompose (réparation) ; d'ici là, la card n'annonce rien de faux.
  const hasOutfit = piecesResolues.length > 0 && tenueAUnSocle(piecesResolues);
  const occasionKey =
    state.occasion && state.occasion !== "all" ? state.occasion : occasionParDefaut(profile.prefs, jourConsulte.date);
  /*
   * LE MANTEAU À PART, SUR L'ACCUEIL AUSSI (04/11/2026, demandé : « aligne sur tous les hero » ; coucheExterieure.ts) : la composition
   * montre le look seul ; le manteau ajouté par le froid se montre dessous, dans « Pour l'extérieur », qui mène à la page Tenue.
   */
  const tempReelle = temperatureReelle({ decalage: jourConsulte.decalage, sourceMeteo, tempDuJour: weather.temp, prevue: jourConsulte.meteoPrevue?.temp, minDuJour: jourConsulte.minDuJour });
  // Les manteaux que le moteur admet pour cette occasion et cette météo (17/11/2026 : sous 22 °C, hors maison — plus seulement
  // par le froid) : une tenue sans manteau en reçoit un, à part. Leurs bornes choisissent un trench à 16°, rien à partir de 22°.
  const manteauxPour = (pieces: Item[], occasion: OccasionKey) =>
    tempReelle != null && !estContexteMaison(occasion, state.workMode) && pieces.length
      ? manteauxPourLaCouche(pieces, wardrobePool, -1, occasion, state.workMode, state.dateContext, meteoDuJour, tempReelle)
      : [];
  // Les manteaux de la CAPSULE admis pour la tenue (12/11/2026, R-B25 arbitré) : proposés quand le manteau de la tenue est plus court que
  // sa veste et que le dressing n'en a pas d'assez long (separerCoucheExterieure).
  const manteauxCapsulePour = (pieces: Item[], occasion: OccasionKey) =>
    tempReelle != null && !estContexteMaison(occasion, state.workMode) && pieces.length
      ? manteauxPourLaCouche(pieces, defaultCapsule, -1, occasion, state.workMode, state.dateContext, meteoDuJour, tempReelle)
      : [];
  const tenueSeparee = separerCoucheExterieure(
    hasOutfit ? piecesResolues : [],
    tempReelle,
    manteauxPour(hasOutfit ? piecesResolues : [], occasionKey),
    manteauxCapsulePour(hasOutfit ? piecesResolues : [], occasionKey),
    estContexteMaison(occasionKey, state.workMode)
  );
  const outfitPieces = tenueSeparee.principal;
  const exterieur = tenueSeparee.exterieur;
  // Ni le manteau montré à part, ni celui que la proposition remplace (trop court, R-B25) ne se comptent comme portés d'office.
  const sansExterieurIds = [...(exterieur && !tenueSeparee.suggere ? [exterieur.id] : []), ...(tenueSeparee.remplace ? [tenueSeparee.remplace.id] : [])];
  const sansExterieur = sansExterieurIds.length ? sansExterieurIds : undefined;
  const blocExterieur =
    exterieur && tempReelle != null ? (
      <div className="mt-[6px]">
        <PourLExterieur
          piece={exterieur}
          temperature={tempReelle}
          quand={jourConsulte.decalage === 0 ? "aujourd'hui" : "prévus"}
          onClick={actions.goTenues}
          compact
          note={phraseManteauTropLeger(state.items, tempReelle, momentDeLaCouche({ decalage: jourConsulte.decalage, occasion: occasionKey }))}
        />
      </div>
    ) : tenueSeparee.conseilManteauPlusLong ? (
      <div className="mt-[6px]">
        <ConseilManteauPlusLong compact />
      </div>
    ) : null;
  // LA VESTE CONSEILLÉE PAR TEMPS FRAIS, SUR L'ACCUEIL AUSSI (14/10/2026, demandé) : la même suggestion que la page Tenue (computeLookScore,
  // « veste_soir », mêmes arguments), posée dans la composition de la tenue du jour, estompée, avec un « + » qui l'ajoute.
  // Pas de conseil quand un manteau est déjà proposé « Pour l'extérieur » (04/11/2026, demandé : « pas la peine de suggérer le manteau si on
  // le met toujours dans la strate extérieure ») : la couche de dessus est déjà là, à côté de la tenue.
  const exterieurId = exterieur?.id ?? null;
  const conseilVeste = useMemo(() => {
    if (!hasOutfit || exterieurId != null) return undefined;
    const score = computeLookScore(
      outfitPieces,
      state.occasion || "all",
      paletteHexes(profile),
      profile.morphology,
      new Set(state.dismissedSuggestions || []),
      meteoDuJour,
      state.workMode,
      state.dateContext,
      wardrobePool,
      colorimetrieMoteur(profile.colorimetrie)
    );
    const p = score.proactives.find((x) => x.key === "veste_soir");
    // Par le froid du soir sans manteau adapté dans le dressing : un manteau de la capsule, jamais une veste (12/11/2026, comme Tenue).
    const tempCouche = meteoDuJour.tempSoir ?? meteoDuJour.temp;
    const manteauCapsule =
      p && p.suggestedId == null && tempCouche < SEUIL_MANTEAU
        ? manteauxPourLaCouche(outfitPieces, defaultCapsule, -1, state.occasion || "all", state.workMode, state.dateContext, meteoDuJour, tempCouche)[0]
        : undefined;
    const piece = p?.suggestedId != null ? wardrobePool.find((i) => i.id === p.suggestedId) : manteauCapsule;
    return piece ? [{ item: piece, onAjouter: () => actions.addPieceToOutfit(piece.id) }] : undefined;
    // `actions` change à chaque rendu ; la suggestion ne dépend que de la tenue, de la météo, de l'occasion et du profil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outfit, state.occasion, state.workMode, state.dateContext, state.dismissedSuggestions, meteoDuJour, wardrobePool, defaultCapsule, profile, hasOutfit, exterieurId]);

  /*
   * LE HERO DYNAMIQUE (04/10/2026) — trois états qui portent un plan, un qui n'en porte pas :
   *   · à venir / jour J : le plan du jour CONSULTÉ est la tenue affichée (planApplique, planDuJour.ts) ; le hero le dit
   *     — « Look planifié » ou « Look du jour » — avec l'occasion et le lieu du plan, plus la petite card de rappel
   *     qui répétait cette information (PlansDuJour ne montre plus que ce que le hero ne dit pas) ;
   *   · sans plan : le hero d'avant.
   * À L'OUVERTURE, LE HERO MONTRE TOUJOURS LA TENUE D'AUJOURD'HUI, planifiée ou non (05/10/2026, signalé : « Ton look d'hier »
   * s'affichait à la connexion). Le look d'hier n'a plus de hero propre : on le consulte avec la barre de date (retro, ci-dessous).
   */
  /**
   * LE RETOUR AUX TENUES PASSÉES (04/10/2026, « conserver l'historique ») : local à l'Accueil, indépendant du jour consulté
   * du store (retro.ts). Le chevron gauche de la barre de date saute à la tenue passée précédente (déclarée portée, sinon
   * planifiée) ; le hero la relit, sans rien composer ni écrire.
   */
  const [retro, setRetro] = useState(0);
  const retours = useMemo(() => retoursAvecTenue(state.history, state.tenuesPlanifiees), [state.history, state.tenuesPlanifiees]);
  const retroActif = jourConsulte.decalage === 0 ? retro : 0;
  const dateRetro = dateDuJour(-retroActif);
  const passee = retroActif > 0 ? tenuePassee(state.history, state.tenuesPlanifiees, jourLocal(dateRetro)) : null;
  const piecesPassee = passee ? passee.pieceIds.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)) : [];
  const planHero = planApplique && hasOutfit ? planApplique.plan : null;
  const contexteRemplacement = useContexteLook({ occasion: occasionKey || "all", weather: meteoDuJour });
  /** Toucher une pièce d'un look : Voir / Remplacer, ou la fiche directe quand le look ne peut pas être modifié ici. */
  const toucherPiece = (look: Item[], appliquer: ((a: number, n: number) => boolean) | null) => (it: Item) =>
    appliquer
      ? remplacement.ouvrir(it, { look, contexte: contexteRemplacement, dressing: state.items, suggestions: defaultCapsule, appliquer })
      : ouvrirPiece(it);
  const remplacerTenueDuJour = planHero || valiseConsultee ? null : (a: number, n: number) => (actions.remplacerDansTenue(a, n), true);
  // Un look de valise (séjour en cours, valiseDuJour.ts) se dit comme tel : « Look de ta valise · Jour 2 de ton séjour à Lisbonne ».
  const texteHero = planHero
    ? estPlanValise(planHero.id) && valiseConsultee
      ? texteHeroValise(valiseConsultee.numero, valiseConsultee.valise.destination)
      : texteHeroPlan(planHero)
    : null;

  /*
   * « J'ADORE » ENREGISTRE LA TENUE (recette du 26/09/2026, qui revient sur
   * l'arbitrage du 22/09) : l'avis est gardé dans `outfit_feedback` ET la
   * tenue rejoint « Mes looks », sans doublon (enregistrerTenueSiAbsente).
   */
  /**
   * AUCUNE TENUE POSSIBLE — et non « pas encore de tenue ».
   *
   * `state.outfit` est vide dans DEUX situations très différentes : pendant
   * le chargement, avant que l'effet d'amorçage ait tourné, et après une
   * génération qui n'a rien produit. Afficher « ajoute des pièces » dans le
   * premier cas accuserait un dressing que personne n'a encore lu.
   *
   * `outfitNoCompleteOutfit` n'est posé que par generateOutfitWithFallback,
   * donc après une tentative réelle : c'est le seul signal qui distingue les
   * deux. Le vide seul n'en est pas un.
   */
  const aucuneTenuePossible = !hasOutfit && state.outfitNoCompleteOutfit;
  /*
   * LE GENRE MANQUANT (15/11/2026, demandé). Sans genre, l'univers du profil ne laisse passer que les pièces unisexes (univers.ts) :
   * aucun bas, donc aucune tenue. L'étape Genre est obligatoire depuis le 12/11/2026, mais un compte plus ancien peut l'avoir passée.
   * L'accueil le dit tel quel — « Complète ton profil » — et ouvre la feuille des genres de Mon profil, avec le même enregistrement
   * (applyGenderChange) : dès que le genre est enregistré, la capsule se recalcule et la tenue du jour se compose sur les styles choisis.
   */
  const sansGenre = !profile.gender;
  const sansTenue = aucuneTenuePossible || sansGenre;
  const [genreOuvert, setGenreOuvert] = useState(false);
  const indiquerGenre = (g: Gender) => {
    setGenreOuvert(false);
    saveProfile({ ...profile, ...applyGenderChange(profile, g).patch });
  };

  /**
   * LA SILHOUETTE ATTENDUE, avant que la tenue soit composée (chargement,
   * 30/09/2026). Le moteur n'a rien choisi : on ne dessine que ce qu'on sait.
   * Un haut, un bas, des chaussures — le socle de toute tenue hors robe — et
   * un sac, sauf à la maison, où le moteur n'en met jamais (R-B14, la même
   * règle : estContexteMaison). Ni robe ni surcouche : elles dépendent des
   * pièces et de leur météo, que seul le moteur tranche. Dès que la tenue
   * existe, la silhouette prend ses catégories réelles (ZoneLookDuJour).
   */
  const categoriesAttendues: CategoryKey[] = estContexteMaison(occasionKey, state.workMode)
    ? ["haut", "pantalon", "chaussures"]
    : ["haut", "pantalon", "chaussures", "sac"];

  const dressingCount = state.items.length;
  const dressingVide = dressingCount === 0;

  // LE BLOC ÉDITORIAL D'UNE TENUE RECOMMANDÉE (12/11/2026, editorialLook.ts) : un titre qui dit le style réel du look et une phrase
  // qui dit sa pertinence pour l'occasion. Une tenue planifiée garde son titre et son texte (texteHero) : ce n'est pas une recommandation.
  const texteDuLook = (pieces: Item[], occ: OccasionKey | null) =>
    texteEditorialLook(pieces, occ ?? "all", state.workMode, state.dateContext, styleDuLook(pieces, profile.styles, profile.gender));
  const titreHero = planHero ? { a: titreDuPlan(planHero), b: "" } : texteDuLook(outfitPieces, occasionKey).titre;
  const sousTitreHero = texteHero ? texteHero.sousTitre : texteDuLook(outfitPieces, occasionKey).phrase;
  const cleTenue = clePieces(outfitPieces.length ? outfitPieces.map((p) => p.id) : state.outfit).join(",");
  const sauvegardee = jourAVenir
    ? state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cleTenue)
    : avisDuJour === "adore";

  /*
   * LE CARROUSEL (14/10/2026, carrousel.ts) : trois tenues par occasion, pour AUJOURD'HUI seulement. La tenue du jour (celle qui porte
   * l'avis, le quota, le plan appliqué) occupe la slide de son occasion — la première si c'est un plan —, les autres sont des propositions
   * du moteur (store : `carrousel`). Un autre jour, une tenue passée, le chargement ou l'absence de tenue gardent la carte seule d'avant.
   */
  // PENDANT UN SÉJOUR (06/11/2026, slidesDuSejour) : le carrousel est celui du voyage — les looks de la valise, dits par l'activité du
  // programme qu'ils servent ; rien qui ne soit dans la valise.
  const enSejour = Boolean(valiseConsultee);
  const slides: SlideCarrousel[] =
    hasOutfit && !passee && jourConsulte.decalage === 0 && valiseConsultee
      ? slidesDuSejour({
          tenueDuJour: state.outfit,
          occasion: occasionKey ?? "quotidien",
          libelleJournee: valiseConsultee.libelleJournee,
          soir: valiseConsultee.soir
            ? { ids: valiseConsultee.soir.pieceIds, occasion: valiseConsultee.soir.occasion, libelle: valiseConsultee.libelleSoir }
            : null,
          looks: valiseConsultee.looks,
        })
      : hasOutfit && !passee && jourConsulte.decalage === 0
      ? composerSlides({
          tenueDuJour: state.outfit,
          occasion: occasionKey,
          planAujourdhui: Boolean(planHero),
          propositions: state.carrousel?.propositions ?? {},
          jour: typeDeJour(occasionParDefaut(profile.prefs, jourConsulte.date)),
        })
      : [];
  const carrouselActif = !sansGenre && slides.length > 1;
  // PORTÉE AUJOURD'HUI (15/10/2026, demandé) : la tenue du jour validée « Porter cette tenue », ou une tenue du Journal d'aujourd'hui
  // faite des mêmes pièces (le validé ne survit pas toujours à un rechargement ; l'historique, si).
  const auj = new Date().toDateString();
  const porteeAujourdhui =
    jourConsulte.decalage === 0 &&
    state.outfit.length > 0 &&
    (state.outfitValidated || state.history.some((h) => new Date(h.ts).toDateString() === auj && cleSlide(h.pieceIds) === cleSlide(state.outfit)));
  const piecesDe = (ids: number[]) => ids.map((id) => resolvePool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
  const dejaSauvegardee = (ids: number[]) => state.savedLooks.some((l) => cleSlide(l.pieceIds) === cleSlide(ids));


  // « AVIS D'UN PROCHE » SUR CHAQUE TENUE DE L'ACCUEIL (19/11/2026, option B arbitrée) : le partage de la page Tenue, pour la tenue de la
  // slide ; le retour ramène à l'accueil. La couche extérieure est séparée par l'écran de partage lui-même (OpinionShareScreen).
  const avisPour = (ids: number[], occasion: OccasionKey) => () =>
    actions.openOpinionShare({
      pieceIds: ids,
      occasion,
      temp: meteoDuJour.temp ?? null,
      label: meteoDuJour.label ?? null,
      moment: momentMessage(jourConsulte.decalage, jourConsulte.date) ?? "",
      retour: "home",
    });

  const carteSlide = (slide: SlideCarrousel) => {
    const duJour = slide.source !== "proposition";
    // Chaque slide a sa couche extérieure (04/11/2026, signalé : « quand je swipe je dois voir la strate extérieur pour les occasions
    // concernées ») : la tenue du jour est déjà séparée plus haut ; une proposition d'une autre occasion l'est ici, même règle, même météo.
    const sepSlide = duJour
      ? tenueSeparee
      : separerCoucheExterieure(
          piecesDe(slide.ids),
          tempReelle,
          manteauxPour(piecesDe(slide.ids), slide.occasion),
          manteauxCapsulePour(piecesDe(slide.ids), slide.occasion),
          estContexteMaison(slide.occasion, state.workMode)
        );
    const pieces = sepSlide.principal;
    const exterieurSlide = sepSlide.exterieur;
    // Le look qu'on sauvegarde est celui qu'on voit : sans le manteau montré à part, ni celui qu'une proposition remplace (R-B25).
    const idsDuLook = slide.ids.filter((id) => id !== exterieurSlide?.id && id !== sepSlide.remplace?.id); // sans effet pour un manteau seulement proposé
    const blocSlide =
      exterieurSlide && tempReelle != null ? (
        <div className="mt-[6px]">
          <PourLExterieur
            piece={exterieurSlide}
            temperature={tempReelle}
            quand={jourConsulte.decalage === 0 ? "aujourd'hui" : "prévus"}
            onClick={() => (duJour ? actions.goTenues() : actions.consulterTenue(slide.ids, slide.occasion, null))}
            compact
            note={phraseManteauTropLeger(state.items, tempReelle, momentDeLaCouche({ decalage: jourConsulte.decalage, occasion: slide.occasion }))}
          />
        </div>
      ) : sepSlide.conseilManteauPlusLong ? (
        <div className="mt-[6px]">
          <ConseilManteauPlusLong compact />
        </div>
      ) : null;
    const texteSlide = texteDuLook(pieces, slide.occasion);
    const titre = slide.source === "plan" && planHero ? { a: titreDuPlan(planHero), b: "" } : texteSlide.titre;
    const sousTitre = slide.source === "plan" && texteHero ? texteHero.sousTitre : texteSlide.phrase;
    // Le libellé d'une tenue planifiée est contextuel (« Look du jour », « Look planifié »…) ; les autres disent leur occasion.
    // L'en-tête de la carte dit déjà le jour (17/11/2026) : le surtitre ne le redit pas (« Aujourd'hui · Quotidien » → « Quotidien »).
    const surtitre = sansLeJour(slide.source === "plan" && texteHero ? texteHero.surtitre : slide.surtitre);
    return (
      <CarteHero
        key={slide.id}
        sansCadre
        surtitre={surtitre}
        titre={titre}
        sousTitre={sousTitre}
        pieces={pieces}
        graine={cleSlide(slide.ids)}
        categoriesAttendues={duJour ? categoriesAttendues : undefined}
        fantomes={sansChaussures(pieces)}
        // LA SILHOUETTE DE CHAUSSURES EST ACTIONNABLE (13/11/2026, demandé) : son « + » ouvre la tenue et sa feuille « Choisir des
        // chaussures », les paires adaptées du dressing, de la capsule puis du catalogue — le composant de Ma tenue du jour, tel quel.
        onFantome={(cat) => {
          if (cat !== "chaussures") return;
          demanderChoixChaussures();
          if (duJour) actions.goTenues();
          else actions.consulterTenue(slide.ids, slide.occasion, null);
        }}
        ajouts={duJour ? conseilVeste : undefined}
        onVoir={() => actions.consulterTenue(slide.ids, slide.occasion, slide.source === "plan" ? (planHero?.id ?? null) : null)}
        sauvegardee={duJour ? sauvegardee : dejaSauvegardee(idsDuLook)}
        onSauvegarder={() => {
          if (duJour) {
            if (!sauvegardee) annoncerTenueSauvegardee(actions.goLooks);
            return actions.setOutfitFeedback("adore", sansExterieur);
          }
          if (!dejaSauvegardee(idsDuLook)) {
            actions.enregistrerIdeeLook(idsDuLook, slide.occasion);
            annoncerTenueSauvegardee(actions.goLooks);
          }
        }}
        // Pendant un séjour, une slide est un look de la valise : pas d'autre tirage (il sortirait de la valise) — on fait défiler.
        onAutre={() => {
          if (duJour) return pasPourMoi();
          if (!enSejour) quota.demander(() => actions.autreIdeeSlide(slide.id as SlideId));
        }}
        autreDesactive={quota.tirageEnCours || (enSejour && !duJour)}
        onAvis={avisPour(slide.ids, slide.occasion)}
        // « Pour l'extérieur » au-dessus des deux actions (17/11/2026, demandé), comme sur la carte sans carrousel ; l'alerte météo reste dessous.
        avantActions={blocSlide ?? undefined}
        pied={duJour && planApplique?.alerte ? <AlerteMeteoLook planApplique={planApplique} /> : undefined}
        portee={duJour && porteeAujourdhui}
        pourquoi={!(slide.source === "plan" && texteHero) && !enSejour}
        onPiece={toucherPiece(
          pieces,
          duJour
            ? slide.source === "plan"
              ? null
              : remplacerTenueDuJour
            : enSejour
              ? null
              : (a, n) => (actions.remplacerDansProposition(slide.id as SlideId, a, n), true)
        )}
      />
    );
  };

  const retroJour = {
    jours: retroActif,
    date: dateRetro,
    precedent: retourPrecedent(retours, retroActif),
    suivant: retourSuivant(retours, retroActif),
    temp: passee?.temp ?? null,
    label: passee?.weatherLabel ?? null,
    onChange: setRetro,
  };
  /**
   * La carte de la tenue. Le jour et sa météo en sont sortis le 19/11/2026 (option B arbitrée) : ils sont sur leur ligne, sous la
   * salutation (BarreDuJour, mêmes données et mêmes gestes, jours passés compris) ; du 17/11 au 19/11, ils étaient en tête de la carte.
   */
  const carteDuJour = (contenu: React.ReactNode) => (
    <div className="mx-4 rounded-hero overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
      {contenu}
    </div>
  );

  /*
   * LE BOUTON « + » NE RECOUVRE PLUS « AUTRE TENUE » (21/11/2026, signalé : le bouton flottant chevauchait la ligne Sauvegarder ·
   * Avis d'un proche · Autre tenue). Il est fixé à l'écran : sur un téléphone peu haut, la ligne d'actions passe dessous. Tant qu'une
   * ligne d'actions (data-actions-tenue) occupe sa place, il s'efface (masquerMenuActions, comme pendant un message) ; il revient dès
   * qu'elle s'en éloigne. Vérifié au défilement, au redimensionnement et quand le contenu change de taille (la tenue qui se charge).
   */
  useEffect(() => {
    const zone = zoneAccueil.current;
    if (!zone) return;
    const verifier = () => {
      const z = zone.getBoundingClientRect();
      const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-height")) || 0;
      // La place du bouton (56 px, à 16 px du bord droit et au-dessus de la barre du bas), avec 8 px de marge.
      const bas = window.innerHeight - nav - 16 + 8;
      const haut = bas - 56 - 16;
      const droite = z.right - 16 + 8;
      const gauche = z.right - 16 - 56 - 8;
      const chevauche = [...zone.querySelectorAll("[data-actions-tenue]")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > haut && r.top < bas && r.right > gauche && r.left < droite;
      });
      masquerMenuActions("accueil-actions-tenue", chevauche);
    };
    verifier();
    zone.addEventListener("scroll", verifier, { passive: true });
    window.addEventListener("resize", verifier);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(verifier) : null;
    if (ro && zone.firstElementChild) ro.observe(zone.firstElementChild);
    return () => {
      zone.removeEventListener("scroll", verifier);
      window.removeEventListener("resize", verifier);
      ro?.disconnect();
      masquerMenuActions("accueil-actions-tenue", false);
    };
  }, []);

  return (
    <div ref={zoneAccueil} onScroll={defilementAccueil.onScroll} className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-safe-nav">
      <div className="px-6">
        {/* L'accueil seul garde le logo, CENTRÉ, avec le calendrier à gauche (13/11/2026 : d'abord ferré à gauche, puis « remets le logo
            au centre c'est mieux et l'icône Calendrier à gauche ») ; ailleurs le titre de la page prend sa place. */}
        <AppHeader calendrier />
      </div>

      {/* ══ MAQUETTE « ACCUEIL V9 » (07/10/2026), reprise intégralement : salutation, jour et météo, look du jour sur fond
          sable, puis une seule section « Tout pour ton style ». Les sections « Pour aller plus loin », « Ton dressing » (catégories)
          et « Ta capsule » (bannière) et la carte Avis de styliste n'y figurent pas : l'avis reste accessible depuis le Journal. */}
      <div className="px-6">
        {/* Le titre des pages majeures (TitrePage, 12/11/2026) : la salutation quitte t-display (28 px) pour la taille des autres. */}
        <TitrePage>
          {t("Bonjour,")} <span className="italic">{firstNameOrYou}</span>
        </TitrePage>
        {/* LE JOUR ET SA MÉTÉO SUR LEUR LIGNE, sous la salutation (19/11/2026, option B arbitrée) — les mêmes données et les mêmes gestes que
            l'en-tête de carte d'avant, jours passés compris (retro). */}
        <BarreDuJour retro={retroJour} meteoEnLigne className="mt-1" />
        {/* Ce qui est planifié ce jour-là (Planifier) : un rappel qui mène à la fiche du plan. Rien sans plan. */}
        {retroActif === 0 && <PlansDuJour depuis="home" className="mt-3" sansJourneeValise={!!sejour} />}
      </div>

      {/* LE JOUR, LA MÉTÉO ET LA TENUE DANS UNE SEULE CARTE (17/11/2026, arbitré sur une maquette : « intègre-les dans la card », les points
          du carrousel aussi, gardés tels qu'ils sont dans l'app). En tête, le jour et sa date, la ville et la météo, max · min et le « i » de
          la source (EnTeteJour, mêmes données et mêmes gestes que la barre d'avant) ; dessous les tenues, sans cadre à elles ; puis les
          points. Le surtitre de chaque tenue ne redit plus le jour. */}
      {carrouselActif ? (
        // data-tour : la cible de la visite guidée « Aujourd'hui » (lib/visites.ts). Les points du carrousel restent SOUS la carte
        // (17/11/2026, demandé après un essai à l'intérieur) : seule la piste est dans la carte (`enveloppe`).
        <div data-tour="accueil-tenue">
          <CarrouselHero
            className="mt-3"
            classeSlide=""
            enveloppe={(piste) => carteDuJour(piste)}
            slides={slides.map(carteSlide)}
            libelles={slides.map((sl) => sl.surtitre)}
            onAvantDerniere={actions.etendreCarrousel}
          />
        </div>
      ) : hasOutfit && !passee && !sansTenue ? (
        // LA TENUE SEULE (un autre jour, ou une seule proposition) : la même carte que les slides du carrousel (CarteHero, option B du
        // 19/11/2026), pour qu'un jour à venir se lise comme aujourd'hui. Un jour à venir sauvegarde la tenue seule et tire une autre
        // tenue sans avis (l'avis du jour ne porte que sur aujourd'hui), comme avant.
        // data-tour : la tenue du jour sans carrousel est aussi la cible de la visite (lib/visites.ts).
        <div className="mt-3" data-tour="accueil-tenue">
          {carteDuJour(
            <CarteHero
              sansCadre
              surtitre={texteHero ? sansLeJour(texteHero.surtitre) : "Ta tenue du jour"}
              titre={titreHero}
              sousTitre={sousTitreHero}
              pourquoi={!texteHero}
              portee={porteeAujourdhui}
              pieces={outfitPieces}
              graine={cleTenue}
              categoriesAttendues={categoriesAttendues}
              fantomes={sansChaussures(outfitPieces)}
              onFantome={(cat) => cat === "chaussures" && (demanderChoixChaussures(), actions.goTenues())}
              ajouts={conseilVeste}
              onPiece={toucherPiece(outfitPieces, remplacerTenueDuJour)}
              onVoir={actions.goTenues}
              sauvegardee={sauvegardee}
              onSauvegarder={() => {
                if (!sauvegardee) annoncerTenueSauvegardee(actions.goLooks);
                return jourAVenir ? actions.toggleSaveOutfitLook(sansExterieur) : actions.setOutfitFeedback("adore", sansExterieur);
              }}
              onAvis={avisPour(state.outfit, occasionKey ?? "quotidien")}
              onAutre={jourAVenir ? () => quota.demander(actions.regenOutfit) : pasPourMoi}
              autreDesactive={quota.tirageEnCours}
              avantActions={blocExterieur ?? undefined}
              pied={
                <>
                  {/* « Autre tenue » sans tenue au socle différent (01/11/2026) : la tenue est gardée, et on le dit. */}
                  {state.autreTenueIndisponible !== null && state.autreTenueIndisponible === clePrincipale(state.outfit, [...state.items, ...vestiairePool]) && (
                    <p className="mt-3 text-center text-[12px] text-muted leading-[1.45]">
                      {t("Pas d'autre tenue vraiment différente avec les pièces disponibles pour cette occasion.")}
                    </p>
                  )}
                  {/* LA TENUE PLANIFIÉE : ce que la météo du jour en dit, s'il y a lieu. */}
                  {planApplique?.alerte && <AlerteMeteoLook planApplique={planApplique} />}
                </>
              }
            />
          )}
        </div>
      ) : (
      <div className="mt-3">
      {carteDuJour(
      // LES AUTRES ÉTATS DE LA CARTE : la tenue d'un jour passé, aucune tenue possible, la tenue qui se compose. Depuis le 19/11/2026
      // (option B), le texte au-dessus et la composition dessous, sur toute la largeur, comme les slides ; avant, côte à côte. La tenue
      // elle-même passe par CarteHero (ci-dessus).
      <div
        // data-tour : la tenue du jour sans carrousel (une seule proposition) est aussi la cible de la visite (lib/visites.ts).
        data-tour="accueil-tenue"
        className="flex flex-col gap-2 px-4 pt-4 pb-3"
        style={{ minHeight: 280 }}
      >
        {/* Sans tenue possible (15/11/2026, capture : le texte tenait dans la moitié gauche, la droite restait vide), le texte prend toute
            la largeur de la carte : il n'y a pas de composition à côté. */}
        <div className="flex flex-col min-w-0" style={!passee && sansTenue ? { gridColumn: "1 / -1" } : undefined}>
          <div className="flex items-center gap-[7px]">
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta-deep" style={{ display: "block" }}>
              <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="t-surtitre text-ink whitespace-nowrap">
              {passee ? (retroActif === 1 ? t("Ta tenue d’hier") : t("Ta tenue passée")) : texteHero ? sansLeJour(texteHero.surtitre) : t("Ta tenue du jour")}
            </span>
          </div>

          {passee ? (
            <>
              <div className="t-titre-section text-ink mt-3" style={{ textWrap: "balance" }}>
                {passee.plan ? titreDuPlan(passee.plan) : OCC_LABELS[passee.occasion]}
              </div>
              <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]">{passee.source === "porte" ? t("Tu as porté cette tenue.") : t("Tu l’avais planifiée.")}</div>
              <div className="mt-auto pt-4">
                <Button variante="principal" pleine={false} onClick={actions.goHistory} className="!px-[18px]">
                  {t("Voir dans mon journal")}
                </Button>
              </div>
            </>
          ) : sansGenre ? (
            <>
              <div className="t-titre-section text-ink mt-3" style={{ textWrap: "balance" }}>
                {t("Complète ton")} <span className="italic text-terracotta">{t("profil")}</span>
              </div>
              <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
                {t("Pour que Capsela prépare tes tenues, complète ton profil.")}
              </div>
              <div className="mt-auto pt-4">
                <Button variante="principal" pleine={false} onClick={() => setGenreOuvert(true)} className="!px-[18px]">
                  {t("Indiquer mon genre")}
                </Button>
              </div>
            </>
          ) : aucuneTenuePossible ? (
            <>
              <div className="t-titre-section text-ink mt-3" style={{ textWrap: "balance" }}>
                {t("On prépare ta")} <span className="italic text-terracotta">{t("première tenue")}</span>
              </div>
              <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
                {/* Dressing vide (15/11/2026) : la tenue se compose avec la capsule. Si elle n'en compose aucune, « ajoute quelques pièces et on
                    compose ta tenue » était faux — c'est la capsule qui ne couvre pas l'occasion, et le dire. */}
                {dressingVide
                  ? t("Ta capsule ne couvre pas encore cette occasion. Ajoute quelques pièces à ton dressing pour composer ta tenue du jour.")
                  : t("Ton dressing et ta capsule ne couvrent pas encore cette occasion. Quelques pièces de plus suffiront.")}
              </div>
              <div className="mt-auto pt-4">
                <Button variante="principal" pleine={false} onClick={dressingVide ? actions.openAdd : actions.goWardrobe} className="!px-[18px]">
                  {dressingVide ? t("Ajouter mes pièces") : t("Voir mon dressing")}
                </Button>
              </div>
            </>
          ) : (
            <div key="chargement" className="motion-safe:animate-[capsule-apparition_260ms_ease-out_300ms_both]" role="status">
              <div className="t-titre-section text-ink mt-3" style={{ textWrap: "balance" }}>
                {t("Capsela compose")} <span className="italic text-terracotta">{t("ta tenue…")}</span>
              </div>
              <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]">
                {jourAVenir ? t("Pensée pour ton programme de ce jour-là.") : t("Pensée pour ton programme d’aujourd’hui.")}
              </div>
              <StatutComposition />
            </div>
          )}
        </div>

        {/* La composition : toutes les pièces du look, en planche (ZoneLookDuJour — silhouette pendant le chargement). */}
        {/* La zone déborde de 10 px dans le remplissage de droite et de 6 px sur la gouttière : la composition est plus grande (08/10/2026,
            « c'est encore vraiment petit »). Le texte garde sa colonne ; les pièces restent à 10 px au moins du bord de la card. */}
        {(passee || !sansTenue) && (
        <div className="relative min-w-0" style={{ aspectRatio: "100 / 96", margin: "4px -8px 0" }}>
          {passee ? (
            <FlatLayCapsela items={piecesPassee} context="hero-home" layoutSeed={clePieces(piecesPassee.map((p) => p.id)).join(",")} onPiece={ouvrirPiece} />
          ) : (
            <ZoneLookDuJour pieces={outfitPieces} categoriesAttendues={categoriesAttendues} graine={cleTenue} onPiece={toucherPiece(outfitPieces, remplacerTenueDuJour)} fantomes={sansChaussures(outfitPieces)} onFantome={(cat) => cat === "chaussures" && (demanderChoixChaussures(), actions.goTenues())} ajouts={conseilVeste} />
          )}
        </div>
        )}

      </div>
      )}
      </div>
      )}

      {/* LE VOYAGE APRÈS LA TENUE (19/11/2026, option B arbitrée ; avant : sous la salutation) : le séjour en cours, ou le prochain départ
          de J-7 à J-1 (06/11/2026, rappelsValise.ts). Seulement pour aujourd'hui : un autre jour consulté n'est pas « maintenant ». */}
      {retroActif === 0 && (sejour || (rappelValise && state.jourDecalage === 0)) && (
        <div className={`px-6 ${carrouselActif ? "mt-2" : "mt-3"}`}>
          {sejour ? <SejourEnCours sejour={sejour} /> : rappelValise && <CarteProchainDepart rappel={rappelValise} />}
        </div>
      )}

      {/* ══ LES QUATRE ACCÈS EN RANGÉE (19/11/2026, option B arbitrée) : Mon dressing, Ma capsule, Planifier mes looks, Préparer une valise —
          les mêmes destinations que les quatre cartes « Explorer Capsela · Tout pour ton style » qu'ils remplacent (CarteUnivers, gardé pour
          l'écran d'essai). La valise garde sa règle d'accès (ouvrirValise). */}
      <div className="px-6 mt-5">
        <AccesAccueil
          ouvrir={{ dressing: actions.goWardrobe, capsule: actions.goCapsule, planifier: () => actions.planifierDirect(), valise: ouvrirValise }}
        />
      </div>

      {/* Quota « Autre tenue » : la même feuille de quota partout. */}
      {quota.feuille}
      {/* La feuille Voir / Remplacer d'une pièce du flat lay, et sa confirmation (RemplacementPiece). */}
      {remplacement.rendu}
      {/* La feuille des genres de Mon profil (« Complète ton profil »), titrée pour l'accueil. */}
      {genreOuvert && <GenderModal current={profile.gender} titre={t("Indiquer mon genre")} onSelect={indiquerGenre} onClose={() => setGenreOuvert(false)} />}
    </div>
  );
}
