"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { OutfitComposition } from "@/components/OutfitComposition";
import { resolveItemImage } from "@/lib/catalogImages";
import { OCC_LABELS } from "@/lib/data";
import { composeOutfitImage } from "@/lib/outfitImage";
import { buildOpinionMessage } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * « Demander un avis » — V1, brief du 23/09/2026.
 *
 * L'écran répond à quatre questions dans l'ordre où elles se posent : voici ma
 * tenue, voici le message qui partira, l'image part-elle aussi, je partage.
 *
 * CE QUI A ÉTÉ MESURÉ AVANT D'ÉCRIRE, parce que la V1 en dépendait :
 *
 *   Le bucket catalog-images répond `access-control-allow-origin: *`. Le
 *   flat-lay n'existant qu'en DOM, il n'y a aucun fichier image de la tenue à
 *   partager ; le seul chemin sans backend est de la redessiner sur un canvas,
 *   ce que cet en-tête rend possible (cf. lib/outfitImage.ts).
 *
 *   Aucun composant d'interrupteur n'existait dans le projet. Celui d'ici est
 *   local à l'écran et n'emprunte que des jetons existants — pas un système de
 *   composants de plus.
 *
 * ANNULER N'EST PAS ENVOYER. navigator.share rejette avec AbortError quand la
 * feuille est refermée sans destinataire. Ce cas ne confirme rien : l'écran
 * qui affirmait « Partagée par WhatsApp » sans rien envoyer est précisément ce
 * que cette page a remplacé.
 *
 * AUCUNE PROMESSE SUR LE RETOUR. La réponse du proche arrive là où il l'a
 * reçue. C'est dit une fois, sobrement, plutôt que laissé espérer.
 */
type Etat = "defaut" | "partage" | "copie";

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

