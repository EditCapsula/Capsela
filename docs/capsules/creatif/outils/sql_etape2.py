"""Étape 2 du style Créatif : écrit le SQL à montrer, JAMAIS à lancer d'ici (supabase/migrations et les données de production sont
appliquées à la main par la propriétaire).

Usage : python3 -I sql_etape2.py <resultats.json> <palette.json> <dossier de sortie>

Décisions appliquées (30/10/2026) :
- identifiant `creatif` commun aux deux genres, libellé catalogue « Créatif » (validé) ;
- « dans les fichiers Excel tu as toutes les pièces » : les pièces de référence SANS équivalent exact sont CRÉÉES depuis l'Excel
  (POTENTIAL_MATCH, MISSING, INCOMPATIBLE), plutôt que d'étiqueter des bases unies ;
- les équivalents EXACTS sont étiquetés « Créatif » plutôt que dupliqués (défaut proposé, à confirmer) ;
- `styles` des pièces créées = « Créatif » seul : les styles secondaires de la référence (Bohème, Streetwear…) n'y sont PAS mis, sans
  quoi ces pièces entreraient dans les capsules d'autres styles (« ne modifie aucune capsule d'un autre style »).
"""
import json
import sys
import unicodedata

R = json.load(open(sys.argv[1]))
PALETTE = {nom.lower(): (nom, hexa) for nom, hexa in json.load(open(sys.argv[2]))}
D = sys.argv[3]

OCC = {"Quotidien": "quotidien", "Travail": "travail_formel", "Date": "date", "Soirée": "soiree", "Sport": "sport",
       "Cocooning": "cocooning", "Voyage": "voyage", "Cérémonie": "evenement_perso"}

CATEGORIE = {
    "tshirt": "hauts", "debardeur": "hauts", "brassiere": "hauts", "haut_technique": "hauts", "top": "hauts", "tunique": "hauts",
    "blouse": "hauts", "chemise": "hauts", "surchemise": "hauts", "polo": "hauts",
    "pull": "pulls_gilets", "sous_pull": "pulls_gilets", "sweat": "pulls_gilets", "cardigan": "pulls_gilets",
    "jogging": "pantalons", "legging": "pantalons", "pantalon": "pantalons", "jean": "jeans", "short": "shorts", "jupe": "jupes",
    "robe": "robes", "combinaison": "combinaisons", "combishort": "combinaisons",
    "blazer": "vestes_blazers", "veste": "vestes_blazers", "doudoune": "manteaux_exterieurs", "manteau": "manteaux_exterieurs",
    "baskets": "chaussures", "ballerines": "chaussures", "bottines": "chaussures", "bottes": "chaussures", "mocassins": "chaussures",
    "derbies": "chaussures", "mules": "chaussures", "sandales": "chaussures", "espadrilles": "chaussures",
    "sac": "sacs", "bijou": "bijoux",
    "foulard": "accessoires", "echarpe": "accessoires", "ceinture": "accessoires", "lunettes": "accessoires", "bonnet": "accessoires",
    "casquette": "accessoires", "gants": "accessoires",
}
# Sous-type : le vocabulaire déjà lu par l'app (SHOE_TYPE_MAP de vestiaire.ts pour les chaussures — sans lui, une chaussure n'a pas de
# type et R-B6 l'écarte ; sous-types existants du catalogue pour le reste).
SOUS_TYPE = {
    "tshirt": "T-shirt", "debardeur": "Débardeur", "brassiere": "Brassière", "haut_technique": "Haut technique", "top": "Top",
    "tunique": "Tunique", "blouse": "Blouse", "chemise": "Chemise", "surchemise": "Surchemise", "polo": "Polo", "pull": "Pull",
    "sous_pull": "Sous-pull", "sweat": "Sweat", "cardigan": "Cardigan", "jogging": "Jogging", "legging": "Legging", "pantalon": "Pantalon",
    "jean": "Jean", "short": "Short", "jupe": "Jupe", "robe": "Robe", "combinaison": "Combinaison", "combishort": "Combishort",
    "blazer": "Blazer", "veste": "Veste", "doudoune": "Doudoune", "manteau": "Manteau",
    "baskets": "Baskets", "ballerines": "Ballerines", "bottines": "Bottines", "bottes": "Bottes", "mocassins": "Mocassins",
    "derbies": "Derbies", "mules": "Mules", "sandales": "Sandales", "espadrilles": "Espadrilles",
    "sac": "Sac", "bijou": "Bijou", "foulard": "Foulard", "echarpe": "Écharpe", "ceinture": "Ceinture", "lunettes": "Lunettes de soleil",
    "bonnet": "Bonnet", "casquette": "Casquette", "gants": "Gants",
}
ROLE = {"robes": "piece_unique", "combinaisons": "piece_unique", "vestes_blazers": "calque", "manteaux_exterieurs": "calque"}


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


