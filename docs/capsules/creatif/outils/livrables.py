"""Écrit les livrables de l'audit Créatif (étape 1) à partir de resultats.json et couverture.json.

Usage : python3 -I livrables.py <resultats.json> <couverture.json> <dossier de sortie>
"""
import json
import sys
from collections import Counter, defaultdict

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

R = json.load(open(sys.argv[1]))
C = json.load(open(sys.argv[2]))
D = sys.argv[3]
SAISONS = ["Printemps", "Été", "Automne", "Hiver"]
STATUTS = ["EXACT_MATCH", "POTENTIAL_MATCH", "MISSING", "INCOMPATIBLE"]
GENRES = ["femme", "homme"]
OCCS = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"]
LIB = {c["occasion"]: c["libelle"] for c in C["cellules"]}
compte = Counter((x["genre"], x["statut_auto"]) for x in R)
compte_s = Counter((x["genre"], x["saison"], x["statut_auto"]) for x in R)


def distincts(genre, saison, statuts):
    return len({x["retenu"]["id"] for x in R if x["genre"] == genre and x["saison"] == saison and x["statut_auto"] in statuts and x["retenu"]})


def cel(x):
    return str(x if x is not None else "").replace("|", "/").replace("\n", " ")


# ── 1. Rapprochement ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
L = []
L += [
    "# Audit de rapprochement — capsules Créatif femme et homme",
    "",
    "Étape 1 de l'audit Créatif (brief « Audit et intégration des capsules Créatif Femme & Homme »), arrêtée le 30/10/2026. Lecture seule :",
    "aucune donnée de production, aucune capsule d'un autre style, aucune image n'a été modifiée.",
    "",
    "## Configuration gelée",
    "",
    "| Élément | Valeur |",
    "|---|---|",
    "| Catalogue | export CSV de `vestiaire_universel` fourni le 30/10/2026 : 627 articles (353 femme, 243 homme, 31 unisexe) |",
    "| Référence femme | `Capsela_capsule_femme_style_creatif_4_saisons_v2.xlsx`, feuille « Catalogue Créatif » : 151 pièces |",
    "| Référence homme | `Capsela_capsule_homme_style_creatif_4_saisons_v2.xlsx`, feuille « Catalogue Créatif » : 128 pièces |",
    "| Outils | `outils/rapprocher.py`, `outils/couverture.py`, `outils/livrables.py` (Python, lecture seule), une seule exécution |",
    "",
    "Constat préalable, **DÉMONTRÉ** sur l'export : aucun article ne porte « Créatif » dans sa colonne `styles` (valeurs présentes : les huit",
    "styles de l'app). Le style n'existe donc pas encore dans les données.",
    "",
    "## Règles de classement",
    "",
    "Une pièce de référence est comparée aux articles du même genre (ou unisexe), du même type de vêtement (lu en tête du nom :",
    "« T-shirt », « Pantalon », « Bottines »…).",
    "",
    "| Statut | Règle |",
    "|---|---|",
    "| **EXACT_MATCH** | même type, même genre, la saison de la référence est couverte par `saison_capsule`, et TOUS les traits créatifs du nom de référence se retrouvent dans l'article (nom, sous-type ou matière), à une famille fine près ; sans trait, le même vocabulaire de coupe ; manches compatibles quand la référence les précise |",
    "| **POTENTIAL_MATCH** | même type, même genre, même nature (matière ou usage quand la référence en nomme un : cuir, lin, velours, maille, satin, homewear, technique, cargo, palazzo…), saison couverte, mais sans le trait créatif : l'article est une BASE qui pourrait porter le style après décision, ou servir de modèle à une variante |",
    "| **MISSING** | aucun article du type pour ce genre, ou aucun qui porte la nature demandée |",
    "| **INCOMPATIBLE** | un équivalent existe mais contredit une règle métier : sa saison n'est pas celle de la référence, ou il n'existe que pour l'autre genre |",
    "",
    "Familles fines de traits : graphique / illustré · artistique / abstrait · imprimé / motif · fleuri · carreaux · rayures · jacquard ·",
    "color-block / empiècements / patchwork · contrasté / décalé · coloré · sculptural / architectural / statement · asymétrique / drapé ·",
    "velours · ajouré · tressé. Une chemise à carreaux ne porte donc pas un « imprimé artistique », un sac structuré n'est pas « sculptural ».",
    "",
    "**Relecture humaine** : les 41 correspondances exactes ont été relues une à une. Les corrections de relecture sont liées à l'article",
    "relu (`RELECTURE`, `outils/rapprocher.py`) : H-CR-HIV-30 → #625 passe en POTENTIAL_MATCH (un sac week-end n'est pas le sac structuré",
    "du quotidien). Deux autres sont déclassées par la règle des manches (t-shirt graphique à manches longues contre article à manches",
    "courtes). Les relectures successives ont durci les règles : familles fines de traits (une chemise à carreaux ne porte pas un « imprimé",
    "artistique ») et, après relecture d'un POTENTIAL_MATCH sur quatre, règle de nature (une veste en cuir n'est pas une veste en jean).",
    "",
    "## Résultat",
    "",
    "| Genre | EXACT_MATCH | POTENTIAL_MATCH | MISSING | INCOMPATIBLE | Total |",
    "|---|---|---|---|---|---|",
]
for g in GENRES:
    L.append(f"| {g.capitalize()} | " + " | ".join(str(compte[(g, s)]) for s in STATUTS) + f" | {sum(compte[(g, s)] for s in STATUTS)} |")
