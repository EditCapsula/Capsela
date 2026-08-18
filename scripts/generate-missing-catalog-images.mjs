#!/usr/bin/env node
// Script admin : génère progressivement les visuels manquants du catalogue
// (recette 18/08/2026, gestion automatique des images produit). Ne
// développe pas de back-office — juste ce script, exécuté manuellement.
//
// Usage :
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/generate-missing-catalog-images.mjs [limite]
// ou, en réutilisant .env.local (Node 20+) :
//   node --env-file=.env.local scripts/generate-missing-catalog-images.mjs [limite]
//
// - Ne sélectionne que image_status = 'missing' — ne retouche jamais 'ready'.
// - Batch limité (par défaut 20, ou premier argument CLI) pour contrôler les
//   coûts d'appel à l'API de génération.
// - Reprise après interruption : chaque exécution requête à nouveau les
//   lignes encore 'missing' — la base fait office de point de reprise,
//   aucun état à conserver entre deux exécutions.
// - SUPABASE_SERVICE_ROLE_KEY ne doit jamais être commité ni exposé côté
//   frontend — ce script tourne uniquement en local/CI, jamais dans le
//   navigateur.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_LIMIT = Number(process.argv[2]) || 20;
const DELAY_MS = 1200; // Espace les appels — évite de saturer l'API de génération.

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { data: rows, error } = await supabase
    .from("vestiaire_universel")
    .select("id, name")
    .eq("image_status", "missing")
    .order("id", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("Impossible de lire vestiaire_universel :", error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log("Aucune image manquante — rien à générer.");
    return;
  }

  console.log(`${rows.length} pièce(s) à traiter (limite ${BATCH_LIMIT}).`);
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    process.stdout.write(`  #${row.id} ${row.name || "(sans nom)"} … `);
    const { data, error: fnError } = await supabase.functions.invoke("generate-catalog-image", {
      body: { item_id: row.id },
    });
    if (fnError || !data?.image_url) {
      failed++;
      console.log(`échec (${fnError?.message || "réponse invalide"})`);
    } else {
      ok++;
      console.log("ok");
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nTerminé : ${ok} réussie(s), ${failed} échec(s) sur ce lot de ${rows.length}.`);
  if (rows.length === BATCH_LIMIT) {
    console.log("Le lot était plein — relance le script pour traiter la suite.");
  }
}

main();
