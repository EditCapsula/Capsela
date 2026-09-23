"use client";

/**
 * PROPOSITION — glyphes dessinés pour les dix occasions (23/09/2026).
 *
 * Branchés sur les DEUX chips de l'écran Tenue après arbitrage du 23/09
 * (« ok pour les chips »). Les sous-choix ont été dessinés à ce moment-là :
 * n'équiper que le chip d'occasion aurait remis un emoji à côté d'un glyphe,
 * exactement le défaut du carré ❑ qu'ils remplacent.
 *
 * Les tables d'emojis OCCASION_ICONS / SOUS_CHOIX_ICONS ont été supprimées de
 * data.ts plutôt que laissées en place : une table morte finit par diverger
 * de celle qui sert.
 * Tracés, jamais remplis : ils prennent currentColor, donc la couleur du chip
 * qui les porte. C'est la différence de fond avec les emojis, dont les
 * couleurs sont imposées par le système et ne s'accordent pas au terracotta.
 * ViewBox 24, trait 1,5 — la graisse du trait reste constante à toute taille.
 */
import type { DateContext, OccasionKey, TravelMode, WorkMode } from "@/lib/types";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const RAYONS = [0, 45, 90, 135, 180, 225, 270, 315];

export const GLYPHES_OCCASION: Record<Exclude<OccasionKey, "all">, React.ReactNode> = {
  // Quotidien — un jour ordinaire : le soleil, sans météo particulière.
  quotidien: (
    <>
      <circle cx="12" cy="12" r="4" {...S} />
      {RAYONS.map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={a} {...S}
            x1={12 + 6.6 * Math.cos(r)} y1={12 + 6.6 * Math.sin(r)}
            x2={12 + 9 * Math.cos(r)} y2={12 + 9 * Math.sin(r)} />
        );
      })}
    </>
  ),
  // Travail / Bureau — mallette.
  travail_formel: (
    <>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" {...S} />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" {...S} />
      <line x1="3" y1="12.5" x2="21" y2="12.5" {...S} />
    </>
  ),
  // Rendez-vous important — une date marquée au calendrier.
  entretien: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" {...S} />
      <line x1="3.5" y1="10.5" x2="20.5" y2="10.5" {...S} />
      <line x1="8" y1="3.5" x2="8" y2="7" {...S} />
      <line x1="16" y1="3.5" x2="16" y2="7" {...S} />
      <circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  // Date — tête-à-tête : la bougie.
  date: (
    <>
      <path d="M12 2.8c2.4 2.7 3.4 4 3.4 5.6a3.4 3.4 0 0 1-6.8 0c0-1.6 1-2.9 3.4-5.6Z" {...S} />
      <path d="M8 12.2h8v7.3H8z" {...S} />
      <line x1="6" y1="19.5" x2="18" y2="19.5" {...S} />
    </>
  ),
  // Sortie / Soirée — la coupe.
  soiree: (
    <>
      <path d="M4.5 4.5h15l-7.5 8.5Z" {...S} />
      <line x1="12" y1="13" x2="12" y2="18.5" {...S} />
      <line x1="8" y1="18.5" x2="16" y2="18.5" {...S} />
    </>
  ),
  // Sortie festive — l'éclat, déjà le signe de l'app (✦).
  festive: (
    <>
      <path d="M13 2.5l1.7 4.8 4.8 1.7-4.8 1.7L13 15.5l-1.7-4.8-4.8-1.7 4.8-1.7Z" {...S} />
      <path d="M6.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" {...S} />
      <path d="M18 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" {...S} />
    </>
  ),
  // Sport — la basket de profil.
  sport: (
    <>
      <line x1="3.2" y1="9.8" x2="3.2" y2="14.2" {...S} />
      <line x1="6.4" y1="7.5" x2="6.4" y2="16.5" {...S} />
      <line x1="17.6" y1="7.5" x2="17.6" y2="16.5" {...S} />
      <line x1="20.8" y1="9.8" x2="20.8" y2="14.2" {...S} />
      <line x1="6.4" y1="12" x2="17.6" y2="12" {...S} />
    </>
  ),
  // Cocooning / Maison — la tasse fumante.
  cocooning: (
    <>
      <path d="M4 10h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" {...S} />
      <path d="M16 11.5h1.6a2.6 2.6 0 0 1 0 5.2H16" {...S} />
      <path d="M8 7.2c0-1 1-1.4 1-2.4" {...S} />
      <path d="M12 7.2c0-1 1-1.4 1-2.4" {...S} />
    </>
  ),
  // Voyage / Déplacement — l'avion de papier.
  voyage: (
    <>
      <path d="M21 3 3 10.4l7.4 3.1L13.5 21Z" {...S} />
      <line x1="10.4" y1="13.5" x2="21" y2="3" {...S} />
    </>
  ),
  // Événement / Cérémonie — la fleur.
  evenement_perso: (
    <>
      <circle cx="12" cy="4.9" r="2.5" {...S} />
      <circle cx="15.6" cy="8.5" r="2.5" {...S} />
      <circle cx="12" cy="12.1" r="2.5" {...S} />
      <circle cx="8.4" cy="8.5" r="2.5" {...S} />
      <line x1="12" y1="14.6" x2="12" y2="21" {...S} />
      <path d="M12 18.5c-2.6 0-4.2-1.6-4.2-3.7 2.6 0 4.2 1.6 4.2 3.7Z" {...S} />
    </>
  ),
};

