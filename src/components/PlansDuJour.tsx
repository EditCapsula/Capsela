"use client";

import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { plansDuJour, villeDuLieu } from "@/lib/planifier";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/*
 * LES TENUES PLANIFIÉES DU JOUR CONSULTÉ — sous la ligne jour + météo, sur
 * l'Accueil et Tenue (27/09/2026, navigation par date reliée à Planifier).
 *
 * UN RAPPEL, PAS UN REMPLACEMENT. La tenue proposée reste celle de « Mon
 * rythme » : une journée peut avoir un dîner le soir et une tenue de travail
 * le jour. Faire de la tenue planifiée la tenue du jour aurait été un autre
 * arbitrage, non retenu. Toucher la ligne ouvre la fiche du plan dans
 * Planifier ; le retour ramène ici.
 *
 * Rien sans plan ce jour-là (et toujours rien en mode démo, où la table n'est
 * pas lue). L'aperçu montre les pièces enregistrées du plan, jamais un visuel
 * générique ; une pièce retirée du dressing depuis n'y figure plus.
 */
export function PlansDuJour({ depuis, className = "" }: { depuis: "home" | "tenues"; className?: string }) {
  const { state, vestiairePool, jourConsulte, actions } = useCapsela();
  const plans = plansDuJour(state.tenuesPlanifiees, jourLocal(jourConsulte.date));
  if (!plans.length) return null;
  const pool: Item[] = [...state.items, ...vestiairePool];

  return (
    <div className={"flex flex-col gap-2 " + className}>
      {plans.map((t) => {
        const apercu = t.pieceIds
          .map((id) => pool.find((i) => i.id === id))
          .filter((i): i is Item => !!i)
          .slice(0, 4);
        const ville = villeDuLieu(t.lieu);
        return (
          <button
            key={t.id}
            onClick={() => actions.ouvrirPlan(t, depuis)}
            aria-label={`Tenue planifiée, ${t.moment.toLowerCase()} : ${occasionShortLabel(t.occasion)}${ville ? ` à ${ville}` : ""}. Voir la tenue`}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-[18px] p-[7px] pr-3 text-left cursor-pointer transition-opacity active:opacity-80"
          >
            {apercu.length > 0 && (
              <span aria-hidden="true" className="w-[46px] h-[46px] flex-shrink-0 rounded-[12px] bg-warm-bg grid grid-cols-2 gap-[2px] p-[3px] overflow-hidden">
                {apercu.map((p) => {
                  const img = resolveItemImage(p);
                  return img.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                  ) : (
                    <span key={p.id} className="block w-full h-full rounded-[3px]" style={{ background: p.hex }} />
                  );
                })}
              </span>
            )}
            <span className={"flex-1 min-w-0" + (apercu.length ? "" : " pl-2")}>
              {/* « Planifiée » et non « Tenue planifiée » : à 360 px, « Tenue
                  planifiée · Toute la journée » était tronqué (mesuré). */}
              <span className="block t-label text-terracotta truncate">Planifiée · {t.moment}</span>
              <span className="block text-[13px] text-ink mt-[3px] truncate">
                {occasionShortLabel(t.occasion)}
                {ville ? ` · ${ville}` : ""}
              </span>
            </span>
            <span aria-hidden="true" className="text-placeholder text-[14px] flex-shrink-0">
              ›
            </span>
          </button>
        );
      })}
    </div>
  );
}
