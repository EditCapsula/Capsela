"use client";

import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CapselaProvider, useCapsela } from "@/lib/store";
import WelcomeScreen from "./screens/WelcomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import AuthScreen from "./screens/AuthScreen";
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
import LoginScreen from "./screens/LoginScreen";
import TabBar from "./TabBar";

const TABBAR_SCREENS = new Set(["wardrobe", "capsule", "tenues", "history", "neverworn"]);
const PRE_AUTH_SCREENS = new Set(["welcome", "onboarding", "auth", "login"]);

function Screens() {
  const { state, actions } = useCapsela();
  const auth = useAuth();
  const showTabbar = TABBAR_SCREENS.has(state.screen);

  // Session déjà ouverte (retour OAuth ou rechargement) : saute les écrans d'accueil.
  const { ready, signedIn } = auth;
  const profileCompleted = auth.profile.completed;
  useEffect(() => {
    if (ready && signedIn && PRE_AUTH_SCREENS.has(state.screen)) {
      actions.go(profileCompleted ? "tenues" : "profileSetup");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn]);

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
        {state.screen === "login" && <LoginScreen />}
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
