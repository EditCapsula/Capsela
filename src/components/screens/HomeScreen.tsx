"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import { StatutComposition, ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import { texteHeroPlan, titreDuPlan } from "@/lib/heroPlan";
import { useQuotaTenues } from "@/components/QuotaTenues";
import { clePieces, jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { OCC_LABELS } from "@/lib/data";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { estContexteMaison, qualificatifLook, tenueAUnSocle, titreLookDuJour } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { groupesDuVestiaire } from "@/lib/dressingEcran";
import { useCapsela } from "@/lib/store";
import { JourEtMeteo } from "@/components/JourMeteo";
import { retourPrecedent, retourSuivant, retoursAvecTenue, tenuePassee } from "@/lib/retro";
import { dateDuJour } from "@/lib/jourConsulte";
import { PlansDuJour, usePlanApplique } from "@/components/PlansDuJour";
import { occasionParDefaut } from "@/lib/jourConsulte";
import type { CategoryKey, Item } from "@/lib/types";
import Button, { BoutonDiscret } from "@/components/Button";

const glypheCalendrier = (taille: number) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </g>
  </svg>
);
const GLYPHE_VALISE = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
      <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" />
    </g>
  </svg>
);

/** Un chevron de carte : la flèche ronde décorative des cartes « Avec Capsela » (toute la carte est le bouton). */
const FLECHE_RONDE = (
  <span aria-hidden="true" className="flex items-center justify-center rounded-full bg-terracotta text-cream flex-shrink-0" style={{ width: 34, height: 34 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ display: "block" }}>
      <path d="M5 12h13M13 6.5l5.5 5.5L13 17.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

/**
 * Un titre de section de l'Accueil : capitales espacées, comme « Mon dressing » du Dressing (même gabarit), avec son lien
 * à droite. Refonte du 05/10/2026 : Aujourd'hui → Avec Capsela → Ton dressing → Ta capsule.
 */
function TitreAccueil({ children, lien, onLien, libelleLien }: { children: React.ReactNode; lien?: string; onLien?: () => void; libelleLien?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mx-6 mt-9">
      <h2 className="t-surtitre text-ink">{children}</h2>
      {lien && onLien && (
        <button onClick={onLien} aria-label={libelleLien ?? lien} className="t-lien text-terracotta cursor-pointer py-2 pl-3 whitespace-nowrap">
          {lien}
        </button>
      )}
    </div>
  );
}

/** Une carte « Avec Capsela » : glyphe, titre, phrase, visuel éditorial, flèche. Un seul bouton, comme toute carte cliquable. */
function CarteAvecCapsela({
  onClick,
  glyphe,
  titre,
  texte,
  visuel,
  alt,
  cta,
  badge,
  busy,
}: {
  onClick: () => void;
  glyphe: React.ReactNode;
  titre: string;
  texte: string;
  visuel: string;
  alt: string;
  cta: string;
  badge?: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={cta}
      aria-busy={busy}
      className="flex-none text-left bg-card border border-border rounded-feuille overflow-hidden cursor-pointer flex flex-col motion-safe:transition-[transform,opacity] motion-safe:active:scale-[.985] active:opacity-90"
      style={{ width: "clamp(236px, 74%, 300px)", scrollSnapAlign: "start" }}
    >
      <span className="block px-[14px] pt-[14px]">
        <span className="flex items-center justify-between gap-2">
          <span className="text-terracotta">{glyphe}</span>
          {badge}
        </span>
        <span className="block t-titre-carte text-ink mt-[8px]">{titre}</span>
        <span className="block text-[12px] text-muted-3 leading-[1.45] mt-[4px] min-h-[2.9em]" style={{ textWrap: "pretty" }}>
          {texte}
        </span>
      </span>
      <span className="relative block mt-[10px]" style={{ height: 104 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={visuel} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute right-[12px] bottom-[10px]">{FLECHE_RONDE}</span>
      </span>
    </button>
  );
}

export default function HomeScreen() {
  const { state, geoLoading, vestiairePool, weather, meteoDuJour, jourConsulte, actions } = useCapsela();
  // Navigation par date (27/09/2026) : la tenue et sa météo sont celles du jour consulté.
  const meteoEnAttente = geoLoading || jourConsulte.previsionEnChargement;
  const jourAVenir = jourConsulte.decalage > 0;
  const planApplique = usePlanApplique();

  /**
   * « PAS POUR MOI » PROPOSE UNE AUTRE TENUE (recette du 26/09/2026) — et
   * c'est un avis : le refus est enregistré (outfit_feedback), puis la
   * tenue suivante l'évite (regenOutfit). Le tirage compte comme une
   * alternative du quota gratuit, exactement comme « Autre tenue »
   * (arbitrage de la propriétaire) : même quota, même Gate (QuotaTenues).
   */
  const quota = useQuotaTenues();
  const [cleRefusee, setCleRefusee] = useState<string | null>(null);
  const cleCourante = clePieces(state.outfit).join(",");
  const autreProposee = cleRefusee !== null && cleRefusee !== cleCourante;
  const pasPourMoi = () => {
    setCleRefusee(cleCourante);
    actions.setOutfitFeedback("pas_aujourdhui");
    quota.demander(actions.regenOutfit);
  };

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
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  // Lecture seule des données déjà disponibles ailleurs dans l'app
  // (météo/localisation, occasion auto-sélectionnée, tenue déjà déterminée) —
  // jamais de génération de tenue ni d'appel image depuis cet écran.
  // Pool de résolution stable : wardrobePool ne contient, par catégorie, que
  // les pièces réelles ou les suggestions de la capsule du profil courant,
  // alors que state.outfit peut venir d'un style exploré ou d'une entrée
  // d'historique rejouée.
  const resolvePool = [...state.items, ...vestiairePool];
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
  // Le contexte le plus précis que les données donnent : une occasion de travail dit « Journée de travail » ou « Télétravail »
  // (le mode choisi), jamais le libellé générique « Travail / Bureau ».
  const occasionLabel =
    occasionKey === "travail_formel" ? (state.workMode === "Télétravail" ? "Télétravail" : "Journée de travail") : OCC_LABELS[occasionKey];

  const outfitPieces = hasOutfit ? piecesResolues : [];

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
  const texteHero = planHero ? texteHeroPlan(planHero) : null;
  // Le qualificatif sous le titre (qualificatifLook) : celui de la météo, sans
  // jamais présenter comme une option une veste que la tenue contient. Aucune
  // température affichée : elle est sur la ligne jour + météo, juste au-dessus.
  const qualificatif = qualificatifLook(meteoEnAttente ? null : meteoDuJour.temp, outfitPieces);

  // Capsule calculée avec le même moteur que CapsuleScreen, jamais un second
  // calcul : saison/style/effectif affichés ici correspondent toujours
  // exactement à l'écran Capsule.
  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = computeDefaultCapsule(profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool);

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

  /**
   * LES CATÉGORIES DU DRESSING, avec leurs vrais effectifs (dressingEcran.groupesDuVestiaire — la même source que l'écran
   * Dressing : jamais un chiffre écrit à la main). Une catégorie sans pièce n'est pas montrée.
   */
  const groupes = groupesDuVestiaire(state.items, profile.gender);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        {/* Le calendrier est une entrée GLOBALE, pas un onglet : un bouton dans la gouttière gauche du bandeau (05/10/2026). */}
        <AppHeader
          gauche={
            <button onClick={actions.goCalendrier} aria-label="Ouvrir mon calendrier" className="w-[34px] h-[34px] flex items-center justify-center rounded-full text-ink cursor-pointer active:opacity-70">
              {glypheCalendrier(24)}
            </button>
          }
        />
      </div>

      {/* Salutation — 34 → 28 px le 07/10/2026 (demandé : « trop grand »). Avant : présence renforcée (30 → 34 px) sans gonfler la hauteur
          de l'en-tête : le gain vient de la taille du serif, pas d'un
          interlignage ou d'une marge supplémentaires. */}
      <div className="px-6 mt-[18px]">
        <div className="font-serif text-[28px] leading-[1.1] text-ink">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
        {/* La promesse du jour, avec la ville de la météo affichée juste dessous : jamais un lieu écrit en dur. */}
        <p className="text-[14px] text-muted-3 leading-[1.45] mt-[6px]" style={{ textWrap: "pretty" }}>
          Voici ta tenue du jour, pensée pour {state.jourDecalage === 0 ? "aujourd’hui" : "ce jour-là"}.
        </p>
        {/* LE JOUR ET SA MÉTÉO, SUR UNE LIGNE (27/09/2026, navigation par
            date) : le jour se change par ses chevrons, la météo ouvre
            « Localisation & météo » des Préférences — les réglages existants,
            aucun écran de plus. Composant partagé avec Tenue. Le surtitre
            « Aujourd'hui » a disparu : la ligne porte la date. */}
        <JourEtMeteo
          className="mt-4"
          retro={{
            jours: retroActif,
            date: dateRetro,
            precedent: retourPrecedent(retours, retroActif),
            suivant: retourSuivant(retours, retroActif),
            temp: passee?.temp ?? null,
            label: passee?.weatherLabel ?? null,
            onChange: setRetro,
          }}
        />
        {/* Ce qui est planifié ce jour-là (Planifier) : un rappel qui mène à
            la fiche du plan, sous la ligne du jour. Rien sans plan. */}
        {retroActif === 0 && <PlansDuJour depuis="home" className="mt-3" />}
      </div>

      {/* ══ Card héros « LOOK DU JOUR » — refonte du 28/09/2026 ════════════
          L'ACCUEIL MONTRE TOUT LE LOOK. La card n'en montrait qu'un extrait
          (au plus cinq pièces, sans veste ni ceinture) et renvoyait à l'écran
          Tenue pour découvrir le reste. Elle en est désormais la projection
          complète ; l'écran Tenue sert à l'approfondir.

          UNE SEULE REPRÉSENTATION POUR LES DEUX ÉCRANS : OutfitComposition,
          variante "planche" depuis le 30/09/2026 (d'abord "hero"), dans une
          zone de même proportion que sur l'écran Tenue, alimentée par la même
          tenue (state.outfit).
          Mêmes pièces, mêmes images, même ordre, par construction — aucune
          sélection propre à l'accueil.

          TROIS ÉTATS, qui ne partagent que le surtitre :
            · la tenue est là — titre éditorial, qualificatif, composition,
              occasion, « Découvrir le look », avis ;
            · le moteur n'a rien pu composer — le message et le CTA d'avant,
              qui mènent au dressing ;
            · sinon, elle se compose (profil, dressing, vestiaire ou
              localisation pas encore prêts) — une silhouette abstraite aux
              emplacements du look et « Sélection des pièces en cours », qui
              n'apparaissent qu'après 300 ms : une génération rapide ne fait
              jamais clignoter le chargement (30/09/2026, à la place de six
              cases et d'un anneau qui tournait : « on doit sentir que Capsela
              compose une silhouette, pas qu'elle charge six produits »).

          LA ZONE DE COMPOSITION EST COMMUNE AU CHARGEMENT ET AU LOOK : seul le
          texte au-dessus change d'un état à l'autre. Elle reste montée, à la
          même place et à la même hauteur ; la planche y remplace la
          silhouette en fondu (ZoneLookDuJour). */}
      {passee ? (
        <div className="mx-6 mt-6 bg-terracotta rounded-hero text-left" style={{ width: "calc(100% - 48px)", padding: "20px 18px 20px" }}>
          <div className="flex items-center gap-[7px] t-label" style={{ color: "rgba(243,238,229,.86)" }}>
            <span aria-hidden="true" className="font-serif italic text-[13px] leading-none">
              ✦
            </span>
            {/* Le quand est dans la barre de date au-dessus (« Hier », « Dim. 27 ») : le hero ne le répète ni dans le surtitre ni dans un badge. */}
            {retroActif === 1 ? "Ton look d'hier" : "Ton look passé"}
          </div>
          <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
            {passee.plan ? titreDuPlan(passee.plan) : OCC_LABELS[passee.occasion]}
          </div>
          <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
            {passee.source === "porte" ? "Tu as porté cette tenue." : "Tu l'avais planifiée."}
          </div>
          <div className="mt-[12px]" style={{ aspectRatio: "100 / 82" }}>
            <OutfitComposition items={piecesPassee} variant="planche" />
          </div>
          <Button variante="claire" onClick={actions.goHistory} className="mt-[16px]">
            Voir dans mon journal <span aria-hidden="true">→</span>
          </Button>
        </div>
      ) : (
      <div
        className="mx-6 mt-6 bg-terracotta rounded-hero text-left"
        style={{ width: "calc(100% - 48px)", padding: "20px 18px 20px" }}
      >
        <div className="flex items-center gap-[7px] t-label" style={{ color: "rgba(243,238,229,.86)" }}>
          <span aria-hidden="true" className="font-serif italic text-[13px] leading-none">
            ✦
          </span>
          {/* « Ta tenue planifiée » quand la tenue affichée vient de Planifier
              (option C, 30/09/2026) : l'étiquette dit d'où elle vient. */}
          {texteHero ? texteHero.surtitre : "Ton look du jour"}
        </div>

        {aucuneTenuePossible ? (
          <>
            <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
              On prépare ta première tenue
            </div>
            <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
              {dressingVide
                ? "Ajoute quelques pièces à ton dressing, et on compose ta tenue du jour."
                : "Ton dressing et ta capsule ne couvrent pas encore cette occasion. Quelques pièces de plus suffiront."}
            </div>
          </>
        ) : (
          <>
            {hasOutfit ? (
              // Une clé par état : sans elle, React réutilise le même <div> d'un
              // état à l'autre et l'animation, de même nom, ne se rejoue pas —
              // l'arrivée de la tenue se ferait sans fondu (mesuré en rendu).
              <div key="prete" className="motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
                <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
                  {planHero ? titreDuPlan(planHero) : titreLookDuJour(occasionKey, state.workMode, state.dateContext)}
                </div>
                {(texteHero ? texteHero.sousTitre : qualificatif) && (
                  <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
                    {texteHero ? texteHero.sousTitre : qualificatif}
                  </div>
                )}
              </div>
            ) : (
              <div key="chargement" className="motion-safe:animate-[capsule-apparition_260ms_ease-out_300ms_both]" role="status">
                <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
                  Capsela compose ta tenue…
                </div>
                <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
                  {jourAVenir
                    ? "Une silhouette pensée pour ton programme de ce jour-là."
                    : "Une silhouette pensée pour ton programme d'aujourd'hui."}
                </div>
              </div>
            )}
            {/* Toutes les pièces du look, sans exception, en PLANCHE (30/09/2026,
                brief « Refonte du hero Look du jour ») : une silhouette et non
                une grille — la pièce héro (robe, ou haut photographié porté),
                la surcouche derrière, le bas devant, chaussures et sac en
                finition (composerPlanche). Zone de hauteur FIXE à largeur
                donnée (82 % de la largeur, mesuré le 30/09 : la partie peinte
                d'une planche va de 0,78 à 0,94 fois la largeur ; l'ancienne
                mesure de grille laissait jusqu'à 60 px vides en haut et en
                bas). La planche s'y ajuste : la card ne bouge pas avec la tenue.

                SANS ANNOTATIONS (30/09/2026, demandé : « je veux que la hauteur
                reste la même ; enlève les annotations et réaugmente de 15 % ») :
                les « Ton haut », « Ta veste »… prenaient une marge autour des
                pièces ; sans elles, les pièces la reprennent, à hauteur de card
                inchangée. La planche sait toujours les dessiner (prop
                `annotations`, libelleAnnotation) si elles reviennent. */}
            <div className="mt-[12px]" style={{ aspectRatio: "100 / 82" }}>
              <ZoneLookDuJour pieces={outfitPieces} categoriesAttendues={categoriesAttendues} />
            </div>
          </>
        )}

        {/* L'OCCASION, étiquette de contexte : dans les trois états sauf
            « aucune tenue », où elle serait la raison même de l'échec.
            PLEINE OPACITÉ PENDANT LE CHARGEMENT (01/10/2026, signalé : « lorsque
            la page charge, le hero n'affiche pas le label de l'occasion »).
            Elle était posée à 72 % « pour rester secondaire », et sur le
            terracotta sa pastille translucide devenait presque invisible : elle
            est dans la page dès le premier rendu (mesuré), mais ne se lisait
            pas. Le contexte du look est la première chose qu'on veut savoir. */}
        {!aucuneTenuePossible && occasionLabel && (
          <div className="pt-[16px]">
            {texteHero ? (
              // Un plan : le quand, pas l'occasion (déjà dans le titre) — « Dimanche 4 oct. · Soirée » ; le jour même, « ✦ Ce soir · Soirée ».
              <span
                className="inline-flex items-center gap-[6px] whitespace-nowrap"
                style={{ fontSize: 11, background: "rgba(243,238,229,.22)", color: "var(--color-on-terracotta)", borderRadius: 100, padding: "8px 14px" }}
              >
                <span aria-hidden="true">{jourAVenir ? "▣" : "✦"}</span>
                {texteHero.badge}
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-[6px] uppercase whitespace-nowrap"
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".08em",
                  background: "rgba(243,238,229,.22)",
                  color: "var(--color-on-terracotta)",
                  borderRadius: 100,
                  padding: "8px 14px",
                }}
              >
                <GlypheOccasion occasion={occasionKey} taille={13} />
                {occasionLabel}
              </span>
            )}
          </div>
        )}

        {/* LE CTA, pleine largeur, seule action pleine de la card. Pas pendant
            le chargement : il n'y a encore rien à découvrir. PAS DE CTA MORT
            (§9.3) : sans tenue possible, il mène au dressing. */}
        {/* Pendant le chargement, la ligne d'attente tient la place du CTA. */}
        {!hasOutfit && !aucuneTenuePossible && <StatutComposition />}
        {(hasOutfit || aucuneTenuePossible) && (
          <Button
            variante="claire"
            onClick={
              aucuneTenuePossible
                ? dressingVide
                  ? actions.openAdd
                  : actions.goWardrobe
                : planHero && jourAVenir
                  ? () => actions.ouvrirPlan(planHero, "home")
                  : actions.goTenues
            }
            className="mt-[12px]"
          >
            {hasOutfit ? (
              <>
                {planHero ? (jourAVenir ? "Voir le look planifié" : "Voir mon look") : "Voir ma tenue"} <span aria-hidden="true">→</span>
              </>
            ) : dressingVide ? (
              "Ajouter mes pièces"
            ) : (
              "Voir mon dressing"
            )}
          </Button>
        )}

        {/* LA TENUE PLANIFIÉE : ce que la météo du jour en dit, s'il y a lieu,
            et le retour à la proposition de Capsela. Jamais de changement
            d'office : la tenue reste celle qu'elle a choisie. */}
        {planApplique && hasOutfit && (
          <div className="mt-[10px] text-center">
            {planApplique.alerte && (
              <div className="text-[12.5px] leading-[1.4] mb-[2px]" style={{ color: "var(--color-on-terracotta-soft)", textWrap: "pretty" }}>
                {planApplique.alerte}
              </div>
            )}
            <button
              onClick={actions.voirAutreProposition}
              className="text-[13px] underline underline-offset-[3px] cursor-pointer"
              style={{ color: "var(--color-on-terracotta)", minHeight: 44 }}
            >
              Voir une autre proposition
            </button>
          </div>
        )}

        {/* FEEDBACK — deux boutons discrets, jamais concurrents du CTA :
            translucides, sous lui, à 44 px comme toute cible tactile. Logique
            inchangée : « J'adore » range la tenue dans Mes looks, « Pas pour
            moi » en propose une autre. Pas sur la tenue d'un jour à venir. */}
        {hasOutfit && !jourAVenir && (
          <div className="mt-[12px]" aria-live="polite">
            {avisDuJour ? (
              // Cliquable : repasser le même verdict le retire. Sans ce
              // geste, un tap involontaire serait définitif pour la journée.
              <button
                onClick={() => actions.setOutfitFeedback(avisDuJour)}
                aria-label="Revenir sur mon avis"
                className="font-serif italic text-[13px] text-left cursor-pointer"
                style={{ color: "var(--color-on-terracotta-soft)", minHeight: 44 }}
              >
                {avisDuJour === "adore" ? "Ajoutée à tes looks — on garde cette direction." : "Noté, pas pour toi."}
              </button>
            ) : (
              <>
                {autreProposee && (
                  <div className="font-serif italic text-[13px] mb-[6px]" style={{ color: "var(--color-on-terracotta-soft)" }}>
                    Voici une autre proposition.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-[9px]">
                  <BoutonDiscret onClick={() => actions.setOutfitFeedback("adore")} className="whitespace-nowrap px-[6px]">
                    <span aria-hidden="true">♡</span> J&apos;adore cette tenue
                  </BoutonDiscret>
                  <BoutonDiscret onClick={pasPourMoi} disabled={quota.tirageEnCours} className="whitespace-nowrap px-[6px]">
                    <span aria-hidden="true">✕</span> Pas pour moi
                  </BoutonDiscret>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* ══ AVEC CAPSELA ═══════════════════════════════════════════════
          Refonte du 05/10/2026 (titre « Pour aller plus loin » depuis la maquette du 07/10/2026) : Aujourd'hui (la tenue) → Pour aller plus loin → Ton dressing → Ta capsule. Les trois entrées
          sont des fonctionnalités qui existent, avec leurs parcours d'avant : Planifier, Valise, Avis de styliste.
          Aucun contenu éditorial inventé, aucun visuel de destination ni de personne : des objets et des matières. */}
      <TitreAccueil lien="Tout découvrir →" onLien={actions.goPremium} libelleLien="Découvrir Capsela Premium">
        Pour aller plus loin
      </TitreAccueil>
      <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
        <CarteAvecCapsela
          onClick={actions.goPlanifier}
          glyphe={glypheCalendrier(17)}
          titre="Planifier une tenue"
          texte="Une occasion en tête ? Capsela compose le look."
          visuel="/editorial/capsela_planifier_intro.webp"
          alt="Un carnet de planning et un crayon"
          cta="Planifier une tenue"
        />
        {/* « Préparer une valise » MÈNE AU PARCOURS (docs/valise.md), selon la règle d'accès PREPARER_VALISE (ouvrirValise). */}
        <CarteAvecCapsela
          onClick={ouvrirValise}
          glyphe={GLYPHE_VALISE}
          titre="Préparer une valise"
          texte="Un départ en vue ? Ta sélection pensée pour le séjour."
          visuel={`/editorial/capsela_planifier_valise_${profile.gender === "homme" ? "homme" : "femme"}.webp`}
          alt="Une valise ouverte, des vêtements pliés et des accessoires"
          cta="Préparer une valise"
        />
      </div>

      {/* ══ TON DRESSING ═════════════════════════════════════════════════
          L'aperçu des catégories, avec les effectifs réels. Dressing vide : une invitation, jamais une rangée vide. */}
      <TitreAccueil lien={dressingVide ? undefined : "Voir tout →"} onLien={actions.goWardrobe} libelleLien="Voir tout mon dressing">
        Ton dressing
      </TitreAccueil>
      {dressingVide ? (
        <div className="mx-6 mt-4">
          <button
            onClick={actions.openAdd}
            className="w-full text-left bg-card border border-border rounded-feuille px-4 py-[16px] cursor-pointer motion-safe:transition-[transform,opacity] motion-safe:active:scale-[.985] active:opacity-90"
          >
            <span className="block t-titre-carte text-ink">Ton dressing commence ici</span>
            <span className="block text-[12px] text-muted-3 leading-[1.45] mt-[5px]">Ajoute quelques pièces pour que Capsela compose des tenues qui te ressemblent.</span>
            <span className="block t-cta text-terracotta mt-[10px]">Ajouter mes pièces <span aria-hidden="true">→</span></span>
          </button>
        </div>
      ) : (
        <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
          {groupes.map((g) => (
            <button
              key={g.id}
              onClick={() => actions.goWardrobePieces({ libelle: g.libelle, categories: g.categories })}
              aria-label={`${g.libelle} : ${g.nbPieces} ${g.nbPieces <= 1 ? "pièce" : "pièces"}`}
              className="flex-none text-left cursor-pointer active:opacity-80"
              style={{ width: 112, scrollSnapAlign: "start" }}
            >
              <span className="block overflow-hidden rounded-bloc" style={{ aspectRatio: "1 / 1", background: "var(--color-warm-bg)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.visuel} alt="" width={480} height={640} loading="lazy" decoding="async" className="w-full h-full object-cover block" />
              </span>
              <span className="block font-serif text-[13px] text-ink leading-[1.25] mt-[8px] px-[2px]" style={{ minHeight: "2.5em", textWrap: "balance" }}>
                {g.libelle.replace(/ & /g, " &\u00a0")}
              </span>
              <span className="block text-[11px] text-muted mt-[1px] px-[2px]">
                {g.nbPieces} {g.nbPieces <= 1 ? "pièce" : "pièces"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ══ TA CAPSULE ═══════════════════════════════════════════════════
          La capsule réelle, calculée comme l'écran Capsule (saison, style, effectif) : jamais écrite en dur. */}
      <TitreAccueil lien="Voir ma capsule →" onLien={actions.goCapsule}>
        {`Ta capsule ${capsuleSeason}`}
      </TitreAccueil>
      <div className="mx-6 mt-4">
        <button
          onClick={actions.goCapsule}
          aria-label="Voir ma capsule"
          className="relative block w-full text-left rounded-feuille overflow-hidden cursor-pointer motion-safe:transition-[transform,opacity] motion-safe:active:scale-[.985] active:opacity-90"
          style={{ minHeight: 132, background: "var(--color-terracotta-deep)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/editorial/capsela_capsule_banner.webp" alt="" width={808} height={300} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute inset-0" style={{ background: "rgba(29,26,22,.42)" }} aria-hidden="true" />
          <span className="relative flex items-end justify-between gap-3 px-[16px] py-[16px]" style={{ minHeight: 132 }}>
            <span className="block min-w-0">
              <span className="block font-serif text-[20px] leading-[1.15]" style={{ color: "var(--color-on-terracotta)" }}>
                {`Ma sélection ${/^[AÉEIOUH]/i.test(capsuleSeason) ? "d’" : "de "}${capsuleSeason.toLowerCase()}`}
              </span>
              <span className="block text-[12px] leading-[1.45] mt-[5px]" style={{ color: "var(--color-on-terracotta-soft)", textWrap: "pretty" }}>
                {capsule.length > 0
                  ? `${capsule.length} ${capsule.length <= 1 ? "pièce pensée" : "pièces pensées"} pour composer facilement tes tenues cette saison.`
                  : "Des pièces pensées pour composer facilement tes tenues cette saison."}
              </span>
            </span>
            {FLECHE_RONDE}
          </span>
        </button>
      </div>

      {/* Quota « Pas pour moi » : même feuille que « Autre tenue ». */}
      {quota.feuille}

    </div>
  );
}