def connues(indicatives):
    """Les couleurs indicatives que la palette de l'app connaît, telles quelles, dans l'ordre ; aucune approchée (« Lilas » n'est pas
    « Lavande », « corail doux » n'est pas « Corail »)."""
    return [PALETTE[c.strip().lower()] for c in str(indicatives or "").split(",") if c.strip().lower() in PALETTE]


# Côté femme, la colonne « Couleurs indicatives » porte la PALETTE DE LA SAISON (la même liste pour toutes les pièces d'une saison),
# pas la couleur de la pièce : en prendre la première peindrait toute la saison d'une seule teinte. Une liste partagée par au moins
# cinq pièces d'un même genre et d'une même saison est lue comme une palette ; ses couleurs connues sont alors RÉPARTIES, dans l'ordre,
# entre les pièces (PROPOSITION, marquée comme telle). Sinon (listes propres à la pièce, côté homme), la première couleur connue.
from collections import Counter

_partage = Counter((x["genre"], x["saison"], x["couleurs"]) for x in R)
_rang = Counter()


def couleur(x):
    choix = connues(x["couleurs"])
    if not choix:
        return (None, None, "aucune")
    if _partage[(x["genre"], x["saison"], x["couleurs"])] >= 5:
        k = (x["genre"], x["saison"], x["couleurs"])
        c = choix[_rang[k] % len(choix)]
        _rang[k] += 1
        return (c[0], c[1], "proposée (palette de saison répartie)")
    return (choix[0][0], choix[0][1], "lue sur la pièce")


def manches(v):
    v = norm(v)
    if v.startswith("longues"):
        return "longues"
    if v.startswith("courtes"):
        return "courtes"
    if v.startswith("sans"):
        return "sans"
    return None


def formalite(occasions):
    """PROPOSITION, à valider : le niveau de formalité déduit des occasions de la référence, par une règle écrite (pas pièce par pièce).
    Sport seul → sport ; Soirée ou Cérémonie sans Quotidien → habillé ; Travail ou Rendez-vous → business casual ; sinon décontracté."""
    o = set(occasions)
    if o and o <= {"sport"}:
        return "sport"
    if o & {"soiree", "evenement_perso"} and "quotidien" not in o:
        return "habille"
    if o & {"travail_formel", "date"}:
        return "business_casual"
    return "decontracte"


def q(v):
    return "null" if v is None else "'" + str(v).replace("'", "''") + "'"


SAISONS = ["Printemps", "Été", "Automne", "Hiver"]

# ── 1. Étiqueter les équivalents exacts et les pièces transversales ──────────────────────────────────────────────────────────────────
exacts = {}
for x in R:
    if x["statut_auto"] == "EXACT_MATCH":
        a = x["retenu"]
        exacts.setdefault(a["id"], (a["name"], a["genre"], []))[2].append(x["id"])
unisexes = sorted((int(i), v) for i, v in exacts.items() if v[1] == "unisexe")
genres = sorted((int(i), v) for i, v in exacts.items() if v[1] != "unisexe")
TRANSVERSALES = [(481, "Chaussures d'intérieur", "femme"), (520, "Chaussures d'intérieur", "homme"), (971, "Baskets de sport", "femme"), (972, "Baskets de sport", "homme")]

