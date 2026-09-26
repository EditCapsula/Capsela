"use client";

import { useState } from "react";
import { prioriserActionsAvis, type ActionAvis } from "@/lib/avisStylisteClient";
import { compositionUtilisable } from "@/lib/reconnaissance";
import type { Item } from "@/lib/types";

/*
 * « ET MAINTENANT ? » — Avis de styliste V2 (26/09/2026). Après l'avis,
 * décider quoi faire de la tenue, avec les fonctionnalités qui existent déjà :
 *   - « Porter aujourd'hui » : la tenue du jour (reWear) — à valider ensuite
 *     sur l'écran Tenue, comme toute tenue du jour ;
 *   - « Planifier pour demain » / « Planifier cette tenue » : le parcours
 *     Planifier, tenue préremplie (planifierComposition), date de demain si
 *     c'est l'action choisie.
 *
 * LA TENUE EST LA COMPOSITION RECONNUE (compositionReconnue) : les pièces que
 * la section « Pièces reconnues » montre et laisse corriger, rien d'autre.
 * Sans socle (haut + bas, ou robe / combinaison), pas d'action — la règle
 * même du moteur.
 */

const LIBELLES: Record<ActionAvis, { principal: string; secondaire: string }> = {
  porter: { principal: "Porter aujourd'hui", secondaire: "Porter aujourd'hui →" },
  demain: { principal: "Planifier pour demain", secondaire: "Planifier pour demain →" },
  planifier: { principal: "Planifier cette tenue", secondaire: "Planifier cette tenue →" },
};

export default function EtMaintenantAvis({
  composition,
  tenueDuJourPortee,
  onPorter,
  onVoirTenue,
  onPlanifier,
}: {
  /** La composition reconnue, déjà résolue dans le dressing. */
  composition: Item[];
  tenueDuJourPortee: boolean;
  onPorter: (ids: number[]) => void;
  onVoirTenue: () => void;
  onPlanifier: (ids: number[], demain: boolean) => void;
}) {
  const [portee, setPortee] = useState<string | null>(null);
  const ids = composition.map((p) => p.id);
  const cle = ids.join(",");
  const actions = prioriserActionsAvis({ heure: new Date().getHours(), tenueDuJourPortee, composable: compositionUtilisable(composition) });
  // En soirée, « Planifier cette tenue » se dit « pour une autre date ».
  const libelleSecondaire = (a: ActionAvis) =>
    a === "planifier" ? (actions?.principale === "demain" ? "Planifier une autre date →" : "Planifier pour une autre date →") : LIBELLES[a].secondaire;

  const agir = (a: ActionAvis) => {
    if (a === "porter") {
      onPorter(ids);
      setPortee(cle);
    } else onPlanifier(ids, a === "demain");
  };

  return (
    <section className="mt-[30px] motion-safe:animate-[capsule-apparition_320ms_ease-out_both]" aria-labelledby="avis-et-maintenant">
      <div id="avis-et-maintenant" className="t-surtitre text-muted">
        Et maintenant ?
      </div>
      <div className="mt-[10px] bg-card border border-border rounded-[20px] px-4 py-[16px]">
        <div className="t-titre-carte text-ink">
          {actions?.principale === "demain" ? (
            <>
              Une idée pour <span className="italic text-terracotta">demain ?</span>
            </>
          ) : (
            <>
              Cette tenue <span className="italic text-terracotta">te plaît ?</span>
            </>
          )}
        </div>
        {actions ? (
          <>
            <div className="text-[12px] text-muted-3 leading-[1.45] mt-[4px]">
              Avec {composition.length > 1 ? `les ${composition.length} pièces reconnues` : "la pièce reconnue"} dans ton dressing.
            </div>
            <div className="mt-[14px]">
              {/* La confirmation ne vaut que pour la composition portée : une
                  correction ensuite rend l'action à nouveau disponible. */}
              {portee === cle ? (
                <div className="w-full rounded-full bg-warm-bg border border-warm-border pl-4 pr-3 flex items-center justify-between gap-3" role="status">
                  <span className="text-[13px] text-ink">
                    <span aria-hidden="true" className="text-terracotta mr-[6px]">
                      ✓
                    </span>
                    Ajoutée à ta tenue du jour
                  </span>
                  <button type="button" onClick={onVoirTenue} className="t-lien text-terracotta cursor-pointer min-h-[44px] flex-shrink-0">
                    Voir ma tenue →
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => agir(actions.principale)}
                  className="w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center t-bouton py-[14px] cursor-pointer"
                >
                  {LIBELLES[actions.principale].principal}
                </button>
              )}
              {actions.secondaires.map((a) => (
                <button key={a} type="button" onClick={() => agir(a)} className="mt-[4px] w-full text-center t-lien text-terracotta min-h-[44px] cursor-pointer">
                  {libelleSecondaire(a)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-[6px] text-[12px] text-muted-3 leading-[1.45]">
            Pour la porter ou la planifier, associe au moins un haut et un bas, ou une robe, dans les pièces reconnues.
          </div>
        )}
      </div>
    </section>
  );
}
