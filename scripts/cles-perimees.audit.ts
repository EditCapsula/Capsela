import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { type Article, type Cause, type Perimee, cleAttendue, causeDe, verifieHashNonDerive } from "./clePerimee.ts";

// AUDIT DES CLÉS VISUELLES PÉRIMÉES — LECTURE SEULE.
//
// POURQUOI IL REMPLACE UNE REQUÊTE SQL. Le balayage du 23/09/2026 a rendu une
// vingtaine de vraies périmées noyées dans ~300 faux positifs. Sa méthode
// était fautive, pas ses données : il comparait l'attribut BRUT de la fiche au
// slug présent dans la clé, alors que le pipeline REGROUPE volontairement en
// seaux (visualKey.ts : « Blanc cassé » -> ecru, « Blouse » -> chemisier,
// « Cardigan » -> gilet). Chaque regroupement voulu ressortait donc en
// « couleur differente (seau ?) » — l'audit signalait sa propre ignorance, et
// laissait le tri à la main.
//
// Porter les dictionnaires en SQL aurait recréé le défaut que la journée du
// 23/09 a passé à corriger ailleurs : une même question répondue à deux
// endroits, qui finissent par diverger. Cet audit appelle donc LA fonction
// elle-même.
//
// LAQUELLE, ET POURQUOI C'EST LE POINT CENTRAL. `computeVisualKey` existe en
// deux copies : celle du bundle Next et le miroir Deno. C'est le MIROIR DENO
// qui écrit réellement `visual_assets.visual_key`, via
// generate-catalog-image. C'est donc lui la référence ici — comparer aux clés
// produites par l'un avec la logique de l'autre serait transporter une mesure
// hors de son périmètre. Que les deux restent d'accord est vérifié à part, et
// hors ligne, par src/lib/__tests__/visualKeyMiroir.test.ts.
//
// CE QU'IL VÉRIFIE : pour chaque article rattaché à un asset, la clé stockée
// est-elle celle que la fonction produirait AUJOURD'HUI à partir des attributs
// actuels de la fiche ? Si non, le visuel a été dessiné pour une autre
// description que celle affichée.
//
// CE QU'IL NE DIT PAS : rien de la QUALITÉ du visuel. Une clé juste sur une
// image ratée passe ici. Et il ne déclenche aucune régénération — aucune
// écriture, aucun coût.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const court = (s: string | null, n: number) => (s ?? "—").slice(0, n).padEnd(n);

describe("clés visuelles périmées", () => {
  it("aucun article ne porte une clé que la fonction ne reproduirait plus", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Même posture que le garde-fou visuels : sans identifiants, on ne
      // prétend pas avoir vérifié.
      console.log("⚠ Identifiants Supabase absents — audit non exécuté (et rien de conclu).");
      return;
    }
    verifieHashNonDerive();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: assets, error: eAssets } = await supabase.from("visual_assets").select("id, visual_key");
    if (eAssets) throw eAssets;
    const cleParAsset = new Map<number, string>((assets ?? []).map((a) => [a.id as number, a.visual_key as string]));

    const { data: articles, error: eArticles } = await supabase
      .from("vestiaire_universel")
      .select(
        "id, name, category, genre, sous_type, couleur_dominante, matiere, coupe, prompt_image_override, silhouette_mode, details_mode, visual_asset_id"
      )
      .not("visual_asset_id", "is", null);
    if (eArticles) throw eArticles;

    const perimees: Perimee[] = [];
    let inconnues = 0;
    for (const a of (articles ?? []) as Article[]) {
      const stockee = cleParAsset.get(a.visual_asset_id as number);
      if (!stockee) continue; // asset supprimé : hors sujet de cet audit
      const attendue = cleAttendue(a);
      if (attendue === null) {
        inconnues++;
        continue;
      }
      if (attendue === stockee) continue;
      perimees.push({ article: a, stockee, attendue, ...causeDe(stockee, attendue) });
    }

    const parCause = new Map<Cause, Perimee[]>();
    for (const p of perimees) parCause.set(p.cause, [...(parCause.get(p.cause) ?? []), p]);

    console.log(
      `\n${(articles ?? []).length} articles rattachés à un asset · ${perimees.length} clés périmées` +
        (inconnues ? ` · ${inconnues} catégorie inconnue du canon (ignorées)` : "")
    );
    for (const [cause, liste] of [...parCause.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n── ${cause} (${liste.length})`);
      for (const p of liste.sort((x, y) => x.article.id - y.article.id)) {
        console.log(`   ${String(p.article.id).padStart(5)}  ${court(p.article.name, 38)}  ${p.detail}`);
      }
    }

    expect(
      perimees,
      perimees.length
        ? `${perimees.length} clés périmées — cf. le détail ci-dessus. ` +
            `« attribut absent à la génération » justifie une régénération ; ` +
            `« attribut modifié depuis » s'arbitre pièce par pièce.`
        : ""
    ).toEqual([]);
  });
});
