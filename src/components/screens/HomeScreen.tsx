"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { StatutComposition, ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import { texteHeroPlan, titreDuPlan } from "@/lib/heroPlan";
import { useQuotaTenues } from "@/components/QuotaTenues";
import { clePieces, jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { OCC_LABELS } from "@/lib/data";
import { estContexteMaison, qualificatifLook, sousTitreLookDuJour, tenueAUnSocle } from "@/lib/logic";
import { libelleStyles } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BarreDuJour from "@/components/BarreDuJour";
import BadgePremium from "@/components/BadgePremium";
import { retourPrecedent, retourSuivant, retoursAvecTenue, tenuePassee } from "@/lib/retro";
import { dateDuJour } from "@/lib/jourConsulte";
import { PlansDuJour, usePlanApplique } from "@/components/PlansDuJour";
import { occasionParDefaut } from "@/lib/jourConsulte";
import type { CategoryKey, Item } from "@/lib/types";
import Button from "@/components/Button";

/** Un glyphe au trait de la grille « Tout pour ton style » (maquette Accueil V9, 07/10/2026). */
const glypheUnivers = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const D_DRESSING = "M10 6a2 2 0 1 1 2 2v1.5M12 9.5L3.4 16a1 1 0 0 0 .6 1.8h16a1 1 0 0 0 .6-1.8z";
const D_CAPSULE = "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3";
const D_AGENDA = "M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5v4M15.5 3.5v4";
const D_VALISE = "M3 10a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 10v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 18zM9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5";

/**
 * Une action discrète sous le look : un rond au trait, puis son libellé (« Sauvegarder », « Autre idée »). Un seul bouton,
 * cible tactile de 48 px.
 */
function ActionRonde({ icone, libelle, onClick, actif, disabled, label }: { icone: React.ReactNode; libelle: string; onClick: () => void; actif?: boolean; disabled?: boolean; label?: string }) {
  // Polish du 07/10/2026 : une icône et un mot, sans pastille — le CTA « Voir le look » reste l'action dominante du hero.
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      aria-label={label}
      className="inline-flex items-center gap-[7px] min-h-[44px] px-1 text-[12.5px] text-on-terracotta-soft cursor-pointer disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[.97]"
    >
      <span className="flex-shrink-0 text-on-terracotta">{icone}</span>
      <span>{libelle}</span>
    </button>
  );
}

/**
 * Une carte de la grille « Tout pour ton style » : un glyphe, un titre en deux lignes, une phrase, un visuel éditorial en
 * colonne à droite et une flèche simple. Toute la carte est le bouton. Polish du 07/10/2026 : moins « tableau de bord » —
 * pas de pastille sous le glyphe ni de rond autour de la flèche, un visuel plus discret ; `surtitre` dit ce que la carte
 * contient (« Mes pièces » / « Par Capsela »), pour que le dressing et la capsule ne se confondent pas.
 */
