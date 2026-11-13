"use client";

import { useEffect, useMemo, useState } from "react";
import FicheSuggestion, { type AssociationFiche } from "@/components/FicheSuggestion";
import { calculerIdeesTenues, poolPourIdees } from "@/components/screens/ItemOutfitsScreen";
import { useAuth } from "@/lib/auth";
import { computeDefaultCapsule, saisonCapsuleDuJour } from "@/lib/capsule";
import { phraseSuggestion } from "@/lib/capsuleEcran";
import { resolvePhotoCatalogue } from "@/lib/catalogImages";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { CATLABEL } from "@/lib/data";
import { clePieces } from "@/lib/outfitFeedback";
import { paletteHexes } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * LA FICHE D'UNE SUGGESTION, PARTOUT (13/11/2026, harmonisation des fiches, validée). Avant, une même suggestion de la capsule avait
 * deux fiches : celle de la Capsule (FicheSuggestion : votes, « Je possède déjà cette pièce », associations) et, depuis l'accueil,
 * Ma tenue du jour ou une idée de look, la fiche complète en mode suggestion (« J'ai déjà ça », « Acheter », sans vote). Désormais la
 * fiche de la Capsule partout, ouverte par openItem(id, true) (state.ficheSuggestion) ; seuls le parcours « 3 / 10 » et « Remplacer
 * cette pièce » (qui recompose la capsule d'une saison) restent dans la Capsule.
 *
 * Les gestes gardent leur sens de la Capsule : « J'aime » note le vote puis ouvre « Comment porter » ; « Pas pour moi » retire la
 * pièce de la capsule (vote « rejetee ») et referme la fiche ; « Je possède déjà cette pièce » ouvre l'ajout au dressing, revenu ici.
 */
export default function FicheSuggestionGlobale() {
  const { state, actions, vestiairePool, defaultCapsule, votesSuggestions, weather } = useCapsela();
  const { profile } = useAuth();
  const fiche = state.ficheSuggestion;
  const ouverte = fiche != null && fiche.ecran === state.screen;
  const piece: Item | null = fiche ? (vestiairePool.find((i) => i.id === fiche.id) ?? defaultCapsule.find((i) => i.id === fiche.id) ?? null) : null;
  const [occupe, setOccupe] = useState(false);

  // L'écran a changé sous la fiche : elle n'a plus lieu d'être.
  useEffect(() => {
    if (fiche && fiche.ecran !== state.screen) actions.fermerFicheSuggestion();
  }, [fiche, state.screen, actions]);

  // Le visuel manquant est demandé à l'ouverture, comme dans la Capsule.
  useEffect(() => {
    if (!ouverte || !piece) return;
    if (resolvePhotoCatalogue(piece).kind === "placeholder" && !["generating", "error", "invalid"].includes(piece.imageStatus ?? "")) actions.requestCatalogImage(piece.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouverte, piece?.id]);

  const saison = state.capsuleSeason || saisonCapsuleDuJour(weather.temp);
  const idees = useMemo(() => {
    if (!ouverte || !piece) return { variations: [], cartes: [] as AssociationFiche[] };
    try {
      const capsule = defaultCapsule.length ? defaultCapsule : computeDefaultCapsule(profile, weather, state.suggestedExcluded, saison, vestiairePool);
      const variations = calculerIdeesTenues(piece, poolPourIdees(state.items, capsule, saison), state.items, saison, paletteHexes(profile), profile.gender, colorimetrieMoteur(profile.colorimetrie));
      const connues = [...state.items, ...vestiairePool];
      const cartes = variations
        .filter((v) => v.ids.includes(piece.id))
        .slice(0, 3)
        .map((v) => ({ ids: v.ids, pieces: v.ids.map((id) => connues.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)) }))
        .filter((c) => c.pieces.length >= 2);
      return { variations, cartes };
    } catch {
      return { variations: [], cartes: [] as AssociationFiche[] };
    }
  }, [ouverte, piece, defaultCapsule, profile, weather, state.suggestedExcluded, saison, vestiairePool, state.items]);

  if (!ouverte || !piece) return null;
  const synthese = [CATLABEL[piece.cat], piece.color, piece.matiere].filter(Boolean).join(" · ");

  return (
    <FicheSuggestion
      piece={piece}
      position={1}
      total={1}
      etat={votesSuggestions[String(piece.id)]}
      phrase={phraseSuggestion(piece, profile)}
      synthese={synthese}
      associations={idees.cartes}
      occupe={occupe}
      onFermer={actions.fermerFicheSuggestion}
      onAimer={() => {
        if (occupe) return;
        setOccupe(true);
        if (votesSuggestions[String(piece.id)] !== "aimee") void actions.voterSuggestion(piece.id, "aimee");
        setTimeout(() => {
          setOccupe(false);
          actions.fermerFicheSuggestion();
          actions.openItemOutfits(piece.id);
        }, 260);
      }}
      onRejeter={() => {
        if (occupe) return;
        setOccupe(true);
        void actions.voterSuggestion(piece.id, "rejetee");
        setTimeout(() => {
          setOccupe(false);
          actions.fermerFicheSuggestion();
        }, 260);
      }}
      onPossede={() => {
        actions.fermerFicheSuggestion();
        actions.startReplace(piece, state.screen);
      }}
      onVoirTenues={() => {
        actions.fermerFicheSuggestion();
        actions.openItemOutfits(piece.id);
      }}
      onOuvrirAssociation={(i) => {
        const carte = idees.cartes[i];
        const v = idees.variations.find((x) => clePieces(x.ids).join(",") === clePieces(carte.ids).join(","));
        if (!v) return;
        actions.fermerFicheSuggestion();
        actions.openIdeeLook(piece.id, idees.variations, null, { ids: v.ids, occasion: v.occasion, numero: i + 1 });
      }}
      onClicAffilie={() => {}}
    />
  );
}
