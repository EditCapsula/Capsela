"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import AppHeader from "@/components/AppHeader";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import { resolveItemImage } from "@/lib/catalogImages";
import { OCC_LABELS } from "@/lib/data";
import { composeOutfitImage } from "@/lib/outfitImage";
import { buildOpinionMessageParts, formatOpinionMessage } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * « Demander un avis » — mise en page de la maquette du 23/09/2026.
 *
 * L'écran répond à quatre questions dans l'ordre où elles se posent : voici ma
 * tenue, voici le message qui partira, l'image part-elle aussi, je partage.
 * La V1 du matin le faisait déjà ; ce qui change ici vient de la maquette et
 * ne touche qu'à la forme :
 *
 *   - bandeau de marque commun (AppHeader) avec le chevron de retour dans sa
 *     gouttière gauche, au lieu d'un bouton rond propre à cet écran ;
 *   - surtitre + titre serif « Un avis de *confiance* », comme l'écran Tenue ;
 *   - le message en LECTURE est composé (titre, puces, question en serif
 *     italique) et ne devient une zone de texte qu'une fois « Modifier »
 *     touché — avec « Modifié » et « Rétablir le message » pour le dire et le
 *     défaire ;
 *   - la ligne d'option est elle-même l'interrupteur, cible de 44 px pleine
 *     largeur plutôt qu'un curseur de 46 px à l'extrémité droite ;
 *   - les deux actions vivent dans une barre basse fixe, au-dessus de la
 *     navigation : elles ne descendent plus avec le message quand il s'allonge.
 *
 * QUATRE POINTS DE LA MAQUETTE N'ONT PAS ÉTÉ REPRIS, et c'est délibéré — ils
 * contredisent des arbitrages mesurés, pas des goûts :
 *
 *   1. Le CTA y est en 14 px, casse de phrase, sans interlettrage. Les CTA
 *      principaux de l'application ont été harmonisés le 23/09 à 13 px /
 *      .1em / capitales, après relevé des 26 boutons pleine largeur. Le
 *      reprendre ici recréerait l'exception qui venait d'être supprimée.
 *   2. Le CTA y est en #9E5B43 (terracotta-deep). Relevé : 27 boutons de
 *      l'application sont en --color-terracotta, et terracotta-deep ne sert
 *      qu'à deux grandes surfaces. Ce serait le seul CTA d'une autre couleur.
 *   3. Le flat-lay y est posé sur un aplat beige. Le 23/09, le panneau crème
 *      sous la composition de l'écran Tenue a été retiré sur demande, pour
 *      que la tenue se lise pareil partout. C'est le MÊME objet à un tap
 *      d'ici : il reste sur terracotta.
 *   4. RIEN N'EST POSÉ SUR LE FLAT-LAY. La maquette y met les pastilles
 *      occasion/météo en bas à gauche et « Image non partagée » en haut à
 *      droite ; les deux couvrent des pièces (le second : 12 à 21 % de la
 *      deuxième, cf. Marque). Les pastilles descendent sous la composition,
 *      l'état rejoint son titre de section.
 *
 *      Remesuré ici avant d'écarter la maquette, plutôt que de reprendre le
 *      relevé de l'écran Tenue — dans une même exécution, les deux pastilles
 *      réelles (207×30 px, jamais de retour à la ligne) posées à
 *      left:12/bottom:12, sur 4 largeurs × 4 tailles de tenue :
 *
 *        largeur   3 pièces   4 pièces        5 pièces        6 pièces
 *        320 px    1 (33%)    2 (33/33%)     3 (33/33/11%)   2 (33/11%)
 *        360 px    1 (31%)    2 (31/29%)     2 (31/29%)      1 (29%)
 *        390 px    1 (29%)    2 (29/18%)     2 (29/18%)      1 (18%)
 *        430 px    1 (26%)    2 (26/8%)      2 (26/8%)       1 (8%)
 *
 *      Nombre de cellules recouvertes, et part de chacune. AUCUN des seize
 *      cas ne laisse les pastilles sur du vide : les chaussures sont couvertes
 *      partout, de 8 à 33 %. Une composition n'a pas de zone vide garantie —
 *      ses pièces se placent selon leur nombre et leur catégorie, donc aucun
 *      coin n'est sûr. Les pastilles prennent leur propre ligne SOUS la
 *      composition, comme les badges de provenance de l'écran Tenue.
 *
 * CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE, parce que la V1 en dépendait :
 *
 *   Le bucket catalog-images répond `access-control-allow-origin: *`. Le
 *   flat-lay n'existant qu'en DOM, il n'y a aucun fichier image de la tenue à
 *   partager ; le seul chemin sans backend est de la redessiner sur un canvas,
 *   ce que cet en-tête rend possible (cf. lib/outfitImage.ts).
 *
 * ANNULER N'EST PAS ENVOYER. navigator.share rejette avec AbortError quand la
 * feuille est refermée sans destinataire. Ce cas ne confirme rien : l'écran
 * qui affirmait « Partagée par WhatsApp » sans rien envoyer est précisément ce
 * que cette page a remplacé.
 *
 * AUCUNE PROMESSE SUR LE RETOUR. La réponse du proche arrive là où il l'a
 * reçue. C'est dit une fois, sobrement, plutôt que laissé espérer. La maquette
 * ne porte pas cette ligne ; le brief interdisant toute réponse dans Capsela,
 * elle reste.
 */

