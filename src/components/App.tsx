"use client";

import LegalDocOverlay from "@/components/legal/LegalDocOverlay";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { decisionRetour, lirePage } from "@/lib/retourSysteme";

/*
 * iOS : LA PAGE PREND TOUT L'ÉCRAN, ET LA COQUE LAISSE LA PLACE DE L'ENCOCHE (06/11/2026, signalé sur l'enregistrement TestFlight :
 * « le haut des écrans est caché »). Sans viewport-fit=cover, WebKit donne 0 à env(safe-area-inset-*) alors que la vue web passe sous
 * la barre d'état : l'en-tête se retrouvait sous l'heure et l'encoche. Posé dès le chargement de ce module (client seulement,
 * AppLoader), sur iOS natif seulement : Android garde sa page entre les barres système, le web ne change pas. La coque applique
 * ensuite `pt-safe-top` (globals.css) ; le bas utilisait déjà env(safe-area-inset-bottom).
 */
if (typeof document !== "undefined" && Capacitor.getPlatform() === "ios") {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta && !/viewport-fit/.test(meta.content)) meta.setAttribute("content", `${meta.content}, viewport-fit=cover`);
}
import { arreterPublicite, demarrerPublicite } from "@/lib/publicite";
import { synchroniserNotifications } from "@/lib/notifications";
import { GoogleAnalytics } from "@next/third-parties/google";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CapselaProvider, useCapsela } from "@/lib/store";
import WelcomeScreen from "./screens/WelcomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import WardrobeScreen from "./screens/WardrobeScreen";
import DernieresPiecesScreen from "@/components/screens/DernieresPiecesScreen";
import PieceScreen from "./screens/PieceScreen";
import AddScreen from "./screens/AddScreen";
import ImporterTenueScreen from "./screens/ImporterTenueScreen";
import CapsuleScreen from "./screens/CapsuleScreen";
import TenuesScreen from "./screens/TenuesScreen";
import CalendrierScreen from "./screens/CalendrierScreen";
import HistoryScreen from "./screens/HistoryScreen";
import PlanifierScreen from "./screens/PlanifierScreen";
import PremiumScreen from "./screens/PremiumScreen";
import ValiseScreen from "./screens/ValiseScreen";
import AvisStylisteScreen from "./screens/AvisStylisteScreen";
import NouveauMotDePasseScreen from "./screens/NouveauMotDePasseScreen";
import AvisTousScreen from "./screens/AvisTousScreen";
import AvisEnregistreScreen from "./screens/AvisEnregistreScreen";
import LooksScreen from "./screens/LooksScreen";
import NeverWornScreen from "./screens/NeverWornScreen";
import ProfileSetupScreen from "./screens/ProfileSetupScreen";
import DateNaissanceScreen from "./screens/DateNaissanceScreen";
import { doitDemanderNaissance } from "@/lib/ageMinimum";
import { decisionSession, PREMIERE_ETAPE } from "@/lib/onboarding";
import ProfileScreen from "./screens/ProfileScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import LegalScreen from "./screens/LegalScreen";
import LoginScreen from "./screens/LoginScreen";
import OpinionShareScreen from "./screens/OpinionShareScreen";
import CreateLookScreen from "./screens/CreateLookScreen";
import FicheEnFeuille from "@/components/FicheEnFeuille";
import ApercuPiece from "./ApercuPiece";
import LookDetailScreen from "./screens/LookDetailScreen";
import ItemOutfitsScreen from "./screens/ItemOutfitsScreen";
import IdeeLookScreen from "./screens/IdeeLookScreen";
import TabBar from "./TabBar";
import MenuActions from "./MenuActions";
import CookieBanner from "./CookieBanner";
import { readConsent, subscribeConsent, type ConsentState } from "@/lib/consent";
import ChargementApp from "./ChargementApp";
import ConfirmationAjout from "./ConfirmationAjout";
import { ecranARestaurer, memoriserEcran } from "@/lib/ecranRestaure";
import { initialiserLangue } from "@/lib/langue";
import { FOND_CREME, FOND_ENCRE, poserFondSysteme } from "@/lib/fondSysteme";
import VisiteGuidee from "./VisiteGuidee";
import { definirSystemeUnites } from "@/lib/unites";

// La langue est fixée une fois, avant le premier rendu (docs/traduction.md) : App.tsx n'est chargé que dans le navigateur.
initialiserLangue();

