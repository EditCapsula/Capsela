"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import LogoCapsela from "@/components/LogoCapsela";

/**
 * Bandeau de marque : logo Capsela centré, avatar profil à
 * droite (masqué sur les écrans d'avant-connexion et de profil). Sur fond
 * sombre (Premium), le logo complet (coloré pour fond clair) cède la place
 * à l'icône seule + "CAPSELA" (correctif 22/08/2026 : le résidu
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
  action,
  gauche,
}: {
  showAvatar?: boolean;
  dark?: boolean;
  onBack?: () => void;
  /** Destination réelle plutôt que « Retour » : c'est ce qu'une lectrice d'écran entend. */
  backLabel?: string;
  /**
   * Un bouton à la place de l'avatar, dans la même gouttière de 34 px — le
   * menu « ••• » d'un avis de styliste (30/09/2026). Le logo reste centré.
   */
  action?: React.ReactNode;
  /** Un bouton dans la gouttière gauche quand il n'y a pas de retour (calendrier de l'accueil, 07/10/2026). */
  gauche?: React.ReactNode;
}) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  // L'entrée GLOBALE du calendrier (05/10/2026), posée dans la gouttière gauche de TOUS les écrans de premier niveau
  // (Accueil, Dressing, Capsule, Journal, Planifier) : un même bandeau partout (07/10/2026). Un écran à retour, à action
  // ou d'avant-connexion garde sa gouttière.
  const calendrierParDefaut = !onBack && gauche === undefined && !action && showAvatar && !dark;
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
        {!onBack && gauche}
        {calendrierParDefaut && (
          <button onClick={actions.goCalendrier} aria-label="Ouvrir mon calendrier" className="w-[34px] h-[34px] flex items-center justify-center rounded-full text-ink cursor-pointer active:opacity-70">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
                <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
              </g>
            </svg>
          </button>
        )}
      </div>
      {dark ? (
        <LogoCapsela taille="sm" claire />
      ) : (
        <LogoCapsela />
      )}
      <div className="w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center">
        {action ?? (showAvatar && (
          <button
            onClick={actions.goProfile}
            className={
              "w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-serif cursor-pointer " +
              (dark ? "bg-[rgba(243,238,229,.12)] text-cream" : "bg-ink text-cream")
            }
          >
            {initial}
          </button>
        ))}
      </div>
    </div>
  );
}
