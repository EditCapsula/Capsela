"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { SlideIdeeLook } from "@/components/CarteIdeeLook";
import { CarrouselHero } from "@/components/CarrouselHero";
import PhotoPiece from "@/components/PhotoPiece";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { clePieces } from "@/lib/outfitFeedback";
import { styleLabel } from "@/lib/profile";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, contexteCapsule, currentSeasonKey, estDeSaison, representativeWeatherFor } from "@/lib/capsule";
import { CATLABEL, CATS, isBag } from "@/lib/data";
import { enSaisons, pourLaSaison, saisonPourIdees, saisonsDe } from "@/lib/saisons";
import { composeWardrobePool } from "@/lib/selectors";
import { avecTirageDeterministe, graineIdees } from "@/lib/looks";
import { FAMILLES_LOOK, cleLook, decrireLooks, fusionnerAvecOuSansVeste, ideesDressingDAbord, ordonnerLooks, pronomCommentPorter, type FamilleLook, type LookNumerote } from "@/lib/ideesLooks";
import type { ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur, type ColorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, Item } from "@/lib/types";
import AppHeader from "@/components/AppHeader";

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
  gender: "femme" | "homme" | null,
  colorimetrie: ColorimetrieMoteur | null = null
): ItemOutfitVariation[] {
  // Tirage STABLE (12/10/2026) : le moteur tire au hasard ; sans graine, « N looks possibles » et les pièces d'une idée changeaient à chaque
  // rechargement. Graine = pièce + saison + pool (looks.ts, graineIdees).
  return avecTirageDeterministe(graineIdees(pivot.id, capsuleSeason, wardrobePool), () =>
    ideesDressingDAbord(pivot, wardrobePool, dressing, capsuleSeason, preferredHexes, gender, colorimetrie)
  );
}

const CAT_KEYS = CATS.map(([k]) => k);

/**
 * Le pool des idées d'une saison (28/09/2026) : le dressing, la capsule de
 * cette saison pour les catégories qu'il n'a pas, et — demandé : « elle doit
 * proposer les chaussures de la saison concernée, quitte à privilégier des
 * chaussures de la capsule » — la capsule aussi pour les catégories où il n'a
 * rien DE CETTE SAISON (composeWardrobePool, completerPourSaison). Le même
 * pour cet écran et pour « Jamais portées », qui annonce le nombre d'idées.
 */
export function poolPourIdees(dressing: Item[], capsule: Item[], saison: CapsuleSeason): Item[] {
  return composeWardrobePool(dressing, capsule, CAT_KEYS, { completerPourSaison: contexteCapsule(saison) });
}

