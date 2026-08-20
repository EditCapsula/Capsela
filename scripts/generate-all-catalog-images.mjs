#!/usr/bin/env node
// Script admin — génération de TOUTE image manquante du catalogue
// (contrairement à warm-frequent-basics.mjs, volontairement limité à une
// liste fermée de basiques). Demandé explicitement le 19/08/2026, une fois
// le système de génération/déduplication validé visuellement article par
// article — jusque-là la consigne était de ne jamais balayer tout le
// catalogue d'un coup.
//
// Cible url_image IS NULL (demande du 19/08/2026) : ne touche jamais un
// article qui a déjà un visuel, ni un visuel marqué 'invalid' (qui doit
// rester une décision consciente de remédiation, pas une régénération
// automatique silencieuse — un article invalide a url_image = null lui
// aussi, mais image_status = 'invalid' ; exclu explicitement ci-dessous).
// La déduplication (visual_key, cascade de réutilisation) s'applique
// normalement côté Edge Function — beaucoup de ces appels ne coûteront
// rien de plus, juste une réutilisation d'un visuel déjà généré pour un
// article équivalent.
//
// Usage (Node 20+, réutilise .env.local) :
//   node --env-file=.env.local scripts/generate-all-catalog-images.mjs
// ou explicitement :
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-all-catalog-images.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELAY_MS = 1200; // Espace les appels — évite de saturer l'API de génération.

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // .neq("image_status", "invalid") seul exclut à tort les lignes où
  // image_status est NULL (jamais renseigné) : en SQL, `NULL <> 'invalid'`
  // vaut NULL/inconnu, pas TRUE, donc la ligne ne passe pas le filtre —
  // correctif 20/08/2026, trouvé sur un article ajouté/renommé manuellement
  // dont image_status n'avait jamais été explicitement mis à 'missing'.
  const { data: rows, error } = await supabase
    .from("vestiaire_universel")
    .select("id, name")
    .is("url_image", null)
    .or("image_status.is.null,image_status.neq.invalid")
    .order("id", { ascending: true });

  if (error) {
    console.error(`Erreur de lecture du catalogue : ${error.message}`);
    process.exit(1);
  }

  console.log(`${rows.length} article(s) sans visuel prêt à traiter.\n`);

  let ok = 0;
  let dailyLimitHit = false;
  let failed = 0;

  for (const row of rows) {
    if (dailyLimitHit) break;
    process.stdout.write(`  [#${row.id}] "${row.name || "(sans nom)"}" … `);

    const { data, error: fnError } = await supabase.functions.invoke("generate-catalog-image", {
      body: { item_id: row.id },
    });

    if (data?.status === "daily_limit_reached" || data?.error === "daily_limit_reached") {
      dailyLimitHit = true;
      console.log("plafond quotidien atteint — arrêt, relancer demain pour le reste.");
      break;
    }
    if (fnError || !data?.image_url) {
      failed++;
      console.log(`échec (${fnError?.message || data?.status || "réponse invalide"})`);
    } else {
      ok++;
      console.log("ok");
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nTerminé : ${ok} généré(s)/réutilisé(s), ${failed} échec(s)${dailyLimitHit ? ", arrêté sur plafond quotidien" : ""}.`);
}

main();
