"use client";

import { useMemo } from "react";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { RailPiecesTenue } from "@/components/HeroTenue";
import { OutfitComposition } from "@/components/OutfitComposition";
import {
  detailCapsela,
  echeanceLongue,
  groupesParMois,
  joursAutour,
  libelleMoisAnnee,
  looksDisponibles,
  marqueDuJour,
  momentsLibres,
  occasionsDuVoyage,
  planificationsParJour,
  sousTitreAgenda,
  type JourAgenda,
} from "@/lib/agendaLooks";
import { grilleDuMoisComplete, moisDecale } from "@/lib/calendrier";
import { occasionShortLabel } from "@/lib/data";
import { titreLookDuJour } from "@/lib/logic";
import { jourLocal } from "@/lib/outfitFeedback";
import { villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import type { DateContext, Item, WorkMode } from "@/lib/types";
import { useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import type { Planification, ValiseGardee } from "@/lib/valises";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";

/*
 * « MES LOOKS À VENIR » — la page « Mes planifications » de Planifier. Refondue le 30/09/2026 (agenda de looks : le prochain en grand,
 * les suivants en frise), puis le 17/10/2026 en AGENDA ÉDITORIAL (brief « Refonte UX/UI de la page Planifier ») : trois vues d'un même
 * état, sans route nouvelle (l'app navigue par état) —
 *
 *   · AGENDA, l'entrée : le calendrier du mois (un point = un look, deux = plusieurs, un trait = un voyage), le prochain rendez-vous en
 *     grand, puis trois autres planifications et « Voir tout » ;
 *   · JOUR, en touchant une date ou une ligne : les jours voisins, la météo FIABLE du jour, chaque look du jour en grand avec ses pièces,
 *     les voyages en cours, et les moments encore libres quand Planifier accepte la date ;
 *   · LISTE, par « Voir tout » : tout, groupé par mois, en lignes compactes.
 *
 * Rien n'est calculé sur les données ici : les planifications arrivent réparties et triées (repartirPlanifications), rangées par jour
 * par planificationsParJour (agendaLooks.ts, testé) ; les pièces sont résolues par l'écran (piecesDuPlan, pool stable). Les actions sont
 * celles d'avant : le détail d'un look, le menu « … », la valise, le parcours de planification. Aucune planification n'est inventée.
 *
 * TUTOIEMENT : toute l'app tutoie, la page aussi.
 */

const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dateDe = (jour: string) => new Date(`${jour}T12:00:00`);
const dateCourte = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW[d.getDay()]}. ${d.getDate()} ${MOIS[d.getMonth()]}`;
};
const dateLongue = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};

/** Même grammaire que les glyphes de PlanifierScreen (viewBox 24, trait 1,5, currentColor). */
const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function GlypheEpingle() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" {...trait} />
      <circle cx="12" cy="10.4" r="2.3" {...trait} />
    </svg>
  );
}
function Chevron() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
      <path d="M9.5 6l6 6-6 6" {...trait} strokeWidth={1.7} />
    </svg>
  );
}

export type ModeAgenda = "agenda" | "jour" | "liste";
/** L'état de navigation des trois vues, porté par PlanifierScreen : il survit à l'ouverture du détail d'un look et au retour. */
export interface EtatAgenda {
  mode: ModeAgenda;
  /** Le jour choisi (vue Jour, case sélectionnée du calendrier). */
  jour: string;
  /** Un jour du mois affiché par le calendrier. */
  mois: string;
}

const JOURS_ENTETE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DOW_CAPS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DOW_TITRE = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const titreJour = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW_TITRE[d.getDay()]} ${d.getDate()} ${MOIS_LONG[d.getMonth()]}`;
};
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
/** Le moment, sauf quand il répète l'occasion (« Soirée · Soirée ») : alors rien. */
const momentDistinct = (t: Pick<TenuePlanifiee, "moment" | "occasion">) => (t.moment === occasionShortLabel(t.occasion) ? null : t.moment);
const meteoEnregistree = (t: Pick<TenuePlanifiee, "temp" | "weatherLabel">) =>
  t.temp != null ? `${t.temp}°${t.weatherLabel ? ` · ${t.weatherLabel}` : ""}` : null;

function Fleche({ vers }: { vers: "gauche" | "droite" }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" aria-hidden="true">
      <path d={vers === "gauche" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} {...trait} strokeWidth={1.7} />
    </svg>
  );
}

