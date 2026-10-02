"use client";

import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { alerteMeteoPlan } from "@/lib/planDuJour";
import { plansDuJour, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * La tenue planifiée devenue tenue du jour (planDuJour.ts, option C du
 * 30/09/2026), et ce que la météo du jour en dit — ou null quand la tenue
 * affichée est la proposition de Capsela. Pour l'étiquette « Ta tenue
 * planifiée » de l'Accueil et de Tenue.
 */
export function usePlanApplique(): { plan: TenuePlanifiee; alerte: string | null } | null {
  const { state, vestiairePool, meteoDuJour } = useCapsela();
  if (!state.planAppliqueId) return null;
  const plan = state.tenuesPlanifiees.find((t) => t.id === state.planAppliqueId);
  if (!plan) return null;
  const pool: Item[] = [...state.items, ...vestiairePool];
  const pieces = plan.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  return { plan, alerte: alerteMeteoPlan(pieces, meteoDuJour) };
}

/*
 * LES TENUES PLANIFIÉES DU JOUR CONSULTÉ — sous la ligne jour + météo, sur
 * l'Accueil et Tenue (27/09/2026, navigation par date reliée à Planifier).
 *
 * DEPUIS LE 30/09/2026 (option C, planDuJour.ts), un plan « Toute la
 * journée », « Matin » ou « Après-midi » DEVIENT la tenue du jour : il
 * n'apparaît donc plus ici, la card le montre. Restent en rappel : la soirée
 * (« Ce soir » — une journée peut avoir une tenue de travail le jour et un
 * dîner le soir), un plan écarté par « Voir une autre proposition », et un
 * plan devenu incomplet, qui le dit. Toucher la ligne ouvre la fiche du plan
 * dans Planifier ; le retour ramène ici.
 *
 * Rien sans plan ce jour-là (et toujours rien en mode démo, où la table n'est
 * pas lue). L'aperçu montre les pièces enregistrées du plan, jamais un visuel
 * générique ; une pièce retirée du dressing depuis n'y figure plus.
 */
export function PlansDuJour({ depuis, className = "" }: { depuis: "home" | "tenues"; className?: string }) {
  const { state, vestiairePool, jourConsulte, actions } = useCapsela();
  const plans = plansDuJour(state.tenuesPlanifiees, jourLocal(jourConsulte.date)).filter((t) => t.id !== state.planAppliqueId);
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
        // Une pièce sortie du dressing depuis : le plan n'est plus complet, il
        // n'est pas imposé comme tenue du jour — la ligne dit pourquoi.
        const manquantes = t.pieceIds.filter((id) => !pool.some((i) => i.id === id)).length;
        return (
          <button
            key={t.id}
            onClick={() => actions.ouvrirPlan(t, depuis)}
            aria-label={`Tenue planifiée, ${t.moment.toLowerCase()} : ${occasionShortLabel(t.occasion)}${ville ? ` à ${ville}` : ""}. Voir la tenue`}
            className="w-full flex items-center gap-3 bg-card border border-border rounded-[18px] p-[7px] pr-3 text-left cursor-pointer transition-opacity active:opacity-80"
          >
            {apercu.length > 0 && (
              <span aria-hidden="true" className="w-[46px] h-[46px] flex-shrink-0 rounded-champ bg-warm-bg grid grid-cols-2 gap-[2px] p-[3px] overflow-hidden">
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
              <span className="block t-label text-terracotta truncate">{t.moment === "Soirée" ? "Ce soir" : `Planifiée · ${t.moment}`}</span>
              <span className="block text-[13px] text-ink mt-[3px] truncate">
                {occasionShortLabel(t.occasion)}
                {ville ? ` · ${ville}` : ""}
              </span>
              {manquantes > 0 && (
                <span className="block text-[12px] text-muted mt-[2px] truncate">
                  {manquantes > 1 ? "Des pièces ne sont plus dans ton dressing" : "Une pièce n'est plus dans ton dressing"}
                </span>
              )}
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