/** Capacités lues par useSyncExternalStore : l'export statique rend le HTML sans navigateur. */
const abonnementInerte = () => () => {};
const faux = () => false;
const litPartage = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const litCopie = () => typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);

/**
 * Le partage de FICHIERS est une capacité distincte du partage tout court :
 * un navigateur mobile peut très bien avoir navigator.share sans accepter
 * `files`. Le brief le souligne, et c'est vrai — on l'interroge donc avec un
 * fichier témoin, seule façon d'obtenir une réponse fiable.
 */
const litPartageFichier = () => {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([new Uint8Array(1)], "t.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

const CRAYON = (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </g>
  </svg>
);

/** Lien d'action d'un titre de section : même forme des deux côtés de l'écran. */
function LienSection({ onClick, label, aria }: { onClick: () => void; label: string; aria: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="inline-flex items-center gap-[5px] text-[12px] text-terracotta cursor-pointer flex-shrink-0"
      style={{ minHeight: 44 }}
    >
      {label}
      {CRAYON}
    </button>
  );
}

function TitreSection({
  children,
  action,
  marque,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  marque?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-[10px] mt-6">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</div>
        {marque}
      </div>
      {action}
    </div>
  );
}

/**
 * Petit état accolé à un titre de section — « Image non partagée », « Modifié ».
 *
 * La maquette pose le premier EN SURIMPRESSION en haut à droite du flat-lay.
 * Mesuré au rendu, comme les pastilles : il couvre 12 à 21 % de la deuxième
 * pièce selon la largeur (21 % à 320 px, 12 % à 430 px). Refuser la
 * surimpression en bas et l'accepter en haut n'aurait eu aucun sens : les deux
 * états rejoignent donc le titre de leur section, là où « Modifié » vivait
 * déjà, et se lisent au même endroit sans rien cacher.
 */
function Marque({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-semibold whitespace-nowrap rounded-full flex-shrink-0"
      style={{ padding: "3px 8px", color: "var(--color-sand-text)", background: "var(--color-warm-bg)" }}
    >
      {children}
    </span>
  );
}

/** Pastille posée sous le flat-lay : fond encre translucide, comme la maquette. */
function ChipTenue({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full whitespace-nowrap text-[11px]"
      style={{ height: 30, padding: "0 12px", background: "rgba(29,26,22,.62)", color: "#FBF3EA" }}
    >
      {children}
    </span>
  );
}

type Etat = "defaut" | "partage";

export default function OpinionShareScreen() {
  const { state, geoCity, geoLoading, vestiairePool, actions } = useCapsela();
  const [etat, setEtat] = useState<Etat>("defaut");
  const [avecImage, setAvecImage] = useState(true);
  const [edition, setEdition] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const peutPartager = useSyncExternalStore(abonnementInerte, litPartage, faux);
  const peutCopier = useSyncExternalStore(abonnementInerte, litCopie, faux);
  const peutPartagerFichier = useSyncExternalStore(abonnementInerte, litPartageFichier, faux);

  // Mêmes pièces que l'écran Tenue, résolues depuis la même source : le
  // message ne peut pas décrire une autre tenue que celle affichée.
  const pieces = useMemo<Item[]>(() => {
    const pool = [...state.items, ...vestiairePool];
    return state.outfit.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
  }, [state.items, state.outfit, vestiairePool]);

  const parties = useMemo(
    () =>
      buildOpinionMessageParts({
        pieces,
        occasion: state.occasion || "all",
        temp: geoLoading ? null : geoCity.temp,
        conditionMeteo: geoLoading ? null : geoCity.label,
      }),
    [pieces, state.occasion, geoLoading, geoCity.temp, geoCity.label]
  );
  const messageGenere = useMemo(() => formatOpinionMessage(parties), [parties]);

  /**
   * Le message est éditable, mais reste PILOTÉ par la tenue tant qu'on n'y a
   * pas touché : changer de tenue doit rafraîchir le texte, sinon on partagerait
   * la description d'une autre. Dès la première frappe, la main reprend.
   */
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const message = brouillon ?? messageGenere;
  const modifie = brouillon !== null && brouillon !== messageGenere;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const occasionLabel = state.occasion && state.occasion !== "all" ? OCC_LABELS[state.occasion] : null;
  const meteo =
    !geoLoading && geoCity.temp != null && Number.isFinite(geoCity.temp)
      ? `${Math.round(geoCity.temp)}°${geoCity.label ? ` · ${geoCity.label}` : ""}`
      : null;

  // Une image ne peut être composée que depuis des visuels réels : une tenue
  // dont aucune pièce n'a d'URL ne produirait qu'un aplat. L'option le dit
  // AVANT le clic plutôt que de laisser découvrir un partage sans image.
  const urlsPieces = useMemo(
    () => pieces.map((p) => resolveItemImage(p).url).filter((u): u is string => Boolean(u)),
    [pieces]
  );
  const imageComposable = urlsPieces.length > 0;
  const optionImageActive = peutPartagerFichier && imageComposable;
  const imageJointe = avecImage && optionImageActive;

  const copier = async (silencieux = false) => {
    try {
      await navigator.clipboard.writeText(message);
      if (!silencieux) setToast("Message copié");
      return true;
    } catch {
      return false;
    }
  };

  const partager = async () => {
    setEtat("partage");
    setNote(null);
    try {
      const fichier = imageJointe ? await composeOutfitImage(urlsPieces) : null;
      // Re-vérifié AVEC le vrai fichier : canShare peut refuser ce type ou
      // cette taille précise, là où le fichier témoin passait.
      const avecFichier = fichier !== null && navigator.canShare?.({ files: [fichier] }) === true;
      await navigator.share(avecFichier ? { text: message, files: [fichier!] } : { text: message });
      // Note réservée au cas SURPRENANT : l'appareil annonçait savoir joindre
      // un fichier, et ne l'a pas fait pour celui-ci. Quand la capacité est
      // absente, le sous-texte de l'option le dit déjà avant le clic — le
      // répéter après serait le dire deux fois.
      if (imageJointe && !avecFichier) {
        setNote("L'image n'a pas pu être jointe — seul le texte est parti.");
      }
      setToast(avecFichier ? "Tenue et image partagées" : "Tenue partagée");
    } catch (e) {
      // AbortError = feuille refermée sans destinataire. Ni envoi, ni échec :
      // on ne dit rien, surtout pas une confirmation.
      if (e instanceof Error && e.name === "AbortError") return;
      if (await copier(true)) setToast("Partage indisponible — message copié");
      else setNote("Le partage n'a pas abouti. Sélectionne le message pour le copier à la main.");
    } finally {
      setEtat("defaut");
    }
  };

  const enTete = (
    <div className="flex-shrink-0 px-6 pt-[6px]">
      <AppHeader onBack={actions.closeOpinionShare} backLabel="Retour à ma tenue" />
    </div>
  );

  const titre = (
    <>
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-3">Demander un avis</div>
      <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]">
        Un avis de <span className="italic text-terracotta">confiance</span>
      </div>
    </>
  );

  if (pieces.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col">
        {enTete}
        <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 pb-safe-nav">
          {titre}
          <div className="text-[13px] text-muted mt-6 leading-[1.5]">
            Il n&apos;y a pas de tenue à partager pour l&apos;instant.
          </div>
          <button
            onClick={actions.closeOpinionShare}
            className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
          >
            Retour à ma tenue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {enTete}

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 pb-5">
        {titre}
        <div className="text-[12px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
          Envoie ta tenue à quelqu&apos;un de confiance et demande-lui ce qu&apos;il en pense.
        </div>

        {/* ── 1. LA TENUE ─────────────────────────────────────────────── */}
        <TitreSection
          marque={optionImageActive && !avecImage ? <Marque>Image non partagée</Marque> : undefined}
          action={<LienSection onClick={actions.closeOpinionShare} label="Modifier" aria="Modifier ma tenue" />}
        >
          Ta tenue
        </TitreSection>
        <div className="rounded-[24px] bg-terracotta-deep" style={{ padding: 16 }}>
          <OutfitComposition items={pieces} variant="hero" />
          {(occasionLabel || meteo) && (
            <div className="flex flex-wrap items-center gap-[6px] mt-[12px]">
              {occasionLabel && (
                <ChipTenue>
                  <GlypheOccasion occasion={state.occasion} taille={14} />
                  {occasionLabel}
                </ChipTenue>
              )}
              {meteo && (
                <ChipTenue>
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                    <path
                      d="M7.5 18.5h9.5a3.8 3.8 0 0 0 .4-7.6A5.8 5.8 0 0 0 6.3 12a3.3 3.3 0 0 0 1.2 6.5z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {meteo}
                </ChipTenue>
              )}
            </div>
          )}
        </div>

        {/* ── 2. LE MESSAGE ───────────────────────────────────────────── */}
        <TitreSection
          marque={modifie ? <Marque>Modifié</Marque> : undefined}
          action={
            <LienSection
              onClick={() => setEdition((v) => !v)}
              label={edition ? "Terminer" : "Modifier"}
              aria={edition ? "Terminer la modification du message" : "Modifier le message"}
            />
          }
        >
          Le message qui sera partagé
        </TitreSection>

        {edition ? (
          <textarea
            // autoFocus SEUL ne suffit pas, et c'est mesuré : la zone de texte
            // naît sous la barre d'actions, le curseur s'y plaçant hors champ.
            // Le rappel de référence, appelé au montage, la ramène dans la vue
            // avant la frappe — pas un useEffect, qui ferait un rendu de plus
            // pour un geste purement DOM.
            ref={(el) => {
              if (!el) return;
              el.focus({ preventScroll: true });
              el.scrollIntoView({ block: "center" });
            }}
            value={message}
            onChange={(e) => setBrouillon(e.target.value)}
            rows={Math.min(12, message.split("\n").length + 1)}
            aria-label="Message qui sera partagé"
            className="w-full bg-card rounded-[20px] p-4 text-[13px] text-ink leading-[1.6] resize-y outline-none"
            style={{ fontFamily: "inherit", border: "1px solid var(--color-terracotta-deep)" }}
          />
        ) : (
          <div className="bg-card border border-border rounded-[20px] p-4">
            {modifie ? (
              // Une fois réécrit, le message n'a plus de structure connue : le
              // recomposer en titre/puces/question inventerait une forme que
              // l'utilisatrice n'a pas voulue. Il est rendu tel quel.
              <div className="text-[13px] leading-[1.6] whitespace-pre-wrap" style={{ color: "var(--color-muted-3)" }}>
                {message}
              </div>
            ) : (
              <>
                <div className="text-[13px] font-semibold leading-[1.45] text-ink">{parties.titre}</div>
                <div className="flex flex-col gap-[2px] mt-[10px]">
                  {parties.pieces.map((nom, i) => (
                    <div
                      key={`${nom}-${i}`}
                      className="flex gap-[9px] text-[13px] leading-[1.6]"
                      style={{ color: "var(--color-muted-3)" }}
                    >
                      <span className="text-terracotta" aria-hidden="true">
                        •
                      </span>
                      <span>{nom}</span>
                    </div>
                  ))}
                </div>
                <div className="font-serif italic text-[15px] text-ink mt-[10px]">{parties.question}</div>
              </>
            )}
          </div>
        )}

        {modifie && (
          <button
            onClick={() => {
              setBrouillon(null);
              setEdition(false);
            }}
            className="text-[12px] text-terracotta cursor-pointer mt-1"
            style={{ minHeight: 40 }}
          >
            Rétablir le message
          </button>
        )}

        {/* ── 3. L'IMAGE ──────────────────────────────────────────────── */}
        {/* La LIGNE ENTIÈRE est l'interrupteur : cible de 44 px sur toute la
            largeur au lieu d'un curseur de 46 px collé au bord droit. */}
        <button
          type="button"
          role="switch"
          aria-checked={imageJointe}
          disabled={!optionImageActive}
          onClick={() => setAvecImage((v) => !v)}
          className={
            "w-full flex items-center gap-[14px] text-left bg-card border border-border rounded-[20px] px-4 py-[14px] mt-4 " +
            (optionImageActive ? "cursor-pointer" : "cursor-default")
          }
          style={{ opacity: optionImageActive ? 1 : 0.55 }}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] text-ink">Partager l&apos;image de la tenue</span>
            <span className="block text-[11px] text-muted leading-[1.45] mt-[3px]">
              {!imageComposable
                ? "Aucun visuel n'est disponible pour cette tenue."
                : !peutPartagerFichier
                  ? // Dit AVANT le clic plutôt que découvert après : l'interrupteur
                    // resterait sans effet sur cet appareil.
                    "Ton appareil ne sait pas joindre d'image à un partage — seul le texte partira."
                  : avecImage
                    ? "La personne verra la tenue avec ton message."
                    : "Seul le message sera envoyé, sans image."}
            </span>
          </span>
          <span
            className="flex-shrink-0 rounded-full flex transition-colors"
            style={{
              width: 44,
              height: 26,
              padding: 3,
              justifyContent: imageJointe ? "flex-end" : "flex-start",
              background: imageJointe ? "var(--color-terracotta)" : "#D9CDBB",
            }}
          >
            <span className="rounded-full bg-card" style={{ width: 20, height: 20 }} />
          </span>
        </button>

        {note && (
          <div className="mt-[14px] text-[12px] text-muted leading-[1.5]" aria-live="polite">
            {note}
          </div>
        )}

        {/* Rappel unique : aucune réponse ne revient dans l'application. */}
        <div className="mt-[14px] text-[11px] text-muted leading-[1.45]">
          La réponse de ton proche arrivera là où tu as partagé, pas dans l&apos;application.
        </div>
      </div>

      {/* ── ACTIONS ─────────────────────────────────────────────────────
          Barre basse fixe (maquette) : le message peut faire douze lignes
          sans que « Partager » quitte l'écran. Le remplissage du bas couvre
          la navigation, qui est posée PAR-DESSUS les écrans (TabBar est en
          absolute bottom-0 du conteneur de l'app, cf. App.tsx). */}
      <div
        className="relative flex-shrink-0 flex flex-col gap-2 bg-cream border-t border-border px-6 pt-[10px]"
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)" }}
      >
        {/* ANCRÉ À LA BARRE, pas à une hauteur devinée. Le premier jet posait le
            toast à nav + 126 px ; capturé, il arrivait collé au filet supérieur
            de la barre. Et ce 126 aurait de toute façon été faux dès que la
            barre change de hauteur — elle en a trois (partage + copie, copie
            seule, et la phrase de repli quand le navigateur ne partage pas).
            `bottom: 100%` la suit, quelle qu'elle soit. */}
        {toast && (
          <div
            className="absolute inset-x-6 pointer-events-none z-30"
            style={{ bottom: "100%", marginBottom: 12 }}
            aria-live="polite"
          >
            <div
              className="rounded-[15px] bg-ink text-cream text-[12px] leading-[1.45]"
              style={{ padding: "13px 16px" }}
            >
              {toast}
            </div>
          </div>
        )}
        {peutPartager ? (
          <button
            onClick={partager}
            disabled={etat === "partage"}
            aria-busy={etat === "partage"}
            className={
              "w-full flex items-center justify-center gap-[9px] rounded-full text-[13px] tracking-[.1em] uppercase bg-terracotta text-cream " +
              (etat === "partage" ? "cursor-not-allowed opacity-60" : "active:bg-terracotta-hover cursor-pointer")
            }
            style={{ minHeight: 52 }}
          >
            {etat === "partage" ? (
              <span
                aria-hidden="true"
                className="loading-spinner-arc rounded-full block flex-shrink-0"
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid rgba(251,243,234,.4)",
                  borderTopColor: "#FBF3EA",
                }}
              />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
                </g>
              </svg>
            )}
            <span>{etat === "partage" ? "Préparation…" : "Partager ma tenue"}</span>
          </button>
        ) : (
          <div className="text-[12px] text-muted leading-[1.5] py-1">
            Ton navigateur ne propose pas de partage. Copie le message pour l&apos;envoyer toi-même.
          </div>
        )}

        {peutCopier && (
          <button
            onClick={() => copier()}
            disabled={etat === "partage"}
            className={
              "w-full flex items-center justify-center gap-2 rounded-full bg-card border border-border text-[12px] " +
              (etat === "partage" ? "cursor-not-allowed opacity-60" : "cursor-pointer")
            }
            style={{ minHeight: 44, color: "var(--color-muted-3)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 9h10.5v11.5H9zM15 9V4.5H4.5V15H9" />
              </g>
            </svg>
            <span>Copier le message</span>
          </button>
        )}
      </div>

    </div>
  );
}
