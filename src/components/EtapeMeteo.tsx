"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";
import Input from "@/components/Input";
import { CITIES } from "@/lib/data";
import { fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";

/**
 * L'ÉTAPE MÉTÉO DE L'ONBOARDING (12/11/2026, brief 2.3, point 3). La demande de localisation du téléphone n'arrive plus sans
 * explication : cet écran dit à quoi elle sert, et la fenêtre du système ne s'ouvre QUE sur « Activer ma localisation », dans le même
 * geste (ProfileSetupScreen). Refusée, elle n'est pas redemandée (`geoConsent` reste faux, le store ne la relance pas) : la ville
 * prend le relais. Les deux se changent ensuite dans Réglages, Météo et localisation.
 *
 * Ce composant ne porte que le contenu de l'écran (où en est la localisation, le choix de la ville) ; les deux actions sont le pied
 * de l'écran du questionnaire, comme partout ailleurs dans le parcours.
 */
export type EtatLocalisation = "attente" | "enCours" | "accordee" | "refusee";

export default function EtapeMeteo({
  etat,
  ville,
  villeOuverte,
  onVille,
}: {
  etat: EtatLocalisation;
  ville: string;
  /** La recherche de ville est ouverte (« Renseigner ma ville manuellement », ou après un refus). */
  villeOuverte: boolean;
  onVille: (nom: string) => void;
}) {
  return (
    <div className="mt-[22px]">
      {etat === "enCours" && <div className="text-[13px] text-muted leading-[1.5]">Localisation en cours…</div>}
      {etat === "accordee" && (
        <div className="rounded-tuile border border-border bg-card px-[14px] py-[12px] text-[13px] text-ink leading-[1.5]">
          Localisation activée. La météo de tes tenues suivra l&apos;endroit où tu te trouves{ville ? ` (${ville} pour l'instant)` : ""}.
        </div>
      )}
      {etat === "refusee" && (
        <div className="text-[13px] text-ink-soft leading-[1.5]">
          La localisation n&apos;est pas autorisée. Indique ta ville : la météo de tes tenues sera celle-ci.
        </div>
      )}
      {villeOuverte && etat !== "accordee" && <ChoixVille ville={ville} onVille={onVille} />}
    </div>
  );
}

/** La ville, choisie dans la recherche (jamais une saisie libre, comme FeuilleVille) ; les villes connues en raccourcis. */
function ChoixVille({ ville, onVille }: { ville: string; onVille: (nom: string) => void }) {
  const [recherche, setRecherche] = useState("");
  const [suggestions, setSuggestions] = useState<VilleSuggeree[] | null>([]);
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) return;
    let annule = false;
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((v) => {
          if (!annule) setSuggestions(v);
        })
        .catch(() => {
          if (!annule) setSuggestions(null);
        });
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [recherche]);
  const enRecherche = recherche.trim().length >= 2;
  const ligne = (cle: string, nom: string, libelle: React.ReactNode) => {
    const actif = ville === nom;
    return (
      <button
        key={cle}
        role="radio"
        aria-checked={actif}
        onClick={() => {
          setRecherche("");
          onVille(nom);
        }}
        className="flex items-center justify-between gap-3 min-h-[48px] px-1 border-b border-border last:border-b-0 text-left cursor-pointer"
      >
        <span className={"text-[13px] " + (actif ? "text-terracotta" : "text-ink")}>{libelle}</span>
        {actif && (
          <span aria-hidden="true" className="text-terracotta text-[14px]">
            ✓
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="mt-4">
      <Input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher une ville"
        aria-label="Rechercher une ville"
        autoComplete="off"
        autoCapitalize="words"
      />
      <div className="flex flex-col mt-2" role="radiogroup" aria-label="Ville">
        {enRecherche ? (
          suggestions === null ? (
            <div className="text-[12px] text-muted py-3 px-1">Recherche indisponible pour l&apos;instant — efface pour choisir dans la liste.</div>
          ) : suggestions.length === 0 ? (
            <EmptyState className="py-3 px-1">Aucune ville trouvée.</EmptyState>
          ) : (
            suggestions.map((v) => ligne(`${v.lat},${v.lon}`, v.name, libelleVille(v)))
          )
        ) : (
          CITIES.map((c) =>
            ligne(
              c.city,
              c.city,
              <>
                {c.city} <span className="text-muted">· {c.country}</span>
              </>
            )
          )
        )}
      </div>
    </div>
  );
}
