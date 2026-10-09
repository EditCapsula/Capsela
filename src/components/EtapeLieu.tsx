"use client";

import { useEffect, useRef, useState } from "react";
import { IconeTuile, type IconePlanifier } from "@/components/PlanifierUI";
import { chargerRecentes, garderRecentes, ajouterRecente, libelleDestination, presenterResultats, type VilleRecente } from "@/lib/lieux";
import { fetchVilleParPosition, fetchVilles, getBrowserPosition, type VilleSuggeree } from "@/lib/weather";

/*
 * L'ÉTAPE « OÙ » (08/10/2026) : fonctionnelle, sans aucune image de destination — un lieu se dit par son nom, son pays, sa météo.
 * Les visuels éditoriaux sont réservés aux occasions.
 *
 * Le lieu choisi (`lieu` + `ville` avec ses coordonnées) vit dans PlanifierScreen : il sert aux autres étapes et à l'enregistrement.
 * Ici, seulement la recherche, ses résultats, les villes récentes (gardées sur l'appareil), la position — demandée UNIQUEMENT au tap —,
 * la carte de la destination et le type de lieu. « Modifier » rouvre la recherche sans effacer le lieu : il ne change qu'à la
 * sélection d'une nouvelle ville.
 */

export type MeteoEtapeLieu =
  | { kind: "sansLieu" }
  | { kind: "sansDate" }
  | { kind: "encours" }
  | { kind: "ok"; temp: number; tempMin: number; tempMax: number; label: string }
  /** Au-delà de la prévision : les températures HABITUELLES du lieu à cette date — jamais présentées comme une prévision. */
  | { kind: "habituelle"; tempMin: number; tempMax: number }
  | { kind: "loin" }
  | { kind: "indispo" };

