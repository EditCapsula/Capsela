"use client";

import { useRef, useState, type ReactNode, type RefObject, type TouchEvent, type UIEvent } from "react";
import { t } from "@/lib/langue";
import { libelle } from "@/lib/traductions/libellesDonnees";
import BarreDuJour from "@/components/BarreDuJour";
import SelecteurOccasion, { type FormeOccasions } from "@/components/SelecteurOccasion";
import { PlansDuJour } from "@/components/PlansDuJour";
import PourquoiCetteTenue from "@/components/PourquoiCetteTenue";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { RailPiecesTenue } from "@/components/HeroTenue";
import PhotoPiece from "@/components/PhotoPiece";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATLABEL, isBag } from "@/lib/data";
import { clePieces } from "@/lib/outfitFeedback";
import type { Item } from "@/lib/types";

/**
 * CINQ ARCHITECTURES DE LA PAGE « MA TENUE DU JOUR » (19/11/2026, brief « Exploration avancée UX »). Écran d'essai seulement
 * (`?maquettes`, TenueMaquettes.tsx) : TenuesScreen lui passe ses blocs et ses actions (BlocsTenue), sans rien recalculer ; seule
 * l'organisation de l'expérience change. Aucun texte réécrit : les libellés nouveaux sont ceux que le brief demande (onglets Look,
 * Pièces, Conseils, Variantes ; tenue précédente ; variantes), écrits ici en clair, hors traduction, comme le reste de l'écran d'essai.
 *
 * Deux traitements de la composition, au choix du sélecteur :
 *   « flatlay » : la planche commune (FlatLayCapsela, la seule règle de composition de l'app), sur fond ivoire ou coloré ;
 *   « asymetrique » : une pièce dominante et les autres en colonne (CompositionAsymetrique). EXCEPTION D'ESSAI à la règle unique du
 *   05/11/2026 (docs/flat-lay.md) : mêmes pièces, mêmes images, rien de généré ; à arbitrer avant toute mise en production.
 *
 * Interactions ajoutées pour l'essai, sur les actions existantes :
 *   « Tenue précédente » : le store ne garde pas la tenue d'avant « Autre tenue » ; l'essai garde la liste des tenues quittées le temps
 *   de la session et la réaffiche par viewItemOutfit (l'action de « Voir le look » ailleurs dans l'app). Rien n'est enregistré.
 *   Variantes : la tenue avec UNE pièce changée, le « Meilleur choix » de la grille « Remplacer » (alternativesClassees) ;
 *   « Voir » l'applique par remplacerDansTenue, comme la grille « Remplacer ».
 */

export type TraitementComposition = "flatlay" | "flatlay-colore" | "asymetrique";
export type ArchitectureTenue = "A" | "B" | "C" | "D" | "E";
type FormeReco = "ligne" | "carte" | "bandeau";

export type VarianteTenue = { remplacee: Item; par: Item; pieces: Item[] };

export type BlocsTenue = {
  entete: ReactNode;
  enteteCarte: ReactNode;
  signature: { accroche: string; phrase: string } | null;
  libelleOccasion: string;
  pieces: Item[];
  outfit: number[];
  planche: ReactNode;
  infos: ReactNode;
  reco: (forme: FormeReco) => ReactNode;
  aReco: boolean;
  actionPorter: ReactNode;
  actionsSecondaires: ReactNode;
  porter: { etat: "a_venir" | "portee" | "a_porter"; desactive: boolean; faire: () => void };
  enregistrer: { possible: boolean; fait: boolean; basculer: () => void };
  avis: () => void;
  autre: { faire: () => void; desactive: boolean; enCours: boolean };
  conseils: ReactNode;
  aConseils: boolean;
  ouvrirPiece: (it: Item) => void;
  remplacerPiece: (it: Item) => void;
  misEnAvant: number | null;
  variantes: VarianteTenue[];
  appliquerVariante: (ancien: number, nouveau: number) => void;
  revoir: (ids: number[]) => void;
  overlays: ReactNode;
  zone: {
    ref: RefObject<HTMLDivElement | null>;
    onScroll: (e: UIEvent<HTMLDivElement>) => void;
    onTouchStart: (e: TouchEvent) => void;
    onTouchEnd: (e: TouchEvent) => void;
  };
};

