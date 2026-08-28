#!/usr/bin/env node
// Script admin FACULTATIF — recette 18/08/2026 v2 (stratégie "generate on
// first use"). N'existe QUE pour préchauffer les basiques les plus
// fréquents du catalogue, jamais pour pré-générer le catalogue entier :
// la première utilisatrice qui reçoit une pièce sans visuel déclenche déjà
// sa génération, réutilisée gratuitement par toutes les suivantes (Edge
// Function generate-catalog-image, cascade de réutilisation par
// visual_key). Générer des milliers de combinaisons ici serait à la fois
// inutile (aucune économie supplémentaire, la déduplication opère déjà à
// l'usage) et coûteux — d'où la liste fermée ci-dessous plutôt qu'un
// balayage de tout le catalogue.
//
// Usage :
//   SUPABASE_URL=... SB_SECRET_KEY=... node scripts/generate-missing-catalog-images.mjs
// ou, en réutilisant .env.local (Node 20+) :
//   node --env-file=.env.local scripts/generate-missing-catalog-images.mjs
//
// Pour chaque basique : cherche une ligne vestiaire_universel dont le nom
// correspond, ignore silencieusement s'il n'y en a aucune dans ton
// catalogue actuel, ignore aussi si un visuel existe déjà (ready). Relance
// sans risque : ne régénère jamais ce qui est déjà prêt.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Clé privilégiée : SB_SECRET_KEY (clé sb_secret_... du nouveau système
// Supabase) d'abord, SUPABASE_SERVICE_ROLE_KEY ensuite. Les clés JWT
// historiques ont été désactivées le 28/08/2026 — le repli ne sert donc plus
// qu'à un environnement local qui n'aurait pas encore été mis à jour.
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DELAY_MS = 1200; // Espace les appels — évite de saturer l'API de génération.

// Basiques fréquents uniquement (brief 18/08/2026 v2) — jamais tout le catalogue.
const FREQUENT_BASICS = [
  "T-shirt blanc",
  "T-shirt noir",
  "Chemise blanche",
  "Jean bleu",
  "Jean noir",
  "Pantalon noir",
  "Blazer noir",
  "Trench beige",
  "Baskets blanches",
  "Ballerines noires",
  "Ballerines beige",
  "Mocassins noirs",
  "Sac noir",
  "Cabas camel",
  "Collier fin doré",
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log(`Préchauffage de ${FREQUENT_BASICS.length} basique(s) fréquent(s).`);
  let ok = 0;
  let skipped = 0;
  let notFound = 0;
  let failed = 0;

  for (const basicName of FREQUENT_BASICS) {
    process.stdout.write(`  "${basicName}" … `);
    const { data: row, error } = await supabase
      .from("vestiaire_universel")
      .select("id, image_status")
      .ilike("name", basicName)
      .limit(1)
      .maybeSingle();

    if (error) {
      failed++;
      console.log(`erreur de lecture (${error.message})`);
      continue;
    }
    if (!row) {
      notFound++;
      console.log("absent du catalogue actuel, ignoré");
      continue;
    }
    if (row.image_status === "ready") {
      skipped++;
      console.log("déjà prêt, ignoré");
      continue;
    }

    const { data, error: fnError } = await supabase.functions.invoke("generate-catalog-image", {
      body: { item_id: row.id },
    });
    if (fnError || !data?.image_url) {
      failed++;
      console.log(`échec (${fnError?.message || data?.status || "réponse invalide"})`);
    } else {
      ok++;
      console.log("ok");
    }
    await sleep(DELAY_MS);
  }

  console.log(
    `\nTerminé : ${ok} généré(s), ${skipped} déjà prêt(s), ${notFound} absent(s) du catalogue, ${failed} échec(s).`
  );
}

main();