L += ["", "Par saison :", "", "| Genre | Saison | EXACT | POTENTIAL | MISSING | INCOMPATIBLE |", "|---|---|---|---|---|---|"]
for g in GENRES:
    for sa in SAISONS:
        L.append(f"| {g.capitalize()} | {sa} | " + " | ".join(str(compte_s[(g, sa, s)]) for s in STATUTS) + " |")
L += [
    "",
    "Lecture, **DÉMONTRÉ** : le catalogue a les BASES de la plupart des pièces Créatif (le type existe, dans la bonne saison et la bonne",
    "matière : 198 pièces sur 279 en POTENTIAL_MATCH), mais presque jamais leur version créative. Côté femme, 8 pièces sur 151 trouvent un",
    "équivalent exact, presque toutes des hauts (t-shirts et sweats graphiques, top drapé asymétrique) et un pantalon en velours côtelé ;",
    "aucune chaussure, aucun bas imprimé, aucune robe. Côté homme, 33 sur 128 : la capsule homme compte davantage de pièces de base",
    "(chemise oxford, bottines, derbies, pull col roulé…), que le catalogue a déjà.",
    "",
    "Plusieurs références pointent vers le même article (ex. trois t-shirts graphiques femme → #710). Articles DISTINCTS concernés :",
    "",
    "| Genre | Saison | Articles distincts EXACT | Articles distincts EXACT + POTENTIAL |",
    "|---|---|---|---|",
]
for g in GENRES:
    for sa in SAISONS:
        L.append(f"| {g.capitalize()} | {sa} | {distincts(g, sa, {'EXACT_MATCH'})} | {distincts(g, sa, {'EXACT_MATCH', 'POTENTIAL_MATCH'})} |")
L += ["", "## Détail par pièce", ""]
for g in GENRES:
    for st in STATUTS:
        ps = [x for x in R if x["genre"] == g and x["statut_auto"] == st]
        if not ps:
            continue
        L += [f"### {g.capitalize()} — {st} ({len(ps)})", "", "| ID | Saison | Pièce de référence | Article retenu | Raison |", "|---|---|---|---|---|"]
        for x in ps:
            a = x["retenu"]
            art = f"#{a['id']} {a['name']} ({a['genre']}, {a['saisons']})" if a else "—"
            L.append(f"| {x['id']} | {x['saison']} | {cel(x['piece'])} | {cel(art)} | {cel(x['raison'])} |")
        L.append("")
open(f"{D}/audit-rapprochement-creatif.md", "w").write("\n".join(L))

# ── 2. Pièces manquantes (xlsx) ────────────────────────────────────────────────────────────────────────────────────────────────────────
wb = openpyxl.Workbook()
gras = Font(bold=True)
fond = PatternFill("solid", fgColor="EFE6D8")


def feuille(titre, entetes, lignes, largeurs):
    ws = wb.create_sheet(titre)
    ws.append(entetes)
    for c in ws[1]:
        c.font = gras
        c.fill = fond
        c.alignment = Alignment(wrap_text=True, vertical="top")
    for l in lignes:
        ws.append(l)
    for i, w in enumerate(largeurs):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = w
    ws.freeze_panes = "A2"
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    return ws


