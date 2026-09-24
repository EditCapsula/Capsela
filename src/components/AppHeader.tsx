"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";

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
  backLabel = "Revenir à l'écran précédent",
}: {
  showAvatar?: boolean;
  dark?: boolean;
  onBack?: () => void;
  /** Destination réelle plutôt que « Retour » : c'est ce qu'une lectrice d'écran entend. */
  backLabel?: string;
}) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center">
        {onBack && (
          /* Même bouton que partout ailleurs depuis le 24/09 (cf.
             BoutonRetour) : ce bandeau portait jusque-là un chevron NU, sans
             cercle, quand les douze autres écrans en avaient un cerclé —
             deux formes pour un même geste, signalé en capture.

             34 px et non 38 : le bandeau réserve deux gouttières de 34, et
             l'avatar occupe celle de droite. Le bouton en devient le miroir
             exact, alors que 38 déborderait et décalerait le logo centré. La
             zone touchable reste à 44 px, le composant s'en charge. */
          <BoutonRetour onClick={onBack} label={backLabel} taille={34} sombre={dark} />
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
