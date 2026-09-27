"use client";

import { useEffect, useMemo, useState } from "react";
import { CarteIdeeLook } from "@/components/CarteIdeeLook";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { contexteCapsule, currentSeasonKey, estDeSaison, representativeWeatherFor } from "@/lib/capsule";
import { enSaisons, saisonsDe } from "@/lib/saisons";
import { FAMILLES_LOOK, cleLook, decrireLooks, ideesDressingDAbord, ordonnerLooks, titreCommentPorter, type FamilleLook } from "@/lib/ideesLooks";
import type { ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, Item } from "@/lib/types";
import BoutonRetour from "@/components/BoutonRetour";

/**
 * Module "Les idées de tenues" (recette 19/08/2026, refonte UX/UI 22/08/2026,
 * renommage + saison/statut de possession 23/08/2026) — P0 : clic sur un
 * article de Capsule, pièce pivot ("anchor piece", identifiée par son
 * contour terracotta — jamais utilisé pour un autre état UI), combinaisons
 * regroupées par occasion, filtre, images existantes, CTA "Voir cette
 * tenue". Réutilise getOutfitsForItem (lui-même une réutilisation de
 * generateOutfit) — jamais un second moteur, jamais d'appel OpenAI à
 * l'ouverture — et OutfitComposition (variante "compact"), le même
 * composant de composition visuelle que la page Tenue ("hero") : un seul
 * moteur de layout, jamais deux qui divergent. Statut de possession dérivé
 * d'isCatalogId + suggestedExcluded (jamais du wardrobePool, qui masque une
 * pièce suggérée non possédée comblant une catégorie vide de la capsule par
 * défaut) ; badge saison strictement lu depuis capsuleSeasons (colonne
 * saison_capsule de vestiaire_universel), jamais déduit du type de pièce.
 *
 * REFONTE ÉDITORIALE DU 27/09/2026 (maquette « Comment porter … ? ») : titre
 * accordé à la pièce, pastilles Quotidien / Travail / Sortie, grandes cartes
 * (CarteIdeeLook) avec provenance explicite — pièces du dressing d'abord,
 * suggestions de la capsule seulement là où le dressing n'a rien —, trois
 * looks différenciés puis « Voir plus de looks ». Une carte ouvre le détail
 * du look (IdeeLookScreen) ; « Porter ce look » y reprend le parcours de
 * l'écran Tenue. Les dérivés sont purs et testés (ideesLooks.ts). Le badge de
 * saison et la phrase « Les pièces complémentaires viennent de ta capsule »
 * sont remplacés par la provenance de chaque look.
 */
/**
 * Les idées de tenues d'une pièce, telles que cet écran les calcule — sorti
 * le 26/09/2026 pour que « Jamais portées » annonce le même nombre, avec les
 * mêmes paramètres (pool, saison de capsule, météo représentative, palette,
 * genre). Le tirage restant aléatoire, les idées calculées là-bas sont
 * ensuite transmises ici (ideesTenuesPretes) plutôt que recalculées.
 */
export function calculerIdeesTenues(
  pivot: Item,
  wardrobePool: Item[],
  /** Le dressing réel (state.items) : ses pièces passent d'abord, cf. ideesDressingDAbord (27/09/2026). */
  dressing: Item[],
  capsuleSeason: CapsuleSeason,
  preferredHexes: string[],
  gender: "femme" | "homme" | null
): ItemOutfitVariation[] {
  return ideesDressingDAbord(pivot, wardrobePool, dressing, capsuleSeason, preferredHexes, gender);
}

