import { describe, expect, it } from "vitest";
import { CHEVAUCHEMENT_MAX, CONTEXTES, LARGEUR_ACCESSOIRE_MIN, LARGEUR_HERO_MAX, LIMITE_INCLINAISON, MASQUE_MAX, PART_VISUELLE, PROPORTION_PIECE, attribuerRoles, composerFlatLay, echelleVisuelle, generateur, type PieceFlatLay, type PlacementFlatLay } from "../flatLay";
import type { CategoryKey } from "../types";

let n = 0;
const p = (cat: CategoryKey, ratio = 0.8): PieceFlatLay => ({ id: ++n, cat, ratio });
const boiteDe = (q: PlacementFlatLay) => {
  const r = (Math.abs(q.angle) * Math.PI) / 180;
  const w = q.l * Math.cos(r) + q.h * Math.sin(r);
  const h = q.l * Math.sin(r) + q.h * Math.cos(r);
  return { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - h / 2, y1: q.y + h / 2 };
};
const roles = (pieces: PieceFlatLay[]) => Object.fromEntries(attribuerRoles(pieces).map((r) => [r.piece.cat, r.role]));

describe("attribuerRoles — la pièce héro suit l'ordre du brief", () => {
  it("robe > manteau > veste > pantalon/jupe > top", () => {
    expect(roles([p("robe"), p("manteau"), p("veste"), p("haut")]).robe).toBe("hero");
    expect(roles([p("manteau"), p("veste"), p("pantalon"), p("pull")]).manteau).toBe("hero");
    expect(roles([p("veste"), p("pantalon"), p("haut")]).veste).toBe("hero");
    expect(roles([p("pantalon"), p("haut")]).pantalon).toBe("hero");
    expect(roles([p("haut")]).haut).toBe("hero");
  });
  it("une combinaison compte comme une robe", () => {
    expect(roles([p("combinaison"), p("sac")]).combinaison).toBe("hero");
  });
  it("sous une veste : le haut est le second plan, le bas le bas, puis chaussures, sac et accessoires", () => {
    const r = roles([p("veste"), p("haut"), p("pantalon"), p("chaussures"), p("sac"), p("bijou")]);
    expect(r).toMatchObject({ veste: "hero", haut: "secondaire", pantalon: "bas", chaussures: "chaussures", sac: "sac", bijou: "accessoire" });
  });
  it("chaque pièce a un seul rôle", () => {
    const pieces = [p("veste"), p("manteau"), p("haut"), p("pull"), p("pantalon"), p("jupe"), p("sac"), p("chaussures"), p("bijou"), p("accessoire")];
    const sortie = attribuerRoles(pieces);
    expect(sortie.length).toBe(pieces.length);
    expect(new Set(sortie.map((s) => s.piece.id)).size).toBe(pieces.length);
  });
});

describe("composerFlatLay — déterministe, borné, sans grille", () => {
  const look = () => [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1), p("bijou", 1.2)];

  it("la même graine donne exactement la même composition", () => {
    const pieces = look();
    expect(composerFlatLay(pieces, "12,15,40")).toEqual(composerFlatLay(pieces, "12,15,40"));
  });

  it("des graines différentes donnent des compositions différentes", () => {
    const pieces = look();
    const vues = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(composerFlatLay(pieces, "look-" + i, { proportions: false }).pieces.map((q) => [Math.round(q.x), Math.round(q.angle)]))));
    expect(vues.size).toBeGreaterThan(6);
  });

  it("chaque inclinaison reste dans la plage de son rôle (héro ±4°, secondaires ±5°, chaussures ±8°, sac ±6°, accessoires ±10°)", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (let i = 0; i < 40; i++)
        for (const q of composerFlatLay(look(), "g" + i, { contexte }).pieces) expect(Math.abs(q.angle)).toBeLessThanOrEqual(LIMITE_INCLINAISON[q.role] + 1e-9);
  });

  it("une veste héro est toujours à droite, le haut à gauche, le bas entre les deux (tailles d'avant le 04/11/2026)", () => {
    for (let i = 0; i < 40; i++) {
      const par = Object.fromEntries(composerFlatLay(look(), "d" + i, { contexte: "look-detail", proportions: false }).pieces.map((q) => [q.role, q]));
      expect(par.hero.x).toBeGreaterThan(par.bas.x);
      expect(par.bas.x).toBeGreaterThan(par.secondaire.x);
      expect(par.chaussures.x).toBeGreaterThan(par.sac.x);
    }
  });

  it("avec les proportions (04/11/2026, « le jean rapetisse trop quand il y a un blazer ») : le haut puis le bas à gauche, la veste puis le sac et les chaussures à droite", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (let i = 0; i < 40; i++) {
        const par = Object.fromEntries(composerFlatLay(look(), "d" + i, { contexte }).pieces.map((q) => [q.role, q]));
        const b = (q: PlacementFlatLay) => boiteDe(q);
        expect(par.hero.x, `${contexte} ${i}`).toBeGreaterThan(par.secondaire.x);
        // Le bas sous le haut, dans sa colonne : à gauche de la veste, sous le haut, jamais derrière la veste.
        expect(par.bas.y).toBeGreaterThan(par.secondaire.y);
        expect(b(par.bas).x1).toBeLessThanOrEqual(b(par.hero).x0 + 1e-6);
        // Le bas est la pièce la plus haute de la planche.
        for (const q of Object.values(par)) expect(par.bas.h + 1e-6).toBeGreaterThanOrEqual(q.h);
        for (const role of ["sac", "chaussures"]) if (par[role]) expect(par[role].y).toBeGreaterThan(par.hero.y);
      }
  });

  it("tout reste dans la zone, rotation comprise, avec la marge de sécurité, et le héro est la plus grande pièce", () => {
    for (let i = 0; i < 40; i++) {
      const { pieces } = composerFlatLay(look(), "z" + i);
      // La marge du contexte (l'accueil, par défaut ici), pas la constante d'avant : la planche de l'accueil remplit sa zone.
      const M = CONTEXTES["hero-home"].marge;
      for (const q of pieces) {
        const r = (Math.abs(q.angle) * Math.PI) / 180;
        const w = q.l * Math.cos(r) + q.h * Math.sin(r);
        const h = q.l * Math.sin(r) + q.h * Math.cos(r);
        expect(q.x - w / 2).toBeGreaterThanOrEqual(M - 0.01);
        expect(q.x + w / 2).toBeLessThanOrEqual(100 - M + 0.01);
        expect(q.y - h / 2).toBeGreaterThanOrEqual(M - 0.01);
        expect(q.y + h / 2).toBeLessThanOrEqual(112 - M + 0.01);
      }
    }
  });

  it("le sac et les chaussures ne sont jamais insignifiants (≥ 20 % de la largeur)", () => {
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "s" + i).pieces) if (q.role === "sac" || q.role === "chaussures") expect(q.l).toBeGreaterThanOrEqual(20);
  });

  it("la veste et le manteau sont toujours au fond, le bas puis le haut devant, puis chaussures, sac, accessoires", () => {
    const z = (pieces: PieceFlatLay[]) => Object.fromEntries(composerFlatLay(pieces, "z", { contexte: "look-detail" }).pieces.map((q) => [pieces.find((x) => x.id === q.id)!.cat, q.z]));
    const a = z(look());
    expect(a.veste).toBeLessThan(a.pantalon);
    expect(a.pantalon).toBeLessThan(a.haut);
    expect(a.haut).toBeLessThan(a.chaussures);
    expect(a.chaussures).toBeLessThan(a.sac);
    // Un bijou isolé ou trop petit est écarté de la planche (cf. « accessoires » plus bas) : on ne compare que s'il y est.
    if (a.bijou !== undefined) expect(a.sac).toBeLessThan(a.bijou);
    // Même quand la veste n'est pas le héro (une robe) ou que le manteau est le second plan.
    const b = z([p("robe"), p("veste"), p("sac")]);
    expect(b.veste).toBeLessThan(b.robe);
    const c = z([p("pantalon"), p("manteau"), p("haut")]);
    expect(c.manteau).toBeLessThan(c.pantalon);
  });

  it("aucune pièce : rien", () => {
    expect(composerFlatLay([], "x").pieces).toEqual([]);
  });
});