/** Écrans du tunnel accueil/auth/onboarding (pas de compte configuré) — la barre d'onglets n'y a pas de sens. */
const NO_TABBAR_SCREENS = new Set(["welcome", "onboarding", "auth", "login", "profileSetup"]);
/**
 * Parcours guidés qui portent leur PROPRE action principale en pied d'écran
 * (23/09/2026, maquette « Planifier une tenue »). Ensemble distinct de
 * NO_TABBAR_SCREENS, qui dit autre chose : là il n'y a pas encore de compte,
 * ici il y en a un et la navigation existe — elle est seulement mise de côté
 * le temps du parcours.
 *
 * La raison est mesurable, pas esthétique : TabBar est en `absolute bottom-0
 * z-20` par-dessus le contenu, et ces écrans posent un bouton plein largeur
 * exactement à cet endroit. Les deux se superposeraient. Le retour se fait
 * par le chevron du bandeau, qui remonte les étapes une à une puis rend la
 * main à l'accueil.
 *
 * « add » rejoint l'ensemble le 27/09/2026 (refonte « Ajouter une pièce ») :
 * même raison, son « Ajouter au dressing » est désormais fixé en pied d'écran.
 */
const FLOW_SCREENS = new Set(["planifier", "premium", "valise", "add", "importerTenue"]);

