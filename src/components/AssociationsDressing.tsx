"use client";

import { VisuelPiece } from "@/components/CarteLook";
import { OutfitComposition } from "@/components/OutfitComposition";
import { OCC_LABELS } from "@/lib/data";
import { provenanceLook } from "@/lib/ideesLooks";
import { titreEditorialOccasion } from "@/lib/logic";
import type { Item, OccasionKey } from "@/lib/types";

/**
 * « TON DRESSING PEUT DÉJÀ FAIRE PLUS » — LES LOOKS (01/10/2026, brief « refonte
 * UX/UI du bloc », troisième version). La taille du bloc ne dépend plus du nombre
 * de tenues : UNE tenue prend toute la largeur (une grande carte), plusieurs
 * forment un carrousel horizontal dont la carte suivante dépasse. Chaque carte est
 * une tenue complète — la planche de ses pièces réelles en 4/3, l'occasion, la
 * phrase éditoriale que le moteur donne déjà à cette occasion
 * (titreEditorialOccasion), « ✦ N suggestion(s) » si la capsule en complète, et son
 * propre « Voir le look → ». Aucun numéro : la carte se reconnaît à son contenu.
 *
 * « Autres idées avec tes pièces » reste en retrait, séparée d'un filet : de
 * petites mosaïques d'autres tenues (jamais celles des cartes), un libellé muet,
 * un lien. Rien ici ne choisit une pièce ni une occasion — les tenues arrivent
 * toutes composées (WardrobeScreen.tenuesMoteur).
 */

export interface TenueIdee {
  occasion: OccasionKey;
  pieces: Item[];
}

function CarteLookIdee({
  tenue,
  dressing,
  largeur,
  onOuvrir,
}: {
  tenue: TenueIdee;
  dressing: Item[];
  /** « pleine » : seule carte, toute la largeur ; « carrousel » : ~84 % de la largeur, la suivante dépasse. */
  largeur: "pleine" | "carrousel";
  onOuvrir: (t: TenueIdee) => void;
}) {
  const { suggestions } = provenanceLook(tenue.pieces.map((p) => p.id), dressing);
  const occasion = OCC_LABELS[tenue.occasion];
  const phrase = titreEditorialOccasion(tenue.occasion);
  return (
    <button
      type="button"
      onClick={() => onOuvrir(tenue)}
      aria-label={`Voir le look ${occasion} : ${phrase}`}
      className="text-left cursor-pointer active:opacity-90 rounded-[20px] p-[8px] flex flex-col outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      style={{
        background: "var(--color-cream)",
        flex: largeur === "pleine" ? "1 1 100%" : "0 0 84%",
        minWidth: 0,
        scrollSnapAlign: "start",
      }}
    >
      {/* L'image est l'élément principal : une planche de pièces réelles, en 4/3, jamais une vignette. */}
      <div className="rounded-[14px] overflow-hidden w-full" style={{ aspectRatio: "4 / 3", background: "var(--color-warm-bg)" }}>
        <OutfitComposition items={tenue.pieces} variant="planche" label={`Composition du look : ${tenue.pieces.map((p) => p.name).join(", ")}`} />
      </div>
      <div className="px-[6px] pt-[12px] pb-[6px] flex flex-wrap items-end justify-between gap-x-[12px] gap-y-[10px]">
        <div className="min-w-0" style={{ flex: "1 1 150px" }}>
          <div className="t-label text-muted">{occasion}</div>
          <div className="t-titre-carte text-ink mt-[4px]" style={{ textWrap: "balance" }}>
            {phrase}
          </div>
          {/* Une tenue complétée par la capsule le dit : « 1 suggestion » — jamais le silence sur ce qui n'est pas dans le dressing. */}
          {suggestions > 0 && (
            <div className="text-[11px] leading-[1.3] text-terracotta mt-[5px]">
              ✦ {suggestions} suggestion{suggestions > 1 ? "s" : ""}
            </div>
          )}
        </div>
        <span className="flex-shrink-0 rounded-full bg-terracotta text-cream text-[12px] px-[14px] py-[9px] whitespace-nowrap">Voir le look →</span>
      </div>
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
      {/* Une seule tenue : toute la largeur, une grande carte éditoriale. Plusieurs : un
          carrousel, la première carte pleinement visible et la suivante qui dépasse
          (~84 % + aperçu) — le défilement se devine, rien n'est numéroté. */}
      <div
        className="scrollarea flex gap-[12px] overflow-x-auto -mx-5 px-5 pb-[2px]"
        style={{ scrollPaddingInline: 20, scrollSnapType: tenues.length > 1 ? "x mandatory" : undefined, overflowX: tenues.length > 1 ? "auto" : "hidden" }}
        data-associations
      >
        {tenues.map((t) => (
          <CarteLookIdee key={t.occasion} tenue={t} dressing={dressing} largeur={tenues.length > 1 ? "carrousel" : "pleine"} onOuvrir={onOuvrir} />
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
