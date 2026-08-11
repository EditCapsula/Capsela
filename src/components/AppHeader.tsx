"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

/**
 * Bandeau de marque : logo complet L'édit Capsela centré, avatar profil à
 * droite (masqué sur les écrans d'avant-connexion et de profil). Sur fond
 * sombre (Premium), le logo complet (coloré pour fond clair) cède la place
 * à l'icône seule + "CAPSELA", comme dans la maquette.
 */
export default function AppHeader({
  showAvatar = true,
  dark = false,
}: {
  showAvatar?: boolean;
  dark?: boolean;
}) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="w-[34px] flex-shrink-0" />
      {dark ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="" className="h-[22px] w-auto" />
          <span className="font-serif text-[15px] tracking-[.28em] pl-[.28em] text-cream">CAPSELA</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo-full.svg" alt="L'édit Capsela" className="h-[40px] w-auto" />
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