const CARTE = { background: "var(--color-card)", border: "1px solid var(--color-border)" } as const;
const FOND_COLORE = "#efdccb"; // la pêche des surfaces chaudes de l'app (warm-bg, un cran plus soutenu), jamais une nouvelle teinte
const STYLE_ESSAI = `
@keyframes maqEntree { from { opacity: 0; transform: translateX(18px) } to { opacity: 1; transform: none } }
@keyframes maqPouls { 0% { transform: scale(1) } 40% { transform: scale(1.28) } 100% { transform: scale(1) } }
@media (prefers-reduced-motion: no-preference) {
  .maq-entree { animation: maqEntree .38s cubic-bezier(.2,.7,.2,1) }
  .maq-pouls { animation: maqPouls .42s ease-out }
}`;

const nomCategorie = (it: Item) => libelle(CATLABEL[isBag(it) ? "sac" : it.cat]);

/** La pièce qui domine la composition asymétrique : la robe, sinon la veste ou le manteau, sinon le haut, sinon le bas. */
const RANG_DOMINANTE = ["robe", "combinaison", "veste", "manteau", "haut", "pull", "pantalon", "jean", "jupe"];
function rangDominante(it: Item): number {
  const r = RANG_DOMINANTE.indexOf(it.cat);
  return r < 0 ? 99 : r;
}

function VisuelPiece({ it, onPiece, style }: { it: Item; onPiece: (it: Item) => void; style?: React.CSSProperties }) {
  const img = resolveItemImage(it);
  return (
    <button type="button" onClick={() => onPiece(it)} aria-label={`${it.name} — ${nomCategorie(it)}. Voir le détail`} className="relative block cursor-pointer active:opacity-80" style={style}>
      {img.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt="" decoding="async" className="absolute inset-0 w-full h-full" style={{ objectFit: img.kind === "photo" ? "cover" : "contain", borderRadius: img.kind === "photo" ? 12 : 0, filter: "drop-shadow(0 6px 10px rgba(29,26,22,.12))" }} />
      ) : (
        <span className="absolute inset-0 rounded-[14px]" style={{ background: it.hex }} />
      )}
    </button>
  );
}

/** Composition 2 : une pièce dominante à gauche (60 % de la largeur), les autres en colonne à droite, de la plus grande à la plus petite. */
function CompositionAsymetrique({ pieces, hauteur, onPiece }: { pieces: Item[]; hauteur: number; onPiece: (it: Item) => void }) {
  const tri = [...pieces].sort((a, b) => rangDominante(a) - rangDominante(b));
  const [dominante, ...autres] = tri;
  if (!dominante) return null;
  const colonne = autres.slice(0, 4);
  const poids = colonne.map((_, i) => (i === 0 ? 1.4 : 1));
  const total = poids.reduce((a, b) => a + b, 0) || 1;
  const ecart = 8;
  const hDispo = hauteur - 24 - ecart * Math.max(0, colonne.length - 1);
  return (
    <div className="relative flex gap-3 px-3 py-3" style={{ height: hauteur }}>
      <VisuelPiece it={dominante} onPiece={onPiece} style={{ width: "60%", height: hauteur - 24 }} />
      <div className="flex-1 flex flex-col" style={{ gap: ecart }}>
        {colonne.map((it, i) => (
          <VisuelPiece key={it.id} it={it} onPiece={onPiece} style={{ width: "100%", height: Math.round((hDispo * poids[i]) / total) }} />
        ))}
      </div>
      {autres.length > 4 && (
        <span className="absolute bottom-3 left-3 rounded-full px-[8px] py-[2px] text-[11px] text-ink" style={{ background: "rgba(251,248,243,.9)" }}>
          +{autres.length - 4}
        </span>
      )}
    </div>
  );
}

