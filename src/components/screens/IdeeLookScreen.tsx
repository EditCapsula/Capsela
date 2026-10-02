"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BoutonRetour from "@/components/BoutonRetour";
import { CarteIdeeLook } from "@/components/CarteIdeeLook";
import { OutfitComposition } from "@/components/OutfitComposition";
import { currentSeasonKey } from "@/lib/capsule";
import { resolveItemImage } from "@/lib/catalogImages";
import { OCC_SHORT, wornAgo } from "@/lib/data";
import { cleLook, decrireLooks, ordonnerLooks, provenanceLook, sourcePiece, texteProvenance } from "@/lib/ideesLooks";
import { participePorte, participePorteMaj } from "@/lib/logic";
import { daysSinceWorn, wearCounts } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";
import Badge from "@/components/Badge";
import Button from "@/components/Button";

/**
 * DÉTAIL D'UNE IDÉE DE LOOK (27/09/2026, maquette page 4) — ouvert depuis une
 * carte de « Comment porter … ? ».
 *
 * Tout ce qui s'affiche vient de l'idée elle-même : mêmes titre et phrase que
 * la carte (decrireLooks), même numéro (ordonnerLooks), provenance pièce par
 * pièce lue sur le dressing réel (sourcePiece). Deux repères rapides
 * seulement, parce que ce sont les seuls que le moteur a réellement fixés :
 * l'occasion de l'idée et la saison de la capsule pour laquelle elle a été
 * composée. Pas de « style » : aucune donnée ne le porte pour un look.
 *
 * Les deux actions réutilisent l'existant : « Porter ce look » ouvre l'écran
 * Tenue sur ces pièces (viewItemOutfit, l'ancien « Voir cette tenue »), où la
 * tenue se valide comme toute autre ; « Enregistrer dans mes looks » est
 * l'écriture de « J'adore cette tenue » (sans doublon). Ni favori ni menu
 * « … » : ils n'existent pas pour une idée de look. Ni prix : aucune pièce
 * n'en porte.
 */