/**
 * Sous-choix : mode de travail, contexte de date, mode de trajet. Une seule
 * table, les trois familles n'ayant aucun libellé commun.
 *
 * Deux réemplois volontaires. « Soirée festive » reprend l'éclat de
 * l'occasion « Sortie festive » : c'est la même idée, et les deux ne peuvent
 * pas se côtoyer — ce sous-choix n'existe que sous l'occasion « Date ». La
 * valise de « Longue distance » ressemble à la mallette du « Travail », mais
 * elle est en portrait avec poignée télescopique, et là encore les deux ne
 * s'affichent jamais ensemble.
 */
export const GLYPHES_SOUS_CHOIX: Record<WorkMode | DateContext | TravelMode, React.ReactNode> = {
  // Présentiel — l'immeuble de bureaux.
  "Présentiel": (
    <>
      <path d="M4 20V5.5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15 5.5V20" {...S} />
      <path d="M15 20V10h3.5A1.5 1.5 0 0 1 20 11.5V20" {...S} />
      <line x1="2.5" y1="20" x2="21.5" y2="20" {...S} />
      <line x1="7.2" y1="7.8" x2="7.2" y2="7.8" {...S} />
      <line x1="11.6" y1="7.8" x2="11.6" y2="7.8" {...S} />
      <line x1="7.2" y1="11.6" x2="7.2" y2="11.6" {...S} />
      <line x1="11.6" y1="11.6" x2="11.6" y2="11.6" {...S} />
      <line x1="7.2" y1="15.4" x2="7.2" y2="15.4" {...S} />
      <line x1="11.6" y1="15.4" x2="11.6" y2="15.4" {...S} />
    </>
  ),
  // Télétravail — la maison.
  "Télétravail": (
    <>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" {...S} />
      <path d="M5.5 11.8V20h13v-8.2" {...S} />
      <path d="M9.8 20v-5.2h4.4V20" {...S} />
    </>
  ),
  // Restaurant / date romantique — le couvert.
  "Restaurant / date romantique": (
    <>
      <path d="M6 3.5v6a2.5 2.5 0 0 0 5 0v-6" {...S} />
      <line x1="8.5" y1="3.5" x2="8.5" y2="9" {...S} />
      <line x1="8.5" y1="12" x2="8.5" y2="20.5" {...S} />
      <path d="M17 20.5v-7c1.6 0 2.5-1.4 2.5-4.5 0-3-.9-5-2.5-5s-2.5 2-2.5 5c0 3.1.9 4.5 2.5 4.5" {...S} />
    </>
  ),
  // Verre — le verre à pied, bol arrondi : distinct de la coupe triangulaire
  // de « Sortie / Soirée ».
  "Verre": (
    <>
      <path d="M7.5 3.5h9v5a4.5 4.5 0 0 1-9 0Z" {...S} />
      <line x1="12" y1="13" x2="12" y2="19" {...S} />
      <line x1="8.5" y1="19" x2="15.5" y2="19" {...S} />
    </>
  ),
  // Cinéma / balade — le clap.
  "Cinéma / balade": (
    <>
      <rect x="3" y="9.5" width="18" height="10.5" rx="1.5" {...S} />
      <path d="M3.4 9.5 5.6 5.2l17 1.6-.6 2.7" {...S} />
      <line x1="9.4" y1="5.6" x2="7.6" y2="9.5" {...S} />
      <line x1="15.2" y1="6.2" x2="13.4" y2="9.5" {...S} />
    </>
  ),
  // Activité — la cible.
  "Activité": (
    <>
      <circle cx="12" cy="12" r="8.5" {...S} />
      <circle cx="12" cy="12" r="4.8" {...S} />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Soirée festive — le même éclat que l'occasion « Sortie festive ».
  "Soirée festive": (
    <>
      <path d="M13 2.5l1.7 4.8 4.8 1.7-4.8 1.7L13 15.5l-1.7-4.8-4.8-1.7 4.8-1.7Z" {...S} />
      <path d="M6.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" {...S} />
      <path d="M18 15.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" {...S} />
    </>
  ),
  // Court trajet — le train.
  "Court trajet": (
    <>
      <path d="M5.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2Z" {...S} />
      <line x1="5.5" y1="10" x2="18.5" y2="10" {...S} />
      <circle cx="9" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <line x1="8.5" y1="16.5" x2="6" y2="20.5" {...S} />
      <line x1="15.5" y1="16.5" x2="18" y2="20.5" {...S} />
    </>
  ),
  // Longue distance — la valise à roulettes.
  "Longue distance": (
    <>
      <rect x="5.5" y="7.5" width="13" height="11.5" rx="2" {...S} />
      <path d="M9.5 7.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2.5" {...S} />
      <line x1="8.5" y1="19" x2="8.5" y2="20.8" {...S} />
      <line x1="15.5" y1="19" x2="15.5" y2="20.8" {...S} />
    </>
  ),
};

function Svg({ taille, children }: { taille: number; children: React.ReactNode }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {children}
    </svg>
  );
}

/**
 * Accepte OccasionKey entier, "all" compris, et ne rend RIEN pour elle. Le
 * type strict obligeait chaque appelant à restreindre lui-même ou à caster :
 * six surfaces affichent une occasion, c'était six occasions de se tromper.
 * "all" est la sentinelle « aucune occasion choisie » — elle n'a pas de
 * glyphe, et l'absence de rendu est la bonne réponse, pas une erreur.
 */
export function GlypheOccasion({ occasion, taille = 17 }: { occasion: OccasionKey; taille?: number }) {
  if (occasion === "all") return null;
  return <Svg taille={taille}>{GLYPHES_OCCASION[occasion]}</Svg>;
}

export function GlypheSousChoix({ valeur, taille = 17 }: { valeur: WorkMode | DateContext | TravelMode; taille?: number }) {
  return <Svg taille={taille}>{GLYPHES_SOUS_CHOIX[valeur]}</Svg>;
}
