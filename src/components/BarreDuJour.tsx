"use client";

import { IconeTuile } from "@/components/PlanifierUI";
import { useDonneesJour, type RetroJour } from "@/components/JourMeteo";
import { JOUR_MAX, libelleJour, libelleJourCourt } from "@/lib/jourConsulte";
import { useCapsela } from "@/lib/store";

/**
 * LA BARRE DU JOUR DE L'ACCUEIL (maquette « Accueil V9 », 07/10/2026) : à gauche le jour et la ville, à droite la température
 * du moment et la condition. Sans carte ni filet — c'est une ligne posée sur le fond.
 *
 * Mêmes données et mêmes gestes que JourEtMeteo (useDonneesJour) : les chevrons changent le jour consulté — ou remontent aux
 * tenues passées —, la ville ouvre « Localisation & météo ». La maquette montre aussi « Max · min » ; le service météo ne donne
 * que la température et la condition, la condition prend donc cette ligne : rien n'est inventé.
 */
function Chevron({ vers }: { vers: "gauche" | "droite" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d={vers === "gauche" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const chevron = "w-[30px] h-[44px] flex items-center justify-center flex-shrink-0 cursor-pointer disabled:cursor-default disabled:opacity-30 text-terracotta";

export default function BarreDuJour({ className = "", retro }: { className?: string; retro?: RetroJour }) {
  const { actions } = useCapsela();
  const { geoCity, geoLoading, decalage, date, enRetro, enAttente, temp, label, note } = useDonneesJour(retro);
  const soleil = !!label && /soleil|dégagé|clair|ensoleill/i.test(label);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center min-w-0 text-[12.5px] font-medium text-muted-3">
          <button
            onClick={() => (retro && decalage === 0 ? retro.precedent != null && retro.onChange(retro.precedent) : actions.choisirJour(decalage - 1))}
            disabled={retro && decalage === 0 ? retro.precedent == null : decalage === 0}
            aria-label={retro && decalage === 0 ? "Tenue passée précédente" : "Jour précédent"}
            className={chevron}
          >
            <Chevron vers="gauche" />
          </button>
          <button
            onClick={() => (enRetro ? retro!.onChange(0) : decalage > 0 && actions.choisirJour(0))}
            aria-label={enRetro ? `${libelleJour(-retro!.jours, retro!.date)}. Revenir à aujourd'hui` : decalage > 0 ? `${libelleJour(decalage, date)}. Revenir à aujourd'hui` : libelleJour(decalage, date)}
            aria-live="polite"
            className={"whitespace-nowrap min-h-[44px] " + (enRetro || decalage > 0 ? "cursor-pointer" : "cursor-default")}
          >
            {enRetro ? libelleJourCourt(-retro!.jours, retro!.date) : libelleJourCourt(decalage, date)}
          </button>
          <button
            onClick={() => (enRetro ? retro!.onChange(retro!.suivant) : actions.choisirJour(decalage + 1))}
            disabled={enRetro ? false : decalage >= JOUR_MAX}
            aria-label={enRetro ? "Tenue passée suivante" : "Jour suivant"}
            className={chevron}
          >
            <Chevron vers="droite" />
          </button>
          <span aria-hidden="true" className="text-muted mr-[6px]">·</span>
          <button
            onClick={() => actions.goPreferences("localisation")}
            aria-label={`Localisation : ${geoCity.city}. Régler la localisation et la météo`}
            className="flex items-center gap-[6px] min-w-0 min-h-[44px] text-ink cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted" style={{ display: "block" }}>
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
                <path d="M12 12.3a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z" />
              </g>
            </svg>
            <span className="truncate">{enAttente ? (geoLoading ? "Localisation…" : "Prévision…") : enRetro ? "Météo enregistrée" : geoCity.city}</span>
          </button>
        </div>

        {!enAttente && temp != null && (
          <div className="flex-shrink-0 text-right" aria-label={`${temp}°${label ? `, ${label}` : ""}`}>
            <div className="flex items-center justify-end gap-[6px] text-terracotta">
              <IconeTuile nom={soleil ? "apresmidi" : "nuage"} taille={22} />
              <span className="text-[20px] font-medium text-ink tabular-nums">{temp}°</span>
            </div>
            {label && <div className="text-[11px] text-muted mt-[2px] whitespace-nowrap">{label}</div>}
          </div>
        )}
      </div>
      {note && <div className="text-[10px] text-placeholder mt-[2px] leading-[1.4]">{note}</div>}
    </div>
  );
}
