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
 *
 * NON BLOQUANT (26/09/2026) : les actions restent visibles même sans socle
 * (haut + bas, ou robe / combinaison — la règle du moteur). La règle ne se
 * dit qu'au moment où une action en a besoin, en message contextuel, avec
 * « Associer une pièce → » ; jamais de « Continuer » vers une tenue
 * incomplète (arbitrage validé le 26/09).
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
  const [manque, setManque] = useState<ActionAvis | null>(null);
  const ids = composition.map((p) => p.id);
  const cle = ids.join(",");
  const composable = compositionUtilisable(composition);
  // L'ordre des actions ne dépend que de l'heure et de la tenue du jour ;
  // la composition, elle, n'est vérifiée qu'au clic.
  const actions = prioriserActionsAvis({ heure: new Date().getHours(), tenueDuJourPortee, composable: true });
  // En soirée, « Planifier cette tenue » se dit « pour une autre date ».
  const libelleSecondaire = (a: ActionAvis) =>
    a === "planifier" ? (actions?.principale === "demain" ? "Planifier une autre date →" : "Planifier pour une autre date →") : LIBELLES[a].secondaire;

  const agir = (a: ActionAvis) => {
    if (!composable) {
      setManque(a);
      return;
    }
    setManque(null);
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
        {actions && (
          <>
            <div className="text-[12px] text-muted-3 leading-[1.45] mt-[4px]">
              {composable
                ? "Tu peux maintenant l'utiliser dans Capsela."
                : "Une fois les pièces principales associées, tu pourras la porter ou la planifier."}
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
              {/* Le message ne vient qu'au clic, et dit ce qui manque — pas une erreur. */}
              {manque && !composable && (
                <div className="mt-[8px] bg-warm-bg border border-warm-border rounded-[16px] px-4 py-[12px] motion-safe:animate-[capsule-apparition_220ms_ease-out_both]" role="status">
                  <div className="text-[13px] text-ink leading-[1.45]">
                    Pour {manque === "porter" ? "porter" : "planifier"} cette tenue, il me manque encore une pièce principale : un haut et un bas, ou une robe.
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById("avis-pieces-reconnues")?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="mt-[4px] t-lien text-terracotta min-h-[40px] cursor-pointer"
                  >
                    Associer une pièce →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
