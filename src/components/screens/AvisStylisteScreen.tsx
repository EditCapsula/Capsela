"use client";

import { useEffect, useRef, useState } from "react";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import EtMaintenantAvis from "@/components/EtMaintenantAvis";
import PiecesReconnues from "@/components/PiecesReconnues";
import AppHeader from "@/components/AppHeader";
import { LienRetour } from "@/components/BoutonRetour";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResultatAvis from "@/components/ResultatAvis";
import { premiumRequis } from "@/lib/autorisations";
import { useAuth } from "@/lib/auth";
import { contexteDepuisProfil, etapesAnalyse, personnalisationAvis, phraseAnalyse, reactionErreur } from "@/lib/avisStylisteClient";
import { preparerPhotoAvis } from "@/lib/photoAvis";
import { compositionReconnue } from "@/lib/reconnaissance";
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
 * ACCÈS. Règle AVIS_DE_STYLISTE (autorisations.ts) : ACCES_LIBRE en phase de
 * test (26/09/2026), PREMIUM_REQUIRED au lancement — on n'arrive alors ici
 * qu'à un statut Premium confirmé. Le contrôle qui compte est serveur : si la fonction
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
  importer: "Choisir dans ma galerie", // optimisation du parcours, 26/09/2026
  analyser: "Analyser ma tenue", // §3, §4, §6
  changer: "Changer de photo", // §4, §6
  retour: "Retour", // §6, écran 13
  reessayer: "Réessayer", // §4, §15
  nouvelle: "Nouvelle analyse", // §3, §12
  // V2 (26/09/2026) : l'enregistrement est automatique — plus de bouton
  // « Enregistrer dans mon journal », qui suggérait une action manuelle.
  enregistre: "Enregistré dans mon Journal",
  voirJournal: "Voir dans mon Journal",
  enregistrementEchoue: "Impossible d'enregistrer ton avis pour le moment. Réessaie.", // validé le 25/09/2026
  // Le placeholder « TODO_COPY » s'affichait tel quel en production.
  supprimer: "Supprimer cette photo",
  // TODO_COPY : proposition de la spec (§15, « Fichier invalide »), non validée.
  fichierInvalide: "Ce fichier ne peut pas être utilisé. Choisis une autre photo.",
};

const BOUTON_PRINCIPAL =
  "w-full rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-center t-bouton py-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
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

/**
 * INTRODUCTION DU SERVICE (optimisation du parcours, 26/09/2026 ; allégée en
 * V2) : trois temps très compacts, qui disent ce qui va se passer — sans
 * promettre plus que ce que fait réellement l'avis.
 */
const ETAPES_SERVICE: [string, string][] = [
  ["Montre ta tenue", "Photo ou galerie."],
  ["Capsela l'analyse", "Style, couleurs, proportions."],
  ["Reçois ton avis", "Conseils personnalisés."],
];

