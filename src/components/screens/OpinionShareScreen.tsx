"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { OutfitComposition } from "@/components/OutfitComposition";
import { buildOpinionMessage } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * « Demander un avis » — refondu le 23/09/2026, signalé « à travailler ».
 *
 * CE QUE FAISAIT L'ÉCRAN AVANT : trois boutons (WhatsApp / Réseaux / SMS)
 * appelaient `sendOpinionRequest(via)`, qui posait deux champs d'état et rien
 * d'autre. Aucun `navigator.share`, aucun presse-papier, aucun lien `sms:` ni
 * `whatsapp://` nulle part dans le dépôt. L'écran affichait ensuite
 * « Partagée par WhatsApp » et « Ta tenue a été envoyée hors de
 * l'application » — deux affirmations fausses. Rien n'était joint non plus :
 * ni pièces, ni image, ni lien.
 *
 * UN SEUL BOUTON, ET C'EST UNE CONSÉQUENCE, PAS UN APPAUVRISSEMENT. Le
 * partage passe par `navigator.share`, qui ouvre la feuille du système — où
 * WhatsApp, les SMS et les réseaux figurent déjà. Garder trois boutons qui
 * ouvrent tous la même feuille aurait remplacé un mensonge par un autre :
 * cliquer « WhatsApp » et voir s'ouvrir un sélecteur générique. Les liens
 * profonds `wa.me` auraient été une vraie destination distincte, mais sur un
 * téléphone sans WhatsApp ils mènent à une page web inutilisable — un cul-de-sac
 * de plus.
 *
 * ANNULER N'EST PAS ENVOYER. `navigator.share` rejette avec AbortError quand
 * l'utilisatrice referme la feuille sans choisir personne. Confirmer dans ce
 * cas reproduirait exactement le défaut corrigé ici, donc seul un partage
 * réellement résolu affiche une confirmation.
 *
 * LE MESSAGE EST MONTRÉ AVANT D'ÊTRE ENVOYÉ. Ce texte sort de l'application
 * vers quelqu'un d'autre : il n'y a aucune raison de le composer dans le dos
 * de celle qui l'envoie.
 *
 * PAS DE RETOUR D'AVIS. La réponse du proche arrive là où il l'a reçue, pas
 * dans l'app — l'écran le dit une fois, sobrement, plutôt que de le laisser
 * espérer.
 */
type Issue = "idle" | "partagee" | "copiee" | "manuel";

/**
 * Capacités du navigateur lues par useSyncExternalStore et non par un effet.
 *
 * Le besoin est réel : l'export statique produit le HTML sans navigateur, donc
 * lire `navigator` pendant le rendu donnerait une réponse fausse au moment de
 * l'hydratation. La première version posait donc un setState dans un effet —
 * que la CI a refusé (react-hooks/set-state-in-effect), à raison : c'est un
 * rendu en cascade pour une valeur qui ne change jamais.
 *
 * useSyncExternalStore est fait exactement pour ça : un instantané serveur
 * distinct de l'instantané client, sans effet ni rendu supplémentaire.
 * L'abonnement est inerte — une capacité de navigateur ne change pas en cours
 * de session — et les trois fonctions sont définies au niveau du module pour
 * garder une référence stable d'un rendu à l'autre.
 */
const abonnementInerte = () => () => {};
const faux = () => false;
const litPartage = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const litCopie = () => typeof navigator !== "undefined" && Boolean(navigator.clipboard?.writeText);

