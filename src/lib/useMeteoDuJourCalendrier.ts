"use client";

import { useEffect, useState } from "react";
import { ecartJoursDuPlan, previsionDuLieu } from "./useMeteoDuPlan";
import { HORIZON_PREVISION_JOURS, previsionPour, type MeteoMoment, type Prevision } from "./prevision";

/*
 * LA MÉTÉO PRÉVUE D'UN JOUR À VENIR, POUR MON PLANNING (08/10/2026, maquette « Aucune tenue prévue » : la pastille « 19° ·
 * Ensoleillé »). Même source et même cache que la météo d'un plan (useMeteoDuPlan) : la prévision de la VILLE de la personne,
 * « toute la journée », dans l'horizon que la prévision couvre réellement. Au-delà, sans ville ou sans réponse : null — la
 * pastille n'est pas affichée, jamais une météo inventée ni celle d'un autre jour.
 */
export function useMeteoDuJourCalendrier(jour: string, ville: string, actif: boolean): MeteoMoment | null {
  const ecart = ecartJoursDuPlan(jour);
  const eligible = actif && Boolean(ville) && ecart >= 0 && ecart <= HORIZON_PREVISION_JOURS;
  const cle = eligible ? ville.toLowerCase() : null;
  const [reponse, setReponse] = useState<{ cle: string; p: Prevision | null } | null>(null);
  useEffect(() => {
    if (!cle) return;
    let annule = false;
    void previsionDuLieu(ville).then((p) => {
      if (!annule) setReponse({ cle, p });
    });
    return () => {
      annule = true;
    };
  }, [cle, ville]);
  return eligible && reponse && reponse.cle === cle && reponse.p ? previsionPour(reponse.p, jour, "Toute la journée") : null;
}