describe("generateur — stable", () => {
  it("rend la même suite pour la même graine", () => {
    const a = generateur("abc");
    const b = generateur("abc");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("echelleVisuelle — la taille se rapporte à la catégorie (standard image flat lay)", () => {
  it("la pièce de référence de chaque rôle garde l'échelle 1", () => {
    expect(echelleVisuelle("hero", "veste")).toBe(1);
    expect(echelleVisuelle("secondaire", "haut")).toBe(1);
    expect(echelleVisuelle("bas", "pantalon")).toBe(1);
    expect(echelleVisuelle("chaussures", "chaussures")).toBe(1);
    expect(echelleVisuelle("sac", "sac")).toBe(1);
  });
  it("une jupe ou un short en bas sont plus petits qu'un pantalon, un manteau plus grand qu'une veste", () => {
    expect(echelleVisuelle("bas", "jupe")).toBeLessThan(1);
    expect(echelleVisuelle("bas", "short")).toBeLessThan(echelleVisuelle("bas", "jupe"));
    expect(echelleVisuelle("hero", "manteau")).toBeGreaterThan(1);
    expect(echelleVisuelle("hero", "robe")).toBeGreaterThan(1);
  });
  it("l'échelle reste bornée et le standard couvre toutes les catégories", () => {
    for (const cat of Object.keys(PART_VISUELLE) as CategoryKey[])
      for (const role of ["hero", "secondaire", "bas", "chaussures", "sac", "accessoire"] as const) {
        const e = echelleVisuelle(role, cat);
        expect(e).toBeGreaterThanOrEqual(0.82);
        expect(e).toBeLessThanOrEqual(1.12);
      }
  });
  it("chaque placement porte sa catégorie et son échelle visuelle", () => {
    const { pieces } = composerFlatLay([p("manteau", 0.9), p("pull", 0.9), p("jupe", 0.7)], "v", { proportions: false });
    const hero = pieces.find((q) => q.role === "hero")!;
    expect(hero.cat).toBe("manteau");
    expect(hero.visualScale).toBeGreaterThan(1);
    expect(pieces.find((q) => q.role === "bas")!.visualScale).toBeLessThan(1);
  });
});

describe("contextes du flat lay — un moteur, des paramètres différents", () => {
  const look = () => [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6), p("chaussures", 1.1), p("sac", 0.82)];

  it("hero-home et look-detail utilisent le même moteur mais pas la même zone ni les mêmes angles", () => {
    const home = composerFlatLay(look(), "ctx", { proportions: false, contexte: "hero-home" });
    const detail = composerFlatLay(look(), "ctx", { proportions: false, contexte: "look-detail" });
    expect(CONTEXTES["look-detail"].hauteur).toBeGreaterThan(CONTEXTES["hero-home"].hauteur);
    // L'accueil ne pose que 4 pièces (09/10/2026), la Tenue du jour toutes.
    expect(home.pieces.length).toBe(CONTEXTES["hero-home"].maxPieces);
    expect(detail.pieces.length).toBe(5);
    const angle = (r: typeof home, role: string) => r.pieces.find((q) => q.role === role)!.angle;
    // Les deux contextes obéissent aux mêmes plages d'inclinaison (calibrage du 08/10/2026).
    expect(Math.abs(angle(detail, "hero"))).toBeLessThanOrEqual(LIMITE_INCLINAISON.hero + 1e-9);
    expect(Math.abs(angle(home, "hero"))).toBeLessThanOrEqual(LIMITE_INCLINAISON.hero + 1e-9);
  });

  it("look-detail : la pièce héro est plus grande à l'écran que sur la homepage", () => {
    // En pixels et non plus en part de zone (14/10/2026) : la composition de l'accueil, resserrée, remplit davantage SA zone (196 × 219 px
    // à 390 px) ; celle de la Tenue du jour, qui pose toute la tenue, en remplit moins, mais dans une zone deux fois et demie plus grande
    // (310 × 350 px). C'est la taille à l'écran que la règle protège.
    const px = (r: ReturnType<typeof composerFlatLay>, largeurPx: number) => {
      const hero = r.pieces.find((q) => q.role === "hero")!;
      return ((hero.l * largeurPx) / 100) * ((hero.h * largeurPx) / 100);
    };
    const home = composerFlatLay(look(), "ctx", { contexte: "hero-home", hauteurZone: 112 });
    const detail = composerFlatLay(look(), "ctx", { contexte: "look-detail", hauteurZone: 113 });
    expect(px(detail, 310)).toBeGreaterThan(px(home, 196));
  });

  it("une robe est centrée en look-detail, sac et chaussures dessous de part et d'autre", () => {
    for (let i = 0; i < 20; i++) {
      const { pieces } = composerFlatLay([p("robe", 0.7), p("sac", 0.8), p("chaussures", 1.1)], "r" + i, { proportions: false, contexte: "look-detail" });
      const par = Object.fromEntries(pieces.map((q) => [q.role, q]));
      expect(par.hero.y).toBeLessThan(par.sac.y);
      expect(par.hero.y).toBeLessThan(par.chaussures.y);
      expect(Math.abs(par.hero.x - 50)).toBeLessThan(18);
    }
  });

  it("chaque contexte est défini, sa zone et sa marge sont raisonnables", () => {
    for (const c of ["hero-home", "look-detail", "capsule", "dressing", "packing"] as const) {
      expect(CONTEXTES[c].hauteur).toBeGreaterThanOrEqual(95);
      expect(CONTEXTES[c].marge).toBeGreaterThanOrEqual(3);
      expect(composerFlatLay(look(), "x", { proportions: false, contexte: c }).pieces.length).toBe(Math.min(5, CONTEXTES[c].maxPieces ?? 5));
    }
  });
});

describe("accessoires — jamais isolés, jamais en surnombre", () => {
  it("le nombre d'accessoires est limité par le contexte et par le nombre de pièces", () => {
    const base = [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6)];
    const trois = [p("bijou", 1), p("accessoire", 1), p("bijou", 1), p("accessoire", 1)];
    const { pieces } = composerFlatLay([...base, ...trois], "a", { proportions: false });
    expect(pieces.filter((q) => q.role === "accessoire").length).toBeLessThanOrEqual(CONTEXTES["hero-home"].maxAccessoires[0]);
    const beaucoup = composerFlatLay([...base, p("chaussures"), p("sac"), ...trois], "a", { proportions: false }).pieces.filter((q) => q.role === "accessoire");
    expect(beaucoup.length).toBeLessThanOrEqual(CONTEXTES["hero-home"].maxAccessoires[1]);
  });

  it("un accessoire de tenue passe avant un bijou", () => {
    const bijou = p("bijou", 1);
    const ceinture = p("accessoire", 1.5);
    const { pieces, ecartees } = composerFlatLay([p("robe", 0.7), p("sac", 0.8), p("chaussures", 1.1), bijou, ceinture, p("bijou", 1), p("bijou", 1)], "a", { contexte: "look-detail" });
    const gardes = pieces.filter((q) => q.role === "accessoire").map((q) => q.id);
    if (gardes.length === 1) expect(gardes[0]).toBe(ceinture.id);
    expect(ecartees.length + gardes.length).toBe(4);
  });

  it("un accessoire gardé touche la composition (écart borné) et ne couvre pas une pièce importante", () => {
    for (let i = 0; i < 40; i++) {
      const { pieces } = composerFlatLay([p("robe", 0.7), p("sac", 0.8), p("chaussures", 1.1), p("accessoire", 1.2)], "iso" + i);
      const acc = pieces.find((q) => q.role === "accessoire");
      if (!acc) continue;
      const autres = pieces.filter((q) => q.role !== "accessoire");
      const dist = Math.min(...autres.map((q) => Math.hypot(q.x - acc.x, q.y - acc.y) - (q.l + q.h) / 4 - (acc.l + acc.h) / 4));
      expect(dist).toBeLessThan(30);
    }
  });
});

describe("données facultatives de la pièce", () => {
  it("flatLayCompatible: false écarte la pièce, visualScale et preferredRotation s'appliquent (bornés)", () => {
    const ceinture = { ...p("accessoire", 1), flatLayCompatible: false };
    expect(composerFlatLay([p("veste", 0.94), p("haut", 1), ceinture], "c", { proportions: false }).pieces.some((q) => q.id === ceinture.id)).toBe(false);
    const grosse = { ...p("sac", 0.8), visualScale: 1.1, preferredRotation: 45 };
    const norm = p("sac", 0.8);
    const a = composerFlatLay([p("veste", 0.94), grosse], "c", { proportions: false }).pieces.find((q) => q.id === grosse.id)!;
    const b = composerFlatLay([p("veste", 0.94), norm], "c", { proportions: false }).pieces.find((q) => q.id === norm.id)!;
    expect(a.visualScale).toBeGreaterThan(b.visualScale);
    expect(Math.abs(a.angle)).toBeLessThanOrEqual(6.01);
  });
});

describe("calibrage du 08/10/2026 — chevauchements, héro, accessoires", () => {
  const boite = (q: PlacementFlatLay) => {
    const r = (Math.abs(q.angle) * Math.PI) / 180;
    const w = q.l * Math.cos(r) + q.h * Math.sin(r);
    const h = q.l * Math.sin(r) + q.h * Math.cos(r);
    return { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - h / 2, y1: q.y + h / 2 };
  };
  const commun = (a: PlacementFlatLay, b: PlacementFlatLay) => {
    const A = boite(a);
    const B = boite(b);
    return Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
  };
  const aireDe = (q: PlacementFlatLay) => {
    const b = boite(q);
    return (b.x1 - b.x0) * (b.y1 - b.y0);
  };
  const looks: PieceFlatLay[][] = [
    [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6), p("chaussures", 1.1), p("sac", 0.82)],
    [p("robe", 0.55), p("sac", 0.82), p("chaussures", 1.2)],
    [p("pull", 1), p("jean", 0.6), p("chaussures", 1.1), p("sac", 0.9), p("accessoire", 1)],
    [p("manteau", 0.7), p("haut", 1), p("pantalon", 0.55), p("chaussures", 1.2), p("sac", 0.8), p("bijou", 1), p("accessoire", 1)],
  ];

  it("deux pièces ne se recouvrent pas de plus de 18 % de la plus petite", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const [k, pieces] of looks.entries())
        for (let i = 0; i < 20; i++) {
          const sortie = composerFlatLay(pieces, `c${k}-${i}`, { contexte }).pieces;
          for (let a = 0; a < sortie.length; a++)
            for (let b = a + 1; b < sortie.length; b++) {
              const part = commun(sortie[a], sortie[b]) / Math.min(aireDe(sortie[a]), aireDe(sortie[b]));
              expect(part, `${contexte} look ${k} graine ${i} : ${sortie[a].cat}/${sortie[b].cat}`).toBeLessThanOrEqual((CONTEXTES[contexte].chevauchementMax ?? CHEVAUCHEMENT_MAX) + 0.02);
            }
        }
  });

  it("aucune pièce n'est masquée à plus de 20 % par celles du dessus", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const [k, pieces] of looks.entries())
        for (let i = 0; i < 20; i++) {
          const sortie = composerFlatLay(pieces, `m${k}-${i}`, { contexte }).pieces;
          for (const q of sortie) {
            const masque = sortie.filter((o) => o.z > q.z).reduce((s, o) => s + commun(q, o), 0) / aireDe(q);
            expect(masque, `${contexte} look ${k} graine ${i} : ${q.cat}`).toBeLessThanOrEqual((CONTEXTES[contexte].masqueMax ?? MASQUE_MAX) + 0.02);
          }
        }
  });

  it("la pièce héro ne dépasse jamais 58 % de la largeur de la zone", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const pieces of looks)
        for (let i = 0; i < 20; i++) expect(composerFlatLay(pieces, "h" + i, { contexte }).pieces.find((q) => q.role === "hero")!.l).toBeLessThanOrEqual(LARGEUR_HERO_MAX + 1e-9);
  });

  it("un accessoire plus étroit que 8 % de la zone n'est pas posé", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const pieces of looks)
        for (let i = 0; i < 20; i++)
          for (const q of composerFlatLay(pieces, "a" + i, { contexte }).pieces.filter((x) => x.role === "accessoire")) expect(q.l).toBeGreaterThanOrEqual(LARGEUR_ACCESSOIRE_MIN);
  });

  it("deux accessoires au plus dans le flat lay principal", () => {
    const beaucoup = [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6), p("chaussures"), p("sac"), p("bijou", 1), p("accessoire", 1), p("bijou", 1), p("accessoire", 1)];
    for (const contexte of ["hero-home", "look-detail"] as const)
      expect(composerFlatLay(beaucoup, "z", { contexte }).pieces.filter((q) => q.role === "accessoire").length).toBeLessThanOrEqual(2);
  });

  it("une pièce manquante ne laisse aucun vide : la composition se recalcule, bornée par la zone", () => {
    const sansSac = [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6), p("chaussures", 1.1)];
    // Les tailles d'avant le 04/11/2026 : sur cette graine, la tenue occupait toute la hauteur.
    const { pieces: avant } = composerFlatLay(sansSac, "sansSac", { contexte: "look-detail", proportions: false });
    expect(avant.length).toBe(4);
    const c = CONTEXTES["look-detail"];
    const h = c.hauteur;
    expect(Math.min(...avant.map((q) => q.y - q.h / 2))).toBeLessThan(h * 0.2);
    expect(Math.max(...avant.map((q) => q.y + q.h / 2))).toBeGreaterThan(h * 0.8);
    // Avec les proportions (04/11/2026), le haut et la veste, plus grands, remplissent la LARGEUR : la composition s'ajuste au côté qui la
    // borne, sans vide de ce côté-là.
    const { pieces } = composerFlatLay(sansSac, "sansSac", { contexte: "look-detail" });
    expect(pieces.length).toBe(4);
    const largeur = (Math.max(...pieces.map((q) => q.x + q.l / 2)) - Math.min(...pieces.map((q) => q.x - q.l / 2))) / (100 - 2 * c.marge);
    const hauteur = (Math.max(...pieces.map((q) => q.y + q.h / 2)) - Math.min(...pieces.map((q) => q.y - q.h / 2))) / (h - (c.margeHaute ?? c.marge) - c.marge);
    expect(Math.max(largeur, hauteur)).toBeGreaterThan(0.97);
  });
});