function Screens() {
  const { state, actions, etatPremium } = useCapsela();
  const auth = useAuth();
  // Les températures s'affichent dans l'unité du profil (unites.ts) : posée ici, avant le rendu des écrans.
  definirSystemeUnites(auth.profile.prefs.unitSystem);
  const showTabbar = !NO_TABBAR_SCREENS.has(state.screen) && !FLOW_SCREENS.has(state.screen);

  // LA VIDÉO RÉCOMPENSÉE (AdMob, 02/11/2026, publicite.ts) : Android seulement, compte connecté au profil complet et
  // non Premium. Le profil complet évite que le formulaire de consentement de Google coupe le questionnaire
  // d'inscription ; « gratuit » seulement, parce que « inconnu » n'applique aucune limite et que Premium n'en a pas :
  // dans les deux cas, la feuille qui propose la vidéo ne s'ouvre jamais.
  const userIdPub = auth.userId;
  const profilCompletPub = auth.profile.completed;
  useEffect(() => {
    if (!userIdPub) arreterPublicite();
    else if (profilCompletPub && etatPremium === "gratuit") void demarrerPublicite(userIdPub);
  }, [userIdPub, profilCompletPub, etatPremium]);

  // LA NOTIFICATION DE LA TENUE DU JOUR (04/11/2026, notifications.ts) : remise en accord avec les Préférences à chaque lancement,
  // une fois le profil complet — la demande d'autorisation du téléphone ne coupe donc jamais le questionnaire d'inscription.
  const prefsNotif = auth.profile.prefs;
  useEffect(() => {
    if (!auth.signedIn || !profilCompletPub) return;
    void synchroniserNotifications(prefsNotif, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.signedIn, profilCompletPub]);
  // ET À CHAQUE RETOUR DANS L'APP (05/11/2026) : les notifications sont programmées jour par jour, sur deux semaines
  // (notifications.ts) ; chaque retour reconduit la fenêtre, avec l'heure du compte telle qu'elle est alors. Sans demande d'autorisation.
  const notifRef = useRef({ actif: false, prefs: prefsNotif });
  useEffect(() => {
    notifRef.current = { actif: auth.signedIn && profilCompletPub, prefs: prefsNotif };
  });
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let ecoute: { remove: () => Promise<void> } | null = null;
    let fini = false;
    void CapApp.addListener("resume", () => {
      if (notifRef.current.actif) void synchroniserNotifications(notifRef.current.prefs, false);
    }).then((h) => {
      if (fini) void h.remove();
      else ecoute = h;
    });
    return () => {
      fini = true;
      void ecoute?.remove();
    };
  }, []);

  // Session ouverte (connexion, retour Apple/Google, rechargement) : la décision suit le PROFIL, pas l'âge du compte (12/11/2026,
  // onboarding.ts — remplace la règle du 17/08/2026). Profil non terminé : le questionnaire, repris à l'étape enregistrée ; terminé :
  // l'écran retenu ou l'accueil. Elle attend que le profil soit lu : dans l'app, la session arrive avant lui.
  const { ready, signedIn } = auth;
  // Rechargement sur le web : on garde l'écran de premier niveau courant pour le retrouver (cf. ecranRestaure.ts).
  useEffect(() => {
    memoriserEcran(state.screen);
    // Les barres système d'Android prennent le fond de l'écran (fondSysteme.ts) : encre sur l'accueil, crème ailleurs.
    poserFondSysteme(state.screen === "welcome" ? FOND_ENCRE : FOND_CREME);
  }, [state.screen]);
  // LE RETOUR ANDROID (22/10/2026, retourSysteme.ts) : il ferme ce qui est ouvert par-dessus, sinon suit le bouton Retour de l'écran,
  // sinon revient à l'accueil depuis un écran de la barre du bas ; l'app ne se ferme plus que depuis l'accueil.
  const ecranRef = useRef(state.screen);
  useEffect(() => {
    ecranRef.current = state.screen;
  });
  useEffect(() => {
    const gerer = () => {
      const page = lirePage(document);
      const decision = decisionRetour({ superposition: !!page.superposition, bouton: !!page.bouton, ecran: ecranRef.current });
      if (decision === "fermer") document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      else if (decision === "bouton") page.bouton?.click();
      else if (decision === "accueil") actions.goHome();
      else if (decision === "etapePrecedente") actions.onbBack();
      else if (Capacitor.isNativePlatform()) void CapApp.exitApp();
      return decision;
    };
    // Vérifiable en rendu dans le navigateur de développement, où l'événement natif n'existe pas.
    if (process.env.NODE_ENV === "development") (window as unknown as { __retourSysteme?: () => string }).__retourSysteme = gerer;
    if (!Capacitor.isNativePlatform()) return;
    let ecoute: { remove: () => Promise<void> } | null = null;
    let fini = false;
    void CapApp.addListener("backButton", gerer).then((h) => {
      if (fini) void h.remove();
      else ecoute = h;
    });
    return () => {
      fini = true;
      void ecoute?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [refusAge, setRefusAge] = useState<string | null>(null);
  const profileCompleted = auth.profile.completed;
  const etapeEnregistree = auth.profile.prefs.onboardingEtape;
  useEffect(() => {
    if (!ready) return;
    const decision = decisionSession({
      signedIn,
      profileLoaded: auth.profileLoaded,
      profilIllisible: auth.profilIllisible,
      completed: profileCompleted,
      screen: state.screen,
    });
    if (decision === "questionnaire") actions.goProfileSetup(etapeEnregistree ?? PREMIERE_ETAPE);
    else if (decision === "accueil") actions.go(ecranARestaurer() ?? "home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, auth.profileLoaded, auth.profilIllisible, profileCompleted, state.screen]);

  // Récupération du mot de passe (recette du 26/09/2026) : ouverte depuis le
  // lien de l'e-mail, elle passe devant tout le reste — la session qu'elle
  // ouvre ne doit mener nulle part avant que le mot de passe soit choisi.
  if (ready && auth.recuperation !== "aucune") {
    return (
      <div className="relative w-full max-w-[480px] mx-auto h-dvh flex flex-col bg-cream overflow-hidden pt-safe-top">
        <div className="relative flex-1 min-h-0">
          <NouveauMotDePasseScreen />
        </div>
      </div>
    );
  }

  // Date de naissance (01/10/2026) : demandée avant tout autre écran à un compte
  // connecté qui n'en a pas et dont le profil n'est pas terminé — en pratique
  // le compte qui vient d'être créé avec Google. `refusAge` garde le message
  // de refus affiché après la suppression du compte, qui ferme la session.
  if (ready && (refusAge || doitDemanderNaissance({ signedIn, profileLoaded: auth.profileLoaded, birthdate: auth.profile.birthdate, completed: profileCompleted }))) {
    return (
      <div className="relative w-full max-w-[480px] mx-auto h-dvh flex flex-col bg-cream overflow-hidden pt-safe-top">
        <div className="relative flex-1 min-h-0">
          <DateNaissanceScreen
            refus={refusAge}
            onRefus={setRefusAge}
            onQuitter={() => {
              setRefusAge(null);
              actions.goWelcome();
            }}
          />
        </div>
        <LegalDocOverlay />
      </div>
    );
  }

  // L'écran de chargement et son astuce (05/11/2026, ChargementApp).
  if (!ready) return <ChargementApp />;

  return (
    <div className="relative w-full max-w-[480px] mx-auto h-dvh flex flex-col bg-cream overflow-hidden pt-safe-top">
      {/* Bandeau de diagnostic temporaire (correctif 22/08/2026, signalé :
          pièces ajoutées au dressing non conservées) — affiche l'erreur
          Supabase réelle sur mobile, où la console développeur n'est pas
          accessible. À retirer une fois la cause identifiée et corrigée. */}
      {state.dressingError && (
        <div
          className="absolute left-0 right-0 z-50 px-4 py-3 text-[12px] leading-[1.4]"
          style={{ top: "env(safe-area-inset-top)", background: "#B3261E", color: "#FFF" }}
        >
          <div className="flex items-start gap-2">
            <span className="flex-1 break-words">{state.dressingError}</span>
            <button onClick={actions.dismissDressingError} className="flex-shrink-0 font-semibold cursor-pointer">
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="relative flex-1 overflow-hidden">
        {state.screen === "welcome" && <WelcomeScreen />}
        {state.screen === "onboarding" && <OnboardingScreen />}
        {state.screen === "auth" && <AuthScreen />}
        {state.screen === "home" && <HomeScreen />}
        {state.screen === "wardrobe" && <WardrobeScreen />}
        {state.screen === "dernieresPieces" && <DernieresPiecesScreen />}
        {state.screen === "piece" && <PieceScreen />}
        {state.screen === "add" && <AddScreen />}
        {state.screen === "importerTenue" && <ImporterTenueScreen />}
        {state.screen === "capsule" && <CapsuleScreen />}
        {state.screen === "tenues" && <TenuesScreen />}
        {state.screen === "calendrier" && <CalendrierScreen />}
        {state.screen === "history" && <HistoryScreen />}
        {state.screen === "planifier" && <PlanifierScreen />}
        {state.screen === "premium" && <PremiumScreen />}
        {state.screen === "valise" && <ValiseScreen />}
        {state.screen === "avisStyliste" && <AvisStylisteScreen />}
        {state.screen === "avisEnregistre" && <AvisEnregistreScreen />}
        {state.screen === "avisTous" && <AvisTousScreen />}
        {state.screen === "looks" && <LooksScreen />}
        {state.screen === "neverworn" && <NeverWornScreen />}
        {state.screen === "profileSetup" && <ProfileSetupScreen />}
        {state.screen === "profile" && <ProfileScreen />}
        {state.screen === "preferences" && <PreferencesScreen />}
        {state.screen === "legal" && <LegalScreen />}
        {state.screen === "login" && <LoginScreen />}
        {state.screen === "opinionShare" && <OpinionShareScreen />}
        {state.screen === "createLook" && <CreateLookScreen />}
        {state.screen === "lookDetail" && <LookDetailScreen />}
        {state.screen === "itemOutfits" && <ItemOutfitsScreen />}
        {state.screen === "ideeLook" && <IdeeLookScreen />}
      </div>
      {showTabbar && <TabBar />}
      {/* Le menu d'actions flottant (12/11/2026, menuActions.ts) : un seul, pour toutes les pages principales. */}
      <MenuActions />
      <LegalDocOverlay />
      <ConfirmationAjout auDessusDeLaBarre={showTabbar} />
      <ApercuPiece />
      <FicheEnFeuille />
      {/* Les visites guidées (lib/visites.ts) : un seul composant, le seul qui manipule Driver.js. */}
      <VisiteGuidee />
      <Analytics />
    </div>
  );
}

/**
 * Mesure d'audience — chargée seulement après un consentement explicite
 * (cf. lib/consent.ts). Le composant GoogleAnalytics de @next/third-parties
 * n'est monté qu'à ce moment : tant que la réponse n'est pas "granted",
 * aucun script Google n'est injecté dans la page, ce que la CNIL exige.
 *
 * NEXT_PUBLIC_GA_ID absent (développement local, préproduction) : rien n'est
 * chargé et le bandeau ne s'affiche pas — inutile de demander un
 * consentement pour une mesure qui n'existe pas.
 */
function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  // useSyncExternalStore plutôt qu'un useState + useEffect : le
  // consentement vit dans localStorage, c'est un store externe au sens de
  // React. Le snapshot serveur vaut "unknown" — l'app est de toute façon
  // montée en ssr:false (AppLoader), mais l'écrire évite tout écart
  // d'hydratation si ça changeait un jour.
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => "unknown" as ConsentState);

  if (!gaId) return null;
  return (
    <>
      {consent === "unknown" && <CookieBanner />}
      {consent === "granted" && <GoogleAnalytics gaId={gaId} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CapselaProvider>
        <Screens />
      </CapselaProvider>
    </AuthProvider>
  );
}
