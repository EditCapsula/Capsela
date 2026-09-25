"use client";

import type { AvisEnregistre } from "@/lib/avisJournal";

/*
 * « Mes avis de styliste » dans le Journal (arbitré le 25/09/2026, point 19) :
 * une section dédiée — un avis reçu n'est pas une tenue portée. Vignette de la
 * photo, date, début de l'avis global ; un clic rouvre l'avis complet.
 * Rien à montrer (aucun avis, ou migration 0036 non exécutée) : la section
 * n'existe pas.
 */

const TITRE = "Mes avis de styliste"; // arbitré le 25/09/2026

const formatDate = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AvisEnregistresJournal({ avis, onOuvrir }: { avis: AvisEnregistre[] | null; onOuvrir: (id: string) => void }) {
  if (!avis?.length) return null;
  return (
    <section className="mt-[30px]" aria-labelledby="journal-avis-styliste">
      <div id="journal-avis-styliste" className="text-[11px] tracking-[.16em] uppercase text-muted mb-[10px]">
        {TITRE}
      </div>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        {avis.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onOuvrir(a.id)}
            className="w-full flex items-center gap-[13px] px-[14px] py-[12px] border-b border-border last:border-b-0 text-left cursor-pointer"
          >
            <span className="w-[52px] h-[65px] flex-shrink-0 rounded-[10px] overflow-hidden bg-warm-bg border border-border">
              {a.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photoUrl} alt="" loading="lazy" className="w-full h-full object-cover block" />
              )}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] text-muted">{formatDate(a.creeLe)}</span>
              <span className="block text-[13px] text-ink leading-[1.4] mt-[3px] line-clamp-2">{a.avis.overallAssessment}</span>
            </span>
            <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
              ›
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