AJOUT = "set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end"
GARDE = "and coalesce(styles, '') not like '%Créatif%'"
L = [
    "-- Style Créatif, étape 2 — 1/3 : étiqueter « Créatif » des articles EXISTANTS (30/10/2026).",
    "-- À lancer à la main dans l'éditeur SQL, après validation. Ajout seulement : aucun style retiré, aucune autre colonne touchée,",
    "-- aucun identifiant ni aucune image modifiés. Idempotent (un article déjà étiqueté n'est pas retouché). Annulation : 03-annuler.sql.",
    "",
    "-- 1.a Équivalents exacts de la capsule de référence (relus un à un, docs/capsules/creatif/audit-rapprochement-creatif.md).",
    f"update vestiaire_universel {AJOUT}",
    "where id in (",
]
L += [f"  {i:<5}{',' if k < len(genres) - 1 else ' '} -- {v[0]} ({v[1]}) ← {', '.join(v[2])}" for k, (i, v) in enumerate(genres)]
L += [f") {GARDE};", "",
      "-- 1.b Pièces transversales (communes à tous les styles) : sans elles, Sport et Cocooning n'ont pas de chaussures Créatif",
      "-- (R-B13 : seules les chaussures d'intérieur sont admises en Cocooning).",
      f"update vestiaire_universel {AJOUT}",
      "where id in (" + ", ".join(str(i) for i, _, _ in TRANSVERSALES) + f") {GARDE}; -- " + " ; ".join(f"{i} {n} ({g})" for i, n, g in TRANSVERSALES),
      "",
      "-- 1.c DÉCISION EN ATTENTE — pièces UNISEXES rapprochées de la capsule homme : les étiqueter les fait aussi entrer dans les capsules",
      "-- Créatif FEMME. Laissées en commentaire : à décommenter seulement si tu le décides.",
      f"-- update vestiaire_universel {AJOUT}",
      "-- where id in (" + ", ".join(str(i) for i, _ in unisexes) + f") {GARDE}; -- " + " ; ".join(f"{i} {v[0]} ← {', '.join(v[2])}" for i, v in unisexes),
      ""]
open(f"{D}/01-etiqueter-existants.sql", "w").write("\n".join(L))

# ── 2. Créer les pièces de référence sans équivalent exact ───────────────────────────────────────────────────────────────────────────
a_creer = [x for x in R if x["statut_auto"] in ("POTENTIAL_MATCH", "MISSING", "INCOMPATIBLE")]
non_representables = [x for x in a_creer if CATEGORIE.get(x["type"]) is None]
fusion = {}
for x in a_creer:
    if CATEGORIE.get(x["type"]) is None:
        continue
    cle = (x["genre"], norm(x["piece"]))
    fusion.setdefault(cle, []).append(x)

lignes, sans_couleur, revue = [], [], []
for (genre, _), xs in sorted(fusion.items(), key=lambda kv: (kv[0][0], SAISONS.index(kv[1][0]["saison"]), kv[1][0]["id"])):
    x = xs[0]
    saisons = [s for s in SAISONS if any(y["saison"] == s for y in xs)]
    occs = []
    for y in xs:
        for o in y["occasions"]:
            k = OCC.get(o)
            if k and k not in occs:
                occs.append(k)
    nom_c, hexa, origine_couleur = couleur(x)
    if nom_c is None:
        sans_couleur.append(x)
    cat = CATEGORIE[x["type"]]
    role_ref = str(x["role"] or "")
    statement = role_ref in ("Pièce forte", "Signature")
    valeurs = {
        "name": x["piece"], "category": cat, "genre": genre, "styles": "Créatif", "saison_capsule": ", ".join(saisons),
        "sous_type": SOUS_TYPE[x["type"]], "matiere": (str(x["matieres"] or "").split(",")[0].strip() or None),
        "couleur_dominante": nom_c, "hex": hexa, "manches": manches(x["manches"]), "occasions": ",".join(occs) or None,
        "niveau_formalite": formalite(occs), "role_piece": ROLE.get(cat, "base"), "est_basique_capsule": False,
        "statement": statement, "image_status": "missing", "frozen": False,
    }
    lignes.append((valeurs, [y["id"] for y in xs]))
    revue.append({**valeurs, "references": ", ".join(y["id"] for y in xs), "statut_audit": ", ".join(sorted({y["statut_auto"] for y in xs})), "couleurs_indicatives": x["couleurs"], "origine_couleur": origine_couleur, "role_reference": role_ref})
    lignes[-1] = (valeurs, lignes[-1][1], origine_couleur)

