import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, saisonCapsulePourMeteo, weatherForDay } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { composerFlatLay, hauteurDuContexte, type ContexteFlatLay } from "../src/lib/flatLay";
import { choisirTemplate, type TemplateFlatLay } from "../src/lib/flatLayTemplates";
import { resolveHeroImage } from "../src/lib/catalogImages";
import { margesDe, objectBounds, ratioHero } from "../src/lib/catalogMarges";
import type { CatalogItem } from "../src/lib/catalog";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// VALIDATION VISUELLE DES SIX TEMPLATES (13/10/2026) — LECTURE SEULE. Compose des tenues réelles du catalogue (capsules de plusieurs styles et
// saisons, plusieurs occasions), puis rend côte à côte, pour chacune, le flat lay ACTUEL (sans template) et le NOUVEAU (avec son template, ou le
// moteur actuel en repli). Écrit une page HTML (FLATLAY_SORTIE) à photographier. Même moteur et mêmes images que l'application :
// `composerFlatLay`, `resolveHeroImage`, `margesDe`, `objectBounds`. La comparaison porte sur le rendu, jamais sur les recommandations.
const SORTIE = process.env.FLATLAY_SORTIE || "/tmp/flatlay-comparaison.html";
const CONTEXTE = (process.env.FLATLAY_CONTEXTE as ContexteFlatLay) || "look-detail";
const MAX = Number(process.env.FLATLAY_MAX || 30);

describe("flat lay : ancien rendu contre templates", () => {
  it("écrit la planche de comparaison", async () => {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SB_SECRET_KEY!);
    const { data: rows } = await sb.from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
    const pool = rows!.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true).map(rowToCatalogItem).filter((x): x is CatalogItem => Boolean(x));
    const parId = new Map(pool.map((p) => [p.id, p]));

    type Sortie = { ids: number[]; template: TemplateFlatLay | null; legende: string };
    const trouvees: Sortie[] = [];
    const vues = new Set<string>();
    const compte: Record<string, number> = {};
    const OCCASIONS = ["quotidien", "travail_formel", "date", "soiree", "voyage", "evenement_perso"] as const;
    for (const [temp, saison, label] of [[14, "Printemps", "Nuageux"], [24, "Été", "Ensoleillé"], [12, "Automne", "Nuageux"], [7, "Hiver", "Nuageux"]] as const) {
      const w = weatherForDay(temp, label, saison);
      const st = saisonCapsulePourMeteo(temp);
      for (const style of STYLES_FEMME) {
        const caps = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], st, pool);
        for (const occ of OCCASIONS) {
          for (let i = 0; i < 14; i++) {
            const r = generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", st);
            if (r.noCompleteOutfit) continue;
            const pieces = r.ids.map((id) => parId.get(id)!).filter(Boolean);
            // Toutes les pièces doivent avoir un visuel : on compare des planches réelles, pas des pastilles.
            if (!pieces.every((p) => resolveHeroImage(p).url)) continue;
            const cle = [...r.ids].sort().join(",");
            if (vues.has(cle)) continue;
            vues.add(cle);
            const tpl = choisirTemplate(pieces.map((p) => ({ cat: p.cat, subtype: p.subtype, name: p.name })));
            const k = tpl ?? "repli";
            if ((compte[k] ?? 0) >= Math.ceil(MAX / 7)) continue;
            compte[k] = (compte[k] ?? 0) + 1;
            trouvees.push({ ids: r.ids, template: tpl, legende: `${saison} · ${style} · ${occ}` });
          }
        }
      }
    }
    const HAUTEUR = hauteurDuContexte(CONTEXTE);
    const planche = (pieces: CatalogItem[], template: TemplateFlatLay | null, graine: string) => {
      const imgs = pieces.map((it) => ({ it, img: resolveHeroImage(it) }));
      const comp = composerFlatLay(
        imgs.map(({ it, img }) => {
          const b = objectBounds(img.url);
          const ratio = b ? (b.width * (ratioHero(img.url) ?? 1)) / b.height : 0.8;
          return { id: it.id, cat: it.cat, ratio, accessoireType: it.accessoireType, photoBrute: img.kind === "photo" };
        }),
        graine,
        { contexte: CONTEXTE, template }
      ).pieces;
      return comp
        .map((p) => {
          const { it, img } = imgs.find(({ it }) => it.id === p.id)!;
          const m = margesDe(img.url);
          const base = `position:absolute;left:${p.x}%;top:${(p.y / HAUTEUR) * 100}%;width:${p.l}%;aspect-ratio:${p.l}/${p.h};transform:translate(-50%,-50%);z-index:${p.z};filter:drop-shadow(0 6px 12px rgba(29,26,22,.12));`;
          if (m) {
            const lc = 1 - m.g - m.d;
            const hc = 1 - m.h - m.b;
            return `<div style="${base}overflow:hidden"><img src="${img.url}" alt="${it.name}" style="position:absolute;display:block;max-width:none;width:${100 / lc}%;height:${100 / hc}%;left:${(-m.g / lc) * 100}%;top:${(-m.h / hc) * 100}%"></div>`;
          }
          return `<div style="${base}overflow:hidden"><img src="${img.url}" alt="${it.name}" style="display:block;width:100%;height:100%;object-fit:contain"></div>`;
        })
        .join("");
    };
    const cartes = trouvees.slice(0, MAX).map((t, n) => {
      const pieces = t.ids.map((id) => parId.get(id)!);
      const graine = t.ids.join(",");
      const noms = pieces.map((p) => p.cat).join(" + ");
      return `<section><h3>${n + 1} · ${t.template ?? "repli (moteur actuel)"}</h3><p>${t.legende}<br>${noms}</p>
        <div class="paire"><figure><figcaption>actuel</figcaption><div class="zone" style="aspect-ratio:100/${HAUTEUR}">${planche(pieces, null, graine)}</div></figure>
        <figure><figcaption>${t.template ?? "repli : identique"}</figcaption><div class="zone" style="aspect-ratio:100/${HAUTEUR}">${planche(pieces, t.template, graine)}</div></figure></div></section>`;
    });
    writeFileSync(
      SORTIE,
      `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#F3EEE5;font:12px Manrope,sans-serif;color:#1d1a16}section{margin-bottom:22px;break-inside:avoid}h3{margin:0 0 2px;font:600 14px serif}p{margin:0 0 6px;color:#5c5548}.paire{display:flex;gap:12px}figure{margin:0;flex:1}figcaption{margin-bottom:3px;color:#7b7366}.zone{position:relative;background:#EEDED8;border-radius:16px;overflow:hidden;width:100%}</style><body style="width:760px">${cartes.join("")}</body>`
    );
    console.log("COMPTE", JSON.stringify(compte), "écrites", Math.min(trouvees.length, MAX), "->", SORTIE);
  }, 280000);
});
