// Embarque les textes de docs/legal dans l'app (src/lib/legal/contenu.ts).
// L'app est une page client unique : elle ne peut pas lire docs/ à l'exécution.
// Lancé avant `dev` et `build` ; un test vérifie que le fichier est à jour.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SLUGS = ["mentions-legales", "confidentialite", "cgu", "droits-rgpd", "cookies", "cgv"];

export function contenuGenere() {
  const lignes = SLUGS.map((slug) => {
    const src = readFileSync(path.join(racine, "docs", "legal", `${slug}.md`), "utf8");
    return `  ${JSON.stringify(slug)}: ${JSON.stringify(src)},`;
  });
  return `// GÉNÉRÉ par scripts/generer-legal.mjs depuis docs/legal — ne pas modifier à la main.\n// Régénérer : npm run legal:generer\nexport const CONTENU_LEGAL: Record<string, string> = {\n${lignes.join("\n")}\n};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(path.join(racine, "src", "lib", "legal", "contenu.ts"), contenuGenere());
}
