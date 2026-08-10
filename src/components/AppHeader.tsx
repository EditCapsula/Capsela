"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

/**
 * Bandeau de marque du prototype v2 : ✦ CAPSELA centré, avatar profil à droite
 * (masqué sur les écrans d'avant-connexion et de profil).
 */
export default function AppHeader({ showAvatar = true }: { showAvatar?: boolean }) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="w-[34px] flex-shrink-0" />
      <div className="flex items-center gap-2">
        <span className="font-serif italic text-[14px] text-terracotta">✦</span>
        <span className="font-serif text-[15px] tracking-[.28em] text-ink pl-[.28em]">CAPSELA</span>
      </div>
      <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center">
        {showAvatar && (
          <button
            onClick={actions.goProfile}
            className="w-[34px] h-[34px] rounded-full bg-ink text-cream flex items-center justify-center text-[13px] font-serif cursor-pointer"
          >
            {initial}
          </button>
        )}
      </div>
    </div>
  );
}