describe("regroupement stylistique — les couches d'une même tenue restent ensemble", () => {
  const boite = (q: PlacementFlatLay) => {
    const r = (Math.abs(q.angle) * Math.PI) / 180;
    const w = q.l * Math.cos(r) + q.h * Math.sin(r);
    const h = q.l * Math.sin(r) + q.h * Math.cos(r);
    return { x0: q.x - w / 2, x1: q.x + w / 2, y0: q.y - h / 2, y1: q.y + h / 2 };
  };
  const ecart = (a: PlacementFlatLay, b: PlacementFlatLay) => {
    const A = boite(a);
    const B = boite(b);
    return Math.max(0, Math.max(A.x0 - B.x1, B.x0 - A.x1), Math.max(A.y0 - B.y1, B.y0 - A.y1));
  };
  const commun = (a: PlacementFlatLay, b: PlacementFlatLay) => {
    const A = boite(a);
    const B = boite(b);
    return Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
  };
  const aireDe = (q: PlacementFlatLay) => (boite(q).x1 - boite(q).x0) * (boite(q).y1 - boite(q).y0);
  const pullTee = () => [p("pull", 1), p("haut", 0.95), p("pantalon", 0.5), p("chaussures", 1), p("sac", 0.85)];
  const par = (pieces: PieceFlatLay[], graine: string, contexte: "hero-home" | "look-detail") => {
    const sortie = composerFlatLay(pieces, graine, { proportions: false, contexte }).pieces;
    return Object.fromEntries(sortie.map((q) => [q.role, q])) as Record<string, PlacementFlatLay>;
  };

  it("un second haut devient la couche du premier : le pull est la couche extérieure", () => {
    expect(roles([p("pull"), p("haut"), p("pantalon")])).toMatchObject({ pull: "secondaire", haut: "couche", pantalon: "hero" });
    // Quel que soit l'ordre des pièces.
    expect(roles([p("haut"), p("pull"), p("pantalon")])).toMatchObject({ pull: "secondaire", haut: "couche" });
    // Sous une veste héro : chemise (second plan) + t-shirt (couche).
    expect(roles([p("veste"), p("haut"), p("pull"), p("pantalon")])).toMatchObject({ veste: "hero", pull: "secondaire", haut: "couche" });
  });

  it("une seule couche ; sous une robe, un haut de plus n'est pas une couche", () => {
    const r = attribuerRoles([p("pull"), p("haut"), p("haut"), p("pantalon")]).map((x) => x.role);
    expect(r.filter((x) => x === "couche").length).toBe(1);
    expect(roles([p("robe"), p("haut")]).haut).toBe("accessoire");
  });

  it("la couche touche la pièce qu'elle double : au plus 15 % de la zone d'écart, au plus 18 % de recouvrement, derrière elle", () => {
    // Sur l'accueil la couche n'est pas posée (cf. plus bas) : la règle vaut pour les autres contextes.
    for (const contexte of ["look-detail"] as const)
      for (let i = 0; i < 30; i++) {
        const o = par(pullTee(), "g" + i, contexte);
        expect(ecart(o.couche, o.secondaire), `${contexte} graine ${i}`).toBeLessThanOrEqual(15);
        expect(commun(o.couche, o.secondaire) / Math.min(aireDe(o.couche), aireDe(o.secondaire)), `${contexte} graine ${i}`).toBeLessThanOrEqual(CHEVAUCHEMENT_MAX + 1e-9);
        expect(o.couche.z).toBeLessThan(o.secondaire.z);
        expect(o.couche.groupeAvec).toBe(o.secondaire.id);
      }
  });

  it("pull + t-shirt à gauche, pantalon à droite, boots sous le groupe, sac sous le pantalon — jamais en miroir", () => {
    for (const contexte of ["look-detail"] as const)
      for (let i = 0; i < 40; i++) {
        const o = par(pullTee(), "m" + i, contexte);
        expect(o.secondaire.x, `${contexte} ${i}`).toBeLessThan(o.hero.x);
        expect(o.couche.x).toBeLessThan(o.hero.x);
        expect(o.chaussures.x).toBeLessThan(o.sac.x);
        expect(o.chaussures.y).toBeGreaterThan(o.secondaire.y);
        expect(o.chaussures.y).toBeGreaterThan(o.couche.y);
        expect(o.sac.y).toBeGreaterThan(o.hero.y);
      }
  });

  it("le t-shirt n'est plus jamais isolé au centre-bas : il est plus près du pull que des chaussures et du sac", () => {
    for (let i = 0; i < 30; i++) {
      const o = par(pullTee(), "i" + i, "look-detail");
      expect(ecart(o.couche, o.secondaire)).toBeLessThan(ecart(o.couche, o.chaussures) + 1e-9);
      // ≤ et non < depuis le 14/10/2026 : la composition resserrée pose le t-shirt contre le pull ET contre le sac (écarts nuls).
      expect(ecart(o.couche, o.secondaire)).toBeLessThanOrEqual(ecart(o.couche, o.sac));
    }
  });

  it("sous une veste héro, la couche reste contre le haut du second plan", () => {
    const look = [p("veste", 0.85), p("pull", 1), p("haut", 0.9), p("pantalon", 0.55), p("chaussures", 1.2), p("sac", 0.85)];
    for (let i = 0; i < 30; i++) {
      const o = par(look, "v" + i, "look-detail");
      expect(ecart(o.couche, o.secondaire)).toBeLessThanOrEqual(15);
      expect(o.secondaire.x).toBeLessThan(o.hero.x);
    }
  });

  it("la composition reste déterministe", () => {
    const pieces = pullTee();
    expect(composerFlatLay(pieces, "k", { contexte: "look-detail" })).toEqual(composerFlatLay(pieces, "k", { contexte: "look-detail" }));
  });
});