ws = wb.active
ws.title = "Lisez-moi"
for l in [
    ["Audit Créatif — étape 1 (30/10/2026)", ""],
    ["Objet", "Pièces des capsules Créatif de référence sans équivalent utilisable dans vestiaire_universel (export du 30/10/2026, 627 articles)."],
    ["Manquantes", "MISSING : aucun article du type pour ce genre, ou aucun qui porte la nature demandée (matière ou usage). À créer."],
    ["Incompatibles", "INCOMPATIBLE : un équivalent existe mais sa saison ou son genre contredit la référence. À créer, ou à arbitrer (élargir la saison d'un article existant est une décision éditoriale)."],
    ["Potentielles à arbitrer", "POTENTIAL_MATCH : une base existe (même type, nature, saison) sans le trait créatif. Deux voies : étiqueter l'article existant « Créatif » (décision éditoriale, pièce par pièce), ou créer la variante créative."],
    ["Exactes", "EXACT_MATCH : article existant qui porte la pièce de référence ; candidat à l'ajout de « Créatif » dans sa colonne styles (étape 2, après validation)."],
    ["Règles", "Cf. docs/capsules/creatif/audit-rapprochement-creatif.md. Aucune donnée inventée : les colonnes reprennent la référence Excel et l'export."],
]:
    ws.append(l)
ws.column_dimensions["A"].width = 24
ws.column_dimensions["B"].width = 120
ws["A1"].font = Font(bold=True, size=13)

ENT = ["ID", "Genre", "Saison", "Catégorie (référence)", "Pièce", "Type lu", "Traits créatifs", "Occasions (référence)", "Rôle", "Couleurs indicatives", "Matières indicatives", "Manches", "Coupe", "Raison"]
LARG = [14, 8, 10, 14, 34, 14, 22, 30, 16, 34, 24, 16, 22, 50]


def ligne(x, plus=()):
    return [x["id"], x["genre"], x["saison"], x["categorie"], x["piece"], x["type"], ", ".join(x["traits"]), "; ".join(x["occasions"]), x["role"], x["couleurs"], x["matieres"], x["manches"], x["coupe"], x["raison"], *plus]


feuille("Manquantes", ENT, [ligne(x) for x in R if x["statut_auto"] == "MISSING"], LARG)
feuille("Incompatibles", ENT + ["Article proche", "Saisons de l'article"], [ligne(x, (f"#{x['retenu']['id']} {x['retenu']['name']} ({x['retenu']['genre']})", x["retenu"]["saisons"])) for x in R if x["statut_auto"] == "INCOMPATIBLE"], LARG + [40, 26])
feuille("Potentielles à arbitrer", ENT + ["Base retenue", "Styles de la base", "Autres bases", "Décision (étiqueter la base / créer la variante / écarter)"], [ligne(x, (f"#{x['retenu']['id']} {x['retenu']['name']}", x["retenu"]["styles"], " ; ".join(f"#{a['id']} {a['name']}" for a in x["autres"]), "")) for x in R if x["statut_auto"] == "POTENTIAL_MATCH"], LARG + [40, 40, 60, 30])
feuille("Exactes", ENT + ["Article", "Styles actuels"], [ligne(x, (f"#{x['retenu']['id']} {x['retenu']['name']}", x["retenu"]["styles"])) for x in R if x["statut_auto"] == "EXACT_MATCH"], LARG + [40, 50])
syn = feuille("Synthèse", ["Genre", "Saison"] + STATUTS, [[g, sa] + [compte_s[(g, sa, s)] for s in STATUTS] for g in GENRES for sa in SAISONS], [10, 12, 14, 18, 12, 16])
wb.move_sheet("Synthèse", offset=-(len(wb.sheetnames) - 2))
wb.save(f"{D}/pieces-manquantes-creatif.xlsx")

# ── 3. Couverture ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
NIV = [("A", "Capsule de référence (Excel)"), ("A+T", "Référence + pièces transversales"), ("B", "Catalogue, EXACT_MATCH seuls"), ("B+T", "EXACT + transversales"), ("C", "EXACT + POTENTIAL validés"), ("C+T", "EXACT + POTENTIAL + transversales")]
K = []
K += [
    "# Audit de couverture des occasions — capsules Créatif",
    "",
    "Étape 1, 30/10/2026. 8 occasions (`OCCASIONS`, `src/lib/data.ts`) × 4 saisons × 2 genres = 64 cellules, mesurées à six niveaux dans",
    "la même exécution, sur les mêmes données (règle d'audit, points 3 et 4).",
    "",
    "## Ce qui est mesuré",
    "",
    "Une cellule est **couverte** quand une tenue complète s'y compose avec des pièces étiquetées pour cette occasion et cette saison :",
    "(un haut ET un bas) OU une pièce unique (robe, combinaison, ensemble), PLUS des chaussures. Une veste ou un manteau n'est pas exigé",
    "(le moteur l'ajoute selon la météo) ; sa présence est seulement relevée.",
    "",
    "Correspondance des occasions de la référence : Quotidien → `quotidien` · Travail → `travail_formel` · Date → `date` · Soirée →",
    "`soiree` · Sport → `sport` · Cocooning → `cocooning` · Voyage → `voyage` · Cérémonie → `evenement_perso`.",
    "",
]
ht = C["hors_taxonomie"]
if ht:
    for o, ids in ht.items():
        K += [f"**Signalé, non interprété** : l'occasion « {o} » de la référence n'existe pas dans la taxonomie de l'app ({len(ids)} pièces femme : {', '.join(ids)}).",
              "Elle n'est comptée nulle part. La rattacher à « Voyage » serait une décision éditoriale, à prendre explicitement.", ""]