/** Les points d'une case ou d'un jour : un point pour un look, deux pour plusieurs, un trait pour un voyage. Toujours doublé d'un nom accessible. */
function Marques({ marque, sur }: { marque: ReturnType<typeof marqueDuJour>; sur: "clair" | "terracotta" }) {
  const couleur = sur === "terracotta" ? "var(--color-on-terracotta)" : "var(--color-terracotta)";
  if (marque.looks === "aucun" && !marque.voyage) return <span className="block h-[5px]" aria-hidden="true" />;
  return (
    <span className="flex items-center justify-center gap-[3px] h-[5px]" aria-hidden="true">
      {marque.looks !== "aucun" && <span className="w-[4px] h-[4px] rounded-full" style={{ background: couleur }} />}
      {marque.looks === "plusieurs" && <span className="w-[4px] h-[4px] rounded-full" style={{ background: couleur }} />}
      {marque.voyage && <span className="w-[8px] h-[2px] rounded-full" style={{ background: couleur, opacity: 0.7 }} />}
    </span>
  );
}

const nomMarque = (m: ReturnType<typeof marqueDuJour>) =>
  [m.looks === "un" ? "un look planifié" : m.looks === "plusieurs" ? "plusieurs looks planifiés" : null, m.voyage ? "un voyage" : null]
    .filter(Boolean)
    .join(", ") || "rien de prévu";

/** La miniature d'une ligne : la planche de la tenue, petite, sur le fond chaud des cartes éditoriales. */
function Miniature({ pieces, taille }: { pieces: Item[]; taille: number }) {
  return (
    <span className="flex-shrink-0 rounded-champ bg-warm-bg p-[5px]" style={{ width: taille, height: taille }} aria-hidden="true">
      {pieces.length > 0 && <OutfitComposition items={pieces} variant="planche" />}
    </span>
  );
}

