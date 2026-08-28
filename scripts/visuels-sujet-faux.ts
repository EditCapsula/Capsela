// Audit et régénération CIBLÉE des visuels dont le sujet dessiné n'est pas
// la bonne pièce — un body rendu en blazer, un sac rendu en chaussure.
//
// Pourquoi cet outil (demande du 28/08/2026) : le vocabulaire de sujets
// (SUBTYPE_EN dans _shared/imagePrompt.ts) s'est enrichi au fil des
// correctifs. Les visuels générés AVANT l'ajout d'un terme ont été dessinés
// à partir d'un sujet de repli générique ("top", "item") au lieu du terme
// exact ("bodysuit"). Le catalogue garde la trace de ce qui a été demandé à
// OpenAI dans vestiaire_universel.image_prompt : on compare donc le sujet
// réellement employé au sujet que le code produirait AUJOURD'HUI, et on ne
// retient que les écarts — quelques dizaines de pièces, pas les centaines
// qu'un balayage complet régénérerait.
//
// Le reste des imperfections connues (nuances de couleur fusionnées par
// COLOR_BUCKETS, sous-types trop grossiers) n'est PAS traité ici : ce sont
// des visuels plausibles, pas des visuels faux, et les corriger imposerait
// de régénérer des centaines d'images. Décision explicite du 28/08/2026.
//
// Lecture seule par défaut. La régénération n'a lieu qu'avec MODE=regen,
// choisi explicitement au lancement du workflow.
//
// Usage :
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/visuels-sujet-faux.ts
//   MODE=regen MAX=40 node --experimental-strip-types ... (idem)