/** La composition selon le traitement choisi, rejouée en fondu glissé à chaque changement de tenue (clé = les pièces). */
function Composition({ b, traitement, hauteur, fond }: { b: BlocsTenue; traitement: TraitementComposition; hauteur: number; fond?: string }) {
  const cle = clePieces(b.pieces.map((p) => p.id)).join(",");
  const couleur = traitement === "flatlay-colore" ? FOND_COLORE : fond;
  return (
    <div key={cle} data-maquette="planche" className="maq-entree relative" style={{ height: hauteur, background: couleur }}>
      {traitement === "asymetrique" ? <CompositionAsymetrique pieces={b.pieces} hauteur={hauteur} onPiece={b.ouvrirPiece} /> : b.planche}
    </div>
  );
}

function Titre({ b, classe, clair = false }: { b: BlocsTenue; classe: string; clair?: boolean }) {
  if (!b.signature) return null;
  return (
    <div className={`relative ${classe}`} style={{ textWrap: "balance", color: clair ? "var(--color-cream)" : "var(--color-ink)" }}>
      {b.signature.accroche}
      <PourquoiCetteTenue texte={b.signature.phrase} />
    </div>
  );
}

const ICONE_PARTAGE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" />
    <path d="M5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7" />
  </svg>
);
const ICONE_AUTRE = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
  </svg>
);

