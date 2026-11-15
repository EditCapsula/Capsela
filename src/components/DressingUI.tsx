"use client";

import type { ReactNode } from "react";
import Card from "@/components/Card";
import SegmentedControl from "@/components/SegmentedControl";

/*
 * LES BRIQUES DES DEUX ONGLETS DU DRESSING (15/11/2026, brief « Refonte UX/UI – Page Dressing »). Mon dressing et Mes looks partagent
 * la même structure — synthèse compacte, recherche, puces, ligne de résultats et tri — et donc les mêmes composants : un seul dessin,
 * des jetons existants (crème, terracotta, encre, filets), aucune couleur nouvelle. Les anciens éléments du Dressing (barre de
 * recherche, puces de catégorie, bouton de tri) en sont repris tels quels, avec leurs mesures (44 px de cible, 40 px de puce).
 */

const ICONE_CINTRE = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7.2a1.9 1.9 0 1 1 1.9-1.9c0 1-.7 1.5-1.4 1.9-.4.2-.5.5-.5.9v.9" />
      <path d="M12 9 3.6 15.2c-.8.6-.4 1.8.6 1.8h15.6c1 0 1.4-1.2.6-1.8L12 9z" />
    </g>
  </svg>
);
const ICONE_COUCHES = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </g>
  </svg>
);

export type OngletDressing = "wardrobe" | "looks";

/** Les deux onglets, sous le titre : la navigation segmentée en pastilles (actif terracotta, inactif crème à filet), 40 px de haut. */
export function OngletsDressing({ actif, onChange }: { actif: OngletDressing; onChange: (o: OngletDressing) => void }) {
  return (
    <div className="mt-2">
      <SegmentedControl
        ariaLabel="Mon dressing ou Mes looks"
        variante="pastilles"
        segments={[
          { key: "wardrobe", label: "Mon dressing", icone: ICONE_CINTRE },
          { key: "looks", label: "Mes looks", icone: ICONE_COUCHES },
        ]}
        actif={actif}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * La synthèse compacte d'un onglet : le nombre (chiffres en Manrope) et son libellé à gauche, l'action en LIEN TEXTUEL à droite
 * (15/11/2026, demandé : « 14 pièces », plus de gros bouton terracotta, « + Ajouter une pièce » en lien aligné à droite du compteur).
 * Rien n'est jamais tronqué : sur un écran trop étroit pour les deux, le lien passe sous le compteur plutôt que de le couper.
 */
export function CarteSynthese({ nombre, libelle, action, onAction }: { nombre: ReactNode; libelle: string; action: string; onAction: () => void }) {
  return (
    <Card rayon="bloc" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 pl-4 pr-[6px] min-h-[52px]">
      <div className="flex items-baseline gap-[6px] whitespace-nowrap">
        <span className="text-[22px] leading-none font-semibold text-ink tabular-nums" style={{ fontFamily: "var(--font-chiffres)" }}>
          {nombre}
        </span>
        <span className="text-[13px] text-muted-3">{libelle}</span>
      </div>
      <button type="button" onClick={onAction} className="min-h-[44px] px-[10px] text-[13px] font-semibold text-terracotta-deep whitespace-nowrap cursor-pointer active:opacity-70">
        + {action}
      </button>
    </Card>
  );
}

/** La recherche, et à sa droite, facultatif, le bouton des filtres avancés (indépendant, avec son compteur de filtres actifs). */
export function BarreRecherche({
  valeur,
  onChange,
  placeholder,
  ariaLabel,
  filtres,
}: {
  valeur: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  filtres?: { actifs: number; onOuvrir: () => void };
}) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <label
        className="flex-1 min-w-0 flex items-center gap-[10px] h-[44px] pl-[14px] pr-[6px] rounded-full bg-card border"
        style={{ borderColor: valeur ? "var(--color-terracotta-deep)" : "var(--color-border)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted-3" style={{ display: "block" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="6" />
            <path d="M20 20l-4.5-4.5" />
          </g>
        </svg>
        <input
          type="search"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13.5px] font-medium text-ink placeholder:text-placeholder"
        />
        {valeur && (
          <button type="button" onClick={() => onChange("")} aria-label="Effacer la recherche" className="w-[34px] h-[34px] flex-shrink-0 rounded-full bg-warm-bg flex items-center justify-center cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-muted-3" style={{ display: "block" }}>
              <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </label>
      {filtres && (
        <button
          type="button"
          onClick={filtres.onOuvrir}
          aria-label={filtres.actifs ? `Filtres avancés, ${filtres.actifs} actif${filtres.actifs > 1 ? "s" : ""}` : "Filtres avancés"}
          className="relative flex-shrink-0 w-[44px] h-[44px] rounded-full bg-card border flex items-center justify-center text-ink cursor-pointer"
          style={{ borderColor: filtres.actifs ? "var(--color-terracotta-deep)" : "var(--color-border)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </g>
          </svg>
          {filtres.actifs > 0 && (
            <span className="absolute -top-[3px] -right-[3px] min-w-[18px] h-[18px] px-[4px] rounded-full bg-terracotta-deep text-cream text-[10px] font-semibold flex items-center justify-center tabular-nums">
              {filtres.actifs}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/** Les puces horizontales (catégories, filtres de looks) : le nombre de chaque puce à côté de son libellé. Défilent, jamais de débordement. */
export function Puces<K extends string | null>({ puces, actif, onChange, ariaLabel }: { puces: { id: K; libelle: string; n?: number }[]; actif: K; onChange: (k: K) => void; ariaLabel: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="scrollarea flex gap-2 overflow-x-auto py-3 -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
      {puces.map((c) => {
        const on = actif === c.id;
        return (
          <button
            key={c.id ?? "tout"}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(c.id)}
            className={
              "flex-shrink-0 h-[40px] px-[15px] rounded-full border text-[12.5px] font-medium whitespace-nowrap flex items-center gap-[6px] cursor-pointer " +
              (on ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")
            }
          >
            {c.libelle}
            {c.n != null && (
              <span className="text-[11.5px]" style={{ color: on ? "var(--color-warm-bg)" : "var(--color-muted)" }}>
                {c.n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type Tri = "recent" | "ancien" | "az";
const LIBELLES_TRI: Record<Tri, string> = { recent: "Récentes d'abord", ancien: "Anciennes d'abord", az: "A → Z" };
const SUIVANT: Record<Tri, Tri> = { recent: "ancien", ancien: "az", az: "recent" };

/** Le bouton de tri : un toucher passe au tri suivant (récentes, anciennes, A → Z) ; le libellé dit le tri en cours. */
export function BoutonTri({ tri, onChange, libelles }: { tri: Tri; onChange: (t: Tri) => void; libelles?: Partial<Record<Tri, string>> }) {
  const l = { ...LIBELLES_TRI, ...libelles };
  return (
    <button
      type="button"
      onClick={() => onChange(SUIVANT[tri])}
      aria-label={`Trier : ${l[tri]}. Toucher pour ${l[SUIVANT[tri]].toLowerCase()}`}
      className="h-[44px] flex items-center gap-[5px] text-[12px] font-semibold text-ink cursor-pointer flex-shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-muted-3" style={{ display: "block" }}>
        <path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {l[tri]}
    </button>
  );
}
