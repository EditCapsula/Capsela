// Export des données personnelles — droit à la portabilité, article 20 du
// RGPD : « recevoir les données la concernant dans un format structuré,
// couramment utilisé et lisible par machine ». D'où le JSON, et non un PDF.
//
// Lu côté client, avec la session de l'utilisatrice et donc sous RLS : elle
// ne peut par construction obtenir que ses propres lignes. C'est plus sûr
// qu'une fonction serveur à clé privilégiée, qui devrait vérifier elle-même
// à qui elle répond — ici la base s'en charge. Le filtre explicite sur
// user_id est une ceinture par-dessus les bretelles : si une politique RLS
// venait à être élargie par erreur, l'export resterait correct.

import { getSupabase, isSupabaseConfigured } from "./supabase";

const BUCKET_PHOTOS = "dressing-photos";

export interface ExportPhoto {
  nom: string;
  taille_octets: number | null;
  ajoutee_le: string | null;
  url: string;
}

export interface ExportDonnees {
  export_genere_le: string;
  format: string;
  compte: { id: string; email: string | null };
  profil: Record<string, unknown> | null;
  dressing: Record<string, unknown>[];
  looks_enregistres: Record<string, unknown>[];
  historique_tenues: Record<string, unknown>[];
  photos_dressing: ExportPhoto[];
  note: string;
}

/**
 * Nom de fichier proposé au téléchargement. Daté, pour qu'un second export
 * n'écrase pas le premier dans le dossier de téléchargements.
 */
export function exportFileName(date = new Date()): string {
  const jour = date.toISOString().slice(0, 10);
  return `capsela-mes-donnees-${jour}.json`;
}

/**
 * Rassemble tout ce que le service détient sur une utilisatrice.
 *
 * Les visuels du catalogue ne sont volontairement pas inclus : ce sont des
 * illustrations génériques, partagées entre toutes les utilisatrices, qui ne
 * la concernent pas. Les photos qu'elle a prises, elles, sont listées avec
 * leur URL — les intégrer en base64 gonflerait le fichier de plusieurs
 * dizaines de mégaoctets pour un résultat moins pratique qu'un lien.
 */
export async function buildDataExport(userId: string, email: string | null): Promise<ExportDonnees> {
  if (!isSupabaseConfigured) {
    throw new Error("Export indisponible en mode démo : les données ne quittent pas cet appareil.");
  }
  const supabase = getSupabase();

  const [profil, dressing, looks, historique, photos] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("dressing_items").select("*").eq("user_id", userId).order("id"),
    supabase.from("saved_looks").select("*").eq("user_id", userId).order("id"),
    supabase.from("outfit_history").select("*").eq("user_id", userId).order("occurred_at"),
    supabase.storage.from(BUCKET_PHOTOS).list(userId, { limit: 1000 }),
  ]);

  // Une erreur sur n'importe quelle partie rend l'export incomplet, donc
  // faux au regard de l'article 20 : mieux vaut échouer que livrer un
  // fichier silencieusement amputé.
  const premiereErreur =
    profil.error || dressing.error || looks.error || historique.error || photos.error;
  if (premiereErreur) {
    throw new Error(`Export interrompu : ${premiereErreur.message}`);
  }

  const fichiers = photos.data ?? [];
  return {
    export_genere_le: new Date().toISOString(),
    format: "JSON, encodage UTF-8",
    compte: { id: userId, email },
    profil: (profil.data as Record<string, unknown> | null) ?? null,
    dressing: (dressing.data ?? []) as Record<string, unknown>[],
    looks_enregistres: (looks.data ?? []) as Record<string, unknown>[],
    historique_tenues: (historique.data ?? []) as Record<string, unknown>[],
    photos_dressing: fichiers.map((f) => ({
      nom: f.name,
      taille_octets: (f.metadata?.size as number | undefined) ?? null,
      ajoutee_le: f.created_at ?? null,
      url: supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(`${userId}/${f.name}`).data.publicUrl,
    })),
    note:
      "Les visuels du catalogue ne figurent pas dans cet export : ce sont des illustrations génériques, communes à toutes les utilisatrices, et non des données personnelles.",
  };
}

/**
 * Déclenche le téléchargement du fichier dans le navigateur.
 *
 * ⚠️ À revoir au moment de l'empaquetage Capacitor : une WebView iOS ou
 * Android ne traite pas toujours un lien `download` sur une URL blob. Il
 * faudra alors passer par le plugin Filesystem, puis Share.
 */
export function downloadJson(donnees: unknown, nomFichier: string): void {
  const blob = new Blob([JSON.stringify(donnees, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Libération différée : Safari annule le téléchargement si l'URL est
  // révoquée dans la foulée du clic.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