COLS = list(lignes[0][0].keys())


def sql_val(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    return q(v)


S = [
    "-- Style Créatif, étape 2 — 2/3 : CRÉER les pièces de la capsule de référence sans équivalent exact (30/10/2026).",
    "-- À lancer à la main dans l'éditeur SQL, après validation, APRÈS 01. Nouvelles lignes seulement : identifiants attribués par la base",
    "-- (aucun identifiant existant remplacé), aucun article existant modifié. Annulation : 03-annuler.sql.",
    "--",
    f"-- {len(lignes)} articles ({len([l for l in lignes if l[0]['niveau_formalite'] != 'sport'])} en 2.a, {len([l for l in lignes if l[0]['niveau_formalite'] == 'sport'])} de sport en 2.b, en attente), tirés de {sum(len(r) for _, r, _ in lignes)} pièces de référence (une même pièce présente à plusieurs saisons = un article,",
    "-- saisons et occasions réunies). Chaque ligne cite ses références (docs/capsules/creatif/pieces-manquantes-creatif.xlsx).",
    "--",
    "-- Règles de remplissage (rien d'inventé) :",
    "--   styles            « Créatif » seul — jamais les styles secondaires de la référence (ils feraient entrer la pièce dans d'autres capsules) ;",
    "--   saison_capsule    les saisons de la référence ; occasions : celles de la référence, en clés de l'app (« Vacances » écartée, décision en attente) ;",
    "--   couleur / hex     côté homme, la première couleur indicative de la pièce que la palette de l'app connaît ; côté femme, la colonne",
    "--                     porte la palette de la SAISON, pas la couleur de la pièce : ses couleurs connues sont RÉPARTIES entre les pièces",
    "--                     — PROPOSITION À VALIDER, signalée « couleur proposée » en fin de ligne ; aucune couleur sinon (null, listées plus bas) ;",
    "--   matiere           la première matière indicative ; manches : celles de la référence quand elle les précise ;",
    "--   statement         vrai pour un rôle « Pièce forte » ou « Signature » de la référence ;",
    "--   niveau_formalite  PROPOSITION À VALIDER, règle écrite sur les occasions : Sport seul → sport ; Soirée ou Cérémonie sans Quotidien →",
    "--                     habillé ; Travail ou Rendez-vous → business casual ; sinon décontracté ;",
    "--   image_status      « missing » : visuel à générer par la chaîne existante (generate-catalog-image), aucune image fournie ici.",
    "",
    "-- 2.0 Précaution (31/10/2026, première exécution : 0 pièce créée) : la table attribue les id (identity), mais le catalogue a été",
    "-- importé avec ses propres id ; si le compteur n'a jamais été recalé, il peut proposer un id déjà pris et faire refuser TOUTE",
    "-- l'insertion. On le place après le plus grand id existant. Ne modifie aucune ligne.",
    "select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));",
    "",
    "-- 2.a Toutes les pièces hors sport.",
    "insert into vestiaire_universel (" + ", ".join(COLS) + ") values",
]


def bloc(rangs, commente):
    out = []
    for k, (v, refs, origine) in enumerate(rangs):
        note = " · couleur proposée" if origine.startswith("proposée") else ""
        out.append(("-- " if commente else "") + "  (" + ", ".join(sql_val(v[c]) for c in COLS) + ")" + ("," if k < len(rangs) - 1 else ";") + f" -- {', '.join(refs)}{note}")
    return out


# Les pièces de SPORT (formalité 0) à part : le bloc Sport d'une capsule n'est jamais filtré par style (capsule.ts, arbitrage du
# 24/08/2026) — mesuré le 30/10/2026 (scripts/creatif.audit.ts, L2 contre L2s) : créées, elles modifient les capsules de TOUS les autres
# styles (32 sur 32 femme, 24 sur 24 homme) ; sans elles, aucune. « Ne modifie aucune capsule d'un autre style » : laissées en commentaire.
hors_sport = [l for l in lignes if l[0]["niveau_formalite"] != "sport"]
sport = [l for l in lignes if l[0]["niveau_formalite"] == "sport"]
S += bloc(hors_sport, False)
S += [
    "",
    f"-- 2.b DÉCISION EN ATTENTE — {len(sport)} pièces de SPORT. Le bloc Sport d'une capsule n'est jamais filtré par style (arbitrage du",
    "-- 24/08/2026) : créées, elles entrent dans les capsules de TOUS les styles. Mesuré (scripts/creatif.audit.ts) : avec elles, 32 capsules",
    "-- femme sur 32 et 24 homme sur 24 des autres styles changent ; sans elles, aucune — et les tenues Sport Créatif restent complètes (100 %)",
    "-- avec le sport commun du catalogue. Laissées en commentaire : à décommenter seulement si tu le décides.",
    "-- insert into vestiaire_universel (" + ", ".join(COLS) + ") values",
]
S += bloc(sport, True)
S.append("")
if non_representables:
    S += ["-- NON CRÉÉES — l'app n'a pas de catégorie « ensemble » (un ensemble est un haut et un bas) :"]
    S += [f"--   {x['id']} {x['piece']} ({x['genre']}, {x['saison']})" for x in non_representables]
    S.append("")
if sans_couleur:
    S += ["-- SANS COULEUR — aucune couleur indicative de la référence n'existe dans la palette de l'app (à choisir à la main) :"]
    S += [f"--   {x['id']} {x['piece']} : {x['couleurs']}" for x in sans_couleur]
    S.append("")
open(f"{D}/02-creer-pieces.sql", "w").write("\n".join(S))

A = [
    "-- Style Créatif, étape 2 — 3/3 : ANNULER 01 et 02 (30/10/2026). Ne sert qu'en cas de retour arrière.",
    "-- 02 : les pièces créées sont les seules dont la colonne styles vaut EXACTEMENT « Créatif » (01 n'en crée aucune : il ajoute à des",
    "--      styles existants). À vérifier avant de supprimer :",
    "select id, name, genre from vestiaire_universel where styles = 'Créatif' order by id;",
    "-- delete from vestiaire_universel where styles = 'Créatif';",
    "",
    "-- 01 : retire « , Créatif » ajouté aux articles existants, sans toucher aux autres styles.",
    "-- update vestiaire_universel set styles = replace(styles, ', Créatif', '') where styles like '%, Créatif';",
    "",
]
open(f"{D}/03-annuler.sql", "w").write("\n".join(A))
json.dump({"revue": revue, "non_representables": [x["id"] for x in non_representables], "sans_couleur": [x["id"] for x in sans_couleur]}, open(f"{D}/revue.json", "w"), ensure_ascii=False, indent=1)
# Classeur de revue : une ligne par article à créer, modifiable avant de lancer le SQL.
import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Articles à créer"
ent = ["references", "statut_audit"] + COLS + ["couleurs_indicatives", "origine_couleur", "role_reference"]
ws.append(ent)
for c in ws[1]:
    c.font = Font(bold=True)
    c.fill = PatternFill("solid", fgColor="EFE6D8")
for r in revue:
    ws.append([r[k] for k in ent])
for i in range(1, len(ent) + 1):
    ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = 18
ws.column_dimensions["C"].width = 40
ws.freeze_panes = "D2"
wb.save(f"{D}/02-revue-pieces-a-creer.xlsx")
print(len(lignes), "articles à créer ;", len(genres), "exacts étiquetés ;", len(unisexes), "unisexes en attente ;", len(non_representables), "non représentables ;", len(sans_couleur), "sans couleur")
