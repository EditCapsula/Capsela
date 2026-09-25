"use client";

import { useRef, useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import { reactionErreur } from "@/lib/avisStylisteClient";
import { resolveItemImage } from "@/lib/catalogImages";
import { preparerPhotoAvis } from "@/lib/photoAvis";
import { useCapsela, type PhotoAvis } from "@/lib/store";
import type { Item } from "@/lib/types";

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
  ceQuiFonctionne: "Ce qui fonctionne", // décision produit n° 9
  monConseil: "Mon conseil", // décision produit n° 9
  aTester: "À tester", // décision produit n° 9
  avecTonDressing: "Avec ton dressing", // décision produit n° 9
  enregistrer: "Enregistrer dans mon journal", // §3, §12
  nouvelle: "Nouvelle analyse", // §3, §12
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

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-[26px]">
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[10px]">{titre}</div>
      {children}
    </section>
  );
}

function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-[10px]">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-[10px] text-[14px] text-ink leading-[1.5]">
          <span aria-hidden="true" className="text-terracotta text-[11px] mt-[4px] flex-shrink-0">
            ✦
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/** Carte d'une pièce du dressing : visuel et nom (§6, écran 10), toute la carte est le bouton. */
function CartePieceDressing({ item, onClick }: { item: Item; onClick: () => void }) {
  const image = resolveItemImage(item);
  return (
    <button type="button" onClick={onClick} className="min-w-0 text-left cursor-pointer">
      <div
        className="w-full rounded-[14px] border border-border overflow-hidden"
        style={{ aspectRatio: "4/5", background: image.url ? "#F3EDE1" : item.hex }}
      >
        {image.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" loading="lazy" className="w-full h-full object-contain block" style={{ padding: 6, boxSizing: "border-box" }} />
        )}
      </div>
      <div className="text-[12px] text-ink leading-[16px] min-h-[32px] line-clamp-2 mt-[8px]">{item.name}</div>
    </button>
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
    const { avis } = analyse;
    contenu = (
      <div className="mt-[22px]">
        <Apercu photo={photo} hauteurMax="30vh" />
        <div className="mt-[20px] font-serif text-[19px] leading-[1.35] text-ink">{avis.overallAssessment}</div>
        <Section titre={TEXTES.ceQuiFonctionne}>
          <Points points={avis.strengths} />
        </Section>
        <Section titre={TEXTES.monConseil}>
          <div className="bg-warm-bg border border-warm-border rounded-[18px] px-4 py-[14px] text-[14px] text-ink leading-[1.5]">{avis.mainAdvice}</div>
        </Section>
        <Section titre={TEXTES.aTester}>
          <Points points={avis.suggestions} />
        </Section>
        {/* « Avec ton dressing » (§12, option A arbitrée) : uniquement des pièces
            choisies par le serveur dans le dressing de l'utilisatrice, et
            encore présentes au moment de l'affichage (une pièce retirée depuis
            disparaît). Aucune : section masquée (point 4). Clic : fiche de la
            pièce, le résultat restant en mémoire pour le retour (point 17). */}
        {(() => {
          const pieces = analyse.dressing
            .map((p) => state.items.find((i) => i.id === p.id))
            .filter((i): i is Item => Boolean(i));
          if (!pieces.length) return null;
          return (
            <Section titre={TEXTES.avecTonDressing}>
              <div className="grid grid-cols-3 gap-[10px]">
                {pieces.map((it) => (
                  <CartePieceDressing key={it.id} item={it} onClick={() => actions.openItem(it.id, false)} />
                ))}
              </div>
            </Section>
          );
        })()}
        <div className="mt-[30px] flex flex-col gap-[10px]">
          {/* Enregistrement Journal : lot suivant (points 2 et 19). */}
          <button type="button" disabled className={BOUTON_PRINCIPAL}>
            {TEXTES.enregistrer}
          </button>
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
