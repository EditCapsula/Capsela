"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import PhotoPiece from "@/components/PhotoPiece";
import SegmentedControl from "@/components/SegmentedControl";
import { BoutonAjoutFlottant } from "@/components/screens/WardrobeScreen";
import { calculerIdeesTenues, poolPourIdees } from "@/components/screens/ItemOutfitsScreen";
import { useAuth } from "@/lib/auth";
import { computeDefaultCapsule, currentSeasonKey, representativeWeatherFor } from "@/lib/capsule";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { occasionShortLabel } from "@/lib/data";
import { groupesDuVestiaire, syntheseDressing } from "@/lib/dressingEcran";
import {
  libelleDateRecente,
  libelleLooksPossibles,
  looksDistincts,
  phrasePiste,
  piecesRecentes,
  separerParSemaine,
} from "@/lib/dressingSections";
import type { ItemOutfitVariation } from "@/lib/logic";
import { clePieces } from "@/lib/outfitFeedback";
import { paletteHexes } from "@/lib/profile";
import { saisonPourIdees } from "@/lib/saisons";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, Item } from "@/lib/types";

/*
 * « TES DERNIÈRES PIÈCES » (maquette V2 du 08/10/2026) — le « Voir tout » de « Ajoutées récemment ». Les pièces du dressing par date
 * d'ajout décroissante, filtrables par catégorie, en « cette semaine » puis « un peu plus tôt ».
 *
 * « N looks possibles » est le nombre d'idées que calcule « Comment porter … ? » (calculerIdeesTenues, même pool, même saison de pièce),
 * transmises telles quelles : le nombre annoncé est celui que l'on trouve en arrivant. Aucune idée : pas de ligne. Le calcul se fait
 * après le premier rendu, sur les seize pièces les plus récentes (≈ 40 ms chacune) : la grille s'affiche d'abord.
 */

/** Pièces dont les idées sont calculées : au-delà, la carte n'annonce rien plutôt qu'un nombre approximatif. */
const NB_PIECES_AVEC_IDEES = 16;

