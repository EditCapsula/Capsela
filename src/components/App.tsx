"use client";

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
import TabBar from "./TabBar";

const TABBAR_SCREENS = new Set(["wardrobe", "capsule", "tenues", "history", "neverworn"]);

function Screens() {
  const { state } = useCapsela();
  const showTabbar = TABBAR_SCREENS.has(state.screen);

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
      </div>
      {showTabbar && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <CapselaProvider>
      <Screens />
    </CapselaProvider>
  );
}
