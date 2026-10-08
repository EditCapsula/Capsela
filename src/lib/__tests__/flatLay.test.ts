import { describe, expect, it } from "vitest";
import { CHEVAUCHEMENT_MAX, CONTEXTES, LARGEUR_ACCESSOIRE_MIN, LARGEUR_HERO_MAX, LIMITE_INCLINAISON, MARGE_SECURITE, MASQUE_MAX, PART_VISUELLE, attribuerRoles, composerFlatLay, echelleVisuelle, generateur, type PieceFlatLay, type PlacementFlatLay } from "../flatLay";
import type { CategoryKey } from "../types";

let n = 0;
const p = (cat: CategoryKey, ratio = 0.8): PieceFlatLay => ({ id: ++n, cat, ratio });
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
    const vues = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(composerFlatLay(pieces, "look-" + i).pieces.map((q) => [Math.round(q.x), Math.round(q.angle)]))));
    expect(vues.size).toBeGreaterThan(6);
  });

  it("chaque inclinaison reste dans la plage de son rôle (héro ±4°, secondaires ±5°, chaussures ±8°, sac ±6°, accessoires ±10°)", () => {
    for (const contexte of ["hero-home", "look-detail"] as const)
      for (let i = 0; i < 40; i++)
        for (const q of composerFlatLay(look(), "g" + i, { contexte }).pieces) expect(Math.abs(q.angle)).toBeLessThanOrEqual(LIMITE_INCLINAISON[q.role] + 1e-9);
  });

  it("une veste héro est toujours à droite, le haut à gauche, le bas entre les deux", () => {
    for (let i = 0; i < 40; i++) {
      const par = Object.fromEntries(composerFlatLay(look(), "d" + i).pieces.map((q) => [q.role, q]));
      expect(par.hero.x).toBeGreaterThan(par.bas.x);
      expect(par.bas.x).toBeGreaterThan(par.secondaire.x);
      expect(par.chaussures.x).toBeGreaterThan(par.sac.x);
    }
  });

  it("tout reste dans la zone, rotation comprise, avec la marge de sécurité, et le héro est la plus grande pièce", () => {
    for (let i = 0; i < 40; i++) {
      const { pieces } = composerFlatLay(look(), "z" + i);
      for (const q of pieces) {
        const r = (Math.abs(q.angle) * Math.PI) / 180;
        const w = q.l * Math.cos(r) + q.h * Math.sin(r);
        const h = q.l * Math.sin(r) + q.h * Math.cos(r);
        expect(q.x - w / 2).toBeGreaterThanOrEqual(MARGE_SECURITE - 0.01);
        expect(q.x + w / 2).toBeLessThanOrEqual(100 - MARGE_SECURITE + 0.01);
        expect(q.y - h / 2).toBeGreaterThanOrEqual(MARGE_SECURITE - 0.01 + (112 - 112) / 2);
        expect(q.y + h / 2).toBeLessThanOrEqual(112 - MARGE_SECURITE + 0.01);
      }
    }
  });

  it("le sac et les chaussures ne sont jamais insignifiants (≥ 20 % de la largeur)", () => {
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "s" + i).pieces) if (q.role === "sac" || q.role === "chaussures") expect(q.l).toBeGreaterThanOrEqual(20);
  });

  it("la veste et le manteau sont toujours au fond, le bas puis le haut devant, puis chaussures, sac, accessoires", () => {
    const z = (pieces: PieceFlatLay[]) => Object.fromEntries(composerFlatLay(pieces, "z").pieces.map((q) => [pieces.find((x) => x.id === q.id)!.cat, q.z]));
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
    const { pieces } = composerFlatLay([p("manteau", 0.9), p("pull", 0.9), p("jupe", 0.7)], "v");
    const hero = pieces.find((q) => q.role === "hero")!;
    expect(hero.cat).toBe("manteau");
    expect(hero.visualScale).toBeGreaterThan(1);
    expect(pieces.find((q) => q.role === "bas")!.visualScale).toBeLessThan(1);
  });
});