export default function IdeeLookScreen() {
  const { state, wardrobePool, vestiairePool, actions } = useCapsela();
  const actif = state.ideeLookActive;
  const haut = useRef<HTMLDivElement>(null);
  // L'enregistrement demandé, par look : un autre look rouvert ici repart à zéro.
  const [demandeCle, setDemandeCle] = useState<string | null>(null);

  const pivotId = actif?.pivotId ?? -1;
  const variations = useMemo(
    () => (state.ideesTenuesPretes && state.ideesTenuesPretes.pivotId === pivotId ? state.ideesTenuesPretes.variations : []),
    [state.ideesTenuesPretes, pivotId]
  );
  // Pool de résolution stable (cf. LookDetailScreen) : le dressing réel, puis
  // la capsule dont les idées ont été tirées, puis tout le vestiaire.
  const resolution = useMemo(() => [...state.items, ...wardrobePool, ...vestiairePool], [state.items, wardrobePool, vestiairePool]);
  const looks = useMemo(() => ordonnerLooks(variations, state.items), [variations, state.items]);
  const insights = useMemo(() => decrireLooks(variations, resolution, pivotId), [variations, resolution, pivotId]);

  const cle = actif ? cleLook(actif.ids) : "";
  const demande = demandeCle === cle;
  useEffect(() => {
    haut.current?.scrollTo({ top: 0 });
  }, [cle]);

  if (!actif) return null;

  const piecesDe = (ids: number[]) => ids.map((id) => resolution.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  const pieces = piecesDe(actif.ids);
  const insight = insights.get(cle);
  const provenance = provenanceLook(actif.ids, state.items);
  const autres = looks.filter((l) => cleLook(l.variation.ids) !== cle).slice(0, 2);

  const counts = wearCounts(state.history);
  const usage = (it: Item) => {
    if (it.worn == null) return "Jamais " + participePorte(it);
    const count = counts.get(it.id) || 0;
    // Sans entrée au Journal, le champ worn (jours depuis le dernier port)
    // reste la source : jamais « Jamais porté » pour une pièce portée.
    return count > 0
      ? `${participePorteMaj(it)} ${count} fois`
      : wornAgo(daysSinceWorn(state.history, it.id) ?? it.worn).replace(/^Porté/, participePorteMaj(it));
  };

  const clePieces = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");
  const enregistre = state.savedLooks.some((l) => clePieces(l.pieceIds) === clePieces(actif.ids));
  const saison = state.capsuleSeason || currentSeasonKey();
  const infos = [
    { label: "Occasion", valeur: actif.occasion !== "all" ? OCC_SHORT[actif.occasion] : null },
    { label: "Saison", valeur: saison },
  ].filter((i): i is { label: string; valeur: string } => Boolean(i.valeur));

  return (
    <div ref={haut} className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <BoutonRetour onClick={actions.closeIdeeLook} label="Revenir aux idées de tenues" />

      {/* Composition éditoriale (27/09/2026) : une silhouette, pas une
          grille — la zone prend la hauteur des pièces, proche du carré. */}
      <div className="rounded-feuille bg-warm-bg px-[16px] py-[20px] mt-[14px]">
        <OutfitComposition items={pieces} variant="editoriale" label={"Composition du look : " + pieces.map((p) => p.name).join(", ")} />
      </div>

      <div className="t-label text-terracotta mt-[18px]">Look {actif.numero}</div>
      {insight && (
        <>
          <h1 className="t-titre-section text-ink mt-[6px]">{insight.title}</h1>
          <p className="text-[13px] text-ink-soft leading-[1.5] mt-[6px]">{insight.sentence}</p>
        </>
      )}

      {infos.length > 0 && (
        <div className="flex mt-[16px] bg-card border border-border rounded-bloc">
          {infos.map((info, i) => (
            <div key={info.label} className={"flex-1 min-w-0 px-[14px] py-[11px] " + (i > 0 ? "border-l border-border" : "")}>
              <div className="t-label text-muted">{info.label}</div>
              <div className="text-[13px] text-ink mt-[3px]">{info.valeur}</div>
            </div>
          ))}
        </div>
      )}

      <div className="t-surtitre text-muted mt-[24px] mb-[10px]">Les pièces de ce look</div>
      <div className="flex flex-col gap-[8px]">
        {pieces.map((it) => {
          const img = resolveItemImage(it);
          const possedee = sourcePiece(it.id, state.items) === "owned";
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => actions.openItem(it.id, !possedee)}
              className="w-full text-left flex items-center gap-[12px] bg-card border border-border rounded-bloc p-[10px] cursor-pointer"
            >
              <div
                className="w-[52px] h-[62px] rounded-[10px] overflow-hidden flex-shrink-0"
                style={
                  img.url
                    ? { background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 4 }
                    : { background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                }
              >
                {img.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    loading="lazy"
                    src={img.url}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain" }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-ink leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">{it.name}</div>
                {possedee && <div className="text-[11px] text-muted mt-[3px]">{usage(it)}</div>}
                <Badge tone={possedee ? "possede" : "plein"} taille="s" className="mt-[6px]">
                  {possedee ? "Dressing" : "À découvrir"}
                </Badge>
              </div>
              <span className="text-muted text-[16px] flex-shrink-0" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3 mt-[20px] text-[12px]">
        <span className={provenance.suggestions === 0 ? "text-ink" : "text-muted"}>
          {provenance.suggestions === 0 && (
            <span className="text-terracotta mr-[5px]" aria-hidden="true">
              ✓
            </span>
          )}
          {texteProvenance(provenance)}
        </span>
        {provenance.suggestions === 0 && (
          <span className="text-muted whitespace-nowrap flex-shrink-0">
            {provenance.dressing}/{provenance.total} pièces
          </span>
        )}
      </div>

      <Button variante="principal" className="mt-[12px]"
        onClick={() => actions.viewItemOutfit(actif.ids, actif.occasion)}
      >
        Porter ce look
      </Button>
      <Button variante="secondaire" className="mt-[10px]"
        onClick={() => {
          if (enregistre || demande) return;
          setDemandeCle(cle);
          actions.enregistrerIdeeLook(actif.ids, actif.occasion);
        }}
        disabled={enregistre || demande}
        aria-pressed={enregistre}
      >
        {enregistre ? "✓ Enregistré dans mes looks" : demande ? "Enregistrement…" : "Enregistrer dans mes looks"}
      </Button>

      {autres.length > 0 && (
        <>
          <div className="t-surtitre text-muted mt-[30px] mb-[10px]">D&apos;autres idées avec cette pièce</div>
          <div className="flex flex-col gap-[16px] pb-[8px]">
            {autres.map((look) => (
              <CarteIdeeLook
                key={cleLook(look.variation.ids)}
                look={look}
                pieces={piecesDe(look.variation.ids)}
                insight={insights.get(cleLook(look.variation.ids))}
                dressing={state.items}
                onOpen={() =>
                  actions.openIdeeLook(pivotId, variations, state.ideesTenuesPretes?.famille ?? null, {
                    ids: look.variation.ids,
                    occasion: look.variation.occasion,
                    numero: look.numero,
                  })
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
