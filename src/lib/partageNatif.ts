/**
 * LE PARTAGE DANS L'APP iOS ET ANDROID (13/11/2026, demandé : « lorsque on envoie la photo […] le logo Capsela systématique affiché »).
 *
 * La page « Demander un avis » partageait par l'API web (`navigator.share`), que la vue web de l'app ne propose pas : dans l'app, ni le
 * message ni l'image ne partaient (« Ton navigateur ne propose pas de partage », vu dans la vidéo pour Apple). Dans l'app, la feuille de
 * partage du téléphone s'ouvre désormais par le plugin natif (@capacitor/share), avec l'image de la tenue — signée du logo
 * (outfitImage.ts) — déposée d'abord dans le cache de l'app (@capacitor/filesystem), seul chemin qu'accepte la feuille du système.
 *
 * Ne lève jamais : « annule » quand la feuille est refermée sans destinataire (ce n'est ni un envoi ni un échec), « echec » sinon.
 */
import { estNatif } from "./authNatif";

export const partageNatifDisponible = (): boolean => estNatif();

const NOM_FICHIER = "capsela-ma-tenue.png";

async function versBase64(fichier: File): Promise<string> {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/** Vrai si l'erreur dit seulement que la feuille a été refermée. */
export function estAnnulation(e: unknown): boolean {
  const texte = `${(e as { message?: unknown } | null)?.message ?? e}`.toLowerCase();
  return /cancel|annul|abort|dismiss/.test(texte);
}

export async function partagerNatif(message: string, fichier: File | null): Promise<{ resultat: "envoye" | "annule" | "echec"; avecImage: boolean }> {
  try {
    const { Share } = await import("@capacitor/share");
    let uri: string | null = null;
    if (fichier) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const ecrit = await Filesystem.writeFile({ path: NOM_FICHIER, data: await versBase64(fichier), directory: Directory.Cache });
        uri = ecrit.uri;
      } catch {
        // Le fichier n'a pas pu être déposé : le message part seul, l'écran le dit.
        uri = null;
      }
    }
    await Share.share(uri ? { text: message, files: [uri], dialogTitle: "Partager ma tenue" } : { text: message, dialogTitle: "Partager ma tenue" });
    return { resultat: "envoye", avecImage: uri !== null };
  } catch (e) {
    return { resultat: estAnnulation(e) ? "annule" : "echec", avecImage: false };
  }
}