function IntroService() {
  return (
    <ol className="mt-[26px] flex flex-col gap-[12px]">
      {ETAPES_SERVICE.map(([titre, texte], i) => (
        <li key={titre} className="flex items-start gap-[12px]">
          <span className="w-[26px] h-[26px] flex-shrink-0 rounded-full bg-warm-bg text-terracotta font-serif text-[13px] leading-none flex items-center justify-center">
            {i + 1}
          </span>
          <span className="min-w-0 pt-[3px]">
            <span className="block text-[13px] text-ink font-medium">{titre}</span>
            <span className="block text-[12px] text-muted leading-[1.45] mt-[1px]">{texte}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * CONSEILS PHOTO : discrets, repliés par défaut. Ce sont exactement les
 * causes d'échec que le serveur signale (trop sombre, trop flou, tenue non
 * visible) — les dire avant évite un aller-retour.
 */
function ConseilsPhoto() {
  return (
    <details className="group mt-[22px] bg-card border border-border rounded-[18px] px-4 py-[12px]">
      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none min-h-[28px]">
        <span className="t-surtitre text-muted">Pour un avis plus précis</span>
        <span aria-hidden="true" className="text-muted transition-transform duration-200 group-open:rotate-180">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </summary>
      <ul className="mt-[10px] flex flex-col gap-[6px] text-[13px] text-ink leading-[1.45]">
        <li>• Prends ta tenue en entier, de la tête aux chaussures</li>
        <li>• Privilégie une lumière naturelle</li>
        <li>• Évite les photos trop recadrées ou floues</li>
      </ul>
    </details>
  );
}

/**
 * ÉTAT D'ANALYSE ÉDITORIAL (V2, 26/09/2026 : des mots plutôt qu'une
 * checklist). Les temps décrivent ce que la styliste regarde réellement
 * (etapesAnalyse) ; ils avancent au fil de l'attente, et le dernier reste en
 * cours tant que la réponse n'est pas là. Rien n'est ralenti : dès que l'avis
 * arrive, cet écran disparaît, quel que soit le temps affiché. Aucun
 * pourcentage. ARBITRAGE ÉDITORIAL : le rythme (1,2 s par temps) est un
 * rendu, pas une mesure de l'analyse.
 */
function EtatAnalyse({ etapes, phrase }: { etapes: string[]; phrase: string }) {
  const [faites, setFaites] = useState(0);
  useEffect(() => {
    if (faites >= etapes.length - 1) return;
    const t = setTimeout(() => setFaites((n) => n + 1), 1200);
    return () => clearTimeout(t);
  }, [faites, etapes.length]);
  return (
    <div className="mt-[22px] text-center" aria-busy="true" aria-live="polite">
      <div className="t-titre-carte text-ink">
        Analyse de <span className="italic text-terracotta">ta tenue…</span>
      </div>
      <div className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]">Je regarde chaque détail pour te donner un avis personnalisé.</div>
      <ul className="mt-[18px] inline-flex flex-col items-start gap-[9px] text-left">
        {etapes.map((e, i) => {
          const fait = i < faites;
          const enCours = i === faites;
          return (
            <li key={e} className={"flex items-center gap-[10px] text-[14px] transition-colors duration-300 " + (fait ? "text-ink" : "text-muted")}>
              <span aria-hidden="true" className="w-[16px] flex-shrink-0 flex items-center justify-center text-terracotta">
                {fait ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : (
                  <span className={"block w-[10px] h-[10px] rounded-full border border-terracotta/60 " + (enCours ? "motion-safe:animate-pulse" : "")} />
                )}
              </span>
              <span className="font-serif">{e}</span>
              <span className="sr-only">{fait ? " : fait" : enCours ? " : en cours" : ""}</span>
            </li>
          );
        })}
      </ul>
      <div className="font-serif italic text-[14px] text-muted-3 leading-[1.5] mt-[20px] max-w-[300px] mx-auto">{phrase}</div>
    </div>
  );
}

/**
 * LA PHOTO EN HÉROS du résultat : ~78 % de la largeur (plafonnée en hauteur
 * pour une photo très verticale), coins arrondis, agrandissable d'un tap.
 */
function PhotoHeros({ photo }: { photo: PhotoAvis }) {
  const [plein, setPlein] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setPlein(true)}
        aria-label="Agrandir la photo"
        className="block mx-auto rounded-[22px] overflow-hidden border border-border bg-card cursor-zoom-in motion-safe:animate-[capsule-apparition_320ms_ease-out_both]"
        style={{ width: "78%", aspectRatio: `${photo.largeur} / ${photo.hauteur}`, maxHeight: "62vh" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt="Ta tenue" className="w-full h-full object-cover block" />
      </button>
      {plein && (
        <button
          type="button"
          onClick={() => setPlein(false)}
          aria-label="Fermer la photo"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: "rgba(29,26,22,.88)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Ta tenue" className="max-w-full max-h-full object-contain rounded-[14px]" />
        </button>
      )}
    </>
  );
}

export default function AvisStylisteScreen() {
  const { state, actions, avisStyliste } = useCapsela();
  const { profile } = useAuth();
  const { photo, analyse } = avisStyliste;
  // Le contexte que la styliste reçoit (le même que lancerAvisStyliste) : il
  // décide des temps annoncés pendant l'analyse et de la ligne « Avis donné
  // en tenant compte de… » — jamais plus que ce qui est réellement envoyé.
  const contexte = contexteDepuisProfil(profile);
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
    // Écran 1 — introduction du service, conseils photo, choix de la source
    // (optimisation du parcours, 26/09/2026). « Prendre une photo » reste
    // l'action dominante ; la galerie est secondaire.
    contenu = (
      <>
        <IntroService />
        <ConseilsPhoto />
        <div className="mt-[22px] flex flex-col gap-[10px]">
          <button type="button" onClick={() => choisir("camera")} className={BOUTON_PRINCIPAL}>
            {TEXTES.prendre}
          </button>
          <button type="button" onClick={() => choisir("galerie")} className={BOUTON_SECONDAIRE}>
            {TEXTES.importer}
          </button>
        </div>
      </>
    );
  } else if (analyse.etat === "en_cours") {
    // Écran 5 — analyse. Aucun « Annuler » : l'analyse continue même si l'on
    // quitte l'écran (point 16) ; le CTA a disparu, donc pas de double envoi.
    contenu = (
      <div className="mt-[24px]">
        <Apercu photo={photo} hauteurMax="30vh" />
        <EtatAnalyse etapes={etapesAnalyse(contexte)} phrase={phraseAnalyse(contexte, state.items.length > 0)} />
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
        <PhotoHeros photo={photo} />
        <ResultatAvis
          avis={analyse.avis}
          pieces={analyse.dressing}
          items={state.items}
          onOuvrirPiece={(id) => actions.openItem(id, false)}
          personnalisation={personnalisationAvis(contexte)}
        />
        {/* PHOTO → PIÈCES DU DRESSING → COMPOSITION → ACTIONS (26/09/2026).
            Les pièces reconnues se vérifient et se corrigent ici ; la
            composition qui en sort est la seule que lisent les actions. */}
        <PiecesReconnues
          reconnaissance={analyse.reconnaissance}
          dressing={state.items}
          onCorriger={actions.corrigerReconnaissanceAvis}
          onOuvrirPiece={(id) => actions.openItem(id, false)}
          etatJournal={avisStyliste.reconnaissanceJournal}
          onReessayerJournal={actions.reessayerReconnaissanceJournal}
        />
        {analyse.reconnaissance.length > 0 && (
          <EtMaintenantAvis
            composition={compositionReconnue(analyse.reconnaissance, state.items)}
            tenueDuJourPortee={state.outfitValidated}
            onPorter={(ids) => actions.reWear(ids, { rester: true })}
            onVoirTenue={actions.goTenues}
            onPlanifier={actions.planifierComposition}
          />
        )}
        {/* STATUT JOURNAL (V2, 26/09/2026). L'avis part dans le Journal dès
            qu'il arrive (lancerAvisStyliste) : l'écran dit où il en est, sans
            jamais proposer d'« enregistrer » ce qui l'est déjà. En cas
            d'échec, message et nouvel essai, résultat intact ; un même
            résultat ne s'enregistre jamais deux fois. */}
        <div className="mt-[30px]">
          {enregistrement === "en_cours" && (
            <div className="text-[13px] text-muted-3 text-center py-[12px]" role="status">
              Enregistrement dans ton Journal…
            </div>
          )}
          {enregistrement === "fait" && (
            <div
              className="w-full rounded-[18px] bg-warm-bg border border-warm-border px-4 pt-[12px] flex flex-col items-center text-center motion-safe:animate-[capsule-apparition_240ms_ease-out_both]"
              role="status"
            >
              <span className="text-[13px] text-ink whitespace-nowrap">
                <span aria-hidden="true" className="text-terracotta mr-[6px]">
                  ✓
                </span>
                {TEXTES.enregistre}
              </span>
              <button type="button" onClick={actions.goHistory} className="t-lien text-terracotta cursor-pointer min-h-[44px] flex-shrink-0">
                {TEXTES.voirJournal} →
              </button>
            </div>
          )}
          {enregistrement === "echec" && (
            <>
              <div className="text-[12px] text-rust text-center leading-[1.45]" role="alert">
                {TEXTES.enregistrementEchoue}
              </div>
              <button type="button" onClick={actions.enregistrerAvisStyliste} className={BOUTON_SECONDAIRE + " mt-[10px]"}>
                {TEXTES.reessayer}
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={() => actions.definirPhotoAvis(null)} className={LIEN + " mt-[10px]"}>
          {TEXTES.nouvelle}
        </button>
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
      {/* EN-TÊTE GLOBAL (V2, 26/09/2026) : le même que sur toutes les pages —
          logo centré, profil à droite — sur l'entrée, l'analyse et le
          résultat. Le retour descend dans le contenu. */}
      <AppHeader />
      <div className="flex items-center justify-between gap-3">
        <LienRetour onClick={actions.goHome} label="Revenir à l'accueil" />
        {premiumRequis("AVIS_DE_STYLISTE") && <BadgePremium />}
      </div>

      <div className="mt-[8px]">
        <div className="t-titre-ecran text-ink">
          Avis de <span className="italic text-terracotta">styliste</span>
        </div>
        {/* Promesse (optimisation du parcours, 26/09/2026). */}
        <div className="t-chapeau text-muted-3 mt-[10px]">Un regard expert sur ta tenue, pensé pour ton style.</div>
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
