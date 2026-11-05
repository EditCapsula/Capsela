import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * LE FOND DES BARRES SYSTÈME, sur Android (05/11/2026, android/app/src/main/java/app/capsela/FondSysteme.java). Crème et icônes
 * sombres partout ; encre et icônes claires sur l'écran d'accueil, sombre. Sans effet ailleurs qu'Android ; une version de l'app
 * construite avant ce plugin refuse l'appel, qui est alors ignoré.
 */
const FondSysteme = registerPlugin<{ poser(o: { couleur: string; sombre: boolean }): Promise<void> }>("FondSysteme");

export const FOND_CREME = { couleur: "#F3EEE5", sombre: false };
export const FOND_ENCRE = { couleur: "#1D1A16", sombre: true };

export function poserFondSysteme(fond: { couleur: string; sombre: boolean }): void {
  if (Capacitor.getPlatform() !== "android") return;
  void FondSysteme.poser(fond).catch(() => {});
}
