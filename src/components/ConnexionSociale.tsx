"use client";

import { Capacitor } from "@capacitor/core";
import { isSupabaseConfigured } from "@/lib/supabase";

/*
 * LA ZONE DE CONNEXION SOCIALE (05/11/2026, cahier des charges de la propriétaire « Zone de Connexion Sociale ») : « Continuer avec
 * Apple » et « Continuer avec Google », empilés, puis le séparateur « ou par e-mail ». Partagée par Se connecter (LoginScreen) et Créer
 * un compte (AuthScreen) : un seul composant, une seule apparence.
 *
 * Styles des fournisseurs, comme leurs règles le demandent : Apple en fond noir, texte blanc, logo Apple ; Google en fond blanc, ombre
 * légère, texte gris foncé, logo « G » aux quatre couleurs. Apple passe en premier sur un appareil Apple (app iOS, iPhone, iPad, Mac),
 * Google en premier ailleurs.
 *
 * APPLE N'APPARAÎT QUE S'IL EST BRANCHÉ : la connexion Apple demande des réglages chez Apple (identifiant de service, clé) et dans
 * Supabase (fournisseur Apple activé). Avant eux, le bouton mènerait à une page d'erreur : il reste masqué tant que la variable
 * NEXT_PUBLIC_CONNEXION_APPLE ne vaut pas « 1 » (Vercel, et le workflow Android). En mode démo, il s'affiche pour le rendu.
 */
export const connexionAppleActive = (): boolean => process.env.NEXT_PUBLIC_CONNEXION_APPLE === "1" || !isSupabaseConfigured;

const surAppareilApple = (): boolean => {
  if (Capacitor.getPlatform() === "ios") return true;
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
};

function LogoApple() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9C3.7 4.8 2.1 5.8 1.2 7.3c-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.8-1.1-2.8-4.2zM11.6 3.1c.7-.9 1.2-2 1.1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1.1 3 1.1.1 2.2-.6 2.9-1.4z"
      />
    </svg>
  );
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.7 6c4.5-4.2 6.6-10.3 6.6-17.4z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s.9 7.4 2.7 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.4-4.9 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const BASE =
  "flex items-center justify-center gap-[10px] rounded-full py-[15px] text-[14px] font-medium cursor-pointer motion-safe:transition-[transform,box-shadow,opacity] motion-safe:duration-150 motion-safe:active:scale-[.985] disabled:opacity-50 disabled:cursor-not-allowed";

export default function ConnexionSociale({ onApple, onGoogle, occupe }: { onApple: () => void; onGoogle: () => void; occupe?: boolean }) {
  const apple = connexionAppleActive() ? (
    <button key="apple" type="button" onClick={onApple} disabled={occupe} className={BASE + " bg-[#000] text-[#fff] hover:opacity-90"}>
      <LogoApple />
      Continuer avec Apple
    </button>
  ) : null;
  const google = (
    <button
      key="google"
      type="button"
      onClick={onGoogle}
      disabled={occupe}
      className={BASE + " bg-[#fff] text-[#3c4043] border border-[#dadce0] shadow-[0_1px_2px_rgba(60,64,67,.12)] hover:shadow-[0_2px_6px_rgba(60,64,67,.18)]"}
    >
      <LogoGoogle />
      Continuer avec Google
    </button>
  );
  const boutons = surAppareilApple() ? [apple, google] : [google, apple];
  return (
    <>
      <div className="flex flex-col gap-[10px] mt-7">{boutons}</div>
      <div className="flex items-center gap-[11px] my-[22px]">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10.5px] tracking-[.14em] uppercase text-placeholder">ou par e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>
    </>
  );
}
