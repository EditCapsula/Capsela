"use client";

import { useRef, useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResultatAvis from "@/components/ResultatAvis";
import { reactionErreur } from "@/lib/avisStylisteClient";
import { preparerPhotoAvis } from "@/lib/photoAvis";
import { useCapsela, type PhotoAvis } from "@/lib/store";

/*
 * AVIS DE STYLISTE — écrans du MVP (docs/avis-de-styliste.md, sections 3, 4,
 * 6, 8, 15), hors « Avec ton dressing » et hors enregistrement Journal (lots
 * suivants).
 *
 * LOT 2 : photo (photoAvis.ts). LOT 3 : analyse. La photo, l'état de
 * l'analyse et le résultat vivent dans le store (session en mémoire, point
 * 16) : une analyse lancée continue si l'on quitte l'écran, et l'écran la
 * retrouve — en cours, réussie ou échouée — quand on y revient.
 *
 * ACCÈS. On n'arrive ici qu'à un statut Premium confirmé (AVIS_DE_STYLISTE →
 * PREMIUM_REQUIRED). Le contrôle qui compte est serveur : si la fonction
 * refuse (compte non Premium), l'écran montre le Premium Gate ; si elle ne
 * peut pas vérifier le statut, un message d'erreur et « Réessayer » — jamais
 * le Gate (arbitré).
 *
 * POSITIONNEMENT [DÉCIDÉ] : un conseil de styliste, jamais un « outil
 * d'analyse IA » — aucun de ces mots n'apparaît à l'écran.
 *
 * CAMÉRA [HYPOTHÈSE TECHNIQUE retenue] : le champ fichier avec
 * `capture="environment"`, comme l'ajout d'une pièce (AddScreen). Un refus
 * d'autorisation n'est pas détectable par une page web ; l'import reste
 * toujours proposé à côté.
 */

/**
 * Libellés. Ceux de la spec sont repris tels quels ; les propositions de la
 * spec sont affichées en attendant leur validation ; sans aucun texte dans la
 * spec : placeholder TODO_COPY.
 */
const TEXTES = {
  prendre: "Prendre une photo", // §3, §6
  importer: "Importer une photo", // §3, §6
  analyser: "Analyser ma tenue", // §3, §4, §6
  changer: "Changer de photo", // §4, §6
  retour: "Retour", // §6, écran 13
  reessayer: "Réessayer", // §4, §15
  enregistrer: "Enregistrer dans mon journal", // §3, §12
  nouvelle: "Nouvelle analyse", // §3, §12
  enregistre: "Enregistré", // §4 (état « Enregistré » après succès)
  // TODO_COPY : proposition de la spec (§15, « Problème de stockage »), non validée.
  enregistrementEchoue: "L'enregistrement n'a pas abouti. Réessaie.",
  // TODO_COPY : suppression de la photo avant analyse ([RECOMMANDÉ] §6 et §11, sans libellé).
  supprimer: "TODO_COPY",
  // TODO_COPY : message d'attente pendant l'analyse (§6, « libellé À ARBITRER »).
  attente: "TODO_COPY",
  // TODO_COPY : proposition de la spec (§15, « Fichier invalide »), non validée.
  fichierInvalide: "Ce fichier ne peut pas être utilisé. Choisis une autre photo.",
};

const BOUTON_PRINCIPAL =
  "w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const BOUTON_SECONDAIRE = "w-full rounded-full border border-border-soft text-terracotta text-center text-[13px] py-[14px] cursor-pointer";
const LIEN = "w-full text-center text-[12px] text-muted py-[10px] cursor-pointer";

function Apercu({ photo, hauteurMax = "52vh" }: { photo: PhotoAvis; hauteurMax?: string }) {
  return (
    <div
      className="mx-auto rounded-[20px] overflow-hidden border border-border bg-card"
      style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}`, maxHeight: hauteurMax, maxWidth: "100%" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt="" className="w-full h-full object-contain block" />
    </div>
  );
}

export default function AvisStylisteScreen() {
  const { state, actions, avisStyliste } = useCapsela();
  const { photo, analyse } = avisStyliste;
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  /** États propres à la sélection d'une photo, avant qu'elle ne rejoigne la session. */
  const [selection, setSelection] = useState<"aucune" | "preparation" | "invalide">("aucune");
  const [sources, setSources] = useState(false);
  /** Refus serveur « non Premium » déjà vu et refermé : ne pas rouvrir le Gate à chaque rendu. */
  const [gateFerme, setGateFerme] = useState<string | null>(null);

  const choisir = (source: "camera" | "galerie") => {
    setSources(false);
    (source === "camera" ? cameraRef : galerieRef).current?.click();
  };

  const recevoir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    // Réinitialiser le champ : sans cela, choisir deux fois la même photo ne
    // déclencherait plus rien. Annuler le sélecteur n'envoie pas d'événement :
    // on reste alors exactement où l'on était.
    e.target.value = "";
    if (!fichier) return;
    setSources(false);
    setSelection("preparation");
    const r = await preparerPhotoAvis(fichier);
    if (!r.ok) {
      // La photo précédente, s'il y en a une, reste en place (cf. « Retour »).
      setSelection("invalide");
      return;
    }
    actions.definirPhotoAvis({ fichier: r.fichier, url: URL.createObjectURL(r.fichier), largeur: r.largeur, hauteur: r.hauteur });
    setSelection("aucune");
  };

  const reaction = analyse.etat === "echouee" ? reactionErreur(analyse.code, analyse.raison) : null;
  const cleRefus = analyse.etat === "echouee" ? `${analyse.code}:${photo?.url ?? ""}` : null;
  const gateOuvert = reaction?.action === "gate" && gateFerme !== cleRefus;

  let contenu: React.ReactNode;
  if (selection === "preparation") {
    contenu = (
      <div className="mt-[60px] flex justify-center" aria-busy="true">
        <LoadingSpinner size={56} />
      </div>
    );
  } else if (selection === "invalide") {
    contenu = (
      <div className="mt-[30px]">
        <div className="bg-card border border-border rounded-[20px] px-4 py-[16px] text-[13px] text-ink leading-[1.55]" role="alert">
          {TEXTES.fichierInvalide}
        </div>
        <button type="button" onClick={() => setSources(true)} className={BOUTON_PRINCIPAL + " mt-[16px]"}>
          {TEXTES.changer}
        </button>
        {photo && (
          <button type="button" onClick={() => setSelection("aucune")} className={LIEN + " mt-[6px]"}>
            {TEXTES.retour}
          </button>
        )}
      </div>
    );
  } else if (!photo) {
    // Écran 1 — choix de la source.
    // À ARBITRER: illustration de l'écran 1 (§6). Conseil de cadrage
    // ([RECOMMANDÉ] §6) : sans libellé validé, non affiché (TODO_COPY).
    contenu = (
      <div className="mt-[34px] flex flex-col gap-[10px]">
        <button type="button" onClick={() => choisir("camera")} className={BOUTON_PRINCIPAL}>
          {TEXTES.prendre}
        </button>
        <button type="button" onClick={() => choisir("galerie")} className={BOUTON_SECONDAIRE}>
          {TEXTES.importer}
        </button>
      </div>
    );
  } else if (analyse.etat === "en_cours") {
    // Écran 5 — analyse. Aucun « Annuler » : l'analyse continue même si l'on
    // quitte l'écran (point 16) ; le CTA a disparu, donc pas de double envoi.
    contenu = (
      <div className="mt-[24px]" aria-busy="true">
        <Apercu photo={photo} hauteurMax="36vh" />
        <div className="mt-[26px] flex flex-col items-center gap-[12px]">
          <LoadingSpinner size={56} />
          <div className="text-[13px] text-muted-3 text-center">{TEXTES.attente}</div>
        </div>
      </div>
    );
  } else if (analyse.etat === "reussie") {
    // Écrans 6 à 9 et 12, en un écran unique qui défile — À ARBITRER: écran
    // unique ou écrans séparés (point 12) ; l'écran unique est le plus
    // réversible. L'avis global est toujours lu en premier, les points forts
    // avant le conseil [§6].
    const enregistrement = avisStyliste.enregistrement;
    contenu = (
      <div className="mt-[22px]">
        <Apercu photo={photo} hauteurMax="30vh" />
        <ResultatAvis avis={analyse.avis} pieces={analyse.dressing} items={state.items} onOuvrirPiece={(id) => actions.openItem(id, false)} />
        <div className="mt-[30px] flex flex-col gap-[10px]">
          {/* « Enregistrer dans mon journal » (§14) : action volontaire ;
              désactivé pendant l'écriture ; remplacé par l'état « Enregistré »
              après succès — un même résultat ne s'enregistre pas deux fois ;
              en cas d'échec, message et nouvel essai, résultat intact. */}
          {enregistrement === "fait" ? (
            <div className="w-full rounded-full bg-warm-bg border border-warm-border text-terracotta text-center text-[13px] tracking-[.1em] uppercase py-4" role="status">
              ✓ {TEXTES.enregistre}
            </div>
          ) : (
            <button type="button" onClick={actions.enregistrerAvisStyliste} disabled={enregistrement === "en_cours"} className={BOUTON_PRINCIPAL}>
              {enregistrement === "echec" ? TEXTES.reessayer : TEXTES.enregistrer}
            </button>
          )}
          {enregistrement === "echec" && (
            <div className="text-[12px] text-rust text-center leading-[1.45]" role="alert">
              {TEXTES.enregistrementEchoue}
            </div>
          )}
          {/* À ARBITRER: avertir avant de quitter un résultat non enregistré
              (point 18) — aucun avertissement en attendant, le plus réversible. */}
          <button type="button" onClick={() => actions.definirPhotoAvis(null)} className={BOUTON_SECONDAIRE}>
            {TEXTES.nouvelle}
          </button>
        </div>
      </div>
    );
  } else if (reaction && reaction.action !== "gate") {
    // Écran 13 — erreur : message humain, jamais technique, et une sortie.
    contenu = (
      <div className="mt-[24px]">
        <Apercu photo={photo} hauteurMax="30vh" />
        <div className="mt-[20px] bg-card border border-border rounded-[20px] px-4 py-[16px]" role="alert">
          <div className="text-[14px] text-ink leading-[1.5]">{reaction.message}</div>
          {reaction.action === "reessayer" && reaction.sousTexte && (
            <div className="text-[12px] text-muted mt-[4px] leading-[1.45]">{reaction.sousTexte}</div>
          )}
        </div>
        {reaction.action === "reessayer" ? (
          <button type="button" onClick={actions.lancerAvisStyliste} className={BOUTON_PRINCIPAL + " mt-[16px]"}>
            {TEXTES.reessayer}
          </button>
        ) : (
          <button type="button" onClick={() => setSources(true)} className={BOUTON_PRINCIPAL + " mt-[16px]"}>
            {TEXTES.changer}
          </button>
        )}
        <button type="button" onClick={actions.revenirAApercuAvis} className={LIEN + " mt-[6px]"}>
          {TEXTES.retour}
        </button>
      </div>
    );
  } else {
    // Écran 4 — photo sélectionnée. L'analyse ne part que sur ce clic [DÉCIDÉ].
    contenu = (
      <div className="mt-[24px]">
        <Apercu photo={photo} />
        <button type="button" onClick={actions.lancerAvisStyliste} className={BOUTON_PRINCIPAL + " mt-[20px]"}>
          {TEXTES.analyser}
        </button>
        <button type="button" onClick={() => setSources(true)} className={BOUTON_SECONDAIRE + " mt-[10px]"}>
          {TEXTES.changer}
        </button>
        <button type="button" onClick={() => actions.definirPhotoAvis(null)} className={LIEN + " mt-[4px]"}>
          {TEXTES.supprimer}
        </button>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <div className="flex items-center justify-between">
        <BoutonRetour onClick={actions.goHome} label="Revenir à l'accueil" />
        <BadgePremium />
      </div>

      <div className="mt-[22px]">
        <div className="font-serif text-[27px] leading-[1.12] text-ink">
          Avis de <span className="italic text-terracotta">styliste</span>
        </div>
        {/* Promesse [DÉCIDÉ], section 1. */}
        <div className="text-[14px] text-muted-3 leading-[1.5] mt-[10px]">Montre-moi ta tenue, je te donne mon avis.</div>
      </div>

      {/* Champs natifs, invisibles : la caméra arrière, et la galerie / les fichiers. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={recevoir} className="hidden" />
      <input ref={galerieRef} type="file" accept="image/*" onChange={recevoir} className="hidden" />

      {contenu}

      {/* « Changer de photo » : retour au choix de la source (spec §3). La photo
          actuelle reste en place tant qu'une nouvelle photo valide ne l'a pas
          remplacée — annuler ne fait rien perdre. */}
      <BottomSheet title={TEXTES.changer} open={sources} onClose={() => setSources(false)}>
        <div className="flex flex-col gap-[10px]">
          <button type="button" onClick={() => choisir("camera")} className={BOUTON_PRINCIPAL}>
            {TEXTES.prendre}
          </button>
          <button type="button" onClick={() => choisir("galerie")} className={BOUTON_SECONDAIRE}>
            {TEXTES.importer}
          </button>
        </div>
      </BottomSheet>

      {/* Refus serveur « non Premium » (compte gratuit ou expiré) : le même Gate
          que l'accueil. « Plus tard » laisse sur cet écran, photo intacte. */}
      <GateAvisStyliste
        open={gateOuvert}
        onClose={() => {
          setGateFerme(cleRefus);
          actions.revenirAApercuAvis();
        }}
        onDecouvrirPremium={() => {
          setGateFerme(cleRefus);
          actions.revenirAApercuAvis();
          actions.goPremium();
        }}
      />
    </div>
  );
}
