#!/usr/bin/env node
// Script admin (08/10/2026) — génère les visuels « hero » (flat lay) du catalogue via l'Edge Function generate-hero-image.
//
// Usage : SUPABASE_URL=... SB_SECRET_KEY=... IDS=448,449,455 [FORCE=1] [DEPUIS_PHOTO=1] node scripts/generer-visuels-hero.mjs
// Sans IDS : REFUSE de balayer le catalogue (un lot d'essai se fait avec des ids explicites ; le balayage complet est un second
// temps, après validation visuelle de l'essai).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// « collants » (16/11/2026) : les collants actifs du catalogue (sous-type ou nom), au lieu d'une liste d'ids.
const PAR_CATEGORIE = (process.env.IDS || "").trim().toLowerCase() === "collants";
let IDS = PAR_CATEGORIE ? [] : (process.env.IDS || "").split(",").map((s) => Number(s.trim())).filter(Number.isFinite);
const FORCE = process.env.FORCE === "1";
// Depuis la photo du catalogue (16/11/2026) : la photo sert de référence, le visuel posé représente la même pièce.
const DEPUIS_PHOTO = process.env.DEPUIS_PHOTO === "1";

if (!SUPABASE_URL || !CLE) {
  console.error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
  process.exit(1);
}
if (PAR_CATEGORIE && SUPABASE_URL && CLE) {
  const url = `${SUPABASE_URL}/rest/v1/vestiaire_universel?select=id,name,sous_type&frozen=eq.false&or=(sous_type.ilike.*collant*,name.ilike.*collant*)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${CLE}`, apikey: CLE } });
  const lignes = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(lignes)) {
    console.error(`Lecture des collants impossible (${res.status}).`);
    process.exit(1);
  }
  IDS = lignes.map((l) => l.id);
  console.log(`Collants : ${lignes.map((l) => `#${l.id} ${l.name}`).join(" · ")}`);
}
if (!IDS.length) {
  console.error("IDS est requis (ids séparés par des virgules) : pas de balayage du catalogue sans lot d'essai validé.");
  process.exit(1);
}

let echecs = 0;
for (const id of IDS) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-hero-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLE}`, apikey: CLE, "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: id, force: FORCE, depuis_photo: DEPUIS_PHOTO }),
  });
  const corps = await res.json().catch(() => ({}));
  if (corps.ok) console.log(`#${id} ${corps.deja ? "déjà généré" : "généré"} ${corps.ratio ?? ""} ${corps.url}`);
  else {
    echecs++;
    console.log(`#${id} ÉCHEC [${corps.code ?? res.status}] ${corps.message ?? ""}`);
    // Une migration manquante vaut pour tous les ids : inutile d'insister.
    if (corps.code === "migration" || corps.code === "config") break;
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(echecs ? `${echecs} échec(s).` : "Terminé.");
process.exit(echecs ? 1 : 0);