K += [
    "Niveaux :",
    "",
    "| Niveau | Contenu |",
    "|---|---|",
    "| A | la capsule de référence telle qu'écrite (ses propres occasions) |",
    "| B | les seules pièces dont le catalogue porte déjà un équivalent exact |",
    "| C | B + toutes les correspondances potentielles, si elles étaient validées |",
    "| +T | + les pièces TRANSVERSALES du catalogue, absentes de la référence mais tirées par le moteur pour ces occasions : chaussures d'intérieur (#481 femme, #520 homme ; seules admises en Cocooning, R-B13, `logic.ts`) et baskets de sport (#971 femme, #972 homme). Elles ne servent au style Créatif que si « Créatif » est ajouté à leur colonne `styles` |",
    "",
    "Les occasions d'un article du catalogue sont celles de sa pièce de référence (c'est elles que l'intégration porterait). Le moteur n'est",
    "pas exécuté : la composition réelle des tenues (formalité, météo, règles R-S, diversité) est **NON DÉMONTRÉE** à ce stade — le style",
    "n'existant pas dans l'app, il n'y a rien à exécuter. Elle se mesure à l'étape 2 (plan d'intégration).",
    "",
    "## Résultat",
    "",
    "| Niveau | Femme | Homme |",
    "|---|---|---|",
]
for n, lib in NIV:
    K.append(f"| {n} — {lib} | " + " | ".join(f"{sum(c[n]['complete'] for c in C['cellules'] if c['genre'] == g)} / 32" for g in GENRES) + " |")
K += ["", "**DÉMONTRÉ** (sur ces données, selon ce critère) :", "",
      "- La capsule de référence n'est pas complète par elle-même : 22 cellules sur 32 côté femme, 16 sur 32 côté homme. Avec les pièces",
      "  transversales (chaussures d'intérieur, baskets de sport), 28 et 23.",
      "- Le catalogue actuel, en équivalents exacts, ne compose presque aucune tenue Créatif : 0 cellule côté femme (aucune chaussure, aucun",
      "  bas autre que le pantalon en velours), 4 côté homme.",
      "- Même si toutes les bases potentielles étaient validées, la couverture plafonne à celle de la référence (20 et 16 ; 23 et 16 avec",
      "  les transversales) : les manques de la référence restent des manques.",
      "",
      "## Matrices", ""]
for g in GENRES:
    for n in ("A+T", "B+T", "C+T"):
        K += [f"### {g.capitalize()} — niveau {n}", "", "| Occasion | " + " | ".join(SAISONS) + " |", "|---|" + "---|" * 4]
        for o in OCCS:
            cs = {c["saison"]: c for c in C["cellules"] if c["genre"] == g and c["occasion"] == o}
            vals = []
            for sa in SAISONS:
                c = cs[sa][n]
                vals.append("couverte" + (f" (avec {c['transversale']})" if c.get("transversale") else "") if c["complete"] else "manque : " + ", ".join(c["manque"]))
            K.append(f"| {LIB[o]} | " + " | ".join(vals) + " |")
        K.append("")
K += ["## Trous de la capsule de référence (niveau A+T)", "", "À combler dans la référence elle-même, avant ou pendant l'intégration :", "", "| Genre | Saison | Occasion | Manque | Pièces étiquetées |", "|---|---|---|---|---|"]
for c in C["cellules"]:
    if not c["A+T"]["complete"]:
        K.append(f"| {c['genre'].capitalize()} | {c['saison']} | {c['libelle']} | {', '.join(c['A+T']['manque'])} | {c['A']['pieces']} |")
K.append("")
open(f"{D}/audit-couverture-creatif.md", "w").write("\n".join(K))
print("ok")
