"use client";

import dynamic from "next/dynamic";
import ChargementApp from "./ChargementApp";

// Pendant le chargement du code de l'app, le même écran que pendant la lecture de la session : une seule attente, sans saut.
const App = dynamic(() => import("./App"), { ssr: false, loading: () => <ChargementApp /> });

export default function AppLoader() {
  return <App />;
}
