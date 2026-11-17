import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * LES RESTRICTIONS DE BATTERIE, sur Android (17/11/2026, android/app/src/main/java/app/capsela/ReglagesBatterie.java). Signalé :
 * notification programmée à 7 h, reçue après 10 h. Une batterie restreinte retient l'alarme inexacte de la tenue du jour jusqu'au
 * réveil du téléphone. Sans effet ailleurs qu'Android ; une version de l'app construite avant ce plugin refuse l'appel : l'état est
 * alors inconnu (null) et l'aide reste affichée, sans bouton qui ne mènerait nulle part.
 */
const ReglagesBatterie = registerPlugin<{ etat(): Promise<{ libre: boolean }>; ouvrir(): Promise<void> }>("ReglagesBatterie");

export const batterieReglableIci = (): boolean => Capacitor.getPlatform() === "android";

/** true : Capsela n'est pas restreinte ; false : elle l'est ; null : inconnu (hors Android, ancienne version de l'app). */
export async function batterieLibre(): Promise<boolean | null> {
  if (!batterieReglableIci()) return null;
  try {
    return (await ReglagesBatterie.etat()).libre;
  } catch {
    return null;
  }
}

/** Ouvre la fiche de Capsela dans les paramètres du téléphone ; false si le téléphone ne l'a pas ouverte. */
export async function ouvrirReglagesBatterie(): Promise<boolean> {
  if (!batterieReglableIci()) return false;
  try {
    await ReglagesBatterie.ouvrir();
    return true;
  } catch {
    return false;
  }
}
