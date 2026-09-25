"use client";

import { useEffect, useRef, useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import LoadingSpinner from "@/components/LoadingSpinner";
import { preparerPhotoAvis } from "@/lib/photoAvis";
import { useCapsela } from "@/lib/store";

/*
 * AVIS DE STYLISTE — écrans 1 à 4 (docs/avis-de-styliste.md, sections 3, 4,
 * 6 et 11).
 *
 * LOT 2 (photo, 25/09/2026) : prendre ou importer une photo, la préparer
 * (photoAvis.ts), l'afficher en aperçu, la remplacer ou la supprimer. La photo
 * ne quitte PAS le téléphone : elle vit dans l'état de cet écran et disparaît
 * avec lui. « Analyser ma tenue » est posé mais inactif — l'envoi relève du
 * lot 3, et ne partira que sur ce clic [DÉCIDÉ].
 *
 * ACCÈS. On n'arrive ici qu'à un statut Premium confirmé (règle
 * AVIS_DE_STYLISTE → PREMIUM_REQUIRED, autorisations.ts). Ce masquage n'est
 * pas une protection : le contrôle qui compte est serveur (assertPremium).
 *
 * POSITIONNEMENT [DÉCIDÉ] : un conseil de styliste, jamais un « outil
 * d'analyse IA » — aucun de ces mots n'apparaît à l'écran.
 *
 * CAMÉRA [HYPOTHÈSE TECHNIQUE retenue] : le champ fichier avec
 * `capture="environment"`, comme l'ajout d'une pièce (AddScreen). Pas de
 * composant caméra : l'app est une page web statique, sans plugin natif. Un
 * refus d'autorisation n'est donc pas détectable par l'app (le système gère
 * la caméra) ; l'alternative recommandée par la spec — l'import — reste
 * toujours proposée à côté.
 */

/**
 * Libellés. Ceux de la spec sont repris tels quels. Pour les autres :
 * - proposition de la spec, affichée en attendant sa validation ;
 * - aucun texte dans la spec : placeholder TODO_COPY.
 */
const TEXTES = {
  prendre: "Prendre une photo", // spec §3, §6
  importer: "Importer une photo", // spec §3, §6
  analyser: "Analyser ma tenue", // spec §3, §4, §6
  changer: "Changer de photo", // spec §4, §6
  retour: "Retour", // spec §6, écran 13 (CTA secondaire)
  // TODO_COPY : suppression de la photo avant analyse ([RECOMMANDÉ] §6 et §11, sans libellé).
  supprimer: "TODO_COPY",
  // TODO_COPY : proposition de la spec (§15, « Fichier invalide »), non validée.
  fichierInvalide: "Ce fichier ne peut pas être utilisé. Choisis une autre photo.",
};

type Photo = { fichier: File; url: string; largeur: number; hauteur: number };
type Vue = "initial" | "preparation" | "apercu" | "invalide";

export default function AvisStylisteScreen() {
  const { actions } = useCapsela();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const [vue, setVue] = useState<Vue>("initial");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [sources, setSources] = useState(false);

  // L'aperçu est une URL locale (blob:) : la libérer dès qu'elle est remplacée
  // ou que l'écran se ferme — rien de la photo ne doit survivre à l'écran.
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

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
    setVue("preparation");
    const r = await preparerPhotoAvis(fichier);
    if (!r.ok) {
      // Photo invalide : l'éventuelle photo précédente est conservée (voir « Changer de photo »).
      setVue("invalide");
      return;
    }
    setPhoto({ fichier: r.fichier, url: URL.createObjectURL(r.fichier), largeur: r.largeur, hauteur: r.hauteur });
    setVue("apercu");
  };

  const supprimer = () => {
    setPhoto(null);
    setVue("initial");
  };

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

      {vue === "initial" && (
        <>
          {/* À ARBITRER: illustration de l'écran 1 (section 6) — aucune tant
              qu'elle n'est pas fournie. Conseil de cadrage ([RECOMMANDÉ] §6,
              « tenue entière, bonne lumière ») : sans libellé validé, non
              affiché — cf. TODO_COPY du rapport de lot. */}
          <div className="mt-[34px] flex flex-col gap-[10px]">
            <button
              type="button"
              onClick={() => choisir("camera")}
              className="w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 cursor-pointer"
            >
              {TEXTES.prendre}
            </button>
            <button
              type="button"
              onClick={() => choisir("galerie")}
              className="w-full rounded-full border border-border-soft text-terracotta text-center text-[13px] py-[15px] cursor-pointer"
            >
              {TEXTES.importer}
            </button>
          </div>
        </>
      )}

      {vue === "preparation" && (
        <div className="mt-[60px] flex justify-center" aria-busy="true">
          <LoadingSpinner size={56} />
        </div>
      )}

      {vue === "invalide" && (
        <div className="mt-[30px]">
          <div className="bg-card border border-border rounded-[20px] px-4 py-[16px] text-[13px] text-ink leading-[1.55]" role="alert">
            {TEXTES.fichierInvalide}
          </div>
          <button
            type="button"
            onClick={() => setSources(true)}
            className="mt-[16px] w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 cursor-pointer"
          >
            {TEXTES.changer}
          </button>
          {photo && (
            <button
              type="button"
              onClick={() => setVue("apercu")}
              className="mt-[6px] w-full text-center text-[12px] text-muted py-[10px] cursor-pointer"
            >
              {/* Revenir à la photo déjà valide, sans rien perdre. */}
              {TEXTES.retour}
            </button>
          )}
        </div>
      )}

      {vue === "apercu" && photo && (
        <div className="mt-[24px]">
          {/* Aperçu local, au ratio de la photo, sans recadrage ; borné en
              hauteur pour laisser les actions visibles. */}
          <div className="mx-auto rounded-[20px] overflow-hidden border border-border bg-card" style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}`, maxHeight: "52vh", maxWidth: "100%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="w-full h-full object-contain block" />
          </div>
          {/* L'analyse ne part que sur ce clic [DÉCIDÉ] — inactif au lot 2. */}
          <button
            type="button"
            disabled
            className="mt-[20px] w-full rounded-full bg-terracotta text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {TEXTES.analyser}
          </button>
          <button
            type="button"
            onClick={() => setSources(true)}
            className="mt-[10px] w-full rounded-full border border-border-soft text-terracotta text-center text-[13px] py-[13px] cursor-pointer"
          >
            {TEXTES.changer}
          </button>
          <button type="button" onClick={supprimer} className="mt-[4px] w-full text-center text-[12px] text-muted py-[10px] cursor-pointer">
            {TEXTES.supprimer}
          </button>
        </div>
      )}

      {/* « Changer de photo » : retour au choix de la source (spec §3). La photo
          actuelle reste en place tant qu'une nouvelle photo valide ne l'a pas
          remplacée — annuler ne fait rien perdre. */}
      <BottomSheet title={TEXTES.changer} open={sources} onClose={() => setSources(false)}>
        <div className="flex flex-col gap-[10px]">
          <button
            type="button"
            onClick={() => choisir("camera")}
            className="w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 cursor-pointer"
          >
            {TEXTES.prendre}
          </button>
          <button
            type="button"
            onClick={() => choisir("galerie")}
            className="w-full rounded-full border border-border-soft text-terracotta text-center text-[13px] py-[15px] cursor-pointer"
          >
            {TEXTES.importer}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
