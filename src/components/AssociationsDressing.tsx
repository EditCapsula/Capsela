"use client";

import { VisuelPiece } from "@/components/CarteLook";
import { OutfitComposition } from "@/components/OutfitComposition";
import { OCC_LABELS } from "@/lib/data";
import { provenanceLook } from "@/lib/ideesLooks";
import { titreEditorialOccasion } from "@/lib/logic";
import type { Item, OccasionKey } from "@/lib/types";

/**
 * « TON DRESSING PEUT DÉJÀ FAIRE PLUS » — LES LOOKS (01/10/2026, brief « optimisation
 * UX du bloc »). Les trois tenues du moteur deviennent trois cartes de looks, et
 * plus une grande image suivie de vignettes : chaque carte est une TENUE
 * COMPLÈTE, composée de pièces réelles du dressing (la planche des heros Tenue
 * et Accueil, pièces entières sur aplat neutre — jamais une photo
 * d'inspiration), nommée par son occasion, avec la phrase éditoriale que le
 * moteur donne déjà à cette occasion (titreEditorialOccasion), et son propre
 * « Voir le look → ». Aucun numéro : la carte se reconnaît à son contenu.
 *
 * Trois cartes côte à côte, comme la maquette fournie le 01/10/2026 (une première
 * version en carrousel a été écartée) : planche, occasion en serif, phrase
 * éditoriale en retrait, bouton « Voir le look → » plein. Moins de trois
 * tenues : les cartes se partagent la largeur.
 *
 * « Autres idées avec tes pièces » reste en retrait : de petites mosaïques, un
 * libellé muet, un lien. Rien ici ne choisit une pièce ni une occasion — les
 * tenues arrivent toutes composées (WardrobeScreen.tenuesMoteur).
 */

export interface TenueIdee {
  occasion: OccasionKey;
  pieces: Item[];
}

function CarteLookIdee({ tenue, dressing, onOuvrir }: { tenue: TenueIdee; dressing: Item[]; onOuvrir: (t: TenueIdee) => void }) {
  const { suggestions } = provenanceLook(tenue.pieces.map((p) => p.id), dressing);
  const occasion = OCC_LABELS[tenue.occasion];
  const phrase = titreEditorialOccasion(tenue.occasion);
  return (
    <button
      type="button"
      onClick={() => onOuvrir(tenue)}
      aria-label={`Voir le look ${occasion} : ${phrase}`}
      className="min-w-0 text-left cursor-pointer active:opacity-90 rounded-[18px] p-[6px] flex flex-col outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      style={{ background: "var(--color-cream)" }}
    >
      <div className="rounded-[13px] overflow-hidden w-full" style={{ aspectRatio: "3 / 4", background: "var(--color-warm-bg)" }}>
        <OutfitComposition items={tenue.pieces} variant="planche" label={`Composition du look : ${tenue.pieces.map((p) => p.name).join(", ")}`} />
      </div>
      <div className="px-[3px] pt-[9px] flex-1">
        <div className="font-serif text-[13px] leading-[1.2] text-ink">{occasion}</div>
        <div className="text-[11px] leading-[1.35] text-muted mt-[3px]">{phrase}</div>
        {/* Une tenue complétée par la capsule le dit : « 1 suggestion » — jamais le silence sur ce qui n'est pas dans le dressing. */}
        {suggestions > 0 && (
          <div className="text-[10px] leading-[1.3] text-terracotta mt-[5px]">
            ✦ {suggestions} suggestion{suggestions > 1 ? "s" : ""}
          </div>
        )}
      </div>
      <span className="mt-[9px] w-full rounded-full bg-terracotta text-cream text-[11px] py-[8px] text-center whitespace-nowrap">Voir le look →</span>
    </button>
  );
}

export default function AssociationsDressing({
  tenues,
  autres,
  dressing,
  onOuvrir,
  onVoirToutes,
}: {
  /** Les associations nouvelles du moteur — ce que dit la phrase « Capsela a trouvé N nouvelles associations ». */
  tenues: TenueIdee[];
  /** D'autres tenues du même moteur, mises en retrait ; vide : la section ne s'affiche pas. */
  autres: TenueIdee[];
  /** Le dressing réel : ce qui n'y est pas, dans une tenue, est une suggestion de la capsule. */
  dressing: Item[];
  onOuvrir: (t: TenueIdee) => void;
  onVoirToutes: () => void;
}) {
  return (
    <div className="mt-5">
      {/* Trois cartes côte à côte (maquette du 01/10/2026) : la rangée déborde un peu
          de l'encart (-mx-3) pour que chacune garde une largeur lisible dès 360 px. */}
      <div className="grid gap-[8px] -mx-3" style={{ gridTemplateColumns: `repeat(${Math.min(tenues.length, 3)}, minmax(0, 1fr))` }} data-associations>
        {tenues.map((t) => (
          <CarteLookIdee key={t.occasion} tenue={t} dressing={dressing} onOuvrir={onOuvrir} />
        ))}
      </div>

      {autres.length > 0 && (
        <div className="mt-[22px] pt-[14px] border-t border-border">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">Autres idées avec tes pièces</span>
            <button
              type="button"
              onClick={onVoirToutes}
              className="inline-flex items-center text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px] whitespace-nowrap"
            >
              Voir toutes les idées →
            </button>
          </div>
          <div className="flex gap-[8px] mt-[10px]">
            {autres.map((t) => (
              <button
                key={t.occasion}
                type="button"
                onClick={() => onOuvrir(t)}
                aria-label={`Voir la tenue ${OCC_LABELS[t.occasion]} proposée par Capsela`}
                className="flex-none grid grid-cols-2 gap-[3px] p-[4px] rounded-[12px] cursor-pointer active:opacity-80"
                style={{ width: 52, background: "var(--color-cream)" }}
              >
                {Array.from({ length: 4 }, (_, i) => t.pieces[i]).map((p, i) => (
                  <span key={p ? p.id : `vide-${i}`} className="block" style={{ aspectRatio: "1" }}>
                    {p ? <VisuelPiece piece={p} alt="" radius={6} /> : null}
                  </span>
                ))}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
