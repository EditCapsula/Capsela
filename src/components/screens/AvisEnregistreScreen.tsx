"use client";

import { useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import EtMaintenantAvis from "@/components/EtMaintenantAvis";
import PiecesReconnues from "@/components/PiecesReconnues";
import AppHeader from "@/components/AppHeader";
import ResultatAvis from "@/components/ResultatAvis";
import { PhotoHeros } from "@/components/screens/AvisStylisteScreen";
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
 *
 * REFONTE ÉDITORIALE (30/09/2026, brief « Avis du styliste »). Le retour
 * passe dans le bandeau, un menu « ••• » y prend la place de l'avatar et
 * porte les actions secondaires : « Modifier les pièces » (ramène aux pièces
 * reconnues, où se fait la correction) et « Supprimer l'avis », qui quitte le
 * bas de page. « Signaler une erreur », demandé par le brief, n'existe pas
 * dans le produit (aucun canal de signalement) : absent plutôt qu'un bouton
 * qui ne mène nulle part. La photo passe en pleine largeur.
 */

const TEXTES = {
  // Suppression d'un avis enregistré — libellés validés le 25/09/2026.
  // « Annuler » conserve l'avis ; « Supprimer l'avis » efface l'avis ET sa photo.
  supprimer: "Supprimer l'avis",
  modifierPieces: "Modifier les pièces",
  titreMenu: "Cet avis",
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
  const [menu, setMenu] = useState(false);

  if (!avis) {
    // Arrivée sans avis (rechargement de la liste, suppression) : retour au Journal.
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        <AppHeader onBack={actions.fermerAvisEnregistre} backLabel="Revenir au Journal" />
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
      {/* Le bandeau commun : le retour ramène d'où l'avis a été ouvert —
          Journal ou liste complète —, le menu « ••• » remplace l'avatar. */}
      <AppHeader
        onBack={actions.fermerAvisEnregistre}
        backLabel="Revenir au Journal"
        action={
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Plus d'actions sur cet avis"
            aria-haspopup="dialog"
            className="relative w-[34px] h-[34px] rounded-full bg-card border border-border text-ink flex items-center justify-center cursor-pointer before:absolute before:-inset-[5px] before:content-['']"
          >
            <span aria-hidden="true" className="text-[16px] leading-none tracking-[.04em]">
              •••
            </span>
          </button>
        }
      />

      {/* Titre d'écran en deux temps et date de l'avis, comme la maquette du 30/09/2026. */}
      <div className="mt-[10px] flex items-start justify-between gap-3">
        <div className="t-titre-ecran text-ink">
          Avis de <span className="italic text-terracotta">styliste</span>
        </div>
        {premiumRequis("AVIS_DE_STYLISTE") && (
          <span className="mt-[6px]">
            <BadgePremium />
          </span>
        )}
      </div>
      <div className="text-[13px] text-muted-3 mt-[6px]">{formatDate(avis.creeLe)}</div>

      {/* LA PHOTO, élément dominant du début de page : pleine largeur,
          entière, plafonnée en hauteur, rien par-dessus — et agrandissable
          d'un tap, comme au résultat d'origine (PhotoHeros). */}
      {avis.photoUrl && (
        <div className="mt-[18px]">
          <PhotoHeros url={avis.photoUrl} taille="100%" />
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
          actionsImposees={{ principale: "demain", secondaires: ["planifier"] }}
        />
      )}

      {/* LE MENU « ••• » — BottomSheet, le seul composant modal de l'app (même
          motif que le menu d'une tenue planifiée). */}
      <BottomSheet title={TEXTES.titreMenu} open={menu} onClose={() => setMenu(false)}>
        <div className="flex flex-col">
          {avis.reconnaissance.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                document.getElementById("avis-pieces-reconnues")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="text-left px-1 py-[14px] text-[13px] text-ink cursor-pointer border-b border-[#EFE7DA]"
              style={{ minHeight: 52 }}
            >
              {TEXTES.modifierPieces}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMenu(false);
              setConfirmation(true);
            }}
            className="text-left px-1 py-[14px] text-[13px] text-rust cursor-pointer"
            style={{ minHeight: 52 }}
          >
            {TEXTES.supprimer}
          </button>
        </div>
      </BottomSheet>

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