export default function DernieresPiecesScreen() {
  const { state, actions, defaultCapsule, vestiairePool, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const [groupe, setGroupe] = useState<string>("toutes");
  const [maintenant] = useState(() => Date.now());

  const groupes = useMemo(() => groupesDuVestiaire(items, profile.gender), [items, profile.gender]);
  const recentes = useMemo(() => piecesRecentes(items, 60), [items]);
  const categories = groupes.find((g) => g.id === groupe)?.categories;
  const affichees = categories ? recentes.filter((p) => categories.includes(p.cat)) : recentes;
  const { semaine, avant } = separerParSemaine(affichees, maintenant);
  const libelleDuGroupe = (p: Item) => groupes.find((g) => g.categories.includes(p.cat))?.libelle ?? "";

  // LES IDÉES, après le premier rendu. Même pool que « Comment porter … ? », par saison de la pièce.
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);
  const colorimetrie = useMemo(() => colorimetrieMoteur(profile.colorimetrie), [profile]);
  const [idees, setIdees] = useState<Map<number, ItemOutfitVariation[]> | null>(null);
  const idsCalcul = useMemo(() => recentes.slice(0, NB_PIECES_AVEC_IDEES).map((p) => p.id).join(","), [recentes]);
  useEffect(() => {
    const t = setTimeout(() => {
      const courante = state.capsuleSeason || currentSeasonKey();
      const pools = new Map<CapsuleSeason, Item[]>();
      const poolDe = (saison: CapsuleSeason) => {
        let pool = pools.get(saison);
        if (!pool) {
          const capsule =
            saison === courante
              ? defaultCapsule
              : computeDefaultCapsule(profile, representativeWeatherFor(saison), state.suggestedExcluded, saison, vestiairePool);
          pool = poolPourIdees(items, capsule, saison);
          pools.set(saison, pool);
        }
        return pool;
      };
      const m = new Map<number, ItemOutfitVariation[]>();
      for (const p of recentes.slice(0, NB_PIECES_AVEC_IDEES)) {
        const saison = saisonPourIdees(p, courante);
        const pool = poolDe(saison);
        const pivot = pool.some((i) => i.id === p.id) ? pool : [...pool, p];
        m.set(p.id, calculerIdeesTenues(p, pivot, items, saison, preferredHexes, profile.gender, colorimetrie));
      }
      setIdees(m);
    }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsCalcul, defaultCapsule, items]);

  // « Avec tes nouvelles pièces » : les pièces de la semaine, sinon les quatre dernières ; les looks distincts qu'elles ouvrent.
  const nouvelles = useMemo(() => {
    const dernieres = separerParSemaine(recentes, maintenant).semaine;
    return (dernieres.length ? dernieres : recentes).slice(0, 4);
  }, [recentes, maintenant]);
  const total = idees ? looksDistincts(nouvelles.map((p) => (idees.get(p.id) ?? []).map((v) => v.ids))) : 0;
  const exemples = idees
    ? nouvelles
        .map((p) => ({ piece: p, idee: idees.get(p.id)?.[0] }))
        .filter((e): e is { piece: Item; idee: ItemOutfitVariation } => !!e.idee)
        .slice(0, 2)
    : [];
  const resolvePool = useMemo(() => [...items, ...vestiairePool, ...defaultCapsule], [items, vestiairePool, defaultCapsule]);
  const synthese = syntheseDressing(etatPremium, items.length, groupes.length);

  const carte = (p: Item) => {
    const n = idees?.get(p.id)?.length ?? 0;
    const ligne = libelleLooksPossibles(n);
    return (
      <button key={p.id} onClick={() => actions.openItem(p.id)} className="text-left cursor-pointer active:opacity-80 min-w-0">
        <PhotoPiece piece={p} ratio={0.8} rayon={20} />
        <div className="font-serif text-ink mt-[10px] px-[2px] line-clamp-2" style={{ fontSize: 15, lineHeight: 1.25 }}>{p.name}</div>
        <div className="text-[12px] text-muted mt-[2px] px-[2px] line-clamp-1">
          {[libelleDuGroupe(p), libelleDateRecente(p.createdAt as number, maintenant)].filter(Boolean).join(" · ")}
        </div>
        {/* La ligne garde sa hauteur même vide : les cartes d'une rangée restent alignées pendant que les idées se calculent. */}
        <div className="text-[12px] font-semibold mt-[2px] px-[2px]" style={{ color: "var(--color-terracotta-deep)", minHeight: 18 }}>{ligne}</div>
      </button>
    );
  };

  const section = (titre: string, pieces: Item[]) =>
    pieces.length > 0 && (
      <section className="mt-6" aria-label={titre}>
        <div className="flex items-center gap-3">
          <div className="t-surtitre text-muted flex-shrink-0">{titre}</div>
          <span aria-hidden="true" className="flex-1 h-px" style={{ background: "var(--color-border)" }} />
        </div>
        <div className="grid grid-cols-2 gap-x-[14px] gap-y-[18px] mt-4">{pieces.map(carte)}</div>
      </section>
    );

  return (
    <>
      <div
        className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 100px)" }}
      >
        <AppHeader onBack={actions.goWardrobe} backLabel="Revenir au dressing" />
        <div className="t-surtitre text-muted mt-[14px]">Ajoutées récemment</div>
        <div className="t-titre-ecran text-ink mt-[6px]">
          Tes dernières <span className="italic text-terracotta">pièces</span>
        </div>
        <div className="text-[13px] mt-[6px]" style={{ color: "var(--color-muted-3)" }}>Elles font déjà partie de tes looks.</div>

        {groupes.length > 1 && (
          <div className="mt-4 -mx-6 px-6">
            <SegmentedControl
              segments={[{ key: "toutes", label: "Toutes" }, ...groupes.map((g) => ({ key: g.id, label: g.libelle }))]}
              actif={groupe}
              onChange={setGroupe}
              ariaLabel="Filtrer par catégorie"
              variante="pastilles"
            />
          </div>
        )}

        {section("Cette semaine", semaine)}

        {/* AVEC TES NOUVELLES PIÈCES : le nombre de looks distincts que le moteur compose avec elles, et deux exemples. */}
        {total > 0 && exemples.length > 0 && groupe === "toutes" && (
          <section className="mt-6 rounded-hero px-5 py-[18px]" style={{ background: "var(--color-warm-bg)" }} aria-label="Avec tes nouvelles pièces">
            <div className="t-surtitre text-muted">
              <span className="font-serif italic text-terracotta" aria-hidden="true">✦</span> Avec tes nouvelles pièces
            </div>
            <div className="font-serif text-ink mt-2" style={{ fontSize: 22, lineHeight: 1.2 }}>
              Déjà <span className="italic text-terracotta">{total} {total === 1 ? "look" : "looks"}</span> à porter
            </div>
            <div className="grid grid-cols-2 gap-[12px] mt-4">
              {exemples.map(({ piece, idee }) => {
                const pieces = idee.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => !!i);
                return (
                  <button key={piece.id} onClick={() => actions.openItemOutfits(piece.id, false, idees?.get(piece.id))} className="text-left cursor-pointer active:opacity-80 min-w-0">
                    <div className="relative overflow-hidden" style={{ aspectRatio: "1", borderRadius: 18, background: "var(--color-photo-bg)" }}>
                      <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(idee.ids).join(",")} />
                    </div>
                    <div className="font-serif text-ink mt-[8px] px-[2px]" style={{ fontSize: 15 }}>{occasionShortLabel(idee.occasion)}</div>
                    <div className="text-[12px] px-[2px] line-clamp-2" style={{ color: "var(--color-muted-3)" }}>{phrasePiste(piece)}</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => actions.openItemOutfits(exemples[0].piece.id, false, idees?.get(exemples[0].piece.id))}
              className="mt-3 t-lien text-terracotta-deep cursor-pointer"
              style={{ minHeight: 44 }}
            >
              Voir tous ces looks →
            </button>
          </section>
        )}

        {section("Un peu plus tôt", avant)}
      </div>
      {!synthese.complet && <BoutonAjoutFlottant onClick={actions.openAdd} />}
    </>
  );
}
