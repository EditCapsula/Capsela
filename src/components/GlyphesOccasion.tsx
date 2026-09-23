"use client";

/**
 * PROPOSITION — glyphes dessinés pour les dix occasions (23/09/2026).
 *
 * PAS ENCORE BRANCHÉ. Les chips affichent toujours OCCASION_ICONS (emojis).
 * Ce fichier existe pour que la planche montrée le 23/09 ne soit pas à
 * redessiner si l'arbitrage va dans ce sens ; il n'est importé nulle part et
 * ne pèse donc rien dans le bundle. À supprimer si la décision est de rester
 * aux emojis.
 * Tracés, jamais remplis : ils prennent currentColor, donc la couleur du chip
 * qui les porte. C'est la différence de fond avec les emojis, dont les
 * couleurs sont imposées par le système et ne s'accordent pas au terracotta.
 * ViewBox 24, trait 1,5 — la graisse du trait reste constante à toute taille.
 */
import type { OccasionKey } from "@/lib/types";

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const RAYONS = [0, 45, 90, 135, 180, 225, 270, 315];

const TRACES: Record<Exclude<OccasionKey, "all">, React.ReactNode> = {
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

export function GlypheOccasion({ occasion, taille = 17 }: { occasion: Exclude<OccasionKey, "all">; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {TRACES[occasion]}
    </svg>
  );
}