describe("accueil (hero-home) — 3 à 4 pièces lisibles (09/10/2026, brief « Optimisation du flat lay »)", () => {
  const CONFIGS: Record<string, PieceFlatLay[]> = {
    "t-shirt + pantalon + sac + chaussures": [p("haut", 1), p("pantalon", 0.55), p("sac", 1.1), p("chaussures", 1.5)],
    "chemise + pantalon + blazer + sac + chaussures": [p("haut", 0.9), p("pantalon", 0.55), p("veste", 0.95), p("sac", 1.1), p("chaussures", 1.5)],
    "pull + pantalon + manteau + chaussures": [p("pull", 1), p("pantalon", 0.55), p("manteau", 0.75), p("chaussures", 1.5)],
    "robe + sac + chaussures": [p("robe", 0.55), p("sac", 1.1), p("chaussures", 1.5)],
    "trois pièces": [p("haut", 1), p("jean", 0.55), p("chaussures", 1.5)],
    "six pièces": [p("pull", 1), p("haut", 1), p("pantalon", 0.55), p("veste", 0.95), p("sac", 1.1), p("chaussures", 1.5)],
  };
  const part = (a: PlacementFlatLay, b: PlacementFlatLay) => {
    const A = boiteDe(a);
    const B = boiteDe(b);
    const commun = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
    return commun / Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
  };

  it("jamais plus de 4 pièces dans la planche ; les autres restent dans la tenue (masquées), jamais retirées de la tenue réelle", () => {
    for (const [nom, pieces] of Object.entries(CONFIGS)) {
      const r = composerFlatLay(pieces, "h", { proportions: false, contexte: "hero-home" });
      expect(r.pieces.length, nom).toBeLessThanOrEqual(4);
      expect(r.pieces.length, nom).toBeGreaterThanOrEqual(Math.min(3, pieces.length));
      expect(r.pieces.length + r.masquees.length + r.ecartees.length, nom).toBe(pieces.length);
    }
  });

  it("les pièces retenues sont les plus représentatives : haut, bas, veste ou manteau, chaussures avant le sac ; un second haut ou une seconde veste après", () => {
    const six = composerFlatLay(CONFIGS["six pièces"], "h", { proportions: false, contexte: "hero-home" });
    expect(six.pieces.map((q) => q.cat).sort()).toEqual(["chaussures", "pantalon", "pull", "veste"]);
    const cinq = composerFlatLay(CONFIGS["chemise + pantalon + blazer + sac + chaussures"], "h", { proportions: false, contexte: "hero-home" });
    expect(cinq.pieces.map((q) => q.cat).sort()).toEqual(["chaussures", "haut", "pantalon", "veste"]);
  });

  it("t-shirt + pantalon + sac + chaussures : le haut en haut, le bas au centre, le sac et les chaussures dessous (ou en miroir)", () => {
    for (let i = 0; i < 30; i++) {
      const o = Object.fromEntries(composerFlatLay(CONFIGS["t-shirt + pantalon + sac + chaussures"], "t" + i, { proportions: false, contexte: "hero-home" }).pieces.map((q) => [q.cat, q]));
      expect(o.haut.y, `graine ${i}`).toBeLessThan(o.sac.y);
      expect(o.pantalon.y).toBeLessThan(o.chaussures.y);
      // Le haut et le bas sont de part et d'autre, jamais l'un sur l'autre — et jamais en miroir sur l'accueil : le haut est à gauche.
      expect(o.haut.x).toBeLessThan(o.pantalon.x);
      expect(Math.abs(o.haut.x - o.pantalon.x)).toBeGreaterThan(25);
      // Sac et chaussures aussi de part et d'autre.
      expect(Math.abs(o.sac.x - o.chaussures.x)).toBeGreaterThan(25);
    }
  });

  // 30 % et non plus 20 % depuis le 14/10/2026 (« le flat lay est encore trop timide ») : le chevauchement toléré passe de 18 à 30 % de
  // la boîte de la pièce, pour que la composition, plus serrée, soit agrandie. Les trois tests de recouvrement suivent ce seuil.
  it("chemise et blazer se rapprochent (moins de 12 unités entre eux), le pantalon reste dessous sans les recouvrir de plus de 30 %", () => {
    for (let i = 0; i < 30; i++) {
      const sortie = composerFlatLay(CONFIGS["chemise + pantalon + blazer + sac + chaussures"], "c" + i, { contexte: "hero-home" }).pieces;
      const o = Object.fromEntries(sortie.map((q) => [q.cat, q]));
      const ecart = boiteDe(o.veste).x0 - boiteDe(o.haut).x1;
      expect(ecart, `graine ${i}`).toBeLessThan(12);
      expect(part(o.pantalon, o.haut)).toBeLessThanOrEqual(0.3 + 1e-9);
      expect(part(o.pantalon, o.veste)).toBeLessThanOrEqual(0.3 + 1e-9);
    }
  });

  it("veste ou manteau héro : le haut à gauche, la veste à droite, le bas sous les deux, jamais en miroir", () => {
    for (let i = 0; i < 30; i++)
      for (const nom of ["chemise + pantalon + blazer + sac + chaussures", "pull + pantalon + manteau + chaussures"]) {
        const o = Object.fromEntries(composerFlatLay(CONFIGS[nom], "v" + i, { contexte: "hero-home" }).pieces.map((q) => [q.role, q]));
        expect(o.secondaire.x, nom).toBeLessThan(o.hero.x);
        expect(o.bas.y).toBeGreaterThan(o.secondaire.y);
        expect(o.bas.y).toBeGreaterThan(o.hero.y);
        expect(o.hero.z).toBeLessThan(o.bas.z);
      }
  });

  it("chaque tenue de référence : recouvrement borné (≤ 30 % de la plus petite), tout dans la zone de sécurité, déterministe", () => {
    const h = CONTEXTES["hero-home"].hauteur;
    const m = CONTEXTES["hero-home"].marge;
    expect(CONTEXTES["hero-home"].chevauchementMax ?? CHEVAUCHEMENT_MAX).toBeLessThanOrEqual(0.3);
    for (const [nom, pieces] of Object.entries(CONFIGS))
      for (let i = 0; i < 30; i++) {
        const sortie = composerFlatLay(pieces, "r" + i, { contexte: "hero-home" }).pieces;
        expect(composerFlatLay(pieces, "r" + i, { contexte: "hero-home" }).pieces, nom).toEqual(sortie);
        for (let a = 0; a < sortie.length; a++)
          for (let b = a + 1; b < sortie.length; b++) expect(part(sortie[a], sortie[b]), `${nom} graine ${i} : ${sortie[a].cat}/${sortie[b].cat}`).toBeLessThanOrEqual(0.3 + 1e-9);
        const boites = sortie.map(boiteDe);
        expect(Math.min(...boites.map((b) => b.x0)), nom).toBeGreaterThanOrEqual(m - 1e-6);
        expect(Math.max(...boites.map((b) => b.x1)), nom).toBeLessThanOrEqual(100 - m + 1e-6);
        expect(Math.min(...boites.map((b) => b.y0)), nom).toBeGreaterThanOrEqual(m - 1e-6);
        expect(Math.max(...boites.map((b) => b.y1)), nom).toBeLessThanOrEqual(h - m + 1e-6);
      }
  });

  it("le haut et le bas se lisent : au moins 29 % de la largeur de la zone ; sac et chaussures au moins 22 %", () => {
    for (const [nom, pieces] of Object.entries(CONFIGS))
      for (let i = 0; i < 20; i++)
        for (const q of composerFlatLay(pieces, "l" + i, { proportions: false, contexte: "hero-home" }).pieces) {
          if (["haut", "pull", "pantalon", "jean", "robe", "veste", "manteau"].includes(q.cat)) expect(q.l, `${nom} ${q.cat}`).toBeGreaterThanOrEqual(29);
          if (q.cat === "sac" || q.cat === "chaussures") expect(q.l, `${nom} ${q.cat}`).toBeGreaterThanOrEqual(22);
        }
  });

  it("le t-shirt sous un pull reste masqué sur l'accueil (et posé dans la Tenue du jour)", () => {
    const pieces = [p("pull", 1), p("haut", 0.95), p("pantalon", 0.5), p("sac", 0.85)];
    const home = composerFlatLay(pieces, "h", { proportions: false, contexte: "hero-home" });
    expect(home.masquees).toContain(pieces[1].id);
    expect(home.pieces.find((q) => q.id === pieces[1].id)).toBeUndefined();
    const detail = composerFlatLay(pieces, "h", { proportions: false, contexte: "look-detail" });
    expect(detail.masquees).toEqual([]);
    expect(detail.pieces.find((q) => q.id === pieces[1].id)?.role).toBe("couche");
  });

  it("une photo brute (parfois une personne) passe après les visuels produit : écartée tant qu'il reste 3 autres pièces", () => {
    const manteauPhoto = { ...p("manteau", 0.8), photoBrute: true };
    const sacPhoto = { ...p("sac", 1), photoBrute: true };
    const tenue = [manteauPhoto, p("haut", 1), p("pantalon", 0.55), p("veste", 1), p("chaussures", 1.5), sacPhoto];
    const home = composerFlatLay(tenue, "h", { proportions: false, contexte: "hero-home" });
    expect(home.pieces.map((q) => q.id)).not.toContain(manteauPhoto.id);
    expect(home.pieces.map((q) => q.id)).not.toContain(sacPhoto.id);
    expect(home.masquees).toEqual(expect.arrayContaining([manteauPhoto.id, sacPhoto.id]));
    // La Tenue du jour montre toujours la tenue entière.
    expect(composerFlatLay(tenue, "h", { proportions: false, contexte: "look-detail" }).pieces.map((q) => q.id)).toContain(manteauPhoto.id);
  });

  it("les chaussures restent sur l'accueil même en photo brute (14/10/2026, signalé : tenue de l'accueil sans ses chaussures)", () => {
    const chaussuresPhoto = { ...p("chaussures", 1.5), photoBrute: true };
    const tenue = [p("robe", 0.5), p("sac", 1), p("accessoire", 1.2), chaussuresPhoto];
    const home = composerFlatLay(tenue, "h", { contexte: "hero-home" });
    expect(home.pieces.map((q) => q.id)).toContain(chaussuresPhoto.id);
  });

  it("sans assez de visuels produit, les photos brutes restent : jamais moins de 3 pièces", () => {
    const tenue = [{ ...p("haut", 1), photoBrute: true }, p("pantalon", 0.55), { ...p("chaussures", 1.5), photoBrute: true }];
    expect(composerFlatLay(tenue, "h", { contexte: "hero-home" }).pieces.length).toBe(3);
  });

  it("les collants sont posés dans le hero de l'accueil comme dans le détail de la tenue (14/10/2026, demandé : ils étaient masqués depuis le 08/10)", () => {
    const pieces = [p("pull"), p("pantalon"), { ...p("accessoire"), accessoireType: "Collants" }, p("sac")];
    const collants = pieces[2].id;
    const home = composerFlatLay(pieces, "x", { contexte: "hero-home" });
    expect(home.pieces.map((q) => q.id)).toContain(collants);
    expect(home.masquees).not.toContain(collants);
    const detail = composerFlatLay(pieces, "x", { contexte: "look-detail" });
    expect(detail.pieces.map((q) => q.id)).toContain(collants);
  });
});

