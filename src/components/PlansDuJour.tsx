"use client";

import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import { jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { evaluerAlerteMeteo, libelleChangement, proposerAdaptation, type AlerteMeteo, type MeteoDuPlan } from "@/lib/alerteMeteo";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, saisonCalendairePour, weatherForDay } from "@/lib/capsule";
import { CATS } from "@/lib/data";
import { poolDePlanification } from "@/lib/selectors";
import type { CategoryKey } from "@/lib/types";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { soireeHabillee } from "@/lib/occasions";
import { sousChoixDuPlan } from "@/lib/planDuJour";
import { estPlanValise } from "@/lib/valiseDuJour";
import { paletteHexes } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { plansDuJour, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { useCapsela } from "@/lib/store";
import { ecartJoursDuPlan, useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import type { Item } from "@/lib/types";

/**
 * La tenue planifiée devenue tenue du jour (planDuJour.ts, option C du
 * 30/09/2026), et ce que la météo du jour en dit — ou null quand la tenue
 * affichée est la proposition de Capsela. Pour l'étiquette « Ta tenue
 * planifiée » de l'Accueil et de Tenue.
 */
export function usePlanApplique(): { plan: TenuePlanifiee; alerte: AlerteMeteo | null; pieces: Item[]; meteo: MeteoDuPlan | null } | null {
  const { state, vestiairePool, meteoPourMoment, valiseConsultee } = useCapsela();
  // Une tenue planifiée par la personne, ou le look de la journée de la valise en cours (plan virtuel, valiseDuJour.ts).
  const plan = state.planAppliqueId
    ? (state.tenuesPlanifiees.find((t) => t.id === state.planAppliqueId) ?? (valiseConsultee?.journee?.id === state.planAppliqueId ? valiseConsultee.journee : null))
    : null;
  // La météo du LIEU et du MOMENT du plan (useMeteoDuPlan), pas celle de la ville de la personne : un plan « Gagny, ce
  // soir » ne se juge pas sur la météo de la journée ailleurs. Un plan sans lieu garde la météo du jour ; un plan avec
  // lieu dont la prévision manque n'a pas d'alerte — rien n'est deviné. Jamais la météo ACTUELLE de l'accueil pour un autre jour/lieu.
  const meteoPlan = useMeteoDuPlan(plan);
  if (!plan) return null;
  const pool: Item[] = [...state.items, ...vestiairePool];
  const pieces = plan.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((i): i is Item => !!i);
  // Un plan SANS lieu se juge sur la prévision de la ville de l'accueil pour SON moment (meteoPourMoment) — jamais sur la météo actuelle, ni
  // sur les valeurs par défaut ou la température d'aujourd'hui reprise pour un autre jour (signalé à l'audit du 12/10/2026 : meteoDuJour en
  // était un repli). Prévision absente : pas d'alerte.
  const meteo = villeDuLieu(plan.lieu) ? meteoPlan : meteoPourMoment(plan.moment);
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
  const { state, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const { alerte, plan, pieces, meteo } = planApplique;
  if (!alerte || !meteo) return null;
  const adapter = () => {
    // Le MÊME pool que celui qui compose une tenue planifiée : le dressing d'abord, complété par la capsule de la saison du plan.
    const saisonDuPlan = saisonCalendairePour(new Date(`${plan.jour}T12:00:00`));
    const meteoMoteur = weatherForDay(meteo.temp, meteo.label, saisonDuPlan, CHALEUR_HORS_SAISON);
    const capsule = plan.dressingSeul ? [] : computeDefaultCapsule(profile, meteoMoteur, state.suggestedExcluded, saisonDuPlan, vestiairePool);
    const pool = poolDePlanification({ items: state.items, capsule, occasion: plan.occasion, dressingSeul: plan.dressingSeul, meteo: meteoMoteur, categories: CATS.map(([k]) => k) as CategoryKey[] });
    const proposition = proposerAdaptation({
      pieces,
      pool,
      dressingIds: new Set(state.items.map((i) => i.id)),
      meteo,
      occasion: plan.occasion,
      saisonDuPlan,
      moteur: {
        ...sousChoixDuPlan(plan),
        soireeHabillee: plan.occasion === "soiree" && soireeHabillee({ typeLieu: plan.typeLieu, humeur: plan.humeur ?? null }),
        paletteHexes: paletteHexes(profile),
        morphology: profile.morphology,
        colorimetrie: colorimetrieMoteur(profile.colorimetrie),
      },
      ctx: { ville: villeDuLieu(plan.lieu) || undefined, moment: plan.moment },
    });
    if (!proposition) return actions.ouvrirPlan(plan, "home");
    // Planifier ne place une tenue que dans les jours À VENIR : pour un plan d'aujourd'hui, la date serait perdue (audit du 12/10/2026). Le look
    // adapté s'ouvre alors comme tenue du jour (écran Tenue), sans toucher au plan, qui n'est remplacé que par un enregistrement explicite.
    if (ecartJoursDuPlan(plan.jour) <= 0) {
      actions.viewItemOutfit(proposition.ids, plan.occasion);
      return actions.goTenues();
    }
    actions.adapterPlan(plan, proposition.ids, proposition.changements.map(libelleChangement), "home");
  };
  return (
    <div
      role="status"
      className="rounded-[16px] px-[14px] py-[11px] text-left"
      style={{ gridColumn: "1 / -1", background: "rgba(29,26,22,.05)", border: "1px solid rgba(29,26,22,.14)" }}
    >
      <div className="text-[13px] font-semibold leading-[1.3] text-ink">{alerte.titre}</div>
      <div className="text-[12.5px] leading-[1.45] text-ink-soft mt-[3px]" style={{ textWrap: "pretty" }}>
        {alerte.message}
      </div>
      <button type="button" onClick={adapter} className="mt-[6px] min-h-[44px] text-[13px] font-semibold text-terracotta-deep underline underline-offset-[3px] cursor-pointer">
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
  const { state, vestiairePool, jourConsulte, valiseConsultee, actions } = useCapsela();
  // Un plan dont la tenue est DÉJÀ celle du hero n'est pas rappelé dessous (14/10/2026, signalé : « inutile de remettre la carte, le hero pousse
  // la tenue planifiée »). Pendant un séjour, les looks de la valise de ce jour (journée écartée, soir) sont rappelés comme les autres
  // (20/10/2026, valiseDuJour.ts) ; les toucher ouvre la valise.
  const deLaValise = [valiseConsultee?.journee, valiseConsultee?.soir].filter((t): t is TenuePlanifiee => !!t);
  const plans = [...plansDuJour(state.tenuesPlanifiees, jourLocal(jourConsulte.date)), ...deLaValise].filter(
    (t) => t.id !== state.planAppliqueId && !memeTenue(t.pieceIds, state.outfit)
  );
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
              <span className="block t-label text-terracotta truncate">{/* « Ce soir » ne vaut que pour aujourd'hui (14/10/2026, signalé : affiché pour un plan de demain soir). */}
                {estPlanValise(t.id)
                  ? `Ta valise · ${t.moment === "Soirée" ? (jourConsulte.decalage === 0 ? "Ce soir" : "Le soir") : "La journée"}`
                  : jourConsulte.decalage === 0 && t.moment === "Soirée" ? "Ce soir" : jourConsulte.decalage > 0 ? "Ta tenue planifiée" : `Planifiée · ${t.moment}`}</span>
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
