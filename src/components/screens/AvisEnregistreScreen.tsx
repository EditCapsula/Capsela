"use client";

import { useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import EtMaintenantAvis from "@/components/EtMaintenantAvis";
import PiecesReconnues from "@/components/PiecesReconnues";
import AppHeader from "@/components/AppHeader";
import { LienRetour } from "@/components/BoutonRetour";
import ResultatAvis from "@/components/ResultatAvis";
import { premiumRequis } from "@/lib/autorisations";
import { compositionReconnue } from "@/lib/reconnaissance";
import { useCapsela } from "@/lib/store";

/*
 * AVIS DE STYLISTE ENREGISTRÉ — rouvert depuis le Journal (arbitrages du
 * 25/09/2026, point 19). Même contenu que le résultat d'origine
 * (ResultatAvis) ; les pièces retirées du dressing depuis ne s'affichent
 * plus (arbitré). Suppression possible, avec confirmation, photo comprise
 * (§14) — même traitement que le retrait d'une pièce du dressing
 * (PieceScreen).
 *
 * Consultation seulement : aucun appel au modèle, aucune condition Premium —
 * ce sont les données de l'utilisatrice, elle les garde.
 */

const TEXTES = {
  // Suppression d'un avis enregistré — libellés validés le 25/09/2026.
  // « Annuler » conserve l'avis ; « Supprimer l'avis » efface l'avis ET sa photo.
  supprimer: "Supprimer l'avis",
  titreConfirmation: "Supprimer cet avis ?",
  texteConfirmation: "Cet avis et la photo associée seront définitivement supprimés de ton Journal.",
  confirmer: "Supprimer l'avis",
  echecSuppression: "Impossible de supprimer cet avis pour le moment. Réessaie.",
  annuler: "Annuler", // validé le 25/09/2026 ; libellé commun de l'app (PieceScreen, AccountScreen)
};

const formatDate = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function AvisEnregistreScreen() {
  const { state, actions, avisEnregistreActif: avis } = useCapsela();
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState<"aucune" | "en_cours" | "echec">("aucune");
  const [correctionRefusee, setCorrectionRefusee] = useState(false);

  if (!avis) {
    // Arrivée sans avis (rechargement de la liste, suppression) : retour au Journal.
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <AppHeader />
        <LienRetour onClick={actions.fermerAvisEnregistre} label="Revenir" />
      </div>
    );
  }

  const supprimer = async () => {
    setSuppression("en_cours");
    const ok = await actions.supprimerAvisEnregistre(avis.id);
    if (ok) {
      setConfirmation(false);
      actions.fermerAvisEnregistre();
    } else {
      setSuppression("echec");
    }
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* En-tête global de Capsela, entier (brief V2 du 26/09/2026) ; le
          retour, dans le contenu, ramène d'où l'avis a été ouvert — Journal
          ou liste complète. */}
      <AppHeader />
      <div className="flex items-center justify-between gap-3">
        <LienRetour onClick={actions.fermerAvisEnregistre} label="Revenir" />
        {premiumRequis("AVIS_DE_STYLISTE") && <BadgePremium />}
      </div>

      <div className="mt-[8px]">
        <div className="t-titre-ecran text-ink">
          Avis de <span className="italic text-terracotta">styliste</span>
        </div>
        <div className="text-[13px] text-muted-3 mt-[8px]">{formatDate(avis.creeLe)}</div>
      </div>

      {/* La photo en héros, comme sur le résultat d'origine (optimisation du
          parcours, 26/09/2026) : ~78 % de la largeur, plafonnée en hauteur. */}
      {avis.photoUrl && (
        <div className="mt-[22px] mx-auto rounded-[22px] overflow-hidden border border-border bg-card" style={{ width: "78%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avis.photoUrl} alt="Ta tenue" className="block w-full object-contain" style={{ maxHeight: "62vh" }} />
        </div>
      )}

      <ResultatAvis avis={avis.avis} pieces={avis.pieces} items={state.items} onOuvrirPiece={(id) => actions.openItem(id, false)} />

      {/* La même couche qu'au résultat (26/09/2026) : les pièces reconnues,
          corrigeables, et les actions sur la composition. Un avis enregistré
          avant la reconnaissance n'en a pas : rien ne s'affiche. */}
      <PiecesReconnues
        reconnaissance={avis.reconnaissance}
        dressing={state.items}
        onCorriger={(index, pieceId) => {
          setCorrectionRefusee(false);
          void actions.corrigerReconnaissanceEnregistree(avis.id, index, pieceId).then((ok) => setCorrectionRefusee(!ok));
        }}
        onOuvrirPiece={(id) => actions.openItem(id, false)}
        onAjouterPiece={actions.ajouterPieceNonReconnue}
        etatJournal={correctionRefusee ? "echec" : undefined}
        messageEchec="Ta correction n'a pas pu être gardée. Réessaie dans un instant."
      />
      {avis.reconnaissance.length > 0 && (
        <EtMaintenantAvis
          composition={compositionReconnue(avis.reconnaissance, state.items)}
          tenueDuJourPortee={state.outfitValidated}
          onPorter={(ids) => actions.reWear(ids, { rester: true })}
          onVoirTenue={actions.goTenues}
          onPlanifier={actions.planifierComposition}
        />
      )}

      <button type="button" onClick={() => setConfirmation(true)} className="mt-[30px] w-full text-center text-[12px] text-rust py-[10px] cursor-pointer">
        {TEXTES.supprimer}
      </button>

      <BottomSheet title={TEXTES.titreConfirmation} open={confirmation} onClose={() => suppression !== "en_cours" && setConfirmation(false)}>
        <div className="text-[13px] text-ink leading-[1.55]">{TEXTES.texteConfirmation}</div>
        {suppression === "echec" && (
          <div className="mt-[12px] text-[12px] text-rust leading-[1.5]" role="alert">
            {TEXTES.echecSuppression}
          </div>
        )}
        <button
          type="button"
          onClick={supprimer}
          disabled={suppression === "en_cours"}
          className="mt-[22px] w-full text-center rounded-full py-[14px] t-bouton bg-rust text-cream cursor-pointer disabled:opacity-60"
        >
          {TEXTES.confirmer}
        </button>
        <button
          type="button"
          onClick={() => setConfirmation(false)}
          disabled={suppression === "en_cours"}
          className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
        >
          {TEXTES.annuler}
        </button>
      </BottomSheet>
    </div>
  );
}