describe("une seconde veste n'est pas un accessoire (09/10/2026, « la veste oversize est trop petite »)", () => {
  const tenue = [p("manteau", 0.8), p("haut", 1), p("pantalon", 0.5), p("veste", 1.05), p("chaussures", 1.5), p("sac", 1)];
  it("un manteau héro et une veste en plus : la veste prend le rôle de couche, pas d'accessoire", () => {
    const r = Object.fromEntries(attribuerRoles(tenue).map((x) => [x.piece.cat, x.role]));
    expect(r).toMatchObject({ manteau: "hero", haut: "secondaire", veste: "couche" });
  });
  it("dans la Tenue du jour, elle est au moins aussi grande que la moitié du haut et reste visible", () => {
    for (const graine of ["x,y", "a,b", "c,d", "e,f"]) {
      const { pieces } = composerFlatLay(tenue, graine, { contexte: "look-detail" });
      const veste = pieces.find((q) => q.cat === "veste")!;
      const haut = pieces.find((q) => q.cat === "haut")!;
      expect(veste, graine).toBeDefined();
      expect(veste.l, graine).toBeGreaterThan(haut.l * 0.5);
      expect(veste.l, graine).toBeGreaterThan(LARGEUR_ACCESSOIRE_MIN * 2);
    }
  });
  it("sur l'accueil (4 pièces), la veste en plus passe après le manteau, le haut, le bas et les chaussures : elle reste dans la tenue", () => {
    const { pieces, masquees } = composerFlatLay(tenue, "x,y", { contexte: "hero-home", proportions: false });
    expect(pieces.length).toBe(4);
    expect(pieces.some((q) => q.cat === "veste")).toBe(false);
    expect(masquees.length).toBe(2);
  });
});

