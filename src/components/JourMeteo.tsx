"use client";

import { WEATHER_ICONS } from "@/lib/data";
import { JOUR_MAX, libelleJour, quandPhrase } from "@/lib/jourConsulte";
import { useCapsela } from "@/lib/store";

/*
 * LE JOUR ET SA MÉTÉO — deux composants partagés par l'Accueil et Tenue
 * (navigation par date, 27/09/2026 — docs/navigation-par-date.md). Un seul
 * état (store : jourDecalage), une seule présentation : le jour choisi sur
 * l'Accueil est celui que Tenue ouvre, et inversement.
 *
 * LA DATE N'EST DITE QU'ICI (option C du brief). Le sélecteur prend la place
 * du surtitre qui portait la date (« Aujourd'hui » sur l'Accueil, « Dimanche
 * 27 septembre » sur Tenue) : même typographie, plus deux chevrons. Aucun
 * autre écran ne répète la date — ceux qui ne dépendent pas d'un jour n'en
 * ont pas besoin.
 */

function Chevron({ vers }: { vers: "gauche" | "droite" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d={vers === "gauche" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * ‹ Aujourd'hui · dimanche 27 › — du jour même à JOUR_MAX, l'horizon de la
 * prévision météo. Hors d'aujourd'hui, « Aujourd'hui » y ramène d'un tap.
 */
export function SelecteurJour() {
  const { jourConsulte, actions } = useCapsela();
  const { decalage, date } = jourConsulte;
  const bouton = "w-[34px] h-[34px] -my-[5px] flex items-center justify-center rounded-full cursor-pointer disabled:cursor-default disabled:opacity-30 text-terracotta";
  return (
    <div className="flex items-center gap-[2px] -ml-[10px]" role="group" aria-label="Jour de la tenue">
      <button onClick={() => actions.choisirJour(decalage - 1)} disabled={decalage === 0} aria-label="Jour précédent" className={bouton}>
        <Chevron vers="gauche" />
      </button>
      <span className="t-surtitre text-muted whitespace-nowrap" aria-live="polite">
        {libelleJour(decalage, date)}
      </span>
      <button onClick={() => actions.choisirJour(decalage + 1)} disabled={decalage >= JOUR_MAX} aria-label="Jour suivant" className={bouton}>
        <Chevron vers="droite" />
      </button>
      {decalage > 0 && (
        <button onClick={() => actions.choisirJour(0)} className="ml-[6px] text-[11px] text-terracotta cursor-pointer whitespace-nowrap py-[8px] -my-[8px]">
          Aujourd&apos;hui
        </button>
      )}
    </div>
  );
}

/**
 * La ville et la météo DU JOUR CONSULTÉ, et d'où elle vient. Toute la
 * pastille ouvre Préférences Capsela sur « Localisation & météo » : les
 * réglages existants, jamais un écran météo de plus.
 */
export function PastilleMeteo({ className = "" }: { className?: string }) {
  const { geoCity, geoLoading, geoIsLive, sourceMeteo, jourConsulte, actions } = useCapsela();
  const { decalage, date, meteoPrevue, previsionEnChargement } = jourConsulte;
  const enAttente = geoLoading || previsionEnChargement;
  const temp = decalage === 0 ? geoCity.temp : meteoPrevue?.temp;
  const label = decalage === 0 ? geoCity.label : meteoPrevue?.label;

  // La source, dite telle qu'elle est (correctif météo du 25/09/2026), et pour
  // un jour à venir la règle de repli de Planifier quand la prévision manque.
  const note = enAttente
    ? null
    : decalage > 0
      ? meteoPrevue
        ? null
        : `Prévision indisponible pour ${quandPhrase(decalage, date)} — tenue composée sur la saison de ce jour et la température d'aujourd'hui.`
      : geoIsLive
        ? null
        : sourceMeteo === "ville"
          ? "Météo actuelle de ta ville — active la géolocalisation pour celle de ta position."
          : sourceMeteo === "derniere_position"
            ? "Position indisponible — dernière météo enregistrée à ta position."
            : "Météo indisponible pour l'instant — tenue composée sur des valeurs par défaut.";

  return (
    <div className={className}>
      <button
        onClick={() => actions.goPreferences("localisation")}
        aria-label={`Météo : ${geoCity.city}${temp != null ? `, ${temp}°${label ? ` ${label}` : ""}` : ""}. Régler la localisation et la météo`}
        className="w-full flex items-center gap-[9px] bg-card border border-border rounded-full py-[10px] pl-[15px] pr-[12px] text-left cursor-pointer"
      >
        {enAttente ? (
          <>
            <span className="w-[9px] h-[9px] rounded-full flex-shrink-0 animate-pulse" style={{ background: "#B3AA9B" }} />
            <span className="flex-1 min-w-0 text-[13px] text-muted">{geoLoading ? "Localisation en cours…" : "Prévision en cours…"}</span>
          </>
        ) : (
          <>
            <span className="w-[9px] h-[9px] rounded-full bg-terracotta flex-shrink-0" style={{ boxShadow: "0 0 0 4px rgba(166,105,80,.16)" }} />
            <span className="flex-1 min-w-0 text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">{geoCity.city}</span>
            {temp != null && label && (
              <>
                <span className="text-[13px] flex-shrink-0" aria-hidden="true">
                  {WEATHER_ICONS[label] || "🌤️"}
                </span>
                <span className="text-[12px] text-[#3F3B34] whitespace-nowrap flex-shrink-0">
                  {temp}° · {label}
                </span>
              </>
            )}
          </>
        )}
        <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0 ml-[2px]">
          ›
        </span>
      </button>
      {note && <div className="text-[10px] text-placeholder mt-[6px] px-[5px] leading-[1.4]">{note}</div>}
    </div>
  );
}