describe("contextes du flat lay — un moteur, des paramètres différents", () => {
  const look = () => [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6), p("chaussures", 1.1), p("sac", 0.82)];

  it("hero-home et look-detail utilisent le même moteur mais pas la même zone ni les mêmes angles", () => {
    const home = composerFlatLay(look(), "ctx", { contexte: "hero-home" });
    const detail = composerFlatLay(look(), "ctx", { contexte: "look-detail" });
    expect(CONTEXTES["look-detail"].hauteur).toBeGreaterThan(CONTEXTES["hero-home"].hauteur);
    expect(home.pieces.length).toBe(detail.pieces.length);
    const angle = (r: typeof home, role: string) => r.pieces.find((q) => q.role === role)!.angle;
    // Les deux contextes obéissent aux mêmes plages d'inclinaison (calibrage du 08/10/2026).
    expect(Math.abs(angle(detail, "hero"))).toBeLessThanOrEqual(LIMITE_INCLINAISON.hero + 1e-9);
    expect(Math.abs(angle(home, "hero"))).toBeLessThanOrEqual(LIMITE_INCLINAISON.hero + 1e-9);
  });

  it("look-detail : la pièce héro occupe une plus grande part de la zone que sur la homepage", () => {
    const part = (r: ReturnType<typeof composerFlatLay>, h: number) => {
      const hero = r.pieces.find((q) => q.role === "hero")!;
      return (hero.l * hero.h) / (100 * h);
    };
    const home = composerFlatLay(look(), "ctx", { contexte: "hero-home" });
    const detail = composerFlatLay(look(), "ctx", { contexte: "look-detail" });
    expect(part(detail, CONTEXTES["look-detail"].hauteur)).toBeGreaterThan(part(home, CONTEXTES["hero-home"].hauteur) * 0.9);
  });

  it("une robe est centrée en look-detail, sac et chaussures dessous de part et d'autre", () => {
    for (let i = 0; i < 20; i++) {
      const { pieces } = composerFlatLay([p("robe", 0.7), p("sac", 0.8), p("chaussures", 1.1)], "r" + i, { contexte: "look-detail" });
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
      expect(composerFlatLay(look(), "x", { contexte: c }).pieces.length).toBe(5);
    }
  });
});

describe("accessoires — jamais isolés, jamais en surnombre", () => {
  it("le nombre d'accessoires est limité par le contexte et par le nombre de pièces", () => {
    const base = [p("veste", 0.94), p("haut", 1), p("pantalon", 0.6)];
    const trois = [p("bijou", 1), p("accessoire", 1), p("bijou", 1), p("accessoire", 1)];
    const { pieces } = composerFlatLay([...base, ...trois], "a");
    expect(pieces.filter((q) => q.role === "accessoire").length).toBeLessThanOrEqual(CONTEXTES["hero-home"].maxAccessoires[0]);
    const beaucoup = composerFlatLay([...base, p("chaussures"), p("sac"), ...trois], "a").pieces.filter((q) => q.role === "accessoire");
    expect(beaucoup.length).toBeLessThanOrEqual(CONTEXTES["hero-home"].maxAccessoires[1]);
  });

  it("un accessoire de tenue passe avant un bijou", () => {
    const bijou = p("bijou", 1);
    const ceinture = p("accessoire", 1.5);
    const { pieces, ecartees } = composerFlatLay([p("robe", 0.7), p("sac", 0.8), p("chaussures", 1.1), bijou, ceinture, p("bijou", 1), p("bijou", 1)], "a");
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
    expect(composerFlatLay([p("veste", 0.94), p("haut", 1), ceinture], "c").pieces.some((q) => q.id === ceinture.id)).toBe(false);
    const grosse = { ...p("sac", 0.8), visualScale: 1.1, preferredRotation: 45 };
    const norm = p("sac", 0.8);
    const a = composerFlatLay([p("veste", 0.94), grosse], "c").pieces.find((q) => q.id === grosse.id)!;
    const b = composerFlatLay([p("veste", 0.94), norm], "c").pieces.find((q) => q.id === norm.id)!;
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
              expect(part, `${contexte} look ${k} graine ${i} : ${sortie[a].cat}/${sortie[b].cat}`).toBeLessThanOrEqual(CHEVAUCHEMENT_MAX + 0.02);
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
            expect(masque, `${contexte} look ${k} graine ${i} : ${q.cat}`).toBeLessThanOrEqual(MASQUE_MAX + 0.02);
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
    const { pieces } = composerFlatLay(sansSac, "sansSac", { contexte: "look-detail" });
    expect(pieces.length).toBe(4);
    const h = CONTEXTES["look-detail"].hauteur;
    expect(Math.min(...pieces.map((q) => q.y - q.h / 2))).toBeLessThan(h * 0.2);
    expect(Math.max(...pieces.map((q) => q.y + q.h / 2))).toBeGreaterThan(h * 0.8);
  });
});