describe("tous les hero du flat lay — aucune rotation (09/10/2026)", () => {
  const configs: PieceFlatLay[][] = [
    [p("haut", 1), p("pantalon", 0.55), p("sac", 1.1), p("chaussures", 1.5)],
    [p("haut", 0.9), p("pantalon", 0.55), p("veste", 0.95), p("sac", 1.1), p("chaussures", 1.5)],
    [p("pull", 1), p("pantalon", 0.55), p("manteau", 0.75), p("chaussures", 1.5)],
    [p("robe", 0.55), p("sac", 1.1), p("chaussures", 1.5), p("accessoire", 1.2)],
    [p("haut", 1), p("jean", 0.55), p("chaussures", 1.5)],
    [p("pull", 1), p("haut", 1), p("pantalon", 0.55), p("veste", 0.95), p("sac", 1.1), p("chaussures", 1.5)],
  ];
  it("toutes les pièces sont à 0°, quelle que soit la graine, y compris une inclinaison préférée portée par la pièce", () => {
    for (const pieces of configs)
      for (let i = 0; i < 30; i++) {
        const avecPreference = pieces.map((q, k) => (k === 0 ? { ...q, preferredRotation: 7 } : q));
        for (const q of composerFlatLay(avecPreference, "r" + i, { contexte: "hero-home" }).pieces) expect(Object.is(q.angle, 0), `${q.cat} graine ${i}`).toBe(true);
      }
  });
  it("tous les contextes sont droits : Tenue du jour, détail d'un look, « Tes looks », capsule, dressing, valise", () => {
    for (const contexte of ["look-detail", "capsule", "dressing", "packing"] as const)
      for (const pieces of configs)
        for (let i = 0; i < 10; i++)
          for (const q of composerFlatLay(pieces, "c" + i, { contexte }).pieces) expect(Object.is(q.angle, 0), `${contexte} ${q.cat}`).toBe(true);
  });
  it("sans inclinaison, le recouvrement reste borné (≤ 30 % de la plus petite depuis le 14/10/2026) : aucune compensation par des chevauchements", () => {
    const part = (a: PlacementFlatLay, b: PlacementFlatLay) => {
      const A = boiteDe(a);
      const B = boiteDe(b);
      const commun = Math.max(0, Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0)) * Math.max(0, Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0));
      return commun / Math.min((A.x1 - A.x0) * (A.y1 - A.y0), (B.x1 - B.x0) * (B.y1 - B.y0));
    };
    for (const pieces of configs)
      for (let i = 0; i < 30; i++) {
        const sortie = composerFlatLay(pieces, "s" + i, { contexte: "hero-home" }).pieces;
        for (let a = 0; a < sortie.length; a++) for (let b = a + 1; b < sortie.length; b++) expect(part(sortie[a], sortie[b]), `graine ${i}`).toBeLessThanOrEqual(0.3 + 1e-9);
      }
  });
});

describe("accueil (hero-home) — le haut et la veste agrandis de 20 % (10/10/2026)", () => {
  const avec = (echelles: Record<string, number> | undefined) => {
    const config = CONTEXTES["hero-home"];
    const sauvegarde = config.echellesCategorie;
    config.echellesCategorie = echelles;
    try {
      const pieces = [p("haut", 1), p("pantalon", 0.55), p("veste", 0.95), p("chaussures", 1.5)];
      // Les échelles par catégorie ne valent que pour les tailles d'avant le 04/11/2026 : les proportions entre pièces les remplacent.
      return composerFlatLay(pieces, "x", { contexte: "hero-home", proportions: false }).pieces;
    } finally {
      config.echellesCategorie = sauvegarde;
    }
  };
  it("le haut et la veste sont plus larges qu'avant, le bas et les chaussures gardent leur gabarit", () => {
    expect(CONTEXTES["hero-home"].echellesCategorie).toMatchObject({ haut: 1.2, veste: 1.2 });
    const apres = Object.fromEntries(avec(CONTEXTES["hero-home"].echellesCategorie).map((q) => [q.cat, q.l]));
    // Le levier seul (14/10/2026) : « avant » garde les autres échelles du contexte (le bas, agrandi depuis) et retire celles du haut et de la veste.
    const sansHautNiVeste = Object.fromEntries(Object.entries(CONTEXTES["hero-home"].echellesCategorie ?? {}).filter(([cat]) => !["haut", "pull", "veste", "manteau"].includes(cat)));
    const avant = Object.fromEntries(avec(sansHautNiVeste).map((q) => [q.cat, q.l]));
    expect(apres.haut).toBeGreaterThan(avant.haut * 1.05);
    expect(apres.veste).toBeGreaterThan(avant.veste * 1.05);
  });
  it("les autres contextes ne changent pas", () => {
    // Le haut et la veste : agrandis sur l'accueil seulement. (Le bas l'est aussi dans la Tenue du jour depuis le 14/10/2026.)
    expect(CONTEXTES["look-detail"].echellesCategorie?.haut).toBeUndefined();
    expect(CONTEXTES["look-detail"].echellesCategorie?.veste).toBeUndefined();
  });
});

describe("hero — la tenue prend toute la place de sa zone (14/10/2026, « le flat lay est encore trop timide »)", () => {
  const boite = (q: PlacementFlatLay) => boiteDe(q);
  const hautPantalon = () => [p("haut", 0.95), p("pantalon", 0.45), p("chaussures", 1.3)];
  it("le pantalon prend plus de hauteur : jusqu'à 92 % de la zone, les chaussures à côté de lui quand il n'y a pas de sac", () => {
    for (const contexte of ["hero-home", "look-detail"] as const) {
      expect(CONTEXTES[contexte].hauteurBasMax).toBe(0.92);
      for (let i = 0; i < 20; i++) {
        // Mesuré le 04/11/2026 sur ces tenues (même exécution) : le pantalon fait 95 % (accueil) et 87 % (Tenue) de la hauteur de la zone
        // avec les tailles d'avant, 73 % et 64 % avec les proportions entre pièces — le haut, à sa vraie taille, prend sa place. Arbitrage
        // présenté à la propriétaire avec la planche avant / après. Le seuil d'avant vaut pour le levier. En deux colonnes (05/11/2026), le
        // haut est AU-DESSUS du bas, comme sur les planches de référence (le pantalon y fait 45 à 50 % de la planche) : au moins 45 % de la
        // zone, et toujours la pièce la plus haute.
        const o = Object.fromEntries(composerFlatLay(hautPantalon(), "b" + i, { contexte, proportions: false }).pieces.map((q) => [q.cat, q]));
        const h = CONTEXTES[contexte].hauteur;
        expect(o.pantalon.h / h, `${contexte} graine ${i}`).toBeGreaterThan(0.75);
        const n = Object.fromEntries(composerFlatLay(hautPantalon(), "b" + i, { contexte }).pieces.map((q) => [q.cat, q]));
        expect(n.pantalon.h / h, `${contexte} graine ${i}`).toBeGreaterThan(0.45);
        expect(n.pantalon.h, `${contexte} graine ${i}`).toBeGreaterThan(Math.max(n.haut.h, n.chaussures.h));
        // À côté et non dessous : les chaussures ne sont pas sous l'emprise horizontale du pantalon.
        const bp = boite(o.pantalon);
        const bc = boite(o.chaussures);
        expect(bc.x1 <= bp.x0 + 0.3 * (bp.x1 - bp.x0) || bc.x0 >= bp.x1 - 0.3 * (bp.x1 - bp.x0), `${contexte} graine ${i}`).toBe(true);
      }
    }
  });
  it("avec un sac, les chaussures gardent leur place sous le bas (la colonne du haut et du sac est pleine)", () => {
    const o = Object.fromEntries(composerFlatLay([...hautPantalon(), p("sac", 1)], "s", { contexte: "hero-home" }).pieces.map((q) => [q.cat, q]));
    expect(o.chaussures.y).toBeGreaterThan(o.pantalon.y);
  });
  it("la zone prend le format de son cadre : avec une hauteur donnée, tout y tient, marges comprises", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const hauteurZone of [100, 113, 126, 140]) {
        const c = CONTEXTES[contexte];
        const sortie = composerFlatLay([p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1)], "z", { contexte, hauteurZone }).pieces;
        const b = sortie.map(boite);
        expect(Math.min(...b.map((x) => x.x0)), `${contexte} ${hauteurZone}`).toBeGreaterThanOrEqual(c.marge - 1e-6);
        expect(Math.max(...b.map((x) => x.x1)), `${contexte} ${hauteurZone}`).toBeLessThanOrEqual(100 - c.marge + 1e-6);
        expect(Math.min(...b.map((x) => x.y0)), `${contexte} ${hauteurZone}`).toBeGreaterThanOrEqual((c.margeHaute ?? c.marge) - 1e-6);
        expect(Math.max(...b.map((x) => x.y1)), `${contexte} ${hauteurZone}`).toBeLessThanOrEqual(hauteurZone - c.marge + 1e-6);
      }
  });
});