export default function VariantesTenue({ b, architecture, traitement }: { b: BlocsTenue; architecture: ArchitectureTenue; traitement: TraitementComposition }) {
  // Les tenues quittées par « Autre tenue », le temps de la session d'essai (cf. l'en-tête).
  const [quittees, setQuittees] = useState<number[][]>([]);
  const [pouls, setPouls] = useState(0);
  const [ongletD, setOngletD] = useState<"look" | "pieces" | "conseils" | "variantes">("look");
  const [ouvertsC, setOuvertsC] = useState<Record<string, boolean>>({ pieces: true });
  const [menuD, setMenuD] = useState(false);
  const [vueB, setVueB] = useState<0 | 1>(0);
  const glisse = useRef<number | null>(null);

  const autre = () => {
    if (b.autre.desactive) return;
    setQuittees((q) => [...q, b.outfit].slice(-10));
    b.autre.faire();
  };
  const precedente = quittees.at(-1);
  const revenir = () => {
    if (!precedente) return;
    setQuittees((q) => q.slice(0, -1));
    b.revoir(precedente);
  };
  const enregistrer = () => {
    if (!b.enregistrer.possible) return;
    b.enregistrer.basculer();
    setPouls((n) => n + 1);
  };

  // ── Les actions, chacune sous plusieurs formes ────────────────────────────────────────────────────────────────────────────────
  const coeur = (
    <span key={pouls} aria-hidden="true" className={"text-terracotta text-[16px] " + (pouls ? "maq-pouls inline-block" : "")}>
      {b.enregistrer.fait ? "♥" : "♡"}
    </span>
  );
  const libelleEnregistrer = b.enregistrer.fait ? t("Enregistrée") : t("Enregistrer");
  const cellule = "flex flex-col items-center justify-center gap-[4px] min-h-[56px] text-[11.5px] leading-[1.2] text-center px-1 cursor-pointer disabled:opacity-45 text-ink";
  const filet = { borderLeft: "1px solid var(--color-border)" } as const;
  const boutonPrecedente = precedente && (
    <button type="button" onClick={revenir} className="inline-flex items-center gap-[6px] min-h-[36px] text-[12px] text-terracotta cursor-pointer">
      <span aria-hidden="true">‹</span> Tenue précédente
    </button>
  );
  const barreTrois = (classe = "") => (
    <div data-maquette="secondaires" className={"grid grid-cols-3 " + classe}>
      <button type="button" onClick={enregistrer} disabled={!b.enregistrer.possible} aria-pressed={b.enregistrer.fait} className={cellule}>
        {coeur}
        {libelleEnregistrer}
      </button>
      <button type="button" onClick={b.avis} className={cellule} style={filet}>
        <span aria-hidden="true" className="text-terracotta text-[15px]">✦</span>
        {t("Avis d'un proche")}
      </button>
      <button type="button" onClick={autre} disabled={b.autre.desactive} aria-busy={b.autre.enCours} className={cellule} style={filet}>
        <span className="text-terracotta">{ICONE_AUTRE}</span>
        {t("Autre tenue")}
      </button>
    </div>
  );
  const porterCompact = (classe: string) =>
    b.porter.etat === "a_venir" ? null : b.porter.etat === "portee" ? (
      <span role="status" className={classe + " flex items-center justify-center gap-2 rounded-full text-[13px] font-semibold text-ink"} style={{ background: "rgba(29,26,22,.07)" }}>
        <span aria-hidden="true">✓</span> {t("Bonne journée avec cette tenue !")}
      </span>
    ) : (
      <button type="button" onClick={b.porter.faire} disabled={b.porter.desactive} className={classe + " rounded-full bg-terracotta-deep text-cream t-label !tracking-[.1em] cursor-pointer disabled:opacity-45"}>
        {t("Porter cette tenue")}
      </button>
    );
  const rondIcone = (label: string, contenu: ReactNode, onClick: () => void, extra: { pressed?: boolean; disabled?: boolean } = {}) => (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={extra.pressed} disabled={extra.disabled} title={label} className="flex-shrink-0 w-[48px] h-[48px] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-45 text-terracotta" style={CARTE}>
      {contenu}
    </button>
  );

  // ── Les blocs communs ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  const meteo = (classe = "mt-1", style?: React.CSSProperties) => (
    <div data-maquette="meteo" className={classe} style={style}>
      <BarreDuJour meteoEnLigne />
    </div>
  );
  const occasions = (forme: FormeOccasions) => (
    <div data-maquette="occasions">
      <SelecteurOccasion forme={forme} />
    </div>
  );
  const indicateurs = (
    <div className="flex flex-wrap gap-[6px]">
      {b.pieces.map((it) => (
        <span key={it.id} className="rounded-full px-[9px] py-[3px] text-[11px] text-ink-soft" style={{ background: "var(--color-warm-bg)" }}>
          {nomCategorie(it)}
        </span>
      ))}
    </div>
  );
  const variantesCartes = (largeur: string) =>
    b.variantes.length > 0 && (
      <ul className="scrollarea flex gap-[10px] overflow-x-auto list-none m-0 -mx-6 px-6 pb-1">
        {b.variantes.map((v) => (
          <li key={`${v.remplacee.id}-${v.par.id}`} className="flex-none rounded-carte overflow-hidden" style={{ ...CARTE, width: largeur }}>
            <div className="relative" style={{ height: 150, background: "var(--color-photo-bg)" }}>
              <div className="absolute inset-2">
                <FlatLayCapsela items={v.pieces} context="look-detail" layoutSeed={clePieces(v.pieces.map((p) => p.id)).join(",")} />
              </div>
            </div>
            <div className="px-3 pt-2 pb-3">
              <div className="t-titre-vignette text-ink truncate">Avec {v.par.name.toLowerCase()}</div>
              <div className="text-[11px] text-muted truncate mt-[2px]">au lieu de {v.remplacee.name.toLowerCase()}</div>
              <button type="button" onClick={() => b.appliquerVariante(v.remplacee.id, v.par.id)} className="mt-2 text-[12px] text-terracotta cursor-pointer min-h-[32px]">
                Voir cette variante →
              </button>
            </div>
          </li>
        ))}
      </ul>
    );
  const variantesListe =
    b.variantes.length > 0 ? (
      <ul className="list-none m-0 p-0 divide-y divide-border">
        {b.variantes.map((v) => (
          <li key={`${v.remplacee.id}-${v.par.id}`} className="flex items-center gap-3 py-[8px]">
            <span className="w-[48px] flex-shrink-0">
              <PhotoPiece piece={v.par} ratio={1} rayon={10} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block t-titre-vignette text-ink truncate">Avec {v.par.name.toLowerCase()}</span>
              <span className="block text-[11px] text-muted truncate">au lieu de {v.remplacee.name.toLowerCase()}</span>
            </span>
            <button type="button" onClick={() => b.appliquerVariante(v.remplacee.id, v.par.id)} className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer min-h-[40px] px-1">
              Voir →
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-[12.5px] text-muted">Aucune variante avec les pièces disponibles.</p>
    );
  const conseilStyle = b.signature && (
    <p className="text-[13px] text-ink-soft leading-[1.5]" style={{ textWrap: "pretty" }}>
      {b.signature.phrase}
    </p>
  );
  const piecesProps = { pieces: b.pieces, misEnAvant: b.misEnAvant, onRemplacer: b.remplacerPiece, onPiece: b.ouvrirPiece };
  const surtitre = (texte: string, classe = "") => <div className={"t-surtitre text-muted " + classe}>{texte}</div>;

  const racine = (contenu: ReactNode) => (
    <div ref={b.zone.ref} onScroll={b.zone.onScroll} onTouchStart={b.zone.onTouchStart} onTouchEnd={b.zone.onTouchEnd} className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <style>{STYLE_ESSAI}</style>
      <div data-maquette="entete">{b.entete}</div>
      {contenu}
      {b.overlays}
    </div>
  );

  // ══ A · IMMERSIVE ÉDITORIALE ═══════════════════════════════════════════════════════════════════════════════════════════════════
  if (architecture === "A") {
    return racine(
      <>
        {meteo()}
        {occasions("onglets")}
        <PlansDuJour depuis="tenues" className="mt-3" />
        <div data-maquette="carte" className="-mx-2 mt-3 rounded-hero overflow-hidden" style={CARTE}>
          {/* Répartition asymétrique : l'inspiration sur un bandeau terracotta décalé à gauche, la composition sur toute la largeur de
              l'ivoire. (Une colonne terracotta à côté de la planche, essayée d'abord, coupait le titre en syllabes et rapetissait la planche
              à 58 % de la largeur.) */}
          <div className="mr-[18%] rounded-br-[28px] px-4 pt-5 pb-5" style={{ background: "var(--color-terracotta-deep)" }}>
            <div className="t-surtitre" style={{ color: "rgba(251,248,243,.78)" }}>{b.libelleOccasion}</div>
            <div className="mt-2">
              <Titre b={b} classe="t-titre-ecran" clair />
            </div>
          </div>
          <Composition b={b} traitement={traitement} hauteur={400} />
          <div className="px-4 pt-3">{b.enteteCarte}</div>
          <div className="px-4">{b.infos}</div>
          <div data-maquette="actions" className="px-4 pb-3">
            {b.actionPorter}
            {b.actionsSecondaires}
            {boutonPrecedente}
          </div>
        </div>
        {b.aReco && (
          <div data-maquette="reco" className="mt-5">
            {b.reco("carte")}
          </div>
        )}
        <div data-maquette="details">
          <RailPiecesTenue {...piecesProps} disposition="grille" />
        </div>
        {b.variantes.length > 0 && (
          <section className="mt-7">
            {surtitre("Variantes", "mb-[10px]")}
            {variantesCartes("62%")}
          </section>
        )}
        {b.conseils}
      </>
    );
  }

  // ══ B · FOCUS COMPOSITION ══════════════════════════════════════════════════════════════════════════════════════════════════════
  if (architecture === "B") {
    const traitementB: TraitementComposition = vueB === 0 ? traitement : traitement === "asymetrique" ? "flatlay" : "asymetrique";
    return racine(
      <>
        {meteo()}
        {occasions("onglets")}
        <PlansDuJour depuis="tenues" className="mt-3" />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Titre b={b} classe="t-titre-section" />
          </div>
          {boutonPrecedente}
        </div>
        <div className="mt-1">{b.enteteCarte}</div>
        <div data-maquette="carte" className="-mx-6 mt-1">
          <Composition b={b} traitement={traitementB} hauteur={480} fond="var(--color-photo-bg)" />
          {/* Deux propositions visuelles de la même tenue : la planche et la composition à pièce dominante. */}
          <div className="flex items-center justify-center gap-2 py-2" role="tablist" aria-label="Présentation de la tenue">
            {([0, 1] as const).map((i) => (
              <button key={i} type="button" role="tab" aria-selected={vueB === i} aria-label={i === 0 ? "Première présentation" : "Seconde présentation"} onClick={() => setVueB(i)} className="w-[28px] h-[28px] flex items-center justify-center cursor-pointer">
                <span className="block rounded-full" style={{ width: vueB === i ? 18 : 7, height: 7, background: vueB === i ? "var(--color-terracotta-deep)" : "var(--color-border)" }} />
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1">{indicateurs}</div>
        <div className="mt-2">{b.infos}</div>
        <div data-maquette="actions" className="-mx-2 mt-2 rounded-hero overflow-hidden" style={CARTE}>
          <div className="px-3 pt-3">{porterCompact("w-full min-h-[56px]")}</div>
          {barreTrois("border-t border-border mt-3")}
        </div>
        {b.aReco && (
          <div data-maquette="reco" className="mt-4">
            {b.reco("ligne")}
          </div>
        )}
        <section data-maquette="details" className="mt-6 -mx-2 rounded-hero px-4 pt-1 pb-2" style={{ background: "var(--color-warm-bg)" }}>
          <RailPiecesTenue {...piecesProps} disposition="liste" />
        </section>
        {b.conseils}
        {b.variantes.length > 0 && (
          <section className="mt-6">
            {surtitre("Variantes", "mb-[10px]")}
            {variantesCartes("55%")}
          </section>
        )}
      </>
    );
  }

  // ══ C · STRUCTURÉE ET RICHE ════════════════════════════════════════════════════════════════════════════════════════════════════
  if (architecture === "C") {
    const sousCarte = (cle: string, titre: string, compte: number | null, contenu: ReactNode, fond: string) => (
      <section className="rounded-carte overflow-hidden" style={{ background: fond, border: "1px solid var(--color-border)" }}>
        <button type="button" aria-expanded={!!ouvertsC[cle]} onClick={() => setOuvertsC((o) => ({ ...o, [cle]: !o[cle] }))} className="w-full flex items-center justify-between gap-3 px-4 min-h-[52px] text-left cursor-pointer">
          <span className="t-titre-carte text-ink">
            {titre}
            {compte != null && <span className="text-muted font-normal"> · {compte}</span>}
          </span>
          <span aria-hidden="true" className="text-terracotta text-[18px]" style={{ transform: ouvertsC[cle] ? "rotate(90deg)" : undefined, transition: "transform .2s" }}>
            ›
          </span>
        </button>
        {ouvertsC[cle] && <div className="px-4 pb-4 -mt-1">{contenu}</div>}
      </section>
    );
    return racine(
      <>
        {meteo("-mx-2 mt-1 rounded-bloc px-2", { background: "var(--color-warm-bg)" })}
        {occasions("segmente")}
        <PlansDuJour depuis="tenues" className="mt-3" />
        {/* Niveau 1 : le titre et les informations, sur leur propre carte. */}
        <div data-maquette="carte" className="mt-3 flex flex-col gap-3">
          <div className="-mx-2 rounded-hero px-4 pt-4 pb-3" style={CARTE}>
            <div className="t-surtitre text-terracotta">{b.libelleOccasion}</div>
            <div className="mt-2">
              <Titre b={b} classe="t-titre-section" />
            </div>
            <div className="mt-2">{b.enteteCarte}</div>
          </div>
          {/* Niveau 2 : la composition, sur une carte à fond photo. */}
          <div className="-mx-2 rounded-hero overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
            <Composition b={b} traitement={traitement} hauteur={360} fond="var(--color-photo-bg)" />
            <div className="px-3 pb-2" style={{ background: "var(--color-photo-bg)" }}>
              {b.infos}
            </div>
          </div>
        </div>
        <div data-maquette="actions" className="mt-1">
          {b.actionPorter}
          {b.actionsSecondaires}
          {boutonPrecedente}
        </div>
        {b.aReco && (
          <div data-maquette="reco" className="mt-4">
            {b.reco("carte")}
          </div>
        )}
        {/* Niveau 3 : les détails en sous-cartes repliables, la liste des pièces ouverte. */}
        <div data-maquette="details" className="mt-5 flex flex-col gap-[10px]">
          {sousCarte("pieces", "Pièces de la tenue", b.pieces.length, <RailPiecesTenue {...piecesProps} disposition="liste" sansTitre />, "var(--color-card)")}
          {sousCarte(
            "conseils",
            "Conseils style",
            null,
            <>
              {conseilStyle}
              <div className="-mt-3">{b.conseils}</div>
            </>,
            "var(--color-warm-bg)"
          )}
          {sousCarte("variantes", "Variantes", b.variantes.length, variantesListe, "var(--color-card)")}
        </div>
      </>
    );
  }

  // ══ D · MODULAIRE À ONGLETS ════════════════════════════════════════════════════════════════════════════════════════════════════
  if (architecture === "D") {
    const onglets: [typeof ongletD, string][] = [
      ["look", "Look"],
      ["pieces", "Pièces"],
      ["conseils", "Conseils"],
      ["variantes", "Variantes"],
    ];
    return racine(
      <>
        {meteo()}
        {occasions("pastilles")}
        <PlansDuJour depuis="tenues" className="mt-3" />
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="t-surtitre text-terracotta">{b.libelleOccasion}</div>
            <div className="mt-[6px]">
              <Titre b={b} classe="t-titre-section" />
            </div>
          </div>
          {boutonPrecedente}
        </div>
        {/* La navigation secondaire, collée en haut pendant le défilement. */}
        <div role="tablist" aria-label="Explorer la tenue" className="sticky top-[-6px] z-20 -mx-6 px-6 mt-3 flex gap-[20px] border-b border-border" style={{ background: "var(--color-cream)" }}>
          {onglets.map(([cle, texte]) => (
            <button key={cle} type="button" role="tab" aria-selected={ongletD === cle} onClick={() => setOngletD(cle)} className={"relative h-[44px] text-[13.5px] cursor-pointer " + (ongletD === cle ? "font-semibold text-ink" : "font-medium text-muted")}>
              {texte}
              {cle === "pieces" && <span className="text-muted font-normal"> {b.pieces.length}</span>}
              {ongletD === cle && <span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-[2px] bg-terracotta-deep" />}
            </button>
          ))}
        </div>
        <div data-maquette="carte" className="mt-3 min-h-[420px]">
          {ongletD === "look" && (
            <div className="-mx-2 rounded-hero overflow-hidden" style={CARTE}>
              <div className="px-4 pt-3">{b.enteteCarte}</div>
              <Composition b={b} traitement={traitement} hauteur={380} />
              <div className="px-4 pb-3">{b.infos}</div>
            </div>
          )}
          {ongletD === "pieces" && (
            <div data-maquette="details">
              <RailPiecesTenue {...piecesProps} disposition="grille3" sansTitre />
            </div>
          )}
          {ongletD === "conseils" && (
            <div className="flex flex-col gap-3">
              {conseilStyle}
              {b.aReco && b.reco("carte")}
              <div className="-mt-4">{b.conseils}</div>
            </div>
          )}
          {ongletD === "variantes" && variantesListe}
        </div>
        {ongletD === "look" && b.aReco && (
          <div data-maquette="reco" className="mt-3">
            {b.reco("bandeau")}
          </div>
        )}
        {/* Les actions, toujours accessibles, quel que soit l'onglet : « Avis d'un proche » passe dans un menu contextuel. */}
        <div data-maquette="actions" className="sticky z-20 -mx-2 mt-4" style={{ bottom: 64 }}>
          {menuD && (
            <>
              <button type="button" aria-label="Fermer le menu" className="fixed inset-0 z-0 cursor-default" onClick={() => setMenuD(false)} />
              <div role="menu" className="absolute right-0 bottom-[64px] z-10 rounded-bloc py-1 min-w-[200px]" style={{ ...CARTE, boxShadow: "0 8px 24px rgba(29,26,22,.16)" }}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuD(false);
                    b.avis();
                  }}
                  className="w-full flex items-center gap-[10px] px-4 min-h-[48px] text-left text-[13px] text-ink cursor-pointer"
                >
                  <span aria-hidden="true" className="text-terracotta">✦</span> {t("Avis d'un proche")}
                </button>
              </div>
            </>
          )}
          <div className="relative flex items-center gap-2 rounded-full p-[6px]" style={{ ...CARTE, boxShadow: "0 6px 20px rgba(29,26,22,.12)" }}>
            {porterCompact("flex-1 min-h-[48px]")}
            {b.porter.etat === "a_venir" && <span className="flex-1" />}
            {rondIcone(libelleEnregistrer, coeur, enregistrer, { pressed: b.enregistrer.fait, disabled: !b.enregistrer.possible })}
            {rondIcone(t("Autre tenue"), ICONE_AUTRE, autre, { disabled: b.autre.desactive })}
            <button type="button" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={menuD} onClick={() => setMenuD((o) => !o)} className="flex-shrink-0 w-[48px] h-[48px] rounded-full flex items-center justify-center cursor-pointer text-ink text-[18px]" style={CARTE}>
              ⋯
            </button>
          </div>
        </div>
      </>
    );
  }

  // ══ E · COMPACTE ET INTERACTIVE ════════════════════════════════════════════════════════════════════════════════════════════════
  const debutGlisse = (e: TouchEvent) => {
    e.stopPropagation();
    glisse.current = e.touches[0]?.clientX ?? null;
  };
  const finGlisse = (e: TouchEvent) => {
    e.stopPropagation();
    const x0 = glisse.current;
    glisse.current = null;
    const x1 = e.changedTouches[0]?.clientX;
    if (x0 == null || x1 == null) return;
    if (x1 - x0 < -50) autre();
    else if (x1 - x0 > 50) revenir();
  };
  const fleche = (sens: "‹" | "›", label: string, onClick: () => void, actif: boolean) => (
    <button type="button" onClick={onClick} disabled={!actif} aria-label={label} className="absolute top-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full flex items-center justify-center text-[18px] text-ink cursor-pointer disabled:opacity-0 z-10" style={{ [sens === "‹" ? "left" : "right"]: 6, background: "rgba(251,248,243,.92)", boxShadow: "0 1px 4px rgba(29,26,22,.14)" }}>
      {sens}
    </button>
  );
  return racine(
    <>
      {meteo()}
      {occasions("onglets")}
      <PlansDuJour depuis="tenues" className="mt-2" />
      <div data-maquette="carte" className="-mx-2 mt-2 rounded-hero overflow-hidden" style={CARTE} onTouchStart={debutGlisse} onTouchEnd={finGlisse}>
        <div className="flex items-start justify-between gap-2 px-4 pt-3">
          <div className="min-w-0">
            <Titre b={b} classe="t-titre-ligne" />
            <div className="text-[11.5px] text-muted mt-[2px]">
              {b.libelleOccasion} · {b.pieces.length} {b.pieces.length > 1 ? "pièces" : "pièce"}
            </div>
          </div>
          {/* « Avis d'un proche » partagé directement depuis la carte. */}
          <button type="button" onClick={b.avis} aria-label={t("Avis d'un proche")} title={t("Avis d'un proche")} className="flex-shrink-0 w-[40px] h-[40px] -mr-2 rounded-full flex items-center justify-center text-terracotta cursor-pointer">
            {ICONE_PARTAGE}
          </button>
        </div>
        <div className="relative">
          <Composition b={b} traitement={traitement} hauteur={250} />
          {fleche("‹", "Tenue précédente", revenir, Boolean(precedente))}
          {fleche("›", t("Autre tenue"), autre, !b.autre.desactive)}
        </div>
        <div className="px-3">{b.infos}</div>
        <div data-maquette="actions" className="flex items-center gap-2 px-3 pt-1 pb-3">
          {porterCompact("flex-1 min-h-[48px]")}
          {b.porter.etat === "a_venir" && <span className="flex-1" />}
          {rondIcone(libelleEnregistrer, coeur, enregistrer, { pressed: b.enregistrer.fait, disabled: !b.enregistrer.possible })}
          {rondIcone(t("Autre tenue"), ICONE_AUTRE, autre, { disabled: b.autre.desactive })}
        </div>
      </div>
      {b.aReco && (
        <div data-maquette="reco" className="mt-3">
          {b.reco("bandeau")}
        </div>
      )}
      <div data-maquette="details">
        <RailPiecesTenue {...piecesProps} disposition="rail" />
      </div>
      {b.conseils}
      {b.variantes.length > 0 && (
        <section className="mt-6">
          {surtitre("Variantes", "mb-[8px]")}
          {variantesListe}
        </section>
      )}
    </>
  );
}
