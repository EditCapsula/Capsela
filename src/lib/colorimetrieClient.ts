import { colorimetrieDeSaison, colorimetrieDisponible, colorimetrieMockActive, estSaison, type Colorimetrie, type MotifPhoto } from "./colorimetrie";
import { preparerPhotoAvis } from "./photoAvis";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { ReponseColorimetrie } from "../../supabase/functions/_shared/colorimetrie.ts";

/*
 * COLORIMÉTRIE PAR PHOTO — côté app (30/09/2026, docs/colorimetrie.md).
 *
 * La photo est préparée comme celle de l'avis de styliste (preparerPhotoAvis :
 * ré-encodée en JPEG, EXIF et position GPS retirés), envoyée UNE fois à la
 * fonction Edge avec le consentement explicite, puis oubliée : rien n'est
 * téléversé dans le stockage, rien n'est gardé en mémoire après la réponse.
 *
 * Le serveur ne rend qu'une saison ; les couleurs viennent de SAISONS
 * (colorimetrie.ts). Aucun score n'est posé : `confiance` reste absent, et
 * l'écran n'affiche donc jamais « Analyse fiable » pour ce chemin.
 */

/** Résultat de démonstration — n'est atteint que derrière NEXT_PUBLIC_COLORIMETRIE_MOCK=1. */
const SAISON_DEMO = "automne" as const;

function lireFichierEnDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(fichier);
  });
}

const MOTIFS: MotifPhoto[] = ["lumiere", "filtre", "visage_non_visible", "plusieurs_personnes", "indetermine"];
const echec = (motif?: MotifPhoto): Colorimetrie => (motif ? { statut: "erreur", motif } : { statut: "erreur" });

/**
 * Point d'entrée unique de l'analyse photo. Ne lève jamais : un échec devient
 * `{ statut: "erreur", motif? }`, que l'écran traite comme « reprendre une
 * photo, répondre aux questions ou passer ». `consentement` doit être le
 * geste explicite de la personne : sans lui, rien ne part.
 */
export async function analyserColorimetrie(
  fichier: File,
  source: "camera" | "galerie",
  consentement: boolean
): Promise<Colorimetrie> {
  if (!consentement || !colorimetrieDisponible()) return echec();
  try {
    if (colorimetrieMockActive()) {
      // Le délai imite l'attente réelle pour que l'écran d'analyse soit vu.
      await new Promise((r) => setTimeout(r, 2200));
      return colorimetrieDeSaison(SAISON_DEMO, source);
    }
    if (!isSupabaseConfigured) return echec();
    const photo = await preparerPhotoAvis(fichier);
    if (!photo.ok) return echec();
    const image = await lireFichierEnDataUrl(photo.fichier);
    const { data, error } = await getSupabase().functions.invoke("analyser-colorimetrie", { body: { image, consentement: true } });
    let corps = data as ReponseColorimetrie | null;
    if (error) {
      const reponse = (error as { context?: unknown }).context;
      corps = reponse instanceof Response ? ((await reponse.json().catch(() => null)) as ReponseColorimetrie | null) : null;
    }
    if (corps?.ok && estSaison(corps.saison)) return colorimetrieDeSaison(corps.saison, source);
    if (corps && !corps.ok && corps.code === "photo_inexploitable") {
      return echec(MOTIFS.includes(corps.motif as MotifPhoto) ? (corps.motif as MotifPhoto) : undefined);
    }
    return echec();
  } catch {
    return echec();
  }
}

/** La phrase à afficher quand la photo n'a pas abouti — jamais un message technique, jamais un mot sur la personne. */
export function messageEchecPhoto(motif: MotifPhoto | undefined): string {
  switch (motif) {
    case "lumiere":
      return "La lumière ne permet pas de lire les couleurs. Essaie près d'une fenêtre, en lumière du jour.";
    case "filtre":
      return "Un filtre semble modifier les couleurs. Essaie avec une photo sans filtre ni retouche.";
    case "visage_non_visible":
      return "Ton visage n'est pas assez visible. Essaie avec une photo de face, cheveux visibles.";
    case "plusieurs_personnes":
      return "Plusieurs personnes apparaissent sur la photo. Essaie avec une photo où n'apparaît que toi.";
    case "indetermine":
      return "Cette photo ne permet pas de trancher entre deux saisons. Le questionnaire peut t'aider à y voir clair.";
    default:
      return "L'analyse n'a pas abouti. Rien n'est perdu : tes couleurs préférées sont conservées.";
  }
}