describe("accessoires à une place fixe (02/11/2026, demandé : « que les accessoires soient au même emplacement »)", () => {
  const q = (id: number, cat: CategoryKey, ratio: number) => ({ id, cat, ratio });
  const tenues = [
    [q(1, "haut", 1), q(2, "pantalon", 0.4), q(3, "chaussures", 2), q(4, "accessoire", 1.2)],
    [q(1, "haut", 1), q(2, "short", 1.1), q(3, "chaussures", 2), q(4, "sac", 0.9), q(5, "accessoire", 1)],
    [q(1, "manteau", 0.6), q(2, "pull", 1), q(3, "jean", 0.42), q(4, "chaussures", 2), q(5, "accessoire", 1)],
    [q(1, "robe", 0.5), q(2, "chaussures", 2), q(3, "sac", 0.9), q(4, "bijou", 1)],
  ];
  const places = (accessoiresFixes?: boolean) => {
    const vues = new Map<string, number>();
    let poses = 0;
    for (const t of tenues)
      for (const g of ["a", "b", "c", "d", "e"]) {
        const r = composerFlatLay(t, g, { proportions: false, contexte: "look-detail", hauteurZone: 118, accessoiresFixes });
        for (const p of r.pieces.filter((x) => x.role === "accessoire")) {
          poses++;
          const cle = `${Math.round(p.x)},${Math.round(p.y)}`;
          vues.set(cle, (vues.get(cle) ?? 0) + 1);
        }
      }
    return { vues, poses };
  };

  it("les accessoires se posent sur peu de places, toujours les mêmes, et aucun n'est perdu", () => {
    const avant = places(false);
    const apres = places();
    // Aucun n'est perdu : autant ou plus d'accessoires posés (un de plus depuis les proportions du 04/11/2026, la colonne de la veste libérant une place).
    expect(apres.poses).toBeGreaterThanOrEqual(avant.poses);
    expect(apres.vues.size).toBeLessThan(avant.vues.size);
    // La première place du contexte reçoit la plupart des accessoires.
    const premiere = CONTEXTES["look-detail"].placesAccessoires![0];
    const sur = [...apres.vues].filter(([cle]) => Math.abs(+cle.split(",")[0] - premiere.x) < 10).reduce((t, [, n]) => t + n, 0);
    expect(sur * 2).toBeGreaterThanOrEqual(apres.poses);
  });

  it("un accessoire posé reste dans la zone et ne recouvre une pièce que dans la limite du contexte", () => {
    for (const t of tenues)
      for (const g of ["a", "b", "c"]) {
        const { pieces } = composerFlatLay(t, g, { contexte: "look-detail", hauteurZone: 118 });
        for (const a of pieces.filter((x) => x.role === "accessoire")) {
          expect(a.x - a.l / 2).toBeGreaterThanOrEqual(CONTEXTES["look-detail"].marge - 1e-6);
          expect(a.y + a.h / 2).toBeLessThanOrEqual(118 - CONTEXTES["look-detail"].marge + 1e-6);
        }
      }
  });
});

describe("proportions entre pièces (04/11/2026, planche de référence de la propriétaire)", () => {
  // Formats réels des visuels du catalogue (catalogMarges.ts) : t-shirt, jean droit, baskets, sac à main, blazer.
  const T = (id: number, cat: CategoryKey, ratio: number) => ({ id, cat, ratio });
  const tenue = [T(1, "haut", 0.94), T(5, "veste", 0.8), T(2, "jean", 0.41), T(3, "chaussures", 1.36), T(4, "sac", 0.84)];
  const taille = (p: { cat: CategoryKey; l: number; h: number }) => (p.cat === "chaussures" || p.cat === "sac" ? Math.max(p.l, p.h) : p.h);

  it.each(["hero-home", "look-detail"] as const)("%s : haut, veste, sac et chaussures rapportés au bas", (contexte) => {
    for (const graine of ["a", "b", "c"]) {
      const r = composerFlatLay(tenue, graine, { contexte }).pieces;
      const bas = r.find((p) => p.cat === "jean")!;
      for (const p of r) expect(taille(p) / bas.h).toBeCloseTo(PROPORTION_PIECE[p.cat]!, 1);
    }
  });

  it("le levier `proportions: false` rend les tailles d'avant : le sac y est bien plus petit", () => {
    const r = composerFlatLay(tenue, "a", { contexte: "hero-home", proportions: false }).pieces;
    const bas = r.find((p) => p.cat === "jean");
    const sac = r.find((p) => p.cat === "sac");
    if (bas && sac) expect(taille(sac) / bas.h).toBeLessThan(0.5);
  });
});

describe("la planche en deux colonnes (05/11/2026, planches de référence de la propriétaire)", () => {
  const T = (id: number, cat: CategoryKey, ratio: number) => ({ id, cat, ratio });
  const TENUES: Record<string, PieceFlatLay[]> = {
    "haut + jean + baskets + sac": [T(1, "haut", 0.94), T(2, "jean", 0.41), T(3, "chaussures", 1.36), T(4, "sac", 0.84)],
    "blazer + haut + jean + baskets": [T(1, "haut", 0.61), T(5, "veste", 0.8), T(2, "jean", 0.41), T(3, "chaussures", 1.36)],
    "robe + escarpins + sac + bijou": [T(6, "robe", 0.55), T(3, "chaussures", 1.72), T(4, "sac", 1.82), T(8, "bijou", 0.65)],
    "manteau + pull + jupe + bottines + sac": [T(7, "manteau", 0.68), T(1, "pull", 0.9), T(2, "jupe", 0.68), T(3, "chaussures", 0.93), T(4, "sac", 0.84)],
  };
  const croisent = (a: PlacementFlatLay, b: PlacementFlatLay) => {
    const A = boiteDe(a);
    const B = boiteDe(b);
    return Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > 1e-6 && Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > 1e-6;
  };
  for (const contexte of ["hero-home", "look-detail"] as const)
    for (const [nom, tenue] of Object.entries(TENUES)) {
      it(`${contexte} · ${nom} : aucune pièce n'en recouvre une autre, tout tient dans la zone, la planche ne dépend pas de la graine`, () => {
        const c = CONTEXTES[contexte];
        const a = composerFlatLay(tenue, "a", { contexte }).pieces;
        const b = composerFlatLay(tenue, "b", { contexte }).pieces;
        expect(a).toEqual(b);
        for (const q of a) for (const r of a) if (q !== r) expect(croisent(q, r), `${q.cat} / ${r.cat}`).toBe(false);
        for (const q of a) {
          const bq = boiteDe(q);
          expect(bq.x0).toBeGreaterThanOrEqual(c.marge - 1e-6);
          expect(bq.x1).toBeLessThanOrEqual(100 - c.marge + 1e-6);
          expect(bq.y0).toBeGreaterThanOrEqual((c.margeHaute ?? c.marge) - 1e-6);
          expect(bq.y1).toBeLessThanOrEqual(c.hauteur - c.marge + 1e-6);
        }
      });
    }

  it("le haut au-dessus du bas dans la colonne de gauche ; veste, sac et chaussures à droite", () => {
    const o = Object.fromEntries(composerFlatLay(TENUES["blazer + haut + jean + baskets"], "x", { contexte: "look-detail" }).pieces.map((q) => [q.cat, q]));
    expect(o.haut.y).toBeLessThan(o.jean.y);
    expect(Math.abs(o.haut.x - o.jean.x)).toBeLessThan(1e-6);
    expect(o.veste.x).toBeGreaterThan(o.jean.x);
    expect(o.chaussures.x).toBeGreaterThan(o.jean.x);
    expect(o.chaussures.y).toBeGreaterThan(o.veste.y);
  });

  it("la robe occupe toute sa colonne : c'est la pièce la plus haute, et de loin (« la robe est trop petite »)", () => {
    const r = composerFlatLay(TENUES["robe + escarpins + sac + bijou"], "x", { contexte: "hero-home" }).pieces;
    const robe = r.find((q) => q.cat === "robe")!;
    for (const q of r) if (q !== robe) expect(robe.h).toBeGreaterThan(q.h * 1.8);
    const c = CONTEXTES["hero-home"];
    expect(robe.h / (c.hauteur - 2 * c.marge)).toBeGreaterThan(0.85);
  });
});

