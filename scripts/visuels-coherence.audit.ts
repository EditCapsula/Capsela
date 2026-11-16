import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// LE VISUEL DU FLAT LAY CORRESPOND-IL À LA PHOTO DU CATALOGUE ? (16/11/2026, signalé : « le visuel de la robe pull midi cintrée n'a pas
// le même style dans le flat lay » ; demandé : « la liste des visuels qui ont un visuel flat lay qui ne correspond pas à son visuel »).
// LECTURE SEULE : rien n'est écrit en base, aucune image n'est générée ni modifiée.
//
// La cause : le visuel hero (url_image_hero, generate-hero-image) est dessiné d'après la seule description de la pièce, jamais d'après
// sa photo du catalogue (url_image) — deux dessins indépendants de « la même » pièce. Une comparaison de pixels ne dirait rien : on
// demande au modèle de vision si les deux images montrent le MÊME vêtement (type, coupe, encolure, manches, longueur, fermeture,
// ceinture, poches, motif, couleur), sans tenir compte de la pose, des plis, de l'angle ni de la lumière.
//
// Coût : une requête par pièce, deux images en basse définition. Plafond : MAX (1000 par défaut).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODELE = process.env.VISION_MODEL || "gpt-4.1-mini";
const MAX = Number(process.env.MAX || 1000);
const PARALLELE = 6;
const PAGE = 1000;

interface Ligne { id: number; name: string | null; category: string | null; url_image: string | null; url_image_hero: string | null; image_status: string | null; frozen?: boolean }
interface Verdict { meme: boolean; ecart: string }

const CONSIGNE = `Tu compares deux visuels produits d'un catalogue de mode. Image A : la photo de la pièce. Image B : la même pièce posée à plat.
Dis si A et B montrent LE MÊME vêtement, au sens du modèle : même type de pièce, même coupe, même encolure ou col, mêmes manches, même
longueur, même fermeture (boutons, zip, portefeuille, nœud), même ceinture, mêmes poches, même motif, même couleur (à une nuance près).
Ne tiens PAS compte de la pose, des plis, de l'angle, du cadrage, de l'ombre ni de la lumière.
Réponds en JSON : {"meme": true|false, "ecart": "la différence principale en quelques mots français, vide si meme"}.`;

async function juger(l: Ligne): Promise<Verdict | { erreur: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELE,
      store: false,
      response_format: { type: "json_object" },
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CONSIGNE },
            { type: "text", text: "Image A :" },
            { type: "image_url", image_url: { url: l.url_image, detail: "low" } },
            { type: "text", text: "Image B :" },
            { type: "image_url", image_url: { url: l.url_image_hero, detail: "low" } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return { erreur: `${res.status} ${(await res.text()).slice(0, 160)}` };
  try {
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    const v = JSON.parse(j.choices[0].message.content) as Partial<Verdict>;
    return { meme: v.meme === true, ecart: typeof v.ecart === "string" ? v.ecart : "" };
  } catch (e) {
    return { erreur: `réponse illisible : ${String(e).slice(0, 120)}` };
  }
}

describe("cohérence des visuels du catalogue", () => {
  it("photo du catalogue contre visuel du flat lay", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY est requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: Ligne[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase
        .from("vestiaire_universel")
        .select("id, name, category, url_image, url_image_hero, image_status, frozen")
        .order("id", { ascending: true })
        .range(debut, debut + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as Ligne[]));
      if (!data || data.length < PAGE) break;
    }
    // Les pièces que l'app montre avec deux visuels : actives, photo prête, visuel hero présent.
    const paires = rows.filter((r) => !r.frozen && r.url_image && r.image_status === "ready" && r.url_image_hero).slice(0, MAX);
    console.log(`\nCatalogue : ${rows.length} lignes · paires à comparer : ${paires.length} (modèle ${MODELE})`);

    const resultats: { l: Ligne; v: Verdict | { erreur: string } }[] = [];
    for (let i = 0; i < paires.length; i += PARALLELE) {
      const lot = paires.slice(i, i + PARALLELE);
      resultats.push(...(await Promise.all(lot.map(async (l) => ({ l, v: await juger(l) })))));
    }
    const differents = resultats.filter((r) => "meme" in r.v && !r.v.meme);
    const erreurs = resultats.filter((r) => "erreur" in r.v);
    console.log(`Identiques : ${resultats.length - differents.length - erreurs.length} · différents : ${differents.length} · non jugés : ${erreurs.length}`);
    console.log("\n═══ VISUELS DIFFÉRENTS : id · catégorie · nom · écart ═══");
    for (const { l, v } of differents) console.log(`${l.id} · ${l.category} · ${l.name} · ${(v as Verdict).ecart}`);
    if (erreurs.length) {
      console.log("\n═══ NON JUGÉS ═══");
      for (const { l, v } of erreurs) console.log(`${l.id} · ${l.name} · ${(v as { erreur: string }).erreur}`);
    }
    console.log(`\nids : ${differents.map((r) => r.l.id).join(",")}`);
  }, 1_800_000);
});
