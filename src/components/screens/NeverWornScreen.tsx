"use client";

import { useMemo } from "react";
import { CATLABEL } from "@/lib/data";
import { suggestName } from "@/lib/attributes";
import { resolveItemImage } from "@/lib/catalogImages";
import { currentSeasonKey } from "@/lib/capsule";
import { participePorte, type ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { deLaSaisonEnCours, neverWornItems, inactivityInfo } from "@/lib/selectors";
import type { Item } from "@/lib/types";
import BoutonRetour from "@/components/BoutonRetour";
import { MosaiquePieces, VisuelPiece } from "@/components/CarteLook";
import { calculerIdeesTenues } from "@/components/screens/ItemOutfitsScreen";

/*
 * « JAMAIS PORTÉES » — refonte éditoriale du 26/09/2026 : non plus « voici
 * ce que tu n'as pas porté », mais « voici comment le porter ».
 *
 *   · en-tête du Journal (surtitre + titre d'écran), puis un encart de
 *     synthèse au grand chiffre ;
 *   · une carte verticale par pièce, la photo d'abord (entière, jamais
 *     recadrée), la première plus grande que les suivantes ;
 *   · « ✦ N tenues possibles » et leurs aperçus : les idées que calcule
 *     l'écran « Les idées de tenues » (calculerIdeesTenues, mêmes
 *     paramètres), transmises telles quelles au clic — le nombre annoncé est
 *     celui que l'on trouve en arrivant. Aucune idée : ni nombre ni aperçu,
 *     le bouton reste ;
 *   · SAISON : les pièces de la saison en cours d'abord (même règle que la
 *     capsule, deLaSaisonEnCours). Les autres ne disparaissent pas — le
 *     Dressing annonce le nombre total et la fiche d'une pièce « qui dort »
 *     mène ici — elles attendent en bas, « Pour la saison prochaine ».
 *
 * « Ajoutée il y a… » n'est plus affiché (la date d'ajout reste dans le
 * modèle, lue par inactivityInfo). Le retour ramène où il ramenait.
 */

/** Aperçus visibles avant « +N ». */
const APERCUS_MAX = 3;

/**
 * Nom affiché sur la card (recette 25/08/2026) — un nom trop générique
 * (juste le libellé de catégorie, ex. "Robe") est remplacé par le nom
 * descriptif recomposé (suggestName), jamais par le nom brut s'il n'apporte
 * aucune information au-delà de la catégorie déjà affichée juste en dessous.
 */
function displayName(it: Item): string {
  const trimmed = it.name?.trim() ?? "";
  if (trimmed && trimmed.toLowerCase() !== CATLABEL[it.cat].toLowerCase()) return trimmed;
  return suggestName(it.cat, it.subtype, it.matiere, it.color);
}

/** « Jamais porté(e)(s) », accordé au genre et au nombre de la pièce (participePorte). */
const jamaisPorte = (it: Item) => "Jamais " + participePorte(it);

function CartePiece({
  item,
  idees,
  pool,
  premiere,
  onOuvrir,
  onTenues,
}: {
  item: Item;
  idees: ItemOutfitVariation[];
  pool: Item[];
  premiere: boolean;
  onOuvrir: () => void;
  onTenues: () => void;
}) {
  const info = inactivityInfo(item);
  const sansPhoto = resolveItemImage(item).kind === "placeholder";
  const nom = displayName(item);
  const apercus = idees.slice(0, APERCUS_MAX).map((v) => v.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p)));
  const reste = idees.length - apercus.length;
  return (
    <article className="motion-safe:animate-[capsule-apparition_320ms_ease-out_both]" aria-label={nom}>
      <button type="button" onClick={onOuvrir} className="relative block w-full cursor-pointer active:opacity-90" aria-label={`${nom}, voir la pièce`}>
        {/* La photo entière (contain) : une pièce mal cadrée n'est jamais
            coupée. La première carte est plus haute que les suivantes. */}
        {sansPhoto ? (
          // Sans photo, l'aplat de sa couleur (même repli que partout) —
          // en pastille : agrandi à toute la largeur, ce n'était qu'un mur
          // de couleur.
          <div className="w-full rounded-[22px] flex items-center justify-center" style={{ aspectRatio: "2 / 1", background: "var(--color-warm-bg)" }}>
            <span className="block w-[34%]" style={{ aspectRatio: "4 / 5" }}>
              <VisuelPiece piece={item} alt="" radius={14} />
            </span>
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-[22px] p-3" style={{ aspectRatio: premiere ? "1 / 1" : "5 / 4", background: "var(--color-warm-bg)" }}>
            <VisuelPiece piece={item} alt="" radius={14} />
          </div>
        )}
        <span className="absolute top-[12px] left-[12px] t-pastille text-terracotta bg-card rounded-full px-[9px] py-[4px]">{jamaisPorte(item)}</span>
      </button>

      <div className="px-[2px]">
        <div className={(premiere ? "t-titre-section" : "t-titre-carte") + " text-ink mt-[14px]"}>{nom}</div>
        <div className="text-[12px] text-muted mt-[4px]">
          {CATLABEL[item.cat]} · {item.color}
        </div>

        {idees.length > 0 && (
          <>
            <div className="flex gap-[8px] mt-[14px]" aria-hidden="true">
              {apercus.map((pieces, i) => (
                <button key={i} type="button" tabIndex={-1} onClick={onTenues} className="flex-none w-[68px] cursor-pointer active:opacity-80">
                  <MosaiquePieces pieces={pieces} />
                </button>
              ))}
              {reste > 0 && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={onTenues}
                  className="flex-none w-[68px] rounded-[20px] flex items-center justify-center text-[13px] text-terracotta cursor-pointer"
                  style={{ aspectRatio: "1", background: "var(--color-warm-bg)" }}
                >
                  +{reste}
                </button>
              )}
            </div>
            <div className="text-[13px] text-ink mt-[12px] flex items-center gap-[7px]">
              <span aria-hidden="true" className="text-terracotta text-[12px]">
                ✦
              </span>
              {idees.length} {idees.length > 1 ? "tenues possibles" : "tenue possible"}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onTenues}
          className="mt-[14px] w-full min-h-[48px] rounded-full bg-terracotta-deep active:bg-terracotta-hover active:scale-[.99] transition-transform text-cream t-cta cursor-pointer flex items-center justify-center gap-[8px] px-4"
          aria-label={`Découvrir les tenues avec ${nom}`}
        >
          Découvrir les tenues
          <span aria-hidden="true">→</span>
        </button>

        {/* Le second geste d'avant, gardé en lien : une pièce qui dort depuis
            une saison peut aussi partir (fiche pièce → revente). */}
        {info.inactive && (
          <button type="button" onClick={onOuvrir} className="mt-[6px] w-full min-h-[44px] text-[12px] text-muted cursor-pointer">
            Envisager de la revendre
          </button>
        )}
      </div>
    </article>
  );
}