function CarteUnivers({
  onClick, glyphe, ligne1, ligne2, texte, accent, visuel, surtitre, label, busy, premium,
}: {
  onClick: () => void;
  glyphe: React.ReactNode;
  ligne1: string;
  ligne2: string;
  texte: string;
  /** Les styles de la personne, en terracotta après la phrase (carte capsule). */
  accent?: string;
  visuel: string;
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={visuel} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover block opacity-90" />
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
        <span className={"block font-serif text-[15px] leading-[1.15] text-ink " + (surtitre ? "mt-[3px]" : "mt-3")}>
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

export default function HomeScreen() {
  const { state, geoLoading, vestiairePool, meteoDuJour, jourConsulte, actions } = useCapsela();
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
  const pasPourMoi = () => {
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

  /** Les styles de la personne, dits en une fois dans la carte capsule : jamais un style écrit en dur. */
  const stylesDits = libelleStyles(profile.styles, profile.gender);
  const titreHero = (() => {
    if (planHero) return { a: titreDuPlan(planHero), b: "" };
    if (qualificatif) {
      const mots = qualificatif.replace(/\.$/, "").split(" et ");
      return { a: mots[0].charAt(0).toUpperCase() + mots[0].slice(1), b: mots.length > 1 ? `et ${mots.slice(1).join(" et ")}` : "" };
    }
    return { a: "Ta tenue", b: "du jour" };
  })();
  const sousTitreHero = texteHero ? texteHero.sousTitre : sousTitreLookDuJour(occasionKey, state.workMode, state.dateContext);
  const cleTenue = clePieces(state.outfit).join(",");
  const sauvegardee = jourAVenir
    ? state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cleTenue)
    : avisDuJour === "adore";
  const genreVisuel = profile.gender === "homme" ? "homme" : "femme";

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        {/* Le calendrier est une entrée GLOBALE, pas un onglet : un bouton dans la gouttière gauche du bandeau (05/10/2026). */}
        <AppHeader />
      </div>

      {/* ══ MAQUETTE « ACCUEIL V9 » (07/10/2026), reprise intégralement : salutation, jour et météo, look du jour sur fond
          sable, puis une seule section « Tout pour ton style ». Les sections « Pour aller plus loin », « Ton dressing » (catégories)
          et « Ta capsule » (bannière) et la carte Avis de styliste n'y figurent pas : l'avis reste accessible depuis le Journal. */}
      <div className="px-6 mt-[18px]">
        <div className="t-display text-ink">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
        {/* LE JOUR ET SA MÉTÉO (navigation par date, partagée avec Tenue) : le jour se change par ses chevrons, la météo
            ouvre les réglages « Localisation & météo » (BarreDuJour, maquette V9). */}
        <BarreDuJour
          className="mt-1"
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
        {/* Ce qui est planifié ce jour-là (Planifier) : un rappel qui mène à la fiche du plan. Rien sans plan. */}
        {retroActif === 0 && <PlansDuJour depuis="home" className="mt-3" />}
      </div>

      {/* LE LOOK DU JOUR : fond sable, texte à gauche, composition à droite, deux actions dessous. Quatre états : la tenue d'un
          jour passé, aucune tenue possible, la tenue qui se compose, la tenue. */}
      <div className="mx-6 mt-3 rounded-hero grid gap-2" style={{ background: "var(--color-terracotta-deep)", gridTemplateColumns: "minmax(0,0.8fr) minmax(0,1.2fr)", padding: "20px 14px 10px 18px", minHeight: 300 }}>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-[7px]">
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-on-terracotta" style={{ display: "block" }}>
              <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="t-surtitre text-on-terracotta whitespace-nowrap">
              {passee ? (retroActif === 1 ? "Ton look d’hier" : "Ton look passé") : texteHero ? texteHero.surtitre : "Ton look du jour"}
            </span>
          </div>

          {passee ? (
            <>
              <div className="font-serif text-on-terracotta mt-3" style={{ fontSize: "clamp(22px, 6.4vw, 27px)", lineHeight: 1.08 }}>
                {passee.plan ? titreDuPlan(passee.plan) : OCC_LABELS[passee.occasion]}
              </div>
              <div className="text-[13px] text-on-terracotta-soft leading-[1.45] mt-[10px]">{passee.source === "porte" ? "Tu as porté cette tenue." : "Tu l’avais planifiée."}</div>
              <div className="mt-auto pt-4">
                <Button variante="claire" pleine={false} onClick={actions.goHistory} className="!px-[18px]">
                  Voir dans mon journal
                </Button>
              </div>
            </>
          ) : aucuneTenuePossible ? (
            <>
              <div className="font-serif text-on-terracotta mt-3" style={{ fontSize: "clamp(22px, 6.4vw, 27px)", lineHeight: 1.08 }}>
                On prépare ta <span className="italic text-on-terracotta-soft">première tenue</span>
              </div>
              <div className="text-[13px] text-on-terracotta-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
                {dressingVide
                  ? "Ajoute quelques pièces à ton dressing, et on compose ta tenue du jour."
                  : "Ton dressing et ta capsule ne couvrent pas encore cette occasion. Quelques pièces de plus suffiront."}
              </div>
              <div className="mt-auto pt-4">
                <Button variante="claire" pleine={false} onClick={dressingVide ? actions.openAdd : actions.goWardrobe} className="!px-[18px]">
                  {dressingVide ? "Ajouter mes pièces" : "Voir mon dressing"}
                </Button>
              </div>
            </>
          ) : hasOutfit ? (
            <>
              <div key="prete" className="motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
                <div className="font-serif text-on-terracotta mt-3" style={{ fontSize: "clamp(22px, 6.4vw, 27px)", lineHeight: 1.08 }}>
                  {titreHero.a}
                  {titreHero.b && (
                    <>
                      <br />
                      <span className="italic text-on-terracotta-soft">{titreHero.b}</span>
                    </>
                  )}
                </div>
                <div className="text-[13px] text-on-terracotta-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
                  {sousTitreHero}
                </div>
              </div>
              <div className="mt-auto pt-4">
                <Button
                  variante="claire"
                  pleine={false}
                  onClick={planHero && jourAVenir ? () => actions.ouvrirPlan(planHero, "home") : actions.goTenues}
                  className="!px-[16px] !normal-case !tracking-[0.02em] !text-[14px] whitespace-nowrap"
                >
                  Voir le look <span aria-hidden="true">→</span>
                </Button>
              </div>
            </>
          ) : (
            <div key="chargement" className="motion-safe:animate-[capsule-apparition_260ms_ease-out_300ms_both]" role="status">
              <div className="font-serif text-on-terracotta mt-3" style={{ fontSize: "clamp(22px, 6.4vw, 27px)", lineHeight: 1.08 }}>
                Capsela compose <span className="italic text-on-terracotta-soft">ta tenue…</span>
              </div>
              <div className="text-[13px] text-on-terracotta-soft leading-[1.45] mt-[10px]">
                {jourAVenir ? "Pensée pour ton programme de ce jour-là." : "Pensée pour ton programme d’aujourd’hui."}
              </div>
              <StatutComposition />
            </div>
          )}
        </div>

        {/* La composition : toutes les pièces du look, en planche (ZoneLookDuJour — silhouette pendant le chargement). */}
        <div className="relative min-w-0 self-center" style={{ aspectRatio: "100 / 112", margin: "14px -4px 0 0" }}>
          {passee ? (
            <FlatLayCapsela pieces={piecesPassee} graine={clePieces(piecesPassee.map((p) => p.id)).join(",")} />
          ) : aucuneTenuePossible ? null : (
            <ZoneLookDuJour pieces={outfitPieces} categoriesAttendues={categoriesAttendues} graine={cleTenue} />
          )}
        </div>

        {/* LES DEUX ACTIONS : « Sauvegarder » range la tenue dans Mes looks (l'ancien « J'adore », même enregistrement) ; « Autre idée »
            propose une autre tenue (l'ancien « Pas pour moi » : le refus est enregistré, la suivante l'évite, même quota). */}
        {hasOutfit && !passee && (
          <div className="flex items-center mt-0" style={{ gridColumn: "1 / -1" }} aria-live="polite">
            <ActionRonde
              icone={
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                  <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={sauvegardee ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              libelle={sauvegardee ? "Sauvegardée" : "Sauvegarder"}
              actif={sauvegardee}
              // Aujourd'hui : l'avis « J'adore » (enregistré, et la tenue rejoint Mes looks). Un autre jour : la tenue seule
              // rejoint Mes looks — l'avis du jour ne porte que sur la tenue d'aujourd'hui.
              onClick={() => (jourAVenir ? actions.toggleSaveOutfitLook() : actions.setOutfitFeedback("adore"))}
            />
            <span aria-hidden="true" className="w-px h-[16px] mx-3" style={{ background: "rgba(251,243,234,.35)" }} />
            <ActionRonde
              icone={
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                  <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              libelle="Autre idée"
              label="Propose-moi une autre tenue"
              disabled={quota.tirageEnCours}
              onClick={jourAVenir ? () => quota.demander(actions.regenOutfit) : pasPourMoi}
            />
          </div>
        )}

        {/* LA TENUE PLANIFIÉE : ce que la météo du jour en dit, s'il y a lieu, et le retour à la proposition de Capsela. */}
        {planApplique && hasOutfit && (
          <div className="text-center" style={{ gridColumn: "1 / -1" }}>
            {planApplique.alerte && (
              <div className="text-[12.5px] text-on-terracotta-soft leading-[1.4] mb-[2px]" style={{ textWrap: "pretty" }}>
                {planApplique.alerte}
              </div>
            )}
            <button onClick={actions.voirAutreProposition} className="text-[13px] underline underline-offset-[3px] text-on-terracotta cursor-pointer" style={{ minHeight: 44 }}>
              Voir une autre proposition
            </button>
          </div>
        )}
      </div>

      {/* ══ EXPLORER CAPSELA — « Tout pour ton style » : les quatre univers de l'app. */}
      <div className="px-6 mt-7">
        <span className="t-surtitre text-muted-3 !text-[9.5px]">Explorer Capsela</span>
        <h2 className="t-titre-ecran text-ink mt-1">
          Tout pour ton <span className="italic text-terracotta">style</span>
        </h2>
        <div className="grid grid-cols-2 gap-[10px] mt-[14px]">
          <CarteUnivers
            onClick={actions.goWardrobe}
            glyphe={glypheUnivers(D_DRESSING)}
            ligne1="Mon"
            ligne2="dressing"
            surtitre="Mes pièces"
            texte="Ajoute et gère tes pièces"
            visuel="/editorial/capsela_dressing_banner.webp"
            label="Mon dressing"
          />
          <CarteUnivers
            onClick={actions.goCapsule}
            glyphe={glypheUnivers(D_CAPSULE)}
            ligne1="Ma"
            ligne2="capsule"
            surtitre="Par Capsela"
            texte={profile.styles.length > 1 ? "Une sélection adaptée à tes styles" : "Une sélection adaptée à ton style"}
            accent={stylesDits || undefined}
            visuel="/editorial/capsela_capsule_banner.webp"
            label="Ma capsule"
          />
          <CarteUnivers
            onClick={actions.goPlanifier}
            glyphe={glypheUnivers(D_AGENDA)}
            ligne1="Planifier"
            ligne2="mes looks"
            texte="Organise tes tenues à l’avance"
            visuel="/editorial/capsela_planifier_intro.webp"
            label="Planifier mes looks"
            premium
          />
          <CarteUnivers
            onClick={ouvrirValise}
            glyphe={glypheUnivers(D_VALISE)}
            ligne1="Préparer"
            ligne2="une valise"
            texte="Une sélection pensée pour ton voyage"
            visuel={`/editorial/capsela_planifier_valise_${genreVisuel}.webp`}
            label="Préparer une valise"
            premium
          />
        </div>
      </div>

      {/* Quota « Autre idée » : même feuille que « Autre tenue ». */}
      {quota.feuille}
    </div>
  );
}
