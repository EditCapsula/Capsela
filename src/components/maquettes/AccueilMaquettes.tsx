"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import TitrePage from "@/components/TitrePage";
import BarreDuJour, { EnTeteJour } from "@/components/BarreDuJour";
import { JourEtMeteo } from "@/components/JourMeteo";
import { CarteProchainDepart } from "@/components/RappelValise";
import { SejourEnCours } from "@/components/SejourEnCours";
import { ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import PourLExterieur, { ConseilManteauPlusLong } from "@/components/PourLExterieur";
import PourquoiCetteTenue from "@/components/PourquoiCetteTenue";
import { IconeAutre, IconeCoeur } from "@/components/CarrouselHero";
import Button from "@/components/Button";
import { useQuotaTenues } from "@/components/QuotaTenues";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";
import { D_AGENDA, D_CAPSULE, D_DRESSING, D_VALISE, glypheUnivers } from "@/components/screens/HomeScreen";
import { useCapsela } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { t } from "@/lib/langue";
import { styleDuLook, texteEditorialLook } from "@/lib/editorialLook";
import { candidatsDeRemplacement, estContexteMaison, tenueAUnSocle } from "@/lib/logic";
import { separerCoucheExterieure, temperatureReelle } from "@/lib/coucheExterieure";
import { jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { dateDuJour, occasionParDefaut } from "@/lib/jourConsulte";
import { prochainRappel } from "@/lib/rappelsValise";
import { sejourEnCours } from "@/lib/valiseDuJour";
import { slideDeLOccasion, SLIDES } from "@/lib/carrousel";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";
import type { ValiseGardee } from "@/lib/valises";

/*
 * TROIS ARCHITECTURES DE L'ACCUEIL, À COMPARER (18/11/2026, brief « Refonte UX – Homepage Capsela | Exploration des layouts »).
 *
 * Un écran d'ESSAI, jamais celui de la production : monté par App.tsx à la place de l'accueil seulement avec `?maquettes` dans l'adresse,
 * et seulement en mode démo ou en développement (maquettesAccueilActives). L'accueil réel (HomeScreen) n'est pas touché.
 *
 * Mêmes données et mêmes actions que l'accueil : la tenue du jour du store, sa couche extérieure (separerCoucheExterieure), son titre
 * (texteEditorialLook), la météo (BarreDuJour, EnTeteJour, JourEtMeteo), « Voir le look », « Sauvegarder » (l'avis « J'adore »), « Avis d'un
 * proche », « Autre tenue » (même quota, même avis « pas aujourd'hui » que l'accueil). Seule la DISPOSITION change d'une option à l'autre.
 *
 * La carte voyage : une valise FICTIVE (aucune écriture), datée pour tomber dans chacun des deux états — à compléter avant le départ
 * (prochainRappel) ou séjour en cours (sejourEnCours) —, rendue par les composants réels de l'accueil.
 */

export type OptionMaquette = "A" | "B" | "C";
export type EtatVoyage = "depart" | "sejour" | "aucun";

/** L'écran d'essai est-il ouvert ? `?maquettes` dans l'adresse, hors production réelle. */
export function maquettesAccueilActives(): boolean {
  if (typeof window === "undefined") return false;
  const ok = !isSupabaseConfigured || process.env.NODE_ENV !== "production";
  return ok && new URLSearchParams(window.location.search).has("maquettes");
}

const lireParam = <T extends string>(cle: string, valides: readonly T[], defaut: T): T => {
  if (typeof window === "undefined") return defaut;
  const v = new URLSearchParams(window.location.search).get(cle) as T | null;
  return v && valides.includes(v) ? v : defaut;
};

/** Une valise fictive datée autour d'aujourd'hui, faite de pièces réelles du pool (douze), trois encore à ajouter. */
function valiseFictive(pool: readonly Item[], debut: number, fin: number): ValiseGardee {
  const ids = pool.slice(0, 12).map((p) => p.id);
  return {
    version: 2,
    id: "maquette",
    destination: "Lisbonne",
    depart: jourLocal(dateDuJour(debut)),
    retour: jourLocal(dateDuJour(fin)),
    bagage: "M",
    sejour: null,
    occasions: ["quotidien", "soiree"],
    meteos: [],
    situations: [],
    pieceIds: ids,
    looks: [0, 1, 2, 3].map((k) => ({ ids: ids.slice(k * 3, k * 3 + 3), situations: [], elargie: false })),
    situationsSansLook: [],
    suggestionIds: ids.slice(9, 12),
  } as unknown as ValiseGardee;
}

const FANTOME_CHAUSSURES: CategoryKey[] = ["chaussures"];
const AUCUN: CategoryKey[] = [];

/** La tenue du jour et ses actions, calculées comme sur l'accueil (HomeScreen), sans rien composer de plus. */
function useTenueDuJour() {
  const { state, vestiairePool, wardrobePool, defaultCapsule, meteoDuJour, jourConsulte, actions, weather, sourceMeteo } = useCapsela();
  const { profile } = useAuth();
  const quota = useQuotaTenues();
  const ouvrirPiece = useOuvrirPiece();
  const pool = [...state.items, ...vestiairePool];
  const resolues = state.outfit.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
  const prete = resolues.length > 0 && tenueAUnSocle(resolues);
  const occasion: OccasionKey = state.occasion && state.occasion !== "all" ? state.occasion : occasionParDefaut(profile.prefs, jourConsulte.date);
  const temp = temperatureReelle({ decalage: jourConsulte.decalage, sourceMeteo, tempDuJour: weather.temp, prevue: jourConsulte.meteoPrevue?.temp, minDuJour: jourConsulte.minDuJour });
  const maison = estContexteMaison(occasion, state.workMode);
  const manteaux = (src: Item[]) => (temp != null && !maison && prete ? candidatsDeRemplacement(resolues, src, -1, "manteau", occasion, state.workMode, state.dateContext, meteoDuJour) : []);
  const sep = separerCoucheExterieure(prete ? resolues : [], temp, manteaux(wardrobePool), manteaux(defaultCapsule), maison);
  const pieces = sep.principal;
  const sauf = [...(sep.exterieur && !sep.suggere ? [sep.exterieur.id] : []), ...(sep.remplace ? [sep.remplace.id] : [])];
  const texte = texteEditorialLook(pieces, occasion, state.workMode, state.dateContext, styleDuLook(pieces, profile.styles, profile.gender));
  const avis = state.outfitFeedbackDuJour.find((a) => a.jour === jourLocal() && memeTenue(a.pieceIds, state.outfit))?.verdict ?? null;
  const surtitre = SLIDES.find((d) => d.id === slideDeLOccasion(occasion))?.surtitre ?? "Ton look du jour";
  return {
    prete,
    pieces,
    graine: pieces.map((p) => p.id).join(","),
    fantomes: pieces.length && !pieces.some((p) => p.cat === "chaussures") ? FANTOME_CHAUSSURES : AUCUN,
    attendues: (maison ? ["haut", "pantalon", "chaussures"] : ["haut", "pantalon", "chaussures", "sac"]) as CategoryKey[],
    surtitre,
    titre: texte.titre,
    phrase: texte.phrase,
    sauvegardee: avis === "adore",
    exterieur:
      sep.exterieur && temp != null ? (
        <PourLExterieur piece={sep.exterieur} temperature={temp} quand="aujourd'hui" onClick={actions.goTenues} compact />
      ) : sep.conseilManteauPlusLong ? (
        <ConseilManteauPlusLong compact />
      ) : null,
    voir: actions.goTenues,
    sauvegarder: () => actions.setOutfitFeedback("adore", sauf.length ? sauf : undefined),
    avisProche: () => actions.openOpinionShare(),
    autre: () =>
      quota.demander(() => {
        if (avis !== "pas_aujourdhui") actions.setOutfitFeedback("pas_aujourdhui");
        actions.regenOutfit();
      }),
    autreOccupe: quota.tirageEnCours,
    feuilleQuota: quota.feuille,
    ouvrirPiece,
  };
}
type Tenue = ReturnType<typeof useTenueDuJour>;

const IconeAvis = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4 3.5V16a2.5 2.5 0 0 1-2.5-2.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
const IconeOeil = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

function Titre({ tenue, taille = "t-titre-section" }: { tenue: Tenue; taille?: string }) {
  return (
    <div className={`relative ${taille} text-ink`} style={{ textWrap: "balance" }}>
      {tenue.titre.a}
      {tenue.titre.b && (
        <>
          {" "}
          <span className="italic text-terracotta">{tenue.titre.b}</span>
        </>
      )}
      <PourquoiCetteTenue texte={tenue.phrase} />
    </div>
  );
}

function Surtitre({ texte }: { texte: string }) {
  return (
    <div className="flex items-center gap-[7px]">
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta-deep" style={{ display: "block" }}>
        <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="t-surtitre text-ink whitespace-nowrap">{t(texte)}</span>
    </div>
  );
}

function Composition({ tenue, ratio }: { tenue: Tenue; ratio: string }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: ratio }}>
      <ZoneLookDuJour pieces={tenue.pieces} categoriesAttendues={tenue.attendues} graine={tenue.graine} onPiece={tenue.ouvrirPiece} fantomes={tenue.fantomes} />
    </div>
  );
}

