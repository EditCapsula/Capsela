"use client";

import { useState } from "react";
import { Vignette } from "@/components/ResultatAvis";
import { prioriserActionsAvis, type ActionAvis } from "@/lib/avisStylisteClient";
import { tenueAUnSocle } from "@/lib/logic";
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
 * LA TENUE, CE SONT LES PIÈCES RECONNUES SUR LA PHOTO dans le dressing réel
 * (reconnaitrePiecesPortees, serveur). Une reconnaissance peut se tromper :
 * chaque pièce se retire d'un tap, sans rien avoir à resélectionner. Aucune
 * pièce reconnue : la section ne s'affiche pas. Pas de socle (haut + bas, ou
 * robe / combinaison) : pas d'action — la règle même du moteur.
 */

const LIBELLES: Record<ActionAvis, { principal: string; secondaire: string }> = {
  porter: { principal: "Porter aujourd'hui", secondaire: "Porter aujourd'hui →" },
  demain: { principal: "Planifier pour demain", secondaire: "Planifier pour demain →" },
  planifier: { principal: "Planifier cette tenue", secondaire: "Planifier cette tenue →" },
};

export default function EtMaintenantAvis({
  pieces,
  tenueDuJourPortee,
  onPorter,
  onVoirTenue,
  onPlanifier,
}: {
  /** Pièces du dressing reconnues sur la photo, déjà résolues. */
  pieces: Item[];
  tenueDuJourPortee: boolean;
  onPorter: (ids: number[]) => void;
  onVoirTenue: () => void;
  onPlanifier: (ids: number[], demain: boolean) => void;
}) {
  const [retirees, setRetirees] = useState<number[]>([]);
  const [portee, setPortee] = useState(false);
  if (pieces.length === 0) return null;

  const gardees = pieces.filter((p) => !retirees.includes(p.id));
  const ids = gardees.map((p) => p.id);
  const actions = prioriserActionsAvis({ heure: new Date().getHours(), tenueDuJourPortee, composable: tenueAUnSocle(gardees) });
  // En soirée, « Planifier cette tenue » se dit « pour une autre date ».
  const libelleSecondaire = (a: ActionAvis) =>
    a === "planifier" ? (actions?.principale === "demain" ? "Planifier une autre date →" : "Planifier pour une autre date →") : LIBELLES[a].secondaire;

  const agir = (a: ActionAvis) => {
    if (a === "porter") {
      onPorter(ids);
      setPortee(true);
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
        <div className="text-[12px] text-muted-3 leading-[1.45] mt-[4px]">
          Reconnue dans ton dressing. Touche une pièce pour la retirer si ce n&apos;est pas elle.
        </div>
        <ul className="mt-[12px] flex gap-[8px] overflow-x-auto -mx-1 px-1 pb-1">
          {pieces.map((p) => {
            const retiree = retirees.includes(p.id);
            return (
              <li key={p.id} className="flex-shrink-0 w-[64px]">
                <button
                  type="button"
                  onClick={() => {
                    setPortee(false);
                    setRetirees((l) => (retiree ? l.filter((x) => x !== p.id) : [...l, p.id]));
                  }}
                  aria-pressed={!retiree}
                  aria-label={`${p.name} : ${retiree ? "retirée de la tenue, toucher pour la remettre" : "dans la tenue, toucher pour la retirer"}`}
                  className={"block w-full text-left cursor-pointer transition-opacity " + (retiree ? "opacity-35" : "opacity-100")}
                >
                  <Vignette item={p} taille={64} />
                  <span className={"block mt-[4px] text-[10px] leading-[1.25] line-clamp-2 " + (retiree ? "text-muted line-through" : "text-ink")}>{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {actions ? (
          <div className="mt-[14px]">
            {portee ? (
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
        ) : (
          <div className="mt-[12px] text-[12px] text-muted-3 leading-[1.45]">
            Pour la porter ou la planifier, il faut au moins un haut et un bas, ou une robe.
          </div>
        )}
      </div>
    </section>
  );
}