export default function ItemOutfitsScreen() {
  const { state, weather, wardrobePool, vestiairePool, defaultCapsule, actions } = useCapsela();
  const { profile } = useAuth();
  const pretes = state.ideesTenuesPretes;
  // La pastille choisie survit à l'aller-retour vers le détail d'un look
  // (gardée avec les idées dans ideesTenuesPretes).
  const [famille, setFamille] = useState<FamilleLook | null>(pretes?.pivotId === state.activeId ? (pretes.famille ?? null) : null);
  const carrousel = useRef<HTMLDivElement>(null);

  const pivot = wardrobePool.find((i) => i.id === state.activeId) || vestiairePool.find((i) => i.id === state.activeId);


  // La pièce pivot doit toujours être présente, même si sa catégorie est
  // par ailleurs pourvue par une pièce réelle dans wardrobePool (auquel
  // cas ce n'est pas exactement la même ligne que celle cliquée). Hooks
  // toujours appelés (jamais après un retour conditionnel) : le garde-fou
  // "pivot manquant" est interne, le retour null n'intervient qu'au rendu.
  const saisonCourante = state.capsuleSeason || currentSeasonKey();
  // LES IDÉES VIENNENT DE LA SAISON DE LA PIÈCE (28/09/2026, demandé :
  // « des suggestions de tenues même avec des saisons pas en cours »). Une
  // pièce hors de la saison affichée n'avait aucune idée — l'écran disait
  // d'attendre sa saison. Ses idées sont désormais tirées de la capsule de sa
  // saison la plus proche (saisonPourIdees), composée comme le pool habituel :
  // tes pièces d'abord, la capsule de cette saison pour compléter.
  const capsuleSeason = pivot ? saisonPourIdees(pivot, saisonCourante) : saisonCourante;
  const autreSaison = capsuleSeason !== saisonCourante;
  // LA CAPSULE DU STYLE EXPLORÉ (01/11/2026, signalé : « Pantalon imprimé » de la capsule Créatif explorée, aucune idée). Les idées
  // étaient tirées dans la capsule du style du PROFIL : la pièce n'y avait aucune pièce de son style pour l'accompagner (mesuré : 0 idée
  // avec les capsules Minimaliste, Casual chic et Classique chic ; 3 avec la sienne). Même profil que l'écran Capsule.
  const exploredStyleId = state.exploredStyleId;
  const profilCapsule = useMemo(() => (exploredStyleId ? { ...profile, styles: [exploredStyleId] } : profile), [profile, exploredStyleId]);
  // LE DRESSING D'ABORD, LA CAPSULE POUR COMPLÉTER (ideesDressingDAbord, 27/09/2026), pour toute pièce. Arbitré de nouveau le
  // 01/11/2026 par la propriétaire : la refonte avait limité une pièce de la capsule à sa seule capsule (règle 2 du brief), puis
  // « Dressing d'abord, la capsule pour compléter » — voir la pièce suggérée avec ce qu'on possède déjà.
  const poolSaison = useMemo(() => {
    const capsule =
      autreSaison || exploredStyleId
        ? computeDefaultCapsule(
            profilCapsule,
            // La saison de la pièce : sa météo représentative ; la saison affichée : la météo de l'écran Capsule, pour la même capsule.
            autreSaison ? representativeWeatherFor(capsuleSeason) : weather,
            state.suggestedExcluded,
            capsuleSeason,
            vestiairePool
          )
        : defaultCapsule;
    return poolPourIdees(state.items, capsule, capsuleSeason);
  }, [autreSaison, exploredStyleId, profilCapsule, weather, capsuleSeason, state.suggestedExcluded, vestiairePool, defaultCapsule, state.items]);

  const pool = useMemo(
    () => (!pivot ? [] : poolSaison.some((i) => i.id === pivot.id) ? poolSaison : [...poolSaison, pivot]),
    [poolSaison, pivot]
  );

  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);
  const colorimetrie = useMemo(() => colorimetrieMoteur(profile.colorimetrie), [profile]);

  const variations = useMemo(
    // capsuleSeason transmis explicitement (correctif 29/08/2026) : le
    // référentiel saisonnier vient de la capsule affichée, jamais de la
    // température représentative — 16 °C au printemps basculait le bucket
    // météo en "Automne / Hiver" et écartait les pièces Printemps/Été de
    // leur propre capsule. La météo continue de gouverner la température.
    // Calculées une fois : un filtre ne fait que trier ce qui est déjà là.
    () =>
      !pivot
        ? []
        : pretes && pretes.pivotId === pivot.id
          ? pretes.variations
          : calculerIdeesTenues(pivot, poolSaison, state.items, capsuleSeason, preferredHexes, profile.gender, colorimetrie),
    [pivot, pretes, poolSaison, state.items, preferredHexes, profile.gender, capsuleSeason, colorimetrie]
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

  // Un look qui ne change que par sa veste n'est montré qu'une fois, « Avec ou sans veste » (06/11/2026).
  const fusion = useMemo(() => fusionnerAvecOuSansVeste(variations, pool, pivot?.id ?? -1), [variations, pool, pivot]);
  const looks = useMemo(() => ordonnerLooks(fusion.variations, state.items), [fusion, state.items]);
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
  const piecesDe = (ids: number[]) => ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  const enregistre = (ids: number[]) => {
    const cle = clePieces(ids).join(",");
    return state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cle);
  };
  const ouvrir = (look: LookNumerote, position: number) =>
    actions.openIdeeLook(pivot.id, fusion.variations, familleActive, { ids: look.variation.ids, occasion: look.variation.occasion, numero: position });

  const choisir = (f: FamilleLook | null) => setFamille(f);
  const pastille = (actif: boolean) =>
    "flex-none rounded-full px-4 py-[9px] min-h-[38px] text-[12px] whitespace-nowrap cursor-pointer " +
    (actif ? "bg-ink border border-ink text-cream" : "bg-card border border-border text-ink");

  // « ET SI ON CHANGEAIT DE STYLE ? » — les autres registres de la même pièce, pris dans les idées déjà calculées : la meilleure de chaque
  // famille absente du filtre (ordonnerLooks). Rien n'est tiré de plus ; sans autre famille, le bloc ne s'affiche pas.
  const autresRegistres = FAMILLES_LOOK.filter((f) => f.cle !== familleActive)
    .map((f) => ({ famille: f, look: looks.find((l) => l.famille === f.cle) }))
    .filter((x): x is { famille: (typeof FAMILLES_LOOK)[number]; look: LookNumerote } => Boolean(x.look));
  const montrerRegistres = familleActive ? autresRegistres.length > 0 : autresRegistres.length > 1;
  const allerAuRegistre = (f: FamilleLook) => {
    // Le carrousel est remonté par le filtre : il s'ouvre sur le premier look de ce registre.
    setFamille(f);
    carrousel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // LA PIÈCE CHOISIE (en-tête compact) : ce qu'elle est et d'où elle vient. Les raisons de la suggestion, un temps ici, ont été retirées
  // le 01/11/2026 (demandé) : la fiche de la pièce les donne.
  const infos = [CATLABEL[isBag(pivot) ? "sac" : pivot.cat], pivot.color, pivot.matiere].filter(Boolean).join(" · ");
  const libelleCapsule = `Capsule ${capsuleSeason}${exploredStyleId ? " · " + styleLabel(exploredStyleId, profile.gender) : ""}`;
  const nombre = `${filtres.length} look${filtres.length > 1 ? "s" : ""}`;
  // Des miniatures de même taille sur toutes les slides : autant de colonnes que le look le plus fourni, entre 4 et 5 — à 6 colonnes,
  // une vignette tombait à 40 px. Un look de 6 pièces ou plus passe alors sur deux rangées, lui seul.
  const colonnesCarrousel = Math.max(4, Math.min(5, Math.max(0, ...filtres.map((l) => piecesDe(l.variation.ids).length))));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto overflow-x-hidden px-6 pt-[6px] pb-safe-nav">
      {/* « Comment la porter ? » dans le bandeau, accordé à la pièce, sans point après « ? » (13/11/2026, tableau validé) ; le nom de la
          pièce passe dans la colonne de la pièce, dessous. */}
      <AppHeader
        onBack={() => actions.go(state.itemOutfitsReturn)}
        point={false}
        titre={
          <>
            Comment <span className="italic">{pronomCommentPorter(pivot)} porter</span> ?
          </>
        }
      />

      {/* ── LA PIÈCE CHOISIE ─ compacte, avec son nom (le titre court ne le porte plus, 13/11/2026) : les looks restent près de la ligne de flottaison. */}
      <section className="flex gap-[14px] items-center mt-[14px]" aria-label={`La pièce choisie : ${pivot.name}`}>
        <button type="button" onClick={() => actions.openItem(pivot.id, !alreadyOwned)} className="flex-none w-[76px] cursor-pointer" aria-label={`Voir la fiche : ${pivot.name}`}>
          <PhotoPiece piece={pivot} ratio={0.8} rayon={12} />
        </button>
        <div className="flex-1 min-w-0">
          <Badge tone={alreadyOwned ? "possede" : "plein"} taille="s">
            {alreadyOwned ? "Ton dressing" : "Suggestion"}
          </Badge>
          <div className="t-titre-carte text-ink mt-[7px]">{pivot.name}</div>
          {infos && <div className="text-[12px] text-muted-3 mt-[7px]">{infos}</div>}
          {!alreadyOwned && <div className="text-[11.5px] text-muted mt-[3px]">{libelleCapsule}</div>}
          {/* Pièce de la capsule, pas encore au dressing : ses deux actions d'origine restent, discrètes, dans la colonne de la pièce. */}
          {!alreadyOwned && (
            <div className="flex items-center flex-wrap gap-2 mt-[8px]">
              <button
                onClick={() => actions.startReplace(pivot)}
                className="inline-block border border-border text-terracotta rounded-full py-[7px] px-[13px] text-[12px] cursor-pointer whitespace-nowrap"
              >
                J&apos;ai déjà
              </button>
              {pivot.affLink && (
                <a
                  href={pivot.affLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border border-border text-terracotta rounded-full py-[7px] px-[13px] text-[12px] cursor-pointer whitespace-nowrap"
                >
                  Acheter ↗
                </a>
              )}
            </div>
          )}
        </div>
      </section>
      {/* La saison des idées, dite quand ce n'est pas celle en cours : sans elle, des sandales proposées en automne sembleraient une erreur. */}
      {autreSaison && (
        <p className="text-[12px] text-terracotta leading-[1.45] mt-[8px]">
          Cette pièce se porte {enSaisons(saisonsDe(pivot))} : voici des idées pour {pourLaSaison(capsuleSeason)}.
        </p>
      )}

      {/* ── LES INSPIRATIONS */}
      <div ref={carrousel} className="scroll-mt-[8px]">
        {looks.length > 0 && (
          <p className="text-[12.5px] text-muted-3 leading-[1.45] mt-[18px]">
            Découvre différentes façons de la porter selon tes envies. <span className="text-ink whitespace-nowrap">{nombre}</span>
          </p>
        )}

        {familles.length > 0 && (
          // Débord -mx-6 px-6 : la liste se coupe au bord de l'écran, la pastille tronquée signale le défilement.
          <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[14px] -mx-6 px-6" role="group" aria-label="Filtrer par occasion">
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
      </div>

      {looks.length === 0 ? (
        <EmptyState forme="carte" className="mt-[18px]" action={!horsSaison ? { libelle: "Compléter mon dressing →", onClick: actions.openAdd } : undefined}>
          {/* Une pièce hors de la saison de la capsule n'a pas d'idée pour une raison qui n'est pas le dressing (27/09/2026) : le dire. */}
          {horsSaison
            ? `Cette pièce se porte ${enSaisons(saisonsDe(pivot))} : ses idées de tenues viendront avec sa saison.`
            : "Pas encore assez de pièces compatibles pour créer plusieurs looks avec cet article."}
        </EmptyState>
      ) : (
        // LE CARROUSEL (01/11/2026) : une slide domine, le bord de la suivante dépasse — on voit qu'il y en a d'autres ; points de
        // pagination et compteur sur chaque look. Remonté à chaque filtre : le premier look du filtre s'affiche.
        <CarrouselHero
          key={familleActive ?? "tous"}
          className="mt-[16px] -mx-6"
          label={`Idées de looks avec ${pivot.name}`}
          retrait={24}
          ecart={12}
          // Un look seul prend toute la largeur ; plusieurs : le bord du suivant dépasse.
          largeurSlide={filtres.length > 1 ? "calc(100% - 28px)" : "100%"}
          classeSlide=""
          libelles={filtres.map((l, i) => `Look ${i + 1}${insights.get(cleLook(l.variation.ids)) ? " : " + insights.get(cleLook(l.variation.ids))!.title : ""}`)}
          slides={filtres.map((look, i) => (
            <SlideIdeeLook
              key={cleLook(look.variation.ids)}
              look={look}
              position={i + 1}
              total={filtres.length}
              pieces={piecesDe(look.variation.ids)}
              insight={insights.get(cleLook(look.variation.ids))}
              dressing={state.items}
              pivotId={pivot.id}
              marquerSuggestions
              enregistre={enregistre(look.variation.ids)}
              onOpen={() => ouvrir(look, i + 1)}
              onCoeur={() => actions.basculerIdeeLook(look.variation.ids, look.variation.occasion)}
              colonnes={colonnesCarrousel}
              avecOuSansVeste={fusion.vesteFacultative.has(cleLook(look.variation.ids))}
            />
          ))}
        />
      )}

      {/* ── ET SI ON CHANGEAIT DE STYLE ? */}
      {montrerRegistres && (
        <section className="mt-[28px] mb-[8px]" aria-label="Et si on changeait de style ?">
          <h2 className="t-titre-section text-ink">
            Et si on changeait <em className="text-terracotta">de style ?</em>
          </h2>
          <p className="text-[12.5px] text-muted-3 leading-[1.45] mt-[4px]">La même pièce, dans un autre registre.</p>
          {/* Une rangée par registre : la composition à gauche, le registre et le titre à droite — lisible à 360 px, sans grille bancale. */}
          <div className="flex flex-col gap-[10px] mt-[12px]">
            {autresRegistres.map(({ famille: f, look }) => {
              const pieces = piecesDe(look.variation.ids);
              const insight = insights.get(cleLook(look.variation.ids));
              const n = looks.filter((l) => l.famille === f.cle).length;
              return (
                <button
                  key={f.cle}
                  type="button"
                  onClick={() => allerAuRegistre(f.cle)}
                  className="w-full flex items-center gap-[14px] text-left bg-card border border-border rounded-tuile p-[8px] pr-[14px] cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  <div className="relative flex-none w-[96px] h-[96px] rounded-champ bg-warm-bg overflow-hidden">
                    <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="t-label text-terracotta">Version {f.libelle}</div>
                    {insight && <div className="text-[14px] text-ink leading-[1.3] mt-[4px] line-clamp-2">{insight.title}</div>}
                    <div className="text-[12px] text-muted mt-[5px]">{`${n} look${n > 1 ? "s" : ""}`}</div>
                  </div>
                  <span className="text-muted text-[16px] flex-shrink-0" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
