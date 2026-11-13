"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import LogoCapsela from "@/components/LogoCapsela";
import { TitreDePage } from "@/components/TitrePage";
import { PointRappel, useRappelValise } from "@/components/RappelValise";
import { useNotifications } from "@/lib/notificationsStore";

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
  cloche,
  titre,
  sansLogo = false,
  calendrier = false,
  point = true,
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
  /**
   * La cloche du centre de notifications (12/11/2026), à gauche de l'avatar. D'abord sur l'accueil seul, puis le même jour sur toutes
   * les pages majeures (demandé) : par défaut, là où le calendrier est posé — Accueil, Dressing, Capsule, Planifier, Journal —, jamais
   * sur un écran à retour ni avant la connexion. Les deux gouttières s'élargissent ensemble pour garder le logo centré.
   */
  cloche?: boolean;
  /**
   * LE TITRE DE LA PAGE À LA PLACE DU LOGO (13/11/2026, demandé ; planche « option A », graisse 500, tout en noir). Le logo ne reste
   * que sur l'accueil, centré ; ailleurs, le titre remonte dans le bandeau, à gauche de la cloche et de l'avatar, après le
   * retour s'il y en a un. Un point final le signe, comme celui du logo (`point={false}` pour un titre qui finit par « ? » ou « ! »).
   */
  titre?: React.ReactNode;
  /**
   * Le bandeau sans logo ni titre (13/11/2026, option b) : la fiche d'une pièce du dressing, page produit dont le titre est le nom
   * de la pièce, sous la photo. Le retour et l'avatar gardent leur place.
   */
  sansLogo?: boolean;
  point?: boolean;
  /**
   * L'icône calendrier (13/11/2026) : sur l'accueil, dans la gouttière gauche du logo centré ; dans Planifier, ferrée à droite avant
   * la cloche, le titre de la page occupant la gauche. Plus sur les autres pages.
   */
  calendrier?: boolean;
}) {
  const { profile, email } = useAuth();
  const { actions } = useCapsela();
  // L'entrée GLOBALE du calendrier (05/10/2026), posée dans la gouttière gauche de TOUS les écrans de premier niveau
  // (Accueil, Dressing, Capsule, Journal, Planifier) : un même bandeau partout (07/10/2026). Un écran à retour, à action
  // ou d'avant-connexion garde sa gouttière.
  // Depuis le 13/11/2026, le calendrier ne vit plus que sur l'accueil et dans Planifier (`calendrier`).
  const premierNiveau = !onBack && gauche === undefined && !action && showAvatar && !dark;
  const avecCloche = cloche ?? premierNiveau;
  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  // Un départ dans les sept jours (rappelsValise.ts) : un point sur le calendrier, le même que sur l'onglet Planifier.
  const rappelValise = useRappelValise();
  const { nonLues } = useNotifications();
  const gouttiere = avecCloche ? "w-[76px] h-[34px] flex-shrink-0 flex items-center" : "w-[34px] h-[34px] flex-shrink-0 flex items-center justify-center";

  const boutonCalendrier = (
    <button
      onClick={actions.goCalendrier}
      aria-label={rappelValise ? "Ouvrir mon calendrier, un départ approche" : "Ouvrir mon calendrier"}
      className="w-[34px] h-[34px] flex items-center justify-center rounded-full text-ink cursor-pointer active:opacity-70"
    >
      <span className="relative block">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
          </g>
        </svg>
        {rappelValise && <PointRappel />}
      </span>
    </button>
  );
  const boutonCloche = avecCloche && (
    <button
      onClick={actions.goNotifications}
      aria-label={nonLues ? `Notifications, ${nonLues} non ${nonLues === 1 ? "lue" : "lues"}` : "Notifications"}
      className="w-[34px] h-[34px] flex items-center justify-center rounded-full text-ink cursor-pointer active:opacity-70"
    >
      <span className="relative block">
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 16.5V11a5.5 5.5 0 0111 0v5.5l1.5 2h-14l1.5-2z" />
            <path d="M10 20.5a2 2 0 004 0" />
          </g>
        </svg>
        {nonLues > 0 && <PointRappel />}
      </span>
    </button>
  );
  const boutonAvatar =
    action ??
    (showAvatar && (
      <button
        onClick={actions.goProfile}
        className={
          // L'initiale en Manrope demi-gras (12/11/2026, brief 2.3, point 5) : en Bodoni à 13 px, elle se lisait mal — et la règle du
          // 04/11/2026 ne veut plus de Bodoni sous 19 px.
          "w-[34px] h-[34px] rounded-full flex items-center justify-center text-[14px] leading-none font-sans font-semibold cursor-pointer " +
          (dark ? "bg-[rgba(243,238,229,.12)] text-cream" : "bg-ink text-cream")
        }
      >
        {initial}
      </button>
    ));

  // LE TITRE À LA PLACE DU LOGO (13/11/2026) : le bloc de gauche prend la place, les icônes restent groupées à droite. Une
  // légère marge au-dessus (demandée) ; la zone sûre d'iOS (encoche, Dynamic Island) est déjà laissée libre par la coque de l'app
  // (globals.css), le bandeau n'a donc rien à y ajouter.
  if (titre !== undefined) {
    return (
      <div className="flex items-start justify-between gap-3 pt-[8px] mb-[10px]">
        <div className="flex items-start gap-[10px] min-w-0 flex-1">
          {onBack && <BoutonRetour onClick={onBack} label={backLabel} taille={34} sombre={dark} />}
          <TitreDePage point={point} className="pt-[4px]">
            {titre}
          </TitreDePage>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
          {calendrier && boutonCalendrier}
          {boutonCloche}
          {boutonAvatar}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-[10px]">
      <div className={gouttiere + (avecCloche ? " justify-start" : "")}>
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
        {calendrier && boutonCalendrier}
      </div>
      {sansLogo ? null : dark ? (
        <LogoCapsela taille="sm" claire />
      ) : (
        <LogoCapsela />
      )}
      <div className={gouttiere + (avecCloche ? " justify-end gap-2" : "")}>
        {boutonCloche}
        {boutonAvatar}
      </div>
    </div>
  );
}