function Interrupteur({
  actif,
  onChange,
  labelId,
}: {
  actif: boolean;
  onChange: (v: boolean) => void;
  labelId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-labelledby={labelId}
      onClick={() => onChange(!actif)}
      className="relative flex-shrink-0 rounded-full cursor-pointer transition-colors"
      style={{
        width: 46,
        height: 28,
        // Jeton d'accent existant, jamais une couleur nouvelle.
        background: actif ? "var(--color-terracotta)" : "#DCD3C4",
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-transform"
        style={{ width: 22, height: 22, top: 3, left: 3, transform: actif ? "translateX(18px)" : "none" }}
      />
    </button>
  );
}

function LienModifier({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-[5px] text-[12px] text-terracotta cursor-pointer flex-shrink-0"
      style={{ minHeight: 44 }}
    >
      Modifier
      {/* Crayon fin, au trait, comme les glyphes d'occasion. */}
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
        <path
          d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M14.5 6.5 17.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function TitreSection({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mt-7 mb-[10px]">
      <div className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</div>
      {action}
    </div>
  );
}

export default function OpinionShareScreen() {
  const { state, geoCity, geoLoading, vestiairePool, actions } = useCapsela();
  const [etat, setEtat] = useState<Etat>("defaut");
  const [avecImage, setAvecImage] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const zoneTexte = useRef<HTMLTextAreaElement>(null);

  const peutPartager = useSyncExternalStore(abonnementInerte, litPartage, faux);
  const peutCopier = useSyncExternalStore(abonnementInerte, litCopie, faux);
  const peutPartagerFichier = useSyncExternalStore(abonnementInerte, litPartageFichier, faux);

  // Mêmes pièces que l'écran Tenue, résolues depuis la même source : le
  // message ne peut pas décrire une autre tenue que celle affichée.
  const pieces = useMemo<Item[]>(() => {
    const pool = [...state.items, ...vestiairePool];
    return state.outfit.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
  }, [state.items, state.outfit, vestiairePool]);

  const messageGenere = useMemo(
    () =>
      buildOpinionMessage({
        pieces,
        occasion: state.occasion || "all",
        temp: geoLoading ? null : geoCity.temp,
        conditionMeteo: geoLoading ? null : geoCity.label,
      }),
    [pieces, state.occasion, geoLoading, geoCity.temp, geoCity.label]
  );

  /**
   * Le message est éditable, mais reste PILOTÉ par la tenue tant qu'on n'y a
   * pas touché : changer de tenue doit rafraîchir le texte, sinon on partagerait
   * la description d'une autre. Dès la première frappe, la main reprend.
   */
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const message = brouillon ?? messageGenere;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const occasionLabel = state.occasion && state.occasion !== "all" ? OCC_LABELS[state.occasion] : null;
  const meteo =
    !geoLoading && geoCity.temp != null && Number.isFinite(geoCity.temp)
      ? `${Math.round(geoCity.temp)}°${geoCity.label ? ` · ${geoCity.label}` : ""}`
      : null;

  const copier = async (silencieux = false) => {
    try {
      await navigator.clipboard.writeText(message);
      if (!silencieux) setToast("Message copié");
      return true;
    } catch {
      if (!silencieux) setEtat("copie");
      return false;
    }
  };

  const partager = async () => {
    setEtat("partage");
    setNote(null);
    try {
      let fichier: File | null = null;
      if (avecImage && peutPartagerFichier) {
        const urls = pieces
          .map((p) => resolveItemImage(p).url)
          .filter((u): u is string => Boolean(u));
        fichier = await composeOutfitImage(urls);
      }
      // Re-vérifié AVEC le vrai fichier : canShare peut refuser ce type ou
      // cette taille précise, là où le fichier témoin passait.
      const avecFichier = fichier !== null && navigator.canShare?.({ files: [fichier] }) === true;
      await navigator.share(avecFichier ? { text: message, files: [fichier!] } : { text: message });
      // Note réservée au cas SURPRENANT : l'appareil annonçait savoir joindre
      // un fichier, et ne l'a pas fait pour celui-ci. Quand la capacité est
      // absente, le sous-texte de l'option le dit déjà avant le clic — le
      // répéter après serait le dire deux fois.
      if (avecImage && peutPartagerFichier && !avecFichier) {
        setNote("L'image n'a pas pu être jointe — seul le texte est parti.");
      }
      setToast(avecFichier ? "Tenue et image partagées" : "Tenue partagée");
    } catch (e) {
      // AbortError = feuille refermée sans destinataire. Ni envoi, ni échec :
      // on ne dit rien, surtout pas une confirmation.
      if (e instanceof Error && e.name === "AbortError") {
        setEtat("defaut");
        return;
      }
      if (await copier(true)) setToast("Partage indisponible — message copié");
      else setNote("Le partage n'a pas abouti. Sélectionne le message pour le copier à la main.");
    } finally {
      setEtat("defaut");
    }
  };

  const enTete = (
    <>
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.closeOpinionShare}
          aria-label="Retour à ma tenue"
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer flex-shrink-0"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">Demander un avis</div>
      </div>
      <div className="text-[13px] text-muted mt-3 leading-[1.5]">
        Envoie ta tenue à quelqu&apos;un de confiance et demande-lui ce qu&apos;il en pense.
      </div>
    </>
  );

  if (pieces.length === 0) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        {enTete}
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
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {enTete}

      {/* ── 1. LA TENUE ─────────────────────────────────────────────── */}
      <TitreSection action={<LienModifier onClick={actions.closeOpinionShare} label="Modifier ma tenue" />}>
        Ta tenue
      </TitreSection>
      <div className="rounded-[24px] bg-terracotta-deep" style={{ padding: 16 }}>
        <OutfitComposition items={pieces} variant="hero" />
        {(occasionLabel || meteo) && (
          <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] mt-[12px]">
            {occasionLabel && (
              <span
                className="inline-flex items-center uppercase whitespace-nowrap"
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".08em",
                  background: "rgba(243,238,229,.22)",
                  color: "#FBF3EA",
                  borderRadius: 100,
                  padding: "6px 12px",
                }}
              >
                {occasionLabel}
              </span>
            )}
            {meteo && <span className="text-[12.5px]" style={{ color: "#F0DDCF" }}>{meteo}</span>}
          </div>
        )}
      </div>

      {/* ── 2. LE MESSAGE ───────────────────────────────────────────── */}
      <TitreSection
        action={<LienModifier onClick={() => zoneTexte.current?.focus()} label="Modifier le message" />}
      >
        Le message qui sera partagé
      </TitreSection>
      <textarea
        ref={zoneTexte}
        value={message}
        onChange={(e) => setBrouillon(e.target.value)}
        rows={Math.min(12, message.split("\n").length + 1)}
        aria-label="Message qui sera partagé"
        className="w-full bg-card border border-border rounded-[16px] px-4 py-[13px] text-[13px] text-ink leading-[1.55] resize-none"
        style={{ fontFamily: "inherit" }}
      />

      {/* ── 3. L'IMAGE ──────────────────────────────────────────────── */}
      <TitreSection>Options de partage</TitreSection>
      <div className="flex items-start gap-3 bg-card border border-border rounded-[16px] px-4 py-[14px]">
        <div className="flex-1 min-w-0">
          <div id="opt-image" className="text-[13.5px] text-ink">
            Partager l&apos;image de la tenue
          </div>
          <div className="text-[12px] text-muted mt-[3px] leading-[1.45]">
            {peutPartagerFichier
              ? "La personne verra la tenue avec ton message."
              : // Dit AVANT le clic plutôt que découvert après : l'interrupteur
                // resterait sans effet sur cet appareil.
                "Ton appareil ne sait pas joindre d'image à un partage — seul le texte partira."}
          </div>
        </div>
        <Interrupteur
          actif={avecImage && peutPartagerFichier}
          onChange={setAvecImage}
          labelId="opt-image"
        />
      </div>

      {/* ── ACTIONS ─────────────────────────────────────────────────── */}
      {peutPartager ? (
        <button
          onClick={partager}
          disabled={etat === "partage"}
          className={
            "mt-7 w-full flex items-center justify-center gap-[9px] rounded-full py-4 text-[13px] tracking-[.1em] uppercase " +
            (etat === "partage" ? "cursor-not-allowed opacity-60 bg-terracotta text-cream" : "bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer")
          }
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="2.6" />
              <circle cx="6" cy="12" r="2.6" />
              <circle cx="18" cy="19" r="2.6" />
              <path d="M8.4 10.8 15.6 6.4M8.4 13.2l7.2 4.4" />
            </g>
          </svg>
          {etat === "partage" ? "Partage en cours…" : "Partager ma tenue"}
        </button>
      ) : (
        <div className="mt-7 text-[12.5px] text-muted leading-[1.5]">
          Ton navigateur ne propose pas de partage. Copie le message ci-dessous pour l&apos;envoyer toi-même.
        </div>
      )}

      {peutCopier && (
        <button
          onClick={() => copier()}
          className="mt-[10px] w-full text-center rounded-full py-[14px] text-[13px] tracking-[.1em] uppercase border border-border-soft text-terracotta cursor-pointer"
        >
          Copier le message
        </button>
      )}

      {note && (
        <div className="mt-[14px] text-[12.5px] text-muted leading-[1.5]" aria-live="polite">
          {note}
        </div>
      )}

      {/* Rappel unique : aucune réponse ne revient dans l'application. */}
      <div className="mt-[16px] text-[11.5px] text-muted leading-[1.45]">
        La réponse de ton proche arrivera là où tu as partagé, pas dans l&apos;application.
      </div>

      {toast && (
        <div
          className="fixed inset-x-0 mx-auto max-w-[480px] px-6 z-30 pointer-events-none"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 14px)" }}
          aria-live="polite"
        >
          <div className="rounded-full bg-ink text-cream text-[12.5px] text-center py-[11px] px-4">{toast}</div>
        </div>
      )}
    </div>
  );
}