export default function NeverWornScreen() {
  const { state, wardrobePool, actions } = useCapsela();
  const { profile } = useAuth();
  const neverWorn = neverWornItems(state.items);
  const enSaison = neverWorn.filter((it) => deLaSaisonEnCours(it));
  const horsSaison = neverWorn.filter((it) => !deLaSaisonEnCours(it));

  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);
  const idsEnSaison = enSaison.map((it) => it.id).join(",");
  // Une passe par pièce de saison (≈ 40 ms chacune), mémoïsée : les idées ne
  // changent pas d'un rendu à l'autre, et ce sont elles qui partent au clic.
  const idees = useMemo(() => {
    const m = new Map<number, ItemOutfitVariation[]>();
    for (const it of enSaison) m.set(it.id, calculerIdeesTenues(it, wardrobePool, capsuleSeason, preferredHexes, profile.gender));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsEnSaison, wardrobePool, capsuleSeason, preferredHexes, profile.gender]);
  const poolApercus = useMemo(() => [...wardrobePool, ...state.items], [wardrobePool, state.items]);

  const n = neverWorn.length;
  // Hors saison = l'autre moitié de l'année (« Toutes saisons » est toujours de saison).
  const ete = horsSaison[0]?.season === "Printemps / Été";

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <div className="mt-[10px]">
        <BoutonRetour onClick={actions.goTenues} label="Revenir à la tenue du jour" />
      </div>

      <div className="t-surtitre text-muted mt-[18px]">Jamais portées</div>

      {n === 0 ? (
        <>
          <div className="t-titre-ecran text-ink mt-[6px]">
            Tout est <span className="italic text-terracotta">porté</span>
          </div>
          <div className="t-chapeau text-muted-3 mt-[10px]">
            {state.items.length > 0
              ? "Ton dressing ne contient aucune pièce oubliée. Capsela n'a rien trouvé à te faire redécouvrir pour le moment."
              : "Les pièces de ton dressing que tu n'as pas encore portées apparaîtront ici."}
          </div>
          <button
            type="button"
            onClick={actions.goWardrobe}
            className="mt-6 w-full min-h-[48px] rounded-full bg-terracotta-deep active:bg-terracotta-hover text-cream t-cta cursor-pointer flex items-center justify-center gap-[8px] px-4"
          >
            Continuer à explorer mon dressing
            <span aria-hidden="true">→</span>
          </button>
        </>
      ) : (
        <>
          <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
            Des pièces qui attendent <span className="italic text-terracotta">leur moment</span>
          </div>

          {/* SYNTHÈSE — le chiffre en grand, dans l'esprit d'une page de
              magazine ; toutes les pièces jamais portées, le même nombre que
              le Dressing. */}
          <div className="mt-5 bg-warm-bg border border-warm-border rounded-[20px] px-5 py-4 flex items-center gap-4">
            <span className="t-display text-terracotta flex-shrink-0" aria-hidden="true">
              {String(n).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="t-surtitre text-terracotta">
                <span className="sr-only">{n} </span>
                {n > 1 ? "Pièces à redécouvrir" : "Pièce à redécouvrir"}
              </div>
              <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[4px]">
                {n > 1
                  ? "Capsela a repéré ces pièces encore jamais portées. Découvre comment les intégrer facilement à tes tenues."
                  : "Capsela a repéré cette pièce encore jamais portée. Découvre comment l'intégrer facilement à tes tenues."}
              </div>
            </div>
          </div>

          {enSaison.length > 0 ? (
            <div className="flex flex-col gap-10 mt-8">
              {enSaison.map((it, i) => (
                <CartePiece
                  key={it.id}
                  item={it}
                  idees={idees.get(it.id) ?? []}
                  pool={poolApercus}
                  premiere={i === 0}
                  onOuvrir={() => actions.openItem(it.id, false)}
                  onTenues={() => actions.openItemOutfits(it.id, false, idees.get(it.id))}
                />
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-muted-3 leading-[1.5] mt-6">Aucune pièce de cette saison n&apos;attend son tour pour l&apos;instant.</div>
          )}

          {horsSaison.length > 0 && (
            <section className="mt-10" aria-labelledby="jamais-saison-prochaine">
              <div id="jamais-saison-prochaine" className="t-surtitre text-muted">
                Pour la saison prochaine
              </div>
              <div className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]">
                {horsSaison.length > 1 ? "Elles se portent" : "Elle se porte"} {ete ? "au printemps et en été" : "en automne et en hiver"} :{" "}
                {horsSaison.length > 1 ? "elles passeront" : "elle passera"} en tête de cette page {ete ? "au printemps" : "à l'automne"}.
              </div>
              <ul className="scrollarea flex gap-[10px] overflow-x-auto mt-3 -mx-6 px-6 pb-[2px]">
                {horsSaison.map((it) => (
                  <li key={it.id} className="flex-none w-[96px]">
                    <button type="button" onClick={() => actions.openItem(it.id, false)} className="w-full text-left cursor-pointer active:opacity-80" aria-label={`${displayName(it)}, voir la pièce`}>
                      <span className="block w-full rounded-[14px] p-[6px]" style={{ aspectRatio: "4 / 5", background: "var(--color-warm-bg)" }}>
                        <VisuelPiece piece={it} alt="" radius={10} />
                      </span>
                      <span className="block text-[12px] text-ink mt-[6px] leading-[1.25] line-clamp-2">{displayName(it)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
