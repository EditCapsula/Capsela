"use client";

import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { evaluerAlerteMeteo, libelleChangement, proposerAdaptation, type AlerteMeteo, type MeteoDuPlan } from "@/lib/alerteMeteo";
import { contexteCapsule, saisonCalendairePour } from "@/lib/capsule";
import { plansDuJour, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { useCapsela } from "@/lib/store";
import { useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import type { Item } from "@/lib/types";

/**
 * La tenue planifiée devenue tenue du jour (planDuJour.ts, option C du
 * 30/09/2026), et ce que la météo du jour en dit — ou null quand la tenue
 * affichée est la proposition de Capsela. Pour l'étiquette « Ta tenue
 * planifiée » de l'Accueil et de Tenue.
 */
export function usePlanApplique(): { plan: TenuePlanifiee; alerte: AlerteMeteo | null; pieces: Item[]; meteo: MeteoDuPlan | null } | null {
  const { state, vestiairePool, meteoDuJour } = useCapsela();
  const plan = state.planAppliqueId ? (state.tenuesPlanifiees.find((t) => t.id === state.planAppliqueId) ?? null) : null;
  // La météo du LIEU et du MOMENT du plan (useMeteoDuPlan), pas celle de la ville de la personne : un plan « Gagny, ce
  // soir » ne se juge pas sur la météo de la journée ailleurs. Un plan sans lieu garde la météo du jour ; un plan avec
  // lieu dont la prévision manque n'a pas d'alerte — rien n'est deviné. Jamais la météo ACTUELLE de l'accueil pour un autre jour/lieu.
  const meteoPlan = useMeteoDuPlan(plan);
  if (!plan) return null;
  const pool: Item[] = [...state.items, ...vestiairePool];
  const pieces = plan.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const meteo = meteoPlan ?? (villeDuLieu(plan.lieu) ? null : meteoDuJour);
  const alerte = meteo ? evaluerAlerteMeteo(pieces, meteo, { ville: villeDuLieu(plan.lieu) || undefined, moment: plan.moment }) : null;
  return { plan, alerte, pieces, meteo };
}

/**
 * L'ALERTE MÉTÉO DU LOOK PLANIFIÉ (12/10/2026) — dans la partie basse de la carte de l'accueil : un titre, une phrase qui dit la température
 * PRÉVUE (au lieu et au moment du plan, jamais la météo actuelle) et ce qui est à faire, et un CTA qui ouvre une vraie adaptation.
 * « Adapter mon look » / « Trouver une alternative » : les modifications minimales sont prises dans le dressing (proposerAdaptation) et
 * ouvertes dans Planifier, où la personne les voit, les garde ou les change. Rien d'adaptable dans le dressing : l'écran du plan, où
 * « Modifier ce look » reprend le parcours complet — le CTA ne reste jamais sans effet. Posée sur le fond terracotta de la carte.
 */
export function AlerteMeteoLook({ planApplique }: { planApplique: NonNullable<ReturnType<typeof usePlanApplique>> }) {
  const { state, actions } = useCapsela();
  const { alerte, plan, pieces, meteo } = planApplique;
  if (!alerte || !meteo) return null;
  const adapter = () => {
    const proposition = proposerAdaptation({
      pieces,
      dressing: state.items,
      meteo,
      occasion: plan.occasion,
      contexte: contexteCapsule(saisonCalendairePour(new Date(`${plan.jour}T12:00:00`))),
      ctx: { ville: villeDuLieu(plan.lieu) || undefined, moment: plan.moment },
    });
    if (proposition) actions.adapterPlan(plan, proposition.ids, proposition.changements.map(libelleChangement), "home");
    else actions.ouvrirPlan(plan, "home");
  };
  return (
    <div
      role="status"
      className="rounded-[16px] px-[14px] py-[11px] text-left"
      style={{ gridColumn: "1 / -1", background: "rgba(251,243,234,.12)", border: "1px solid rgba(251,243,234,.28)" }}
    >
      <div className="text-[13px] font-semibold leading-[1.3] text-cream">{alerte.titre}</div>
      <div className="text-[12.5px] leading-[1.45] text-on-terracotta-soft mt-[3px]" style={{ textWrap: "pretty" }}>
        {alerte.message}
      </div>
      <button type="button" onClick={adapter} className="mt-[6px] min-h-[44px] text-[13px] font-semibold text-cream underline underline-offset-[3px] cursor-pointer">
        {alerte.cta} →
      </button>
    </div>
  );
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
            className="w-full flex items-center gap-3 bg-card border border-border rounded-carte p-[7px] pr-3 text-left cursor-pointer transition-opacity active:opacity-80"
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