describe("trop de pièces pour deux colonnes (05/11/2026, robe + sac + chaussures + collants + bijou)", () => {
  const T = (id: number, cat: CategoryKey, ratio: number, accessoireType?: string) => ({ id, cat, ratio, accessoireType });
  const tenue = [T(6, "robe", 0.55), T(4, "sac", 0.84), T(3, "chaussures", 1.4), T(9, "accessoire", 0.3, "Collants"), T(8, "bijou", 1.6)];
  it("la disposition retenue (deux ou trois colonnes) laisse à la robe au moins 60 % de la hauteur de la zone (40 % sur la capture)", () => {
    const c = CONTEXTES["look-detail"];
    const r = composerFlatLay(tenue, "x", { contexte: "look-detail" }).pieces;
    const robe = r.find((q) => q.cat === "robe")!;
    expect(robe.h / (c.hauteur - (c.margeHaute ?? c.marge) - c.marge)).toBeGreaterThan(0.6);
  });
  it("les collants se posent en hauteur, comme un bas, et non comme un petit accessoire", () => {
    const r = composerFlatLay(tenue, "x", { contexte: "look-detail" }).pieces;
    const robe = r.find((q) => q.cat === "robe")!;
    const collants = r.find((q) => q.id === 9)!;
    expect(collants.h / robe.h).toBeCloseTo(0.85 / 1.65, 1);
  });
});

describe("la règle commune des compositions de looks (05/11/2026, docs/compositions-looks.md)", () => {
  const T = (id: number, cat: CategoryKey, ratio: number, accessoireType?: string) => ({ id, cat, ratio, accessoireType });
  const TENUES: PieceFlatLay[][] = [
    [T(1, "haut", 0.94), T(2, "jean", 0.41), T(3, "chaussures", 1.36), T(4, "sac", 0.84)],
    [T(1, "haut", 0.61), T(5, "veste", 0.8), T(2, "jean", 0.41), T(3, "chaussures", 1.36), T(4, "sac", 0.84), T(8, "bijou", 1.6)],
    [T(6, "robe", 0.55), T(4, "sac", 0.84), T(3, "chaussures", 1.4), T(9, "accessoire", 0.3, "Collants"), T(8, "bijou", 1.6)],
    [T(7, "manteau", 0.68), T(1, "pull", 0.9), T(10, "haut", 0.95), T(2, "jupe", 0.68), T(3, "chaussures", 0.93), T(4, "sac", 0.84)],
  ];
  const VETEMENTS: CategoryKey[] = ["haut", "pull", "veste", "manteau", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
  const PETITS: CategoryKey[] = ["bijou", "accessoire"];

  it("l'accueil et la Tenue du jour posent les mêmes pièces, aux mêmes proportions entre elles", () => {
    for (const t of TENUES) {
      const a = composerFlatLay(t, "x", { contexte: "hero-home" });
      const b = composerFlatLay(t, "x", { contexte: "look-detail" });
      expect(a.pieces.map((q) => q.id).sort()).toEqual(b.pieces.map((q) => q.id).sort());
      const ref = (r: PlacementFlatLay[]) => Math.max(...r.map((q) => q.h));
      for (const q of a.pieces) {
        const autre = b.pieces.find((x) => x.id === q.id)!;
        expect(q.h / ref(a.pieces)).toBeCloseTo(autre.h / ref(b.pieces), 2);
      }
    }
  });

  it("les vêtements restent grands : la plus grande pièce fait au moins 40 % de la hauteur utile, même à six pièces", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (const t of TENUES) {
        const c = CONTEXTES[contexte];
        const r = composerFlatLay(t, "x", { contexte }).pieces;
        const utile = c.hauteur - (c.margeHaute ?? c.marge) - c.marge;
        expect(Math.max(...r.filter((q) => VETEMENTS.includes(q.cat)).map((q) => q.h)) / utile).toBeGreaterThan(0.4);
      }
  });

  it("les accessoires se voient sans prendre le dessus : jamais plus grands que le plus petit vêtement, deux au plus", () => {
    for (const t of TENUES) {
      const r = composerFlatLay(t, "x", { contexte: "look-detail" }).pieces;
      const taille = (q: PlacementFlatLay) => Math.max(q.l, q.h);
      const petits = r.filter((q) => PETITS.includes(q.cat) && q.id !== 9);
      const vetements = r.filter((q) => VETEMENTS.includes(q.cat));
      expect(petits.length).toBeLessThanOrEqual(2);
      for (const q of petits) expect(taille(q)).toBeLessThanOrEqual(Math.min(...vetements.map(taille)) + 1e-6);
    }
  });
});

describe("le t-shirt : affiché quand il est le haut de la tenue, pas quand il est une couche sous un pull (05/11/2026)", () => {
  const T = (id: number, cat: CategoryKey, ratio: number) => ({ id, cat, ratio });
  for (const contexte of ["hero-home", "look-detail"] as const) {
    it(`${contexte} : t-shirt seul en haut → posé`, () => {
      const r = composerFlatLay([T(1, "haut", 0.94), T(2, "jean", 0.41), T(3, "chaussures", 1.36)], "x", { contexte });
      expect(r.pieces.some((q) => q.id === 1)).toBe(true);
      expect(r.masquees).not.toContain(1);
    });
    it(`${contexte} : t-shirt sous un pull → dans la tenue, non dessiné ; le pull, lui, est posé`, () => {
      const r = composerFlatLay([T(10, "pull", 0.9), T(1, "haut", 0.94), T(2, "jean", 0.41), T(3, "chaussures", 1.36)], "x", { contexte });
      expect(r.pieces.some((q) => q.id === 1)).toBe(false);
      expect(r.masquees).toContain(1);
      expect(r.pieces.some((q) => q.id === 10)).toBe(true);
    });
  }
});

describe("Capsule › Composer : le haut choisi sous un pull est dessiné (05/11/2026)", () => {
  const T = (id: number, cat: CategoryKey, ratio: number) => ({ id, cat, ratio });
  const tenue = [T(10, "pull", 0.9), T(1, "haut", 0.94), T(2, "jean", 0.41), T(3, "chaussures", 1.36)];
  it("afficherCouche pose le t-shirt, sans chevauchement ; sans l'option, la règle commune le laisse hors planche", () => {
    const avec = composerFlatLay(tenue, "x", { contexte: "look-detail", afficherCouche: true });
    expect(avec.pieces.some((q) => q.id === 1)).toBe(true);
    expect(avec.masquees).not.toContain(1);
    const sans = composerFlatLay(tenue, "x", { contexte: "look-detail" });
    expect(sans.pieces.some((q) => q.id === 1)).toBe(false);
  });
});
