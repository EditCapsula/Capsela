"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CapselaProvider, useCapsela } from "@/lib/store";
import WelcomeScreen from "./screens/WelcomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import WardrobeScreen from "./screens/WardrobeScreen";
import PieceScreen from "./screens/PieceScreen";
import AddScreen from "./screens/AddScreen";
import CapsuleScreen from "./screens/CapsuleScreen";
import TenuesScreen from "./screens/TenuesScreen";
import PremiumScreen from "./screens/PremiumScreen";
import HistoryScreen from "./screens/HistoryScreen";
import NeverWornScreen from "./screens/NeverWornScreen";
import ProfileSetupScreen from "./screens/ProfileSetupScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ProfileEditScreen from "./screens/ProfileEditScreen";
import LegalScreen from "./screens/LegalScreen";
import LoginScreen from "./screens/LoginScreen";
import OpinionShareScreen from "./screens/OpinionShareScreen";
import CreateLookScreen from "./screens/CreateLookScreen";
import LookDetailScreen from "./screens/LookDetailScreen";
import ItemOutfitsScreen from "./screens/ItemOutfitsScreen";
import TabBar from "./TabBar";

/** Écrans du tunnel accueil/auth/onboarding (pas de compte configuré) et l'écran Premium (fond sombre, pas de variante de barre adaptée). */
const NO_TABBAR_SCREENS = new Set(["welcome", "onboarding", "auth", "login", "profileSetup", "premium"]);
const PRE_AUTH_SCREENS = new Set(["welcome", "onboarding", "auth", "login"]);

function Screens() {
  const { state, actions } = useCapsela();
  const auth = useAuth();
  const showTabbar = !NO_TABBAR_SCREENS.has(state.screen);

  // Session déjà ouverte (connexion, retour OAuth ou rechargement) : saute les écrans
  // d'accueil, direction la Homepage — jamais le questionnaire, même si le profil est
  // incomplet (règle métier 17/08/2026 : un compte existant n'est jamais renvoyé vers
  // l'onboarding, quelle que soit la complétude du profil). Seule exception : la
  // connexion Google qui vient tout juste de créer le compte (justSignedUp, posé via
  // markSignupIntent avant l'appel — la création de compte par e-mail navigue déjà
  // directement vers le questionnaire dans AuthScreen, sans passer par cet effet).
  // Seule source de vérité pour la navigation post-connexion — le profil arrive de façon
  // asynchrone (state React, ou requête réseau en mode réel), donc profileCompleted et
  // justSignedUp doivent rester en dépendance pour que l'effet se redéclenche dès qu'ils
  // sont prêts, même si signedIn est passé à true avant que le profil ne soit chargé.
  const { ready, signedIn, justSignedUp } = auth;
  const profileCompleted = auth.profile.completed;
  useEffect(() => {
    if (ready && signedIn && PRE_AUTH_SCREENS.has(state.screen)) {
      if (justSignedUp && !profileCompleted) actions.goProfileSetup("genre");
      else actions.goHome();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn, justSignedUp, profileCompleted]);

  if (!ready) {
    return (
      <div className="relative w-full max-w-[480px] mx-auto h-dvh flex items-center justify-center bg-cream">
        <span className="font-serif text-[15px] tracking-[.4em] text-terracotta pl-[.4em]">✦</span>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[480px] mx-auto h-dvh flex flex-col bg-cream overflow-hidden">
      <div className="relative flex-1 overflow-hidden">
        {state.screen === "welcome" && <WelcomeScreen />}
        {state.screen === "onboarding" && <OnboardingScreen />}
        {state.screen === "auth" && <AuthScreen />}
        {state.screen === "home" && <HomeScreen />}
        {state.screen === "wardrobe" && <WardrobeScreen />}
        {state.screen === "piece" && <PieceScreen />}
        {state.screen === "add" && <AddScreen />}
        {state.screen === "capsule" && <CapsuleScreen />}
        {state.screen === "tenues" && <TenuesScreen />}
        {state.screen === "premium" && <PremiumScreen />}
        {state.screen === "history" && <HistoryScreen />}
        {state.screen === "neverworn" && <NeverWornScreen />}
        {state.screen === "profileSetup" && <ProfileSetupScreen />}
        {state.screen === "profile" && <ProfileScreen />}
        {state.screen === "profileEdit" && <ProfileEditScreen />}
        {state.screen === "legal" && <LegalScreen />}
        {state.screen === "login" && <LoginScreen />}
        {state.screen === "opinionShare" && <OpinionShareScreen />}
        {state.screen === "createLook" && <CreateLookScreen />}
        {state.screen === "lookDetail" && <LookDetailScreen />}
        {state.screen === "itemOutfits" && <ItemOutfitsScreen />}
      </div>
      {showTabbar && <TabBar />}
    </div>
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
