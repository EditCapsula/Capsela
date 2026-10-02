"use client";

import { WEATHER_ICONS } from "@/lib/data";
import { JOUR_MAX, libelleJour, libelleJourCourt, quandPhrase } from "@/lib/jourConsulte";
import { useCapsela } from "@/lib/store";

/*
 * LE JOUR ET SA MÉTÉO, SUR UNE SEULE LIGNE — composant partagé par l'Accueil
 * et Tenue (navigation par date, 27/09/2026 — docs/navigation-par-date.md).
 * Un seul état (store : jourDecalage), une seule présentation : le jour
 * choisi sur l'Accueil est celui que Tenue ouvre, et inversement.
 *
 * LA DATE VIT SUR LA LIGNE DE LA LOCALISATION (demandé le 27/09/2026, après
 * une première version où le sélecteur remplaçait le surtitre du titre) :
 * le jour et sa météo se lisent ensemble, comme une seule information de
 * contexte. À gauche le jour et ses chevrons, à droite la ville et la
 * météo, qui ouvrent Préférences Capsela sur « Localisation & météo ».
 * Aucun autre endroit ne répète la date.
 *
 * Largeur : à 360 px, le libellé court (« Aujourd'hui », « Demain »,
 * « Mar. 29 ») et « Ville ☁ 23° » tiennent ; la condition (« Nuageux »)
 * s'ajoute à partir de 400 px — l'icône la porte en dessous, et le nom
 * accessible la dit toujours.
 */

function Chevron({ vers }: { vers: "gauche" | "droite" }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d={vers === "gauche" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function JourEtMeteo({ className = "" }: { className?: string }) {
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

  const chevron = "w-[30px] h-[36px] flex items-center justify-center flex-shrink-0 cursor-pointer disabled:cursor-default disabled:opacity-30 text-terracotta";

  return (
    <div className={className}>
      <div className="flex items-stretch bg-card border border-border rounded-full min-h-[46px]">
        {/* LE JOUR — ‹ libellé ›. Hors d'aujourd'hui, le libellé lui-même
            ramène à aujourd'hui d'un tap. */}
        <div className="flex items-center flex-shrink-0 pl-[4px]" role="group" aria-label="Jour de la tenue">
          <button onClick={() => actions.choisirJour(decalage - 1)} disabled={decalage === 0} aria-label="Jour précédent" className={chevron}>
            <Chevron vers="gauche" />
          </button>
          <button
            onClick={() => decalage > 0 && actions.choisirJour(0)}
            aria-label={decalage > 0 ? `${libelleJour(decalage, date)}. Revenir à aujourd'hui` : libelleJour(decalage, date)}
            aria-live="polite"
            className={"text-[12px] text-ink whitespace-nowrap py-[8px] " + (decalage > 0 ? "cursor-pointer" : "cursor-default")}
          >
            {libelleJourCourt(decalage, date)}
          </button>
          <button onClick={() => actions.choisirJour(decalage + 1)} disabled={decalage >= JOUR_MAX} aria-label="Jour suivant" className={chevron}>
            <Chevron vers="droite" />
          </button>
        </div>

        <span aria-hidden="true" className="w-px my-[10px] bg-border flex-shrink-0" />

        {/* LA LOCALISATION ET LA MÉTÉO DU JOUR — ouvre les réglages existants. */}
        <button
          onClick={() => actions.goPreferences("localisation")}
          aria-label={`Météo : ${geoCity.city}${temp != null ? `, ${temp}°${label ? ` ${label}` : ""}` : ""}. Régler la localisation et la météo`}
          className="flex-1 min-w-0 flex items-center gap-[7px] pl-[12px] pr-[12px] text-left cursor-pointer"
        >
          {enAttente ? (
            <>
              <span className="w-[8px] h-[8px] rounded-full flex-shrink-0 animate-pulse" style={{ background: "#B3AA9B" }} />
              <span className="flex-1 min-w-0 text-[12px] text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                {geoLoading ? "Localisation…" : "Prévision…"}
              </span>
            </>
          ) : (
            <>
              <span className="w-[8px] h-[8px] rounded-full bg-terracotta flex-shrink-0" style={{ boxShadow: "0 0 0 3px rgba(166,105,80,.16)" }} />
              <span className="flex-1 min-w-0 text-[12px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">{geoCity.city}</span>
              {temp != null && label && (
                <span className="flex items-center gap-[5px] flex-shrink-0 text-[12px] text-ink-soft whitespace-nowrap">
                  <span aria-hidden="true">{WEATHER_ICONS[label] || "🌤️"}</span>
                  {temp}°<span className="hidden min-[400px]:inline"> · {label}</span>
                </span>
              )}
            </>
          )}
          <span aria-hidden="true" className="text-placeholder text-[14px] flex-shrink-0">
            ›
          </span>
        </button>
      </div>
      {note && <div className="text-[10px] text-placeholder mt-[6px] px-[5px] leading-[1.4]">{note}</div>}
    </div>
  );
}