const ICONE_LIEU: Record<string, IconePlanifier> = {
  Restaurant: "restaurant",
  "Bar / Rooftop": "bar",
  "Lieu culturel": "culture",
  Extérieur: "exterieur",
  "Chez quelqu'un": "maison",
  Autre: "aucune",
};

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const Loupe = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" {...trait}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
);
const Epingle = ({ taille = 16 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" {...trait}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);
const Cible = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...trait}>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);
const Coche = ({ taille = 12 }: { taille?: number }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" {...trait} strokeWidth={2.2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const Surtitre = ({ children }: { children: React.ReactNode }) => <div className="t-surtitre text-muted">{children}</div>;

export default function EtapeLieu({
  lieu,
  onChoisir,
  types,
  typeLieu,
  onType,
  meteo,
}: {
  lieu: string;
  /** Choisir une destination : `ville` porte les coordonnées (null pour une saisie libre), `libelle` est ce qui s'affiche et s'enregistre. */
  onChoisir: (ville: VilleSuggeree | null, libelle: string) => void;
  /** Les types de lieu proposés, « Autre » compris — vide quand la question ne se pose pas pour cette occasion. */
  types: string[];
  typeLieu: string | null;
  onType: (t: string | null) => void;
  meteo: MeteoEtapeLieu;
}) {
  const [requete, setRequete] = useState("");
  const [edition, setEdition] = useState(false);
  /** La réponse de l'autocomplétion, avec la saisie à laquelle elle répond : `liste === null` = pas d'autocomplétion ici (démo, réseau). */
  const [reponse, setReponse] = useState<{ q: string; liste: VilleSuggeree[] | null } | null>(null);
  const [recentes, setRecentes] = useState<VilleRecente[]>(() => chargerRecentes());
  const [position, setPosition] = useState<"repos" | "encours">("repos");
  const champ = useRef<HTMLInputElement>(null);

  const q = requete.trim();
  useEffect(() => {
    if (q.length < 2) return;
    let annule = false;
    // 280 ms après la dernière frappe ; la réponse d'une recherche périmée est jetée (« Par » après « Paris »).
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((liste) => {
          if (!annule) setReponse({ q, liste });
        })
        .catch(() => {
          if (!annule) setReponse({ q, liste: null });
        });
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [q]);

  const choisir = (v: VilleSuggeree, libelle: string) => {
    const r = ajouterRecente(recentes, { ...v, libelle });
    setRecentes(r);
    garderRecentes(r);
    onChoisir(v, libelle);
    setEdition(false);
    setRequete("");
    setReponse(null);
  };

  const utiliserPosition = async () => {
    setPosition("encours");
    try {
      // La permission du système n'est demandée qu'ici, après le tap — jamais à l'ouverture de l'écran. Un refus ne dit rien :
      // la recherche reste là.
      const pos = await getBrowserPosition();
      if (!pos) return;
      const v = await fetchVilleParPosition(pos.coords.latitude, pos.coords.longitude);
      if (v) choisir(v, libelleDestination(v));
    } finally {
      setPosition("repos");
    }
  };

  const carte = lieu.trim() !== "" && !edition;
  const enAttente = q.length >= 2 && reponse?.q !== q;
  const resultats = reponse && reponse.q === q && reponse.liste ? presenterResultats(reponse.liste) : null;
  const nomsRecents = recentes.map((r) => r.name);

  return (
    <>
      {carte ? (
        <div className="mt-5">
          <Surtitre>Destination sélectionnée</Surtitre>
          <div className="mt-[10px] flex items-center gap-[10px] rounded-bloc border border-border bg-card px-[14px]" style={{ minHeight: 56 }}>
            <span className="flex-shrink-0 text-terracotta-deep"><Epingle /></span>
            <span className="flex-1 min-w-0 font-serif text-[17px] text-ink truncate">{lieu}</span>
            <button
              onClick={() => {
                setEdition(true);
                setTimeout(() => champ.current?.focus(), 0);
              }}
              className="t-lien text-terracotta-deep cursor-pointer flex-shrink-0"
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label={`Modifier la destination : ${lieu}`}
            >
              Modifier
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-[10px] rounded-bloc border border-border bg-card px-[14px] focus-within:border-terracotta" style={{ minHeight: 52 }}>
            <span aria-hidden="true" className="flex-shrink-0 text-placeholder"><Loupe /></span>
            <input
              ref={champ}
              className="capin flex-1 min-w-0 bg-transparent border-none text-[14px] font-medium text-ink"
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              // Le clavier virtuel s'ouvre : le champ remonte, la liste garde sa place dessous.
              onFocus={(e) => {
                try {
                  e.currentTarget.scrollIntoView({ block: "start", behavior: "smooth" });
                } catch {
                  // sans effet : la page reste où elle est
                }
              }}
              placeholder="Rechercher une ville ou un pays"
              aria-label="Rechercher une ville ou un pays"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="search"
            />
            {requete && (
              <button
                onClick={() => {
                  setRequete("");
                  setReponse(null);
                  champ.current?.focus();
                }}
                aria-label="Effacer la recherche"
                className="flex-shrink-0 flex items-center justify-center text-muted cursor-pointer"
                style={{ width: 44, height: 44, marginRight: -10 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </div>

          {q.length >= 2 ? (
            // La liste : un état léger pendant la recherche (jamais l'écran bloqué), puis les villes, ou « Aucune ville trouvée ».
            <div className="mt-2" aria-live="polite">
              {enAttente ? (
                <div className="px-[4px] py-[14px] text-[13px] text-muted">Recherche…</div>
              ) : reponse?.liste === null ? (
                // Pas d'autocomplétion (mode démo, réseau) : la saisie libre reste valable, comme avant.
                <button
                  onClick={() => {
                    onChoisir(null, q);
                    setEdition(false);
                    setRequete("");
                    setReponse(null);
                  }}
                  className="w-full flex items-center gap-[12px] text-left rounded-bloc border border-border bg-card px-[14px] cursor-pointer"
                  style={{ minHeight: 56 }}
                >
                  <span className="flex-shrink-0 text-muted"><Epingle /></span>
                  <span className="flex-1 min-w-0 text-[14px] text-ink truncate">Utiliser « {q} »</span>
                </button>
              ) : resultats && resultats.length === 0 ? (
                <div className="px-[4px] py-[14px]">
                  <div className="text-[14px] text-ink">Aucune ville trouvée</div>
                  <div className="text-[12px] text-muted mt-[2px]">Vérifie l&apos;orthographe ou essaie une autre ville.</div>
                </div>
              ) : (
                <ul className="flex flex-col rounded-bloc border border-border bg-card overflow-hidden" aria-label="Villes proposées">
                  {(resultats ?? []).map((r) => (
                    <li key={`${r.ville.lat},${r.ville.lon}`} className="border-b border-divider last:border-b-0">
                      <button
                        onClick={() => choisir(r.ville, r.libelle)}
                        className="w-full flex items-center gap-[12px] text-left px-[14px] cursor-pointer"
                        style={{ minHeight: 56 }}
                        aria-label={r.libelle}
                      >
                        <span aria-hidden="true" className="flex-shrink-0 text-muted"><Epingle /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] text-ink font-medium truncate">{r.principal}</span>
                          {r.secondaire && <span className="block text-[12px] text-muted truncate">{r.secondaire}</span>}
                        </span>
                        <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0">›</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={utiliserPosition}
                disabled={position === "encours"}
                className="mt-3 inline-flex items-center gap-[8px] text-[13px] text-terracotta-deep cursor-pointer"
                style={{ minHeight: 44 }}
              >
                <Cible />
                {position === "encours" ? "Je cherche ta position…" : "Utiliser ma position actuelle"}
              </button>
              {/* Première utilisation : aucune section vide. */}
              {recentes.length > 0 && (
                <div className="mt-4">
                  <Surtitre>Villes récentes</Surtitre>
                  <div className="flex flex-wrap gap-[8px] mt-[10px]">
                    {recentes.map((r, i) => (
                      <button
                        key={`${r.lat},${r.lon}`}
                        onClick={() => choisir(r, r.libelle)}
                        aria-label={r.libelle}
                        className="rounded-full border border-border bg-card px-[14px] text-[13px] text-ink cursor-pointer active:opacity-80"
                        style={{ minHeight: 44 }}
                      >
                        {nomsRecents.filter((n) => n === r.name).length > 1 ? r.libelle : r.name}
                        <span className="sr-only">{i === 0 ? " (la plus récente)" : ""}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <MeteoDuLieu meteo={meteo} />

      {types.length > 0 && (
        <div className="mt-6 pt-5 border-t border-divider">
          <Surtitre>Le type de lieu · Facultatif</Surtitre>
          <div className="text-[12px] text-muted leading-[1.45] mt-[4px]">Cela nous aide à affiner ta tenue.</div>
          <div className="grid grid-cols-3 gap-[10px] mt-3" role="group" aria-label="Type de lieu">
            {types.map((t) => {
              const actif = typeLieu === t;
              return (
                <button
                  key={t}
                  onClick={() => onType(actif ? null : t)}
                  aria-pressed={actif}
                  // Le contour fait toujours 2 px, transparent au repos : la carte ne change jamais de taille à la sélection.
                  className="relative flex flex-col items-center justify-center gap-[6px] rounded-tuile px-2 py-3 text-center cursor-pointer bg-card transition-colors"
                  style={{ minHeight: 76, border: `2px solid ${actif ? "var(--color-terracotta-deep)" : "var(--color-border)"}` }}
                >
                  <span className={actif ? "text-terracotta-deep" : "text-muted-3"}><IconeTuile nom={ICONE_LIEU[t] ?? "maison"} /></span>
                  <span className={`text-[12px] leading-[1.2] ${actif ? "text-ink font-semibold" : "text-ink"}`}>{t}</span>
                  {actif && (
                    <span aria-hidden="true" className="absolute top-[6px] right-[6px] w-[16px] h-[16px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center">
                      <Coche taille={10} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/** La météo du lieu à la date choisie : la prévision réelle, ou ce qui manque, dit simplement. Jamais une température estimée. */
function MeteoDuLieu({ meteo }: { meteo: MeteoEtapeLieu }) {
  if (meteo.kind === "sansLieu") return null;
  if (meteo.kind === "ok") {
    return (
      <div className="mt-4" aria-live="polite">
        <div className="rounded-bloc border border-border bg-card px-[14px] py-[12px] flex items-center gap-[12px]">
          <span className="text-terracotta-deep flex-shrink-0">
            <IconeTuile nom={/soleil|dégagé|ensoleill/i.test(meteo.label) ? "apresmidi" : "nuage"} taille={26} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-serif text-[20px] text-ink leading-[1.2]">
              {meteo.tempMin === meteo.tempMax ? `${meteo.temp}°` : `${meteo.tempMin}° — ${meteo.tempMax}°`}
            </span>
            <span className="block text-[12px] text-muted-3 mt-[1px]">Prévisions pour le jour sélectionné · {meteo.label}</span>
          </span>
        </div>
        <div className="mt-2 inline-flex items-center gap-[7px] rounded-full px-[12px] py-[6px] text-[12px] text-muted-3" style={{ background: "var(--color-warm-bg)" }}>
          <span className="text-terracotta-deep"><Coche /></span>
          La météo sera prise en compte pour ta tenue.
        </div>
      </div>
    );
  }
  if (meteo.kind === "habituelle") {
    return (
      <div className="mt-4" aria-live="polite">
        <div className="rounded-bloc border border-border bg-card px-[14px] py-[12px]">
          <div className="font-serif text-[20px] text-ink leading-[1.2]">
            {meteo.tempMin === meteo.tempMax ? `${meteo.tempMin}°` : `${meteo.tempMin}° — ${meteo.tempMax}°`}
          </div>
          <div className="text-[12px] text-muted-3 mt-[1px]">Températures habituelles à cette date · la prévision sera disponible plus près du jour.</div>
        </div>
        <div className="mt-2 inline-flex items-center gap-[7px] rounded-full px-[12px] py-[6px] text-[12px] text-muted-3" style={{ background: "var(--color-warm-bg)" }}>
          <span className="text-terracotta-deep"><Coche /></span>
          Ces températures habituelles seront prises en compte.
        </div>
      </div>
    );
  }
  const texte =
    meteo.kind === "encours"
      ? "Je regarde la météo…"
      : meteo.kind === "loin"
        ? "La météo sera disponible plus près de la date."
        : meteo.kind === "indispo"
          ? "Les prévisions ne sont pas disponibles pour le moment."
          : "La météo s'ajoutera quand tu auras choisi la date.";
  return (
    <div className="mt-4 text-[13px] text-muted-3 leading-[1.45]" aria-live="polite">
      {texte}
    </div>
  );
}
