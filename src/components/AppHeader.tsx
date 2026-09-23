"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

/**
 * Bandeau de marque : logo complet L'édit Capsela centré, avatar profil à
 * droite (masqué sur les écrans d'avant-connexion et de profil). Sur fond
 * sombre (Premium), le logo complet (coloré pour fond clair) cède la place
 * à l'icône seule + "L'ÉDIT CAPSELA" (correctif 22/08/2026 : le résidu
 * "CAPSELA" seul contrevenait au renommage produit complet).
 *
 * `onBack` (23/09/2026, maquette « Demander un avis ») remplit la gouttière
 * gauche de 34 px que ce bandeau réservait déjà vide pour équilibrer
 * l'avatar. Un écran secondaire n'a donc plus à poser son propre bouton de
 * retour au-dessus ou à la place du bandeau : le logo reste centré, l'avatar
 * à sa place, et le chevron occupe une gouttière qui existait de toute
 * façon. Sans `onBack`, le rendu est exactement celui d'avant.
 */
export default function AppHeader({
  showAvatar = true,
  dark = false,
  onBack,
  backLabel = "Retour",
}: {
  showAvatar?: boolean;
  dark?: boolean;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={backLabel}
            className={
              "w-[34px] h-[34px] flex items-center justify-center cursor-pointer " +
              (dark ? "text-cream" : "text-ink")
            }
          >
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
              <path
                d="M15 5 8 12l7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      {dark ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="" className="h-6 w-auto" />
          <span className="font-serif text-[15px] tracking-[.28em] pl-[.28em] text-cream">L&apos;ÉDIT CAPSELA</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-full.svg" alt="L'édit Capsela" className="h-11 w-auto" />
      )}
      <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center">
        {showAvatar && (
          <button
            onClick={actions.goProfile}
            className={
              "w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-serif cursor-pointer " +
              (dark ? "bg-[rgba(243,238,229,.12)] text-cream" : "bg-ink text-cream")
            }
          >
            {initial}
          </button>
        )}
      </div>
    </div>
  );
}