/** Les trois actions secondaires sous l'action principale (Sauvegarder · Avis d'un proche · Autre tenue) : trois colonnes égales, l'icône
 * au-dessus du libellé — sur une ligne, les trois libellés ne tiennent pas à 390 px. */
function ActionsTexte({ tenue }: { tenue: Tenue }) {
  const actions = [
    { cle: "sauver", icone: <IconeCoeur plein={tenue.sauvegardee} />, libelle: tenue.sauvegardee ? t("Sauvegardée") : t("Sauvegarder"), onClick: tenue.sauvegarder, actif: tenue.sauvegardee },
    { cle: "avis", icone: <IconeAvis />, libelle: t("Avis d'un proche"), onClick: tenue.avisProche },
    { cle: "autre", icone: <IconeAutre />, libelle: t("Autre tenue"), onClick: tenue.autre, desactive: tenue.autreOccupe },
  ];
  return (
    <div className="grid grid-cols-3">
      {actions.map((a) => (
        <button key={a.cle} type="button" onClick={a.onClick} disabled={a.desactive} aria-pressed={a.actif} className="flex flex-col items-center justify-center gap-[4px] min-h-[52px] text-[12px] text-ink-soft cursor-pointer disabled:opacity-50">
          <span className="text-ink">{a.icone}</span>
          {a.libelle}
        </button>
      ))}
    </div>
  );
}

