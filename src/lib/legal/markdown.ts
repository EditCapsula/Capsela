/**
 * Un lecteur de Markdown MINIMAL, pour les textes de docs/legal (01/10/2026).
 *
 * Il ne lit que ce que ces textes emploient : titres (# ## ###), paragraphes,
 * listes à puces et numérotées, tableaux, citations, filet (---), et dans le
 * texte le gras, l'italique, le code et les liens. Aucune dépendance de plus
 * pour six documents, et une sortie qui reste du texte : jamais de HTML brut
 * injecté, tout passe par le rendu de React.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; niveau: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" };

/** Un lien n'est suivi que s'il part vers le web, une adresse e-mail ou une page du site. */
const lienSur = (href: string): boolean => /^(https?:\/\/|mailto:|\/)/.test(href);

export function inline(texte: string): Inline[] {
  const out: Inline[] = [];
  let reste = texte;
  const motif = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/;
  while (reste.length) {
    const m = motif.exec(reste);
    if (!m) {
      out.push({ type: "text", text: reste });
      break;
    }
    if (m.index > 0) out.push({ type: "text", text: reste.slice(0, m.index) });
    if (m[2] !== undefined) out.push({ type: "strong", children: inline(m[2]) });
    else if (m[3] !== undefined) out.push({ type: "em", children: inline(m[3]) });
    else if (m[4] !== undefined) out.push({ type: "code", text: m[4] });
    else if (lienSur(m[6])) out.push({ type: "link", href: m[6], children: inline(m[5]) });
    else out.push({ type: "text", text: m[5] });
    reste = reste.slice(m.index + m[0].length);
  }
  return out;
}

const cellules = (ligne: string): string[] => ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const estSeparateur = (ligne: string): boolean => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(ligne);

export function lireMarkdown(source: string): Block[] {
  const lignes = source.replace(/\r\n/g, "\n").split("\n");
  const blocs: Block[] = [];
  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];
    if (!ligne.trim()) { i++; continue; }

    const titre = /^(#{1,3})\s+(.*)$/.exec(ligne);
    if (titre) {
      blocs.push({ type: "heading", niveau: titre[1].length as 1 | 2 | 3, children: inline(titre[2].trim()) });
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(ligne)) { blocs.push({ type: "rule" }); i++; continue; }

    if (ligne.trimStart().startsWith("|") && i + 1 < lignes.length && estSeparateur(lignes[i + 1])) {
      const head = cellules(ligne).map(inline);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lignes.length && lignes[i].trimStart().startsWith("|")) { rows.push(cellules(lignes[i]).map(inline)); i++; }
      blocs.push({ type: "table", head, rows });
      continue;
    }

    if (ligne.startsWith(">")) {
      const parties: string[] = [];
      while (i < lignes.length && lignes[i].startsWith(">")) { parties.push(lignes[i].replace(/^>\s?/, "")); i++; }
      blocs.push({ type: "quote", children: inline(parties.join(" ").trim()) });
      continue;
    }

    const puce = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(ligne);
    if (puce) {
      const ordered = /\d/.test(puce[2]);
      const items: string[] = [];
      while (i < lignes.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lignes[i]);
        if (m && /\d/.test(m[2]) === ordered) { items.push(m[3]); i++; continue; }
        // Ligne de continuation d'un élément : indentée, non vide.
        if (items.length && /^\s+\S/.test(lignes[i]) && !/^\s*([-*]|\d+\.)\s/.test(lignes[i])) { items[items.length - 1] += " " + lignes[i].trim(); i++; continue; }
        break;
      }
      blocs.push({ type: "list", ordered, items: items.map((t) => inline(t.trim())) });
      continue;
    }

    const parties: string[] = [];
    while (
      i < lignes.length &&
      lignes[i].trim() &&
      !/^(#{1,3}\s|>|-{3,}\s*$|\s*([-*]|\d+\.)\s)/.test(lignes[i]) &&
      !lignes[i].trimStart().startsWith("|")
    ) { parties.push(lignes[i].trim()); i++; }
    if (!parties.length) { parties.push(lignes[i].trim()); i++; }
    blocs.push({ type: "paragraph", children: inline(parties.join(" ")) });
  }
  return blocs;
}

/** Texte brut d'un morceau de ligne, pour un titre de page. */
export function texteBrut(morceaux: Inline[]): string {
  return morceaux.map((m) => (m.type === "text" || m.type === "code" ? m.text : texteBrut(m.children))).join("");
}