export default function ItemOutfitsScreen() {
  const { state, wardrobePool, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const pretes = state.ideesTenuesPretes;
  // La pastille choisie survit à l'aller-retour vers le détail d'un look
  // (gardée avec les idées dans ideesTenuesPretes).
  const [famille, setFamille] = useState<FamilleLook | null>(pretes?.pivotId === state.activeId ? (pretes.famille ?? null) : null);
  const [toutVoir, setToutVoir] = useState(false);

  const pivot = wardrobePool.find((i) => i.id === state.activeId) || vestiairePool.find((i) => i.id === state.activeId);

  // La pièce pivot doit toujours être présente, même si sa catégorie est
  // par ailleurs pourvue par une pièce réelle dans wardrobePool (auquel
  // cas ce n'est pas exactement la même ligne que celle cliquée). Hooks
  // toujours appelés (jamais après un retour conditionnel) : le garde-fou
  // "pivot manquant" est interne, le retour null n'intervient qu'au rendu.
  const pool = useMemo(
    () => (!pivot ? [] : wardrobePool.some((i) => i.id === pivot.id) ? wardrobePool : [...wardrobePool, pivot]),
    [wardrobePool, pivot]
  );

  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);

  const variations = useMemo(
    // capsuleSeason transmis explicitement (correctif 29/08/2026) : le
    // référentiel saisonnier vient de la capsule affichée, jamais de la
    // température représentative — 16 °C au printemps basculait le bucket
    // météo en "Automne / Hiver" et écartait les pièces Printemps/Été de
    // leur propre capsule. La météo continue de gouverner la température.
    () =>
      !pivot
        ? []
        : pretes && pretes.pivotId === pivot.id
          ? pretes.variations
          : calculerIdeesTenues(pivot, wardrobePool, state.items, capsuleSeason, preferredHexes, profile.gender),
    [pivot, pretes, wardrobePool, state.items, preferredHexes, profile.gender, capsuleSeason]
  );

  // Génération à la demande du visuel de la pièce pivot (correctif 23/08/2026,
  // signalé : "Bomber oversize" resté sans photo sur cette page) — cet écran
  // n'avait jamais ce déclenchement, contrairement à PieceScreen/TenuesScreen,
  // qui l'ont déjà pour la même raison (aucune ligne vestiaire_universel pour
  // une pièce réelle du dressing, donc jamais de génération pour elle).
  useEffect(() => {
    if (!pivot || !isCatalogId(pivot.id)) return;
    if (
      resolveItemImage(pivot).kind === "placeholder" &&
      pivot.imageStatus !== "generating" &&
      pivot.imageStatus !== "error" &&
      pivot.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(pivot.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pivot?.id]);

  const looks = useMemo(() => ordonnerLooks(variations, state.items), [variations, state.items]);
  const insights = useMemo(() => (pivot ? decrireLooks(variations, pool, pivot.id) : new Map()), [variations, pool, pivot]);

  if (!pivot) return null;

  // Déjà au dressing = pas un id de catalogue (statique 1001+ ou
  // vestiaire_universel 100000+, cf. isCatalogId), ou déjà remplacée via
  // "J'ai déjà" (suggestedExcluded, alimenté par startReplace + saveItem).
  // Plus fiable que l'ancien !wardrobePool.some(...) : wardrobePool contient
  // aussi les pièces de la capsule par défaut qui comblent une catégorie
  // vide, où une pièce suggérée non possédée lirait alors à tort comme
  // "déjà au dressing".
  const alreadyOwned = !isCatalogId(pivot.id) || state.suggestedExcluded.includes(pivot.id);

  // Même critère que les idées elles-mêmes : la saison de la météo représentative de la capsule.
  // Une pièce qui porte ses quatre saisons (27/09/2026) est jugée comme le
  // moteur la juge ici, sur la saison de la capsule (contexteCapsule) — la
  // météo représentative du Printemps (14°) désignerait l'Automne.
  const horsSaison = pivot.saisons?.length
    ? !estDeSaison(pivot, contexteCapsule(capsuleSeason))
    : pivot.season !== "Toutes saisons" && !representativeWeatherFor(capsuleSeason).seasons.includes(pivot.season);

  // Une pastille n'existe que si elle a des looks : jamais de filtre vide.
  const familles = FAMILLES_LOOK.filter((f) => looks.some((l) => l.famille === f.cle));
  const familleActive = famille && familles.some((f) => f.cle === famille) ? famille : null;
  const filtres = familleActive ? looks.filter((l) => l.famille === familleActive) : looks;
  const visibles = toutVoir ? filtres : filtres.slice(0, 3);
  const piecesDe = (ids: number[]) => ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));

  const titre = titreCommentPorter(pivot, alreadyOwned);
  const DEBUT = "Comment porter ";

  const choisir = (f: FamilleLook | null) => {
    setFamille(f);
    setToutVoir(false);
  };
  const pastille = (actif: boolean) =>
    "flex-none rounded-full px-4 py-[9px] text-[12px] whitespace-nowrap cursor-pointer " +
    (actif ? "bg-terracotta active:bg-terracotta-hover text-cream" : "bg-card border border-border text-ink");

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <BoutonRetour onClick={() => actions.go(state.itemOutfitsReturn)} label="Revenir à l'écran précédent" />

      {/* Titre accordé au nom de la pièce (titreCommentPorter) : « ton » pour
          une pièce du dressing, article défini pour une suggestion. */}
      <h1 className="t-titre-ecran text-ink mt-[14px]">
        {DEBUT}
        <em className="text-terracotta">{titre.slice(DEBUT.length)}</em>
      </h1>
      <p className="text-[13px] text-[#3F3B34] leading-[1.45] mt-[8px]">Des idées créées à partir de ta capsule.</p>
      <p className="text-[12px] text-muted leading-[1.45] mt-[2px]">
        Capsela privilégie tes pièces et complète avec des suggestions si nécessaire.
      </p>

      {/* Pièce de la capsule, pas encore au dressing (ouverte depuis la
          Capsule ou la Tenue) : ses deux actions d'origine restent, à leur
          place de secondaires. Une pièce du dressing n'a rien ici. */}
      {!alreadyOwned && (
        <div className="flex items-center flex-wrap gap-2 mt-[12px]">
          <span className="text-[12px] text-muted mr-1">Cette pièce est une suggestion de ta capsule.</span>
          {pivot.affLink && (
            <a
              href={pivot.affLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-border-soft text-terracotta rounded-full py-[8px] px-[14px] text-[12px] cursor-pointer whitespace-nowrap"
            >
              Acheter ↗
            </a>
          )}
          <button
            onClick={() => actions.startReplace(pivot)}
            className="inline-block border border-border-soft text-terracotta rounded-full py-[8px] px-[14px] text-[12px] cursor-pointer whitespace-nowrap"
          >
            J&apos;ai déjà
          </button>
        </div>
      )}

      {familles.length > 0 && (
        // Débord -mx-6 px-6 : la liste se coupe au bord de l'écran, la
        // pastille tronquée signale le défilement.
        <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[18px] -mx-6 px-6">
          <button onClick={() => choisir(null)} aria-pressed={!familleActive} className={pastille(!familleActive)}>
            Tous les looks
          </button>
          {familles.map((f) => (
            <button key={f.cle} onClick={() => choisir(f.cle)} aria-pressed={familleActive === f.cle} className={pastille(familleActive === f.cle)}>
              {f.libelle}
            </button>
          ))}
        </div>
      )}

      {looks.length === 0 ? (
        <div className="mt-[22px] bg-card border border-border rounded-[14px] px-4 py-[18px]">
          {/* Une pièce hors de la saison de la capsule n'a pas d'idée pour une
              raison qui n'est pas le dressing (27/09/2026) : le dire, plutôt
              que d'inviter à ajouter des pièces qui n'y changeraient rien. */}
          {horsSaison ? (
            <div className="text-[13px] text-[#3F3B34] leading-[1.5]">
              Cette pièce se porte {enSaisons(saisonsDe(pivot))} : ses idées de tenues
              viendront avec sa saison.
            </div>
          ) : (
            <>
              <div className="text-[13px] text-[#3F3B34] leading-[1.5]">
                Pas encore assez de pièces compatibles pour créer plusieurs looks avec cet article.
              </div>
              <button onClick={actions.openAdd} className="mt-[12px] inline-block text-[12px] text-terracotta cursor-pointer">
                Compléter mon dressing →
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[16px] mt-[16px]">
            {visibles.map((look) => (
              <CarteIdeeLook
                key={cleLook(look.variation.ids)}
                look={look}
                pieces={piecesDe(look.variation.ids)}
                insight={insights.get(cleLook(look.variation.ids))}
                dressing={state.items}
                onOpen={() =>
                  actions.openIdeeLook(pivot.id, variations, familleActive, {
                    ids: look.variation.ids,
                    occasion: look.variation.occasion,
                    numero: look.numero,
                  })
                }
              />
            ))}
          </div>
          {!toutVoir && filtres.length > visibles.length && (
            <button onClick={() => setToutVoir(true)} className="mt-[16px] mb-[6px] w-full text-center t-cta text-terracotta py-[10px] cursor-pointer">
              Voir plus de looks →
            </button>
          )}
        </>
      )}
    </div>
  );
}
