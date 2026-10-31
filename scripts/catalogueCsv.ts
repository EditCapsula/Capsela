import type { VestiaireRow } from "../src/lib/vestiaire";

// Lecture de l'export CSV de vestiaire_universel pour les audits hors ligne (Supabase n'est pas joignable depuis le conteneur).
// Partagé par scripts/creatif.audit.ts et scripts/creatif-sport.audit.ts.

/** Lecteur CSV RFC 4180 (champs entre guillemets, guillemets doublés, retours à la ligne dans un champ). */
export function lireCsv(texte: string): Record<string, string>[] {
  const lignes: string[][] = [];
  let champ = "";
  let ligne: string[] = [];
  let entre = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entre) {
      if (c === '"' && texte[i + 1] === '"') {
        champ += '"';
        i++;
      } else if (c === '"') entre = false;
      else champ += c;
    } else if (c === '"') entre = true;
    else if (c === ",") {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ || ligne.length) lignes.push([...ligne, champ]);
  const [entete, ...corps] = lignes;
  const cles = entete.map((h) => h.replace(/^﻿/, ""));
  return corps.filter((l) => l.length === cles.length).map((l) => Object.fromEntries(cles.map((k, j) => [k, l[j]])));
}

export function enLigne(r: Record<string, string>): VestiaireRow {
  const bool = (v: string) => (v === "true" ? true : v === "false" ? false : null);
  const num = (v: string) => (v === "" ? null : Number(v));
  const txt = (v: string | undefined) => (v === undefined || v === "" ? null : v);
  return {
    ...(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, txt(v)])) as unknown as VestiaireRow),
    id: Number(r.id),
    meteo_min_temp: num(r.meteo_min_temp),
    meteo_max_temp: num(r.meteo_max_temp),
    resiste_pluie: bool(r.resiste_pluie),
    est_basique_capsule: bool(r.est_basique_capsule),
    statement: bool(r.statement),
    necessite_soleil: bool(r.necessite_soleil),
    frozen: bool(r.frozen),
  } as VestiaireRow;
}