export default function AgendaLooks({
  etat,
  onEtat,
  onglet,
  onglets,
  aVenir,
  passees,
  piecesDuPlan,
  dressing,
  onOuvrir,
  onMenu,
  onOuvrirValise,
  peutPlanifierLe,
  onPlanifierLe,
}: {
  etat: EtatAgenda;
  onEtat: (e: EtatAgenda) => void;
  onglet: "up" | "past";
  /** Les onglets À venir / Passées de l'écran, partagés avec le hub. */
  onglets: React.ReactNode;
  aVenir: Planification[];
  passees: Planification[];
  piecesDuPlan: (t: TenuePlanifiee) => Item[];
  dressing: Item[];
  onOuvrir: (t: TenuePlanifiee) => void;
  onMenu: (t: TenuePlanifiee) => void;
  onOuvrirValise: (v: ValiseGardee) => void;
  /** Planifier accepte ce jour (de demain à J+21) : le parcours existant s'ouvre avec la date choisie. */
  peutPlanifierLe: (jour: string) => boolean;
  onPlanifierLe: (jour: string) => void;
}) {
  const passe = onglet === "past";
  const aujourdhui = jourLocal();
  const toutes = useMemo(() => [...aVenir, ...passees], [aVenir, passees]);
  const parJour = useMemo(
    () =>
      planificationsParJour(
        toutes.flatMap((p) => (p.type === "tenue" ? [p.tenue] : [])),
        toutes.flatMap((p) => (p.type === "valise" ? [p.valise] : []))
      ),
    [toutes]
  );
  const liste = passe ? passees : aVenir;
  const sousTitre = sousTitreAgenda(aVenir.length);
  const ouvrirJour = (jour: string) => onEtat({ mode: "jour", jour, mois: jour });

  const entete = (
    <>
      <div className="t-surtitre text-muted">Planifier</div>
      <h1 className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
        Mes <span className="italic text-terracotta">looks</span> à venir
      </h1>
    </>
  );

  // ── VUE JOUR ───────────────────────────────────────────────────────────
  if (etat.mode === "jour") {
    return (
      <VueJour
        jour={etat.jour}
        parJour={parJour}
        aujourdhui={aujourdhui}
        onJour={(jour) => onEtat({ mode: "jour", jour, mois: jour })}
        onCalendrier={() => onEtat({ mode: "agenda", jour: etat.jour, mois: etat.jour })}
        piecesDuPlan={piecesDuPlan}
        dressing={dressing}
        onOuvrir={onOuvrir}
        onMenu={onMenu}
        onOuvrirValise={onOuvrirValise}
        peutPlanifierLe={peutPlanifierLe}
        onPlanifierLe={onPlanifierLe}
      />
    );
  }

  // ── VUE LISTE ──────────────────────────────────────────────────────────
  if (etat.mode === "liste") {
    const groupes = groupesParMois(liste);
    return (
      <>
        {entete}
        {sousTitre && <div className="t-chapeau text-muted-3 mt-[8px]">{sousTitre}</div>}
        {(aVenir.length > 0 || passees.length > 0) && <div className="mt-[18px]">{onglets}</div>}
        {groupes.length === 0 ? (
          <EmptyState forme={passe ? "carte" : "invitation"} className="mt-[22px]" titre={passe ? "Aucun look passé" : "Ton prochain look commence ici."}>
            {passe ? "Tes looks et tes voyages viendront ici une fois leur date passée." : "Planifie une tenue pour une occasion, un voyage ou simplement demain."}
          </EmptyState>
        ) : (
          groupes.map((g) => (
            <section key={g.cle} className="mt-[24px]" style={{ opacity: passe ? 0.85 : 1 }}>
              <h2 className="t-surtitre text-muted">{g.libelle}</h2>
              <div className="flex flex-col gap-[8px] mt-[10px]">
                {g.items.map((p) => (
                  <LignePlanification
                    key={p.type === "tenue" ? p.tenue.id : "valise-" + p.valise.id}
                    p={p}
                    piecesDuPlan={piecesDuPlan}
                    dressing={dressing}
                    onTenue={(t) => ouvrirJour(t.jour)}
                    onOuvrirValise={onOuvrirValise}
                    avecDate
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </>
    );
  }

  // ── VUE AGENDA ─────────────────────────────────────────────────────────
  const prochain = passe ? null : (aVenir.find((p): p is Extract<Planification, { type: "tenue" }> => p.type === "tenue")?.tenue ?? null);
  const autres = liste.filter((p) => !(p.type === "tenue" && p.tenue === prochain));
  const AUTRES_MAX = 3;
  return (
    <>
      {entete}
      <div className="t-chapeau text-muted-3 mt-[8px]" style={{ textWrap: "pretty" }}>
        Organise tes tenues et profite de chaque occasion en toute sérénité.
      </div>
      {(aVenir.length > 0 || passees.length > 0) && <div className="mt-[18px]">{onglets}</div>}

      <Calendrier
        mois={etat.mois}
        selection={etat.jour}
        aujourdhui={aujourdhui}
        parJour={parJour}
        onMois={(mois) => onEtat({ ...etat, mois })}
        onJour={ouvrirJour}
      />

      {liste.length === 0 ? (
        passe ? (
          <EmptyState forme="carte" className="mt-[26px]" titre="Aucun look passé">
            Tes looks et tes voyages viendront ici une fois leur date passée.
          </EmptyState>
        ) : (
          <EmptyState forme="invitation" className="mt-[22px]" titre="Ton prochain look commence ici.">
            Planifie une tenue pour une occasion, un voyage ou simplement demain.
          </EmptyState>
        )
      ) : (
        <>
          {prochain && (
            <ProchainLook
              t={prochain}
              pieces={piecesDuPlan(prochain)}
              echeance={echeanceLongue(prochain.jour, aujourdhui)}
              onOuvrir={onOuvrir}
              onMenu={onMenu}
            />
          )}
          {autres.length > 0 && (
            <section className="mt-[30px]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="t-surtitre text-muted">{passe ? "Tes derniers looks" : prochain ? "Autres looks à venir" : "Tes voyages à venir"}</h2>
                {autres.length > AUTRES_MAX || (prochain && autres.length > 0) ? (
                  <button
                    onClick={() => onEtat({ ...etat, mode: "liste" })}
                    className="text-[12px] text-terracotta cursor-pointer min-h-[44px] -my-[12px] flex items-center"
                  >
                    Voir tout
                  </button>
                ) : null}
              </div>
              <div className="flex flex-col gap-[8px] mt-[12px]">
                {autres.slice(0, AUTRES_MAX).map((p) => (
                  <LignePlanification
                    key={p.type === "tenue" ? p.tenue.id : "valise-" + p.valise.id}
                    p={p}
                    piecesDuPlan={piecesDuPlan}
                    dressing={dressing}
                    onTenue={(t) => ouvrirJour(t.jour)}
                    onOuvrirValise={onOuvrirValise}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

/**
 * LE CALENDRIER DU MOIS — compact, dans une carte crème. La case choisie est pleine terracotta ; aujourd'hui, cerclé ; les jours d'un autre
 * mois, atténués. Un point = un look, deux points = plusieurs, un trait = un voyage : la légende le dit, et chaque case porte un nom qui le dit.
 * La grille vient de grilleDuMoisComplete (Mon planning), la même partout.
 */
function Calendrier({
  mois,
  selection,
  aujourdhui,
  parJour,
  onMois,
  onJour,
}: {
  mois: string;
  selection: string;
  aujourdhui: string;
  parJour: Map<string, JourAgenda>;
  onMois: (mois: string) => void;
  onJour: (jour: string) => void;
}) {
  const d = dateDe(mois);
  const semaines = grilleDuMoisComplete(d.getFullYear(), d.getMonth());
  return (
    <section className="mt-[18px] rounded-carte border border-border bg-card px-[12px] pt-[12px] pb-[10px]" aria-label="Calendrier de tes looks">
      <div className="flex items-center justify-between pl-[6px]">
        <h2 className="font-serif text-[19px] text-ink" aria-live="polite">
          {libelleMoisAnnee(mois)}
        </h2>
        <div className="flex items-center">
          <button onClick={() => onMois(moisDecale(mois, -1))} aria-label="Mois précédent" className="w-11 h-11 flex items-center justify-center text-ink cursor-pointer rounded-full active:opacity-60">
            <Fleche vers="gauche" />
          </button>
          <button onClick={() => onMois(moisDecale(mois, 1))} aria-label="Mois suivant" className="w-11 h-11 flex items-center justify-center text-ink cursor-pointer rounded-full active:opacity-60">
            <Fleche vers="droite" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 mt-[2px]" aria-hidden="true">
        {JOURS_ENTETE.map((j) => (
          <span key={j} className="text-center text-[10px] uppercase tracking-[.08em] text-muted py-[4px]">
            {j}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-[2px]">
        {semaines.flat().map(({ jour, horsMois }) => {
          const marque = marqueDuJour(parJour.get(jour));
          const choisi = jour === selection;
          const auj = jour === aujourdhui;
          const n = dateDe(jour).getDate();
          return (
            <button
              key={jour}
              onClick={() => onJour(jour)}
              aria-label={`${titreJour(jour)}${auj ? ", aujourd'hui" : ""} : ${nomMarque(marque)}`}
              aria-current={auj ? "date" : undefined}
              className="flex flex-col items-center justify-center min-h-[44px] cursor-pointer"
            >
              <span
                className="w-[34px] h-[34px] rounded-full flex flex-col items-center justify-center gap-[2px] text-[13px] tabular-nums"
                style={{
                  background: choisi ? "var(--color-terracotta-deep)" : undefined,
                  color: choisi ? "var(--color-on-terracotta)" : horsMois ? "var(--color-muted)" : "var(--color-ink)",
                  opacity: horsMois && !choisi ? 0.55 : 1,
                  boxShadow: auj && !choisi ? "inset 0 0 0 1px var(--color-terracotta)" : undefined,
                  fontWeight: choisi || auj ? 600 : 400,
                }}
              >
                <span className="leading-none mt-[3px]">{n}</span>
                <Marques marque={marque} sur={choisi ? "terracotta" : "clair"} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-center flex-wrap gap-x-[14px] gap-y-[4px] mt-[8px] pt-[8px] border-t border-border text-[10.5px] text-muted-3" aria-hidden="true">
        <span className="inline-flex items-center gap-[5px]">
          <Marques marque={{ looks: "un", voyage: false }} sur="clair" /> Un look
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <Marques marque={{ looks: "plusieurs", voyage: false }} sur="clair" /> Plusieurs looks
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <Marques marque={{ looks: "aucun", voyage: true }} sur="clair" /> Voyage
        </span>
      </div>
    </section>
  );
}

/**
 * UNE LIGNE DE PLANIFICATION — l'agenda (« Autres looks à venir ») et la liste. Plus compacte que le prochain rendez-vous : la date, la
 * miniature de la tenue, l'occasion, ce qui est préparé, le lieu et la météo ENREGISTRÉE (dite à la planification, jamais une prévision).
 */
function LignePlanification({
  p,
  piecesDuPlan,
  dressing,
  onTenue,
  onOuvrirValise,
  avecDate = false,
}: {
  p: Planification;
  piecesDuPlan: (t: TenuePlanifiee) => Item[];
  dressing: Item[];
  onTenue: (t: TenuePlanifiee) => void;
  onOuvrirValise: (v: ValiseGardee) => void;
  /** La vue Liste pose la date à gauche, en colonne ; l'agenda la met dans le texte. */
  avecDate?: boolean;
}) {
  const jour = p.type === "tenue" ? p.tenue.jour : p.valise.depart;
  const d = dateDe(jour);
  const colonneDate = avecDate && (
    <span className="w-[34px] flex-shrink-0 text-center" aria-hidden="true">
      <span className="block text-[10px] tracking-[.08em] text-muted">{DOW_CAPS[d.getDay()]}</span>
      <span className="block font-serif text-[22px] leading-[1.1] text-terracotta">{d.getDate()}</span>
    </span>
  );
  const classe = "w-full flex items-center gap-[12px] rounded-carte border border-border bg-card px-[12px] py-[10px] text-left cursor-pointer transition-transform active:scale-[.99]";
  if (p.type === "valise") {
    const v = p.valise;
    const nb = looksDisponibles(v, dressing);
    const occasions = occasionsDuVoyage(v);
    return (
      <button onClick={() => onOuvrirValise(v)} className={classe} aria-label={`Voyage à ${v.destination}, ${dateLongue(v.depart)}${nb ? `, ${pluriel(nb, "look préparé", "looks préparés")}` : ""}`}>
        {colonneDate}
        <span className="w-[52px] h-[52px] flex-shrink-0 rounded-champ bg-warm-bg flex items-center justify-center text-terracotta" aria-hidden="true">
          <GlypheOccasion occasion="voyage" taille={22} />
        </span>
        <span className="flex-1 min-w-0">
          {!avecDate && <span className="block t-label text-terracotta">{dateCourte(v.depart)}{v.retour !== v.depart ? ` → ${dateCourte(v.retour).replace(/^\S+ /, "")}` : ""}</span>}
          <span className="block t-titre-vignette text-ink truncate">Voyage · {v.destination}</span>
          <span className="block text-[12px] text-muted-3 mt-[2px] truncate">
            {nb > 0 ? pluriel(nb, "look préparé", "looks préparés") : "Valise préparée"}
            {occasions.length ? ` · ${occasions.join(", ")}` : ""}
          </span>
        </span>
        <span className="text-muted">
          <Chevron />
        </span>
      </button>
    );
  }
  const t = p.tenue;
  const ville = villeDuLieu(t.lieu);
  const meteo = meteoEnregistree(t);
  return (
    <button onClick={() => onTenue(t)} className={classe} aria-label={`${occasionShortLabel(t.occasion)}, ${dateLongue(t.jour)}, ${t.moment.toLowerCase()}`}>
      {colonneDate}
      <Miniature pieces={piecesDuPlan(t)} taille={52} />
      <span className="flex-1 min-w-0">
        {!avecDate && <span className="block t-label text-terracotta">{dateCourte(t.jour)}</span>}
        <span className="block t-titre-vignette text-ink truncate">{occasionShortLabel(t.occasion)}</span>
        <span className="block text-[12px] text-muted-3 mt-[2px] truncate">
          {[momentDistinct(t), ville, avecDate && meteo ? `${t.temp}°` : null].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="text-muted">
        <Chevron />
      </span>
    </button>
  );
}

/**
 * LA VUE JOUR — le détail d'une date : la date en titre, un sélecteur des jours voisins (une grille de sept, sans défilement de page),
 * la météo du jour quand elle est fiable, puis chaque look du jour en grand avec ses pièces, les voyages en cours, et les moments
 * encore libres quand Planifier accepte cette date. Les actions sont celles d'avant : voir le look (son détail : modifier, avis d'un
 * proche, avis de styliste), le menu « … », planifier un look — rien d'ajouté au modèle.
 */
function VueJour({
  jour,
  parJour,
  aujourdhui,
  onJour,
  onCalendrier,
  piecesDuPlan,
  dressing,
  onOuvrir,
  onMenu,
  onOuvrirValise,
  peutPlanifierLe,
  onPlanifierLe,
}: {
  jour: string;
  parJour: Map<string, JourAgenda>;
  aujourdhui: string;
  onJour: (jour: string) => void;
  onCalendrier: () => void;
  piecesDuPlan: (t: TenuePlanifiee) => Item[];
  dressing: Item[];
  onOuvrir: (t: TenuePlanifiee) => void;
  onMenu: (t: TenuePlanifiee) => void;
  onOuvrirValise: (v: ValiseGardee) => void;
  peutPlanifierLe: (jour: string) => boolean;
  onPlanifierLe: (jour: string) => void;
}) {
  const duJour = parJour.get(jour) ?? { tenues: [], valises: [] };
  const premiere = duJour.tenues[0] ?? null;
  // La météo de la date : la PRÉVISION du lieu du premier look quand elle couvre la date (useMeteoDuPlan, horizon de prévision), sinon
  // celle enregistrée à la planification, dite comme telle. Jamais inventée, jamais la météo d'aujourd'hui pour un autre jour.
  const prevision = useMeteoDuPlan(premiere);
  const meteo = prevision
    ? { texte: `${Math.round(prevision.temp)}° · ${prevision.label}`, source: "Prévision" }
    : premiere && premiere.temp != null
      ? { texte: meteoEnregistree(premiere)!, source: "Prévue à la planification" }
      : null;
  const ville = premiere ? villeDuLieu(premiere.lieu) : duJour.valises[0]?.destination;
  const sousTitre = [premiere ? occasionShortLabel(premiere.occasion) : duJour.valises.length ? "Voyage" : null, ville].filter(Boolean).join(" · ");
  const libres = momentsLibres(duJour.tenues);
  const planifiable = peutPlanifierLe(jour) && libres.length > 0;
  const nb = duJour.tenues.length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="t-surtitre text-muted">Planifier</div>
        <button onClick={onCalendrier} className="text-[12px] text-terracotta cursor-pointer min-h-[44px] -my-[12px] flex items-center gap-[4px]">
          Calendrier
        </button>
      </div>
      <h1 className="t-titre-ecran text-ink mt-[6px]">{titreJour(jour)}</h1>
      {sousTitre && <div className="t-chapeau text-muted-3 mt-[4px]">{sousTitre}</div>}

      {/* LES JOURS VOISINS — sept cases dans la largeur, sans défilement : le jour choisi au centre ; toucher un voisin le recentre. */}
      <nav className="mt-[16px] grid grid-cols-7 gap-[4px]" aria-label="Choisir un autre jour">
        {joursAutour(jour).map((j) => {
          const d = dateDe(j);
          const choisi = j === jour;
          const marque = marqueDuJour(parJour.get(j));
          return (
            <button
              key={j}
              onClick={() => onJour(j)}
              aria-label={`${titreJour(j)} : ${nomMarque(marque)}`}
              aria-current={choisi ? "date" : undefined}
              className="flex flex-col items-center gap-[3px] rounded-champ py-[8px] cursor-pointer min-h-[60px] border"
              style={{
                background: choisi ? "var(--color-terracotta-deep)" : "var(--color-card)",
                borderColor: choisi ? "var(--color-terracotta-deep)" : "var(--color-border)",
                color: choisi ? "var(--color-on-terracotta)" : "var(--color-ink)",
              }}
            >
              <span className="text-[9.5px] tracking-[.06em]" style={{ opacity: choisi ? 0.9 : 0.6 }}>
                {DOW_CAPS[d.getDay()]}
              </span>
              <span className="text-[15px] leading-none tabular-nums" style={{ fontWeight: j === aujourdhui || choisi ? 600 : 400 }}>
                {d.getDate()}
              </span>
              <Marques marque={marque} sur={choisi ? "terracotta" : "clair"} />
            </button>
          );
        })}
      </nav>

      {meteo && (
        <div className="mt-[14px] inline-flex items-center gap-[8px] rounded-full border border-border bg-card px-[12px] py-[6px] text-[12px] text-ink">
          <span>{meteo.texte}</span>
          <span className="text-muted">· {meteo.source}</span>
        </div>
      )}

      {nb === 0 && duJour.valises.length === 0 ? (
        <EmptyState
          forme="invitation"
          className="mt-[20px]"
          titre="Rien de prévu ce jour-là."
          action={peutPlanifierLe(jour) ? { libelle: "Planifier un look ce jour-là", onClick: () => onPlanifierLe(jour) } : undefined}
        >
          {peutPlanifierLe(jour) ? "Une occasion en vue ? Capsela compose la tenue avec la météo prévue." : "Choisis un autre jour, ou reviens au calendrier."}
        </EmptyState>
      ) : (
        <>
          {nb > 0 && <h2 className="font-serif text-[19px] text-ink mt-[20px]">{pluriel(nb, "look planifié", "looks planifiés")}</h2>}
          {duJour.tenues.map((t) => {
            const pieces = piecesDuPlan(t);
            const detail = detailCapsela(pieces, t.occasion) ?? titreLookDuJour(t.occasion, (t.sousChoix ?? "") as WorkMode, (t.sousChoix ?? "") as DateContext);
            return (
              <article key={t.id} className="mt-[12px]">
                <Card rayon="hero" className="p-[10px]">
                  <div className="relative">
                    <button
                      onClick={() => onOuvrir(t)}
                      aria-label={`Voir le look : ${occasionShortLabel(t.occasion)}, ${t.moment.toLowerCase()}`}
                      className="block w-full rounded-carte bg-warm-bg cursor-pointer transition-transform active:scale-[.99]"
                      style={{ aspectRatio: "100 / 86", padding: "18px 16px" }}
                    >
                      {pieces.length > 0 ? (
                        <OutfitComposition items={pieces} variant="planche" />
                      ) : (
                        <span className="h-full flex items-center justify-center text-center px-6 text-[13px] text-muted-3 leading-[1.5]">
                          Les pièces de ce look ne sont plus dans ton dressing.
                        </span>
                      )}
                    </button>
                    <span className="absolute top-[10px] left-[10px] rounded-full bg-card/90 border border-border px-[10px] py-[4px] text-[11px] text-terracotta">
                      {[occasionShortLabel(t.occasion), momentDistinct(t)].filter(Boolean).join(" · ")}
                    </span>
                    <button
                      onClick={() => onMenu(t)}
                      aria-label={`Actions pour ce look`}
                      className="absolute top-[4px] right-[4px] w-11 h-11 flex items-center justify-center cursor-pointer text-muted-3"
                    >
                      <span aria-hidden="true" className="text-[17px] leading-none">
                        ⋯
                      </span>
                    </button>
                  </div>
                  <div className="px-[8px] pt-[12px] pb-[6px]">
                    <p className="font-serif italic text-[15px] leading-[1.45] text-ink" style={{ textWrap: "pretty" }}>
                      {detail}
                    </p>
                    <Button className="mt-[14px]" onClick={() => onOuvrir(t)}>
                      Voir le look
                    </Button>
                  </div>
                </Card>
                <RailPiecesTenue pieces={pieces} />
              </article>
            );
          })}

          {duJour.valises.length > 0 && (
            <section className="mt-[24px]">
              <h2 className="t-surtitre text-muted">En voyage</h2>
              <div className="flex flex-col gap-[8px] mt-[10px]">
                {duJour.valises.map((v) => (
                  <LignePlanification key={v.id} p={{ type: "valise", valise: v }} piecesDuPlan={piecesDuPlan} dressing={dressing} onTenue={() => {}} onOuvrirValise={onOuvrirValise} />
                ))}
              </div>
            </section>
          )}

          {/* AUTRES MOMENTS — le modèle accepte un look par moment (Matin, Après-midi, Soirée, Toute la journée) : les moments libres
              ouvrent le parcours existant, date choisie. Seulement quand Planifier propose cette date (demain à J+21). */}
          {planifiable && nb > 0 && (
            <section className="mt-[26px]">
              <h2 className="t-surtitre text-muted">Autres moments de la journée</h2>
              <button
                onClick={() => onPlanifierLe(jour)}
                className="mt-[10px] w-full flex items-center gap-[12px] rounded-carte border border-dashed border-sand-border px-[14px] py-[12px] text-left cursor-pointer active:opacity-80"
              >
                <span className="w-[34px] h-[34px] rounded-full border border-border flex items-center justify-center text-terracotta text-[18px] leading-none" aria-hidden="true">
                  +
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] text-ink">Ajouter un look</span>
                  <span className="block text-[12px] text-muted-3 mt-[2px] truncate">{libres.join(", ")}</span>
                </span>
                <span className="text-muted">
                  <Chevron />
                </span>
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}

/**
 * LE PROCHAIN LOOK. L'image d'abord — la planche de la tenue enregistrée, la
 * même que l'accueil et le détail, sur le fond chaud des cartes éditoriales —,
 * puis l'occasion, la date et le moment, le lieu et la météo ENREGISTRÉE à la
 * planification (dite comme telle, jamais une prévision du jour), puis le
 * conseil, puis l'action. Pas de « Tenue planifiée » : le surtitre dit
 * « Prochain rendez-vous ».
 */
function ProchainLook({
  t,
  pieces,
  echeance,
  onOuvrir,
  onMenu,
}: {
  t: TenuePlanifiee;
  pieces: Item[];
  echeance: string | null;
  onOuvrir: (t: TenuePlanifiee) => void;
  onMenu: (t: TenuePlanifiee) => void;
}) {
  const ville = villeDuLieu(t.lieu);
  const occasion = occasionShortLabel(t.occasion);
  // Le conseil des pièces réelles ; sans lui, la phrase éditoriale de l'occasion (celle du « Look du jour »).
  const detail =
    detailCapsela(pieces, t.occasion) ?? titreLookDuJour(t.occasion, (t.sousChoix ?? "") as WorkMode, (t.sousChoix ?? "") as DateContext);
  const meteo = t.temp != null ? `${t.temp}°${t.weatherLabel ? ` · ${t.weatherLabel}` : ""}` : null;
  const contexte = [ville, meteo].filter(Boolean).join(" · ");
  return (
    <section className="mt-[28px] motion-safe:animate-[capsule-apparition_420ms_ease-out_both]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="t-surtitre text-muted">Prochain rendez-vous</div>
        {echeance && <div className="t-label text-terracotta">{echeance}</div>}
      </div>

      <Card rayon="hero" className="mt-[12px] p-[10px]">
        {/* L'OCCASION ET LA DATE AU-DESSUS DE L'IMAGE : le brief veut qu'on
            sache en trois secondes quel look, pour quoi, quand. Dessous, au
            premier écran d'un téléphone, elles tombaient sous le pli (mesuré
            à 390 × 844). */}
        <div className="px-[8px] pt-[8px] pb-[12px]">
          <div className="t-label text-terracotta">
            {dateCourte(t.jour)} · {t.moment}
          </div>
          <div className="t-titre-ecran text-ink mt-[5px]">{occasion}</div>
        </div>
        <div className="relative">
          <button
            onClick={() => onOuvrir(t)}
            aria-label={`Voir le look : ${occasion}, ${dateLongue(t.jour)}`}
            className="block w-full rounded-carte bg-warm-bg cursor-pointer transition-transform active:scale-[.99]"
            style={{ aspectRatio: "100 / 86", padding: "18px 16px" }}
          >
            {pieces.length > 0 ? (
              <OutfitComposition items={pieces} variant="planche" />
            ) : (
              <span className="h-full flex items-center justify-center text-center px-6 text-[13px] text-muted-3 leading-[1.5]">
                Les pièces de ce look ne sont plus dans ton dressing.
              </span>
            )}
          </button>
          <button
            onClick={() => onMenu(t)}
            aria-label={`Actions pour le look du ${dateLongue(t.jour)}`}
            className="absolute top-[4px] right-[4px] w-11 h-11 flex items-center justify-center cursor-pointer text-muted-3"
          >
            <span aria-hidden="true" className="text-[17px] leading-none">
              ⋯
            </span>
          </button>
        </div>

        <div className="px-[8px] pt-[12px] pb-[8px]">
          {contexte && (
            <div className="flex items-center gap-[6px] text-[12.5px] text-muted-3">
              <span className="text-terracotta">
                <GlypheEpingle />
              </span>
              <span className="truncate">{contexte}</span>
            </div>
          )}
          {meteo && <div className="text-[11px] text-muted mt-[3px]">Météo prévue au moment de planifier</div>}

          {/* LE DÉTAIL CAPSELA — une phrase, celle d'un styliste. */}
          <div className={(contexte ? "mt-[14px] " : "") + "pt-[14px] border-t border-border"}>
            <div className="flex items-center gap-[7px] t-label text-sand-text">
              <span aria-hidden="true" className="font-serif italic text-[13px] leading-none text-terracotta normal-case tracking-normal">
                ✦
              </span>
              Le détail Capsela
            </div>
            <p className="font-serif italic text-[15px] leading-[1.45] text-ink mt-[7px]" style={{ textWrap: "pretty" }}>
              {detail}
            </p>
          </div>

          {/* L'action en bas de carte, sans fond (t-cta) : la même forme que
              « Préparer ma valise → » sur les cartes du hub. */}
          <button
            onClick={() => onOuvrir(t)}
            className="mt-[10px] t-cta text-terracotta min-h-[44px] flex items-center cursor-pointer active:opacity-70"
          >
            Voir le look&nbsp;<span aria-hidden="true">→</span>
          </button>
        </div>
      </Card>
    </section>
  );
}