export default function OpinionShareScreen() {
  const { state, geoCity, geoLoading, vestiairePool, actions } = useCapsela();
  const [issue, setIssue] = useState<Issue>("idle");
  const peutPartager = useSyncExternalStore(abonnementInerte, litPartage, faux);
  const peutCopier = useSyncExternalStore(abonnementInerte, litCopie, faux);

  // Mêmes pièces que celles affichées sur l'écran Tenue, résolues depuis la
  // même source : le message ne peut pas décrire une autre tenue que celle
  // que l'utilisatrice a sous les yeux.
  const pieces = useMemo<Item[]>(() => {
    const pool = [...state.items, ...vestiairePool];
    return state.outfit
      .map((id) => pool.find((i) => i.id === id))
      .filter((it): it is Item => Boolean(it));
  }, [state.items, state.outfit, vestiairePool]);

  const message = useMemo(
    () =>
      buildOpinionMessage({
        pieces,
        occasion: state.occasion || "all",
        temp: geoLoading ? null : geoCity.temp,
        conditionMeteo: geoLoading ? null : geoCity.label,
      }),
    [pieces, state.occasion, geoLoading, geoCity.temp, geoCity.label]
  );

  const partager = async () => {
    try {
      await navigator.share({ text: message });
      setIssue("partagee");
    } catch (e) {
      // AbortError = la feuille a été refermée sans choisir de destinataire.
      // Ce n'est pas un échec, et surtout pas un envoi : on ne dit rien.
      if (e instanceof Error && e.name === "AbortError") return;
      await copier();
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setIssue("copiee");
    } catch {
      // Ni partage ni presse-papier : le texte est affiché pour être
      // sélectionné à la main, plutôt qu'un échec sans issue.
      setIssue("manuel");
    }
  };

  const enTete = (
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
  );

  const retour = (
    <button
      onClick={actions.closeOpinionShare}
      className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
    >
      Retour à ma tenue
    </button>
  );

  // Aucune tenue à partager : le bouton mène ici depuis la card, mais une
  // régénération peut l'avoir vidée entre-temps.
  if (pieces.length === 0) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        {enTete}
        <div className="text-[13px] text-muted mt-5 leading-[1.5]">
          Il n&apos;y a pas de tenue à partager pour l&apos;instant.
        </div>
        {retour}
      </div>
    );
  }

  if (issue === "partagee" || issue === "copiee") {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        {enTete}
        <div className="mt-[30px] flex flex-col items-center text-center px-[10px] py-5">
          <span className="w-[52px] h-[52px] rounded-full bg-[#F0E5D6] text-terracotta flex items-center justify-center text-[22px] mb-4">
            ✓
          </span>
          <div className="font-serif text-[19px] text-ink">
            {issue === "partagee" ? "Tenue partagée" : "Message copié"}
          </div>
          {/* Deux phrases distinctes : « partagé » et « copié » ne décrivent
              pas le même événement, et l'ancienne version en confondait bien
              d'autres. */}
          <div className="text-[13px] text-muted mt-2 leading-[1.5] max-w-[280px]">
            {issue === "partagee"
              ? "La réponse de ton proche arrivera là où tu as partagé, pas dans l'application."
              : "Colle-le où tu veux — la réponse arrivera là-bas, pas dans l'application."}
          </div>
        </div>
        {retour}
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {enTete}

      <div className="text-[13px] text-muted mt-4 leading-[1.5]">
        Envoie ta tenue du jour à quelqu&apos;un de confiance avant de te lancer. Tu choisis la personne dans
        l&apos;application de partage.
      </div>

      {/* La tenue, pour qu'on voie ce dont on parle avant de l'envoyer. */}
      <div className="mt-5 rounded-[20px] bg-terracotta-deep" style={{ padding: 14 }}>
        <OutfitComposition items={pieces} variant="hero" />
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[9px]">Ce qui sera envoyé</div>
      <div
        className="bg-card border border-border rounded-[14px] px-4 py-[13px] text-[13px] text-ink leading-[1.55]"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {message}
      </div>
      {/* L'image ne part pas avec le texte, et c'est écrit plutôt que
          découvert : navigator.share sait joindre des fichiers, mais le
          flat-lay n'existe qu'en DOM — en faire une image demanderait un
          rendu canvas des visuels hébergés, qui est un autre chantier. */}
      <div className="text-[11.5px] text-muted mt-[7px] leading-[1.45]">
        Le texte seul est partagé, sans l&apos;image de la tenue.
      </div>

      {peutPartager ? (
        <button
          onClick={partager}
          className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
        >
          Partager ma tenue
        </button>
      ) : peutCopier ? (
        // Pas de feuille de partage (ordinateur, navigateur ancien) : copier
        // est la seule action honnête, et elle porte son vrai nom.
        <button
          onClick={copier}
          className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
        >
          Copier le message
        </button>
      ) : (
        <div className="mt-[22px] text-[12.5px] text-muted leading-[1.5]">
          Ton navigateur ne permet ni le partage ni la copie automatique. Sélectionne le message ci-dessus pour le
          copier à la main.
        </div>
      )}

      {peutPartager && peutCopier && (
        <button
          onClick={copier}
          className="mt-[10px] w-full text-center rounded-full py-[14px] text-[12.5px] tracking-[.08em] uppercase border border-border-soft text-terracotta cursor-pointer"
        >
          Copier le message
        </button>
      )}

      {issue === "manuel" && (
        <div className="mt-[14px] text-[12.5px] text-muted leading-[1.5]">
          La copie automatique a échoué. Sélectionne le message ci-dessus pour le copier à la main.
        </div>
      )}
    </div>
  );
}