import { createClient } from "@supabase/supabase-js";
import { buildImagePrompt, type VestiaireRow } from "../supabase/functions/_shared/imagePrompt.ts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = (process.env.MODE || "audit").trim().toLowerCase();
// Plafond dur de sécurité : borne le coût OpenAI d'une exécution. ~0,02 $
// l'image, donc 40 assets ≈ 0,80 $. Jamais dépassé même si la détection
// remonte davantage de pièces — le reste attend une exécution suivante.
const MAX = Number(process.env.MAX || 40);
const DELAY_MS = 1200;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
  process.exit(1);
}
if (MODE !== "audit" && MODE !== "regen") {
  console.error(`MODE inconnu : "${MODE}" — attendu "audit" ou "regen".`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CHAMPS_PROMPT =
  "id, name, category, sous_type, couleur_dominante, matiere, genre, coupe, niveau_tendance, " +
  "silhouette_mode, details_mode, prompt_image_override";

interface Ligne extends VestiaireRow {
  image_prompt: string | null;
  image_status: string | null;
  url_image: string | null;
  visual_asset_id: number | null;
}

/**
 * Le sujet attendu apparaît-il tel quel dans le prompt réellement envoyé ?
 * Test volontairement conservateur : on cherche le terme exact, bordé de
 * non-lettres. Un prompt qui contient "bodysuit" est considéré bon même si
 * le reste de la formulation a changé depuis — on ne veut signaler que les
 * cas où OpenAI a dessiné une AUTRE pièce, pas les évolutions de style.
 */
function sujetPresent(prompt: string, sujet: string): boolean {
  const echappe = sujet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${echappe}([^a-z]|$)`, "i").test(prompt);
}

async function main() {
  const { data, error } = await supabase
    .from("vestiaire_universel")
    .select(`${CHAMPS_PROMPT}, image_prompt, image_status, url_image, visual_asset_id`)
    .order("id", { ascending: true })
    .returns<Ligne[]>();

  if (error) {
    console.error(`Erreur de lecture du catalogue : ${error.message}`);
    process.exit(1);
  }

  const avecVisuel = data.filter((r) => r.image_status === "ready" && r.url_image && r.image_prompt);
  const faux: { ligne: Ligne; attendu: string; }[] = [];
  const vocabulaireManquant: Ligne[] = [];

  for (const ligne of avecVisuel) {
    const built = buildImagePrompt(ligne);
    if (!built.ok) {
      // Le code ACTUEL ne sait toujours pas quel objet dessiner : régénérer
      // reproduirait la même erreur. Ces pièces demandent d'abord une entrée
      // de vocabulaire, pas un appel OpenAI — signalées, jamais régénérées.
      vocabulaireManquant.push(ligne);
      continue;
    }
    if (!sujetPresent(ligne.image_prompt!, built.noun)) faux.push({ ligne, attendu: built.noun });
  }

  console.log(`Catalogue : ${data.length} article(s), dont ${avecVisuel.length} avec un visuel prêt.\n`);

  if (vocabulaireManquant.length) {
    console.log(`⚠ ${vocabulaireManquant.length} article(s) dont le sous-type reste inconnu du vocabulaire —`);
    console.log(`  à corriger par un ajout dans SUBTYPE_EN, PAS par une régénération :`);
    for (const l of vocabulaireManquant.slice(0, 30)) {
      console.log(`    [#${l.id}] ${l.name} — sous_type "${l.sous_type}" / category "${l.category}"`);
    }
    if (vocabulaireManquant.length > 30) console.log(`    … et ${vocabulaireManquant.length - 30} autre(s).`);
    console.log("");
  }

  if (!faux.length) {
    console.log("Aucun visuel au sujet manifestement faux. Rien à régénérer.");
    return;
  }

  // Regroupement par asset : plusieurs articles peuvent partager une même
  // image. Une seule génération suffit pour tout le groupe, les articles
  // suivants ne font que recopier l'URL produite (aucun appel OpenAI).
  const parAsset = new Map<number, { ligne: Ligne; attendu: string }[]>();
  const sansAsset: { ligne: Ligne; attendu: string }[] = [];
  for (const f of faux) {
    if (f.ligne.visual_asset_id === null) sansAsset.push(f);
    else {
      const grp = parAsset.get(f.ligne.visual_asset_id) || [];
      grp.push(f);
      parAsset.set(f.ligne.visual_asset_id, grp);
    }
  }

  const groupes = [...parAsset.entries()];
  const aGenerer = groupes.length + sansAsset.length;
  console.log(`${faux.length} article(s) au sujet faux, répartis sur ${aGenerer} visuel(s) distinct(s).`);
  console.log(`Coût estimé d'une régénération complète : ~${(aGenerer * 0.02).toFixed(2)} $.\n`);

  for (const [assetId, grp] of groupes) {
    console.log(`  asset ${assetId} — dessiné comme autre chose que « ${grp[0].attendu} »`);
    for (const { ligne, attendu } of grp) {
      console.log(`    [#${ligne.id}] ${ligne.name} — sous_type "${ligne.sous_type}" → attendu « ${attendu} »`);
    }
  }
  for (const { ligne, attendu } of sansAsset) {
    console.log(`  (sans asset) [#${ligne.id}] ${ligne.name} → attendu « ${attendu} »`);
  }
  console.log("");

  if (MODE === "audit") {
    console.log("MODE=audit : aucune modification effectuée. Relancer avec MODE=regen pour corriger.");
    return;
  }

  const lots = [
    ...groupes.map(([assetId, grp]) => ({ assetId, grp })),
    ...sansAsset.map((f) => ({ assetId: null as number | null, grp: [f] })),
  ].slice(0, MAX);
  console.log(`MODE=regen : traitement de ${lots.length} visuel(s) (plafond MAX=${MAX}).\n`);

  let generes = 0;
  let echecs = 0;

  for (const { assetId, grp } of lots) {
    // Invalider l'asset est ce qui débloque la régénération : tant qu'il est
    // "ready", la cascade de réutilisation de l'Edge Function le rendrait à
    // l'article sans jamais rappeler OpenAI. Aucune suppression — la ligne
    // reste en base et sera réécrite en place avec la nouvelle image.
    if (assetId !== null) {
      const { error: invalidError } = await supabase
        .from("visual_assets")
        .update({ image_status: "invalid" })
        .eq("id", assetId);
      if (invalidError) {
        echecs++;
        console.log(`  asset ${assetId} : échec de l'invalidation (${invalidError.message}) — ignoré.`);
        continue;
      }
    }

    // Premier article du groupe : génère réellement. Les suivants retrouvent
    // l'asset redevenu "ready" et se contentent d'en recopier l'URL — sans
    // cette seconde passe ils garderaient l'ancienne image, car chaque
    // (ré)génération produit une URL horodatée distincte.
    for (const { ligne } of grp) {
      process.stdout.write(`  [#${ligne.id}] "${ligne.name}" … `);
      const { data: res, error: fnError } = await supabase.functions.invoke("generate-catalog-image", {
        body: { item_id: ligne.id },
      });
      if (res?.status === "daily_limit_reached" || res?.error === "daily_limit_reached") {
        console.log("plafond quotidien atteint — arrêt.");
        console.log(`\nTerminé (interrompu) : ${generes} visuel(s) régénéré(s), ${echecs} échec(s).`);
        return;
      }
      if (fnError || !res?.image_url) {
        echecs++;
        console.log(`échec (${fnError?.message || res?.status || "réponse invalide"})`);
      } else {
        generes++;
        console.log("ok");
      }
      await sleep(DELAY_MS);
    }
  }

  const restants = aGenerer - lots.length;
  console.log(`\nTerminé : ${generes} article(s) remis à jour, ${echecs} échec(s).`);
  if (restants > 0) console.log(`${restants} visuel(s) au-delà du plafond MAX — relancer pour les traiter.`);
}

main();