function CarteVoyage({ etat, className = "" }: { etat: EtatVoyage; className?: string }) {
  const { state, vestiairePool } = useCapsela();
  const pool = useMemo(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  if (etat === "aucun" || pool.length < 12) return null;
  const aujourdhui = jourLocal(dateDuJour(0));
  if (etat === "depart") {
    const rappel = prochainRappel([valiseFictive(pool, 5, 9)], aujourdhui);
    return rappel ? <CarteProchainDepart rappel={rappel} className={className} /> : null;
  }
  const sejour = sejourEnCours([valiseFictive(pool, -1, 4)], aujourdhui, pool);
  return sejour ? <SejourEnCours sejour={sejour} className={className} /> : null;
}

const ACCES = [
  { cle: "dressing", d: D_DRESSING, a: "Mon", b: "dressing", label: "Mon dressing" },
  { cle: "capsule", d: D_CAPSULE, a: "Ma", b: "capsule", label: "Ma capsule" },
  { cle: "planifier", d: D_AGENDA, a: "Planifier", b: "mes looks", label: "Planifier mes looks" },
  { cle: "valise", d: D_VALISE, a: "Préparer", b: "une valise", label: "Préparer une valise" },
] as const;

/** Les quatre accès en compact : une rangée de quatre (B) ou une grille 2 × 2 de tuiles basses (A, C). */
function AccesCompacts({ forme }: { forme: "rangee" | "grille" }) {
  const { actions } = useCapsela();
  const ouvrir = { dressing: actions.goWardrobe, capsule: actions.goCapsule, planifier: () => actions.planifierDirect(), valise: () => void actions.ouvrirValise(null) };
  if (forme === "rangee")
    return (
      <div className="grid grid-cols-4 gap-2">
        {ACCES.map((x) => (
          <button key={x.cle} type="button" onClick={ouvrir[x.cle]} aria-label={t(x.label)} className="flex flex-col items-center gap-[6px] rounded-carte bg-card border border-border py-3 cursor-pointer active:opacity-80">
            <span className="w-9 h-9 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">{glypheUnivers(x.d)}</span>
            <span className="text-[11.5px] leading-[1.2] text-ink text-center font-semibold">
              {t(x.a)}
              <br />
              {t(x.b)}
            </span>
          </button>
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-[10px]">
      {ACCES.map((x) => (
        <button key={x.cle} type="button" onClick={ouvrir[x.cle]} aria-label={t(x.label)} className="flex items-center gap-[10px] rounded-carte bg-card border border-border px-3 min-h-[60px] text-left cursor-pointer active:opacity-80">
          <span className="w-9 h-9 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">{glypheUnivers(x.d)}</span>
          <span className="t-titre-ligne text-ink leading-[1.2]">
            {t(x.a)} {t(x.b)}
          </span>
        </button>
      ))}
    </div>
  );
}

function Salutation() {
  const { profile } = useAuth();
  return (
    <TitrePage>
      {t("Bonjour,")} <span className="italic">{profile.displayName || t("toi")}</span>
    </TitrePage>
  );
}

function ExplorerTitre() {
  return (
    <>
      <span className="t-surtitre text-muted-3 !text-[9.5px]">{t("Explorer Capsela")}</span>
      <h2 className="t-titre-ecran text-ink mt-1">
        {t("Tout pour ton")} <span className="italic text-terracotta">{t("style")}</span>
      </h2>
    </>
  );
}

/* ═════ OPTION A — ÉDITORIALE : voyage en tête, une grande carte (jour, météo, occasion en en-tête ; composition pleine largeur ;
   actions dessous ; recommandation dans la carte), accès compacts. */
function OptionA({ tenue, voyage }: { tenue: Tenue; voyage: EtatVoyage }) {
  return (
    <>
      <div className="px-6">
        <Salutation />
        <CarteVoyage etat={voyage} className="mt-3" />
      </div>
      <div className="mx-4 mt-3 rounded-hero overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <EnTeteJour className="px-2 pt-[6px]" />
        <div aria-hidden="true" className="mx-4 mt-[4px] border-t border-border" />
        <div className="px-[18px] pt-4 pb-3">
          <Surtitre texte={tenue.surtitre} />
          <div className="mt-2">
            <Titre tenue={tenue} />
          </div>
          <div className="mt-2 -mx-2">
            <Composition tenue={tenue} ratio="100 / 78" />
          </div>
          {tenue.exterieur && <div className="mt-1">{tenue.exterieur}</div>}
          <div className="mt-3">
            <Button variante="principal" onClick={tenue.voir} className="!normal-case !tracking-[0.02em] !text-[15px]">
              {t("Voir le look")}
            </Button>
          </div>
          <div className="mt-1">
            <ActionsTexte tenue={tenue} />
          </div>
        </div>
      </div>
      <div className="px-6 mt-6">
        <ExplorerTitre />
        <div className="mt-3">
          <AccesCompacts forme="grille" />
        </div>
      </div>
    </>
  );
}

/* ═════ OPTION B — FOCUS TENUE : date et météo sur une ligne, la tenue occupe l'écran (composition dominante, actions aussitôt dessous,
   recommandation sous la tenue), puis le voyage, puis les accès en une rangée. */
function OptionB({ tenue, voyage }: { tenue: Tenue; voyage: EtatVoyage }) {
  return (
    <>
      <div className="px-6">
        <BarreDuJour meteoEnLigne className="mt-1" />
      </div>
      <div className="mx-4 mt-2 rounded-hero overflow-hidden px-[16px] pt-4 pb-3" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Surtitre texte={tenue.surtitre} />
            <div className="mt-2">
              <Titre tenue={tenue} taille="t-titre-ecran" />
            </div>
          </div>
        </div>
        <div className="mt-1 -mx-2">
          <Composition tenue={tenue} ratio="100 / 96" />
        </div>
        <div className="mt-1">
          <Button variante="principal" onClick={tenue.voir} className="!normal-case !tracking-[0.02em] !text-[15px]">
            {t("Voir le look")}
          </Button>
        </div>
        <div className="mt-1">
          <ActionsTexte tenue={tenue} />
        </div>
      </div>
      {tenue.exterieur && <div className="mx-4 mt-3">{tenue.exterieur}</div>}
      <div className="px-6">
        <CarteVoyage etat={voyage} className="mt-3" />
      </div>
      <div className="px-6 mt-5">
        <AccesCompacts forme="rangee" />
      </div>
    </>
  );
}

/* ═════ OPTION C — COMPACTE ET MODULAIRE : voyage compact, date et météo en une ligne, carte tenue basse (texte et composition côte à
   côte), barre d'actions dédiée, recommandation en ligne, accès en grille compacte. */
function OptionC({ tenue, voyage }: { tenue: Tenue; voyage: EtatVoyage }) {
  const barre = [
    { cle: "voir", icone: <IconeOeil />, libelle: t("Voir le look"), onClick: tenue.voir, principal: true },
    { cle: "sauver", icone: <IconeCoeur plein={tenue.sauvegardee} />, libelle: tenue.sauvegardee ? t("Sauvegardée") : t("Sauvegarder"), onClick: tenue.sauvegarder },
    { cle: "avis", icone: <IconeAvis />, libelle: t("Avis d'un proche"), onClick: tenue.avisProche },
    { cle: "autre", icone: <IconeAutre />, libelle: t("Autre tenue"), onClick: tenue.autre, desactive: tenue.autreOccupe },
  ];
  return (
    <>
      <div className="px-6">
        <CarteVoyage etat={voyage} className="mt-1" />
        <JourEtMeteo className="mt-2" />
      </div>
      <div className="mx-4 mt-2 rounded-hero overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
        <div className="grid gap-2 grille-hero" style={{ minHeight: 0, paddingBottom: 12 }}>
          <div className="flex flex-col min-w-0">
            <Surtitre texte={tenue.surtitre} />
            <div className="mt-3">
              <Titre tenue={tenue} />
            </div>
          </div>
          <div className="relative min-w-0 self-center" style={{ aspectRatio: "100 / 92", margin: "0 -10px 0 -6px" }}>
            <ZoneLookDuJour pieces={tenue.pieces} categoriesAttendues={tenue.attendues} graine={tenue.graine} onPiece={tenue.ouvrirPiece} fantomes={tenue.fantomes} />
          </div>
        </div>
        <div className="grid grid-cols-4 border-t border-border">
          {barre.map((b, i) => (
            <button
              key={b.cle}
              type="button"
              onClick={b.onClick}
              disabled={b.desactive}
              className={`flex flex-col items-center justify-center gap-[5px] min-h-[60px] px-1 text-[11px] leading-[1.2] text-center cursor-pointer disabled:opacity-50 ${b.principal ? "text-terracotta-deep font-semibold" : "text-ink-soft"}`}
              style={i ? { borderLeft: "1px solid var(--color-border)" } : undefined}
            >
              <span className={b.principal ? "text-terracotta-deep" : "text-ink"}>{b.icone}</span>
              {b.libelle}
            </button>
          ))}
        </div>
      </div>
      {tenue.exterieur && <div className="mx-4 mt-2">{tenue.exterieur}</div>}
      <div className="px-6 mt-5">
        <AccesCompacts forme="grille" />
      </div>
    </>
  );
}

/** L'écran d'essai : un sélecteur d'option et d'état du voyage (masqué par `?nu`, pour les captures), puis l'accueil de l'option. */
export default function AccueilMaquettes() {
  const tenue = useTenueDuJour();
  const [option, setOption] = useState<OptionMaquette>(() => lireParam("option", ["A", "B", "C"] as const, "A"));
  const [voyage, setVoyage] = useState<EtatVoyage>(() => lireParam("voyage", ["depart", "sejour", "aucun"] as const, "depart"));
  const nu = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nu");
  const Pastille = ({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick} aria-pressed={on} className="min-h-[32px] px-3 rounded-full text-[12px] cursor-pointer" style={on ? { background: "var(--color-ink)", color: "var(--color-cream)" } : { border: "1px solid var(--color-border)", color: "var(--color-ink)" }}>
      {children}
    </button>
  );
  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-safe-nav">
      {!nu && (
        <div className="sticky top-0 z-30 bg-cream/95 border-b border-border px-4 py-2 flex flex-wrap items-center gap-2">
          <span className="t-label text-muted">Maquette</span>
          {(["A", "B", "C"] as const).map((o) => (
            <Pastille key={o} on={option === o} onClick={() => setOption(o)}>
              {o === "A" ? "A · Éditoriale" : o === "B" ? "B · Focus tenue" : "C · Compacte"}
            </Pastille>
          ))}
          <span className="t-label text-muted ml-1">Voyage</span>
          {(["depart", "sejour", "aucun"] as const).map((v) => (
            <Pastille key={v} on={voyage === v} onClick={() => setVoyage(v)}>
              {v === "depart" ? "Avant départ" : v === "sejour" ? "Séjour" : "Aucun"}
            </Pastille>
          ))}
        </div>
      )}
      <div className="px-6">
        <AppHeader calendrier />
      </div>
      {!tenue.prete ? (
        <div className="px-6 mt-6 text-[13px] text-muted">Capsela compose ta tenue…</div>
      ) : option === "A" ? (
        <OptionA tenue={tenue} voyage={voyage} />
      ) : option === "B" ? (
        <OptionB tenue={tenue} voyage={voyage} />
      ) : (
        <OptionC tenue={tenue} voyage={voyage} />
      )}
      <div className="h-6" />
      {tenue.feuilleQuota}
    </div>
  );
}
