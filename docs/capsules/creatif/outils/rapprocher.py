"""Rapprochement des capsules Créatif (Excel) avec le catalogue vestiaire_universel (export CSV du 30/10/2026, 627 articles).

Lecture seule : aucun fichier source n'est modifié. Sortie : resultats.json (une ligne par pièce de référence, ses candidats et son statut).
"""
import csv
import json
import re
import sys
import unicodedata

import openpyxl

# Usage : python3 -I rapprocher.py <export vestiaire_universel.csv> <capsule femme.xlsx> <capsule homme.xlsx> <sortie.json>
CSV = sys.argv[1]
XL = {
    "femme": (sys.argv[2], "Pièce", "Occasions Capsela"),
    "homme": (sys.argv[3], "Nom de la pièce", "Occasions"),
}
OUT = sys.argv[4]


def norm(t):
    t = unicodedata.normalize("NFD", str(t or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]+", " ", t.replace("-", " ")).strip()


# Le TYPE d'une pièce : le nom de vêtement, lu en tête du nom (les synonymes se lisent comme un seul type).
TYPES = [
    ("t shirt technique", "haut_technique"), ("t shirt", "tshirt"), ("tee shirt", "tshirt"), ("debardeur", "debardeur"), ("brassiere", "brassiere"),
    ("haut technique", "haut_technique"), ("haut thermique", "haut_technique"), ("top", "top"), ("tunique", "tunique"),
    ("blouse", "blouse"), ("surchemise", "surchemise"), ("chemise", "chemise"), ("polo", "polo"), ("sous pull", "pull"), ("pull", "pull"), ("cardigan", "cardigan"), ("gilet", "cardigan"), ("hoodie", "sweat"),
    ("sweat", "sweat"), ("jogging", "jogging"), ("jogger", "jogging"), ("pantalon jogger", "jogging"), ("pantalon de sport", "jogging"),
    ("legging", "legging"), ("bermuda", "short"), ("combishort", "combishort"), ("short", "short"), ("jean", "jean"),
    ("chino", "pantalon"), ("pantalon", "pantalon"), ("jupe", "jupe"), ("robe", "robe"), ("combinaison", "combinaison"),
    ("ensemble", "ensemble"), ("blazer", "blazer"), ("blouson", "veste"), ("veste", "veste"), ("doudoune", "doudoune"), ("manteau", "manteau"),
    ("baskets", "baskets"), ("sneakers", "baskets"), ("ballerines", "ballerines"), ("bottines", "bottines"), ("bottes", "bottes"),
    ("mocassins", "mocassins"), ("derbies", "derbies"), ("mules", "mules"), ("sandales", "sandales"), ("espadrilles", "espadrilles"),
    ("sac", "sac"), ("bijoux", "bijou"), ("bijou", "bijou"), ("collier", "bijou"), ("boucles", "bijou"), ("creoles", "bijou"),
    ("bracelet", "bijou"), ("bague", "bijou"), ("foulard", "foulard"), ("bandana", "foulard"), ("echarpe", "echarpe"),
    ("ceinture", "ceinture"), ("lunettes", "lunettes"), ("bonnet", "bonnet"), ("casquette", "casquette"), ("gants", "gants"),
]


def type_de(nom):
    n = " " + norm(nom) + " "
    # Un pantalon de jogging est un jogging (« Pantalon de jogger / Jogging structuré ») : le type précis l'emporte sur « pantalon ».
    if " jogger " in n or " jogging " in n:
        return "jogging"
    meilleur = None
    for cle, t in TYPES:
        i = n.find(" " + cle + " ")
        if i >= 0 and (meilleur is None or i < meilleur[0] or (i == meilleur[0] and len(cle) > meilleur[2])):
            meilleur = (i, t, len(cle))
    return meilleur[1] if meilleur else None


# Ce qui rend une pièce « créative » dans les deux référentiels : motif, couleur, ligne ou détail affirmé.
# Familles FINES (30/10/2026, après relecture) : une chemise à carreaux ne porte pas un « imprimé artistique », un sac structuré n'est pas
# « sculptural ». Une correspondance exacte exige la même famille fine, pas seulement « un motif ».
QUALIFS = {
    "graphique": ["graphique", "graphiques", "geometrique", "geometriques", "illustre", "illustree", "illustration", "brode", "brodee"],
    "artistique": ["artistique", "arty", "abstrait", "auteur"],
    "imprime": ["imprime", "imprimee", "imprimes", "imprimees", "motif", "motifs"],
    "fleuri": ["fleuri", "fleurie", "floral", "florale"],
    "carreaux": ["carreaux", "tartan", "vichy"],
    "rayures": ["rayures", "raye", "rayee", "rayes"],
    "jacquard": ["jacquard"],
    "color_block": ["color", "colorblock", "bicolore", "bicolores", "empiecements", "panneaux", "patchwork"],
    "contraste": ["contraste", "contrastee", "contrastes", "contrastees", "contrastante", "contrastants", "decale", "decalee", "decales", "decalees"],
    "colore": ["colore", "coloree", "colores", "colorees"],
    "sculptural": ["sculptural", "sculpturale", "sculpturales", "architectural", "architecturale", "statement"],
    "asymetrique": ["asymetrique", "drape", "drapee"],
    "velours": ["cotele", "velours"],
    "ajoure": ["ajoure", "ajouree"],
    "tresse": ["tresse", "tressee"],
}


def qualifs_de(nom):
    mots = set(norm(nom).split())
    return {q for q, ms in QUALIFS.items() if mots & set(ms)}


# La NATURE d'une pièce (matière ou usage) : une référence qui la précise n'est satisfaite que par un article qui la porte. Une veste en
# cuir n'est pas une veste en jean ; un pantalon homewear n'est pas un pantalon tailleur (relecture du 30/10/2026).
NATURES = {
    "cuir": ["cuir"], "denim": ["denim", "jean"], "lin": ["lin"], "velours": ["velours"], "maille": ["maille", "tricot"],
    "laine": ["laine"], "satin": ["satin", "satinee", "satine"], "homewear": ["homewear", "detente", "interieur"],
    "cargo": ["cargo"], "palazzo": ["palazzo"], "barrel": ["barrel"], "wide": ["wide", "large"], "brut": ["brut"],
    "technique": ["technique", "thermique", "sport"], "tailleur": ["tailleur"], "soiree": ["soiree"], "colonne": ["colonne"],
    "portefeuille": ["portefeuille"], "chemise": ["chemise"], "pull": ["pull"], "plisse": ["plissee", "plisse"], "trapeze": ["trapeze"],
    "longue": ["longue", "maxi"], "midi": ["midi"], "oversize": ["oversize"], "montant": ["montantes", "montante", "montants"],
}


def natures_de(nom, t):
    mots = set(norm(nom).split())
    # Le mot qui nomme le type ne compte pas comme nature (« jean » d'un jean, « chemise » d'une chemise, « pull » d'un pull).
    return {k for k, ms in NATURES.items() if mots & set(ms) and k != t and not (k == "denim" and t == "jean")}


SAISONS = {"Printemps", "Été", "Automne", "Hiver"}


def saisons_catalogue(v):
    v = (v or "").strip()
    if v == "Toutes saisons":
        return set(SAISONS)
    return {s.strip() for s in v.split(",") if s.strip() in SAISONS}


# Clé : (pièce de référence, article proposé). Une correction ne vaut que pour l'article relu, jamais pour un autre candidat.
RELECTURE = {
    ("F-CRE-ÉTÉ-16", "547"): ("POTENTIAL_MATCH", "relecture : une robe courte ample brodée n'est pas une robe chemise graphique"),
    ("H-CR-HIV-30", "625"): ("POTENTIAL_MATCH", "relecture : un sac week-end (voyage) n'est pas le sac structuré du quotidien de la référence"),
}

catalogue = list(csv.DictReader(open(CSV, encoding="utf-8-sig")))
for a in catalogue:
    a["_type"] = type_de(a["name"]) or type_de(a["sous_type"])
    a["_q"] = qualifs_de(a["name"]) | qualifs_de(a["sous_type"]) | qualifs_de(a["matiere"])
    a["_saisons"] = saisons_catalogue(a["saison_capsule"])
    a["_mots"] = set(norm(a["name"] + " " + a["matiere"]).split())

resultats = []
for genre, (fichier, col_nom, col_occ) in XL.items():
    ws = openpyxl.load_workbook(fichier, data_only=True)["Catalogue Créatif"]
    lignes = list(ws.iter_rows(values_only=True))
    entete = lignes[0]
    for brut in lignes[1:]:
        if not brut[0]:
            continue
        p = dict(zip(entete, brut))
        nom = p[col_nom]
        t = type_de(nom)
        q = qualifs_de(nom)
        saison = p["Saison"]
        meme_genre = [a for a in catalogue if a["genre"] in (genre, "unisexe")]
        autre_genre = [a for a in catalogue if a["genre"] not in (genre, "unisexe")]
        mots = set(norm(nom).split())

        VIDES = {"a", "de", "en", "et", "ou", "le", "la", "les", "du", "des", "au", "aux"}

        def score(a):
            return (
                (3 if a["_type"] == t else 0)
                + 2 * len(a["_q"] & q)
                + 1.5 * len((a["_mots"] & mots) - VIDES)
                + (1 if saison in a["_saisons"] else 0)
                # Un sous-pull est un col roulé fin : la forme la plus proche dans le catalogue.
                + (2 if "sous" in mots and {"col", "roule"} <= a["_mots"] else 0)
            )

        nat = natures_de(nom, t)
        tous_du_type = sorted((a for a in meme_genre if t and a["_type"] == t), key=score, reverse=True)
        # « A ou B » (« Jean barrel ou wide-leg ») : l'une des natures suffit.
        alternative = " ou " in " " + norm(nom) + " "

        def porte(a):
            n = natures_de(a["name"] + " " + a["sous_type"] + " " + a["matiere"], a["_type"])
            return bool(nat & n) if (alternative and nat) else nat <= n

        cands = [a for a in tous_du_type if porte(a)]
        en_saison = [a for a in cands if saison in a["_saisons"]]
        # Exacte : TOUS les traits du nom de référence se retrouvent dans l'article ; sans trait, le même vocabulaire de coupe.
        avec_q = [a for a in en_saison if q <= a["_q"]] if q else [a for a in en_saison if (mots - VIDES) <= a["_mots"]]
        if not t:
            statut, raison, retenu = "À_EXAMINER", "type de pièce non reconnu", None
        elif avec_q:
            statut, raison, retenu = "EXACT_MATCH?", "même type, même genre, saison couverte, mêmes traits : " + (", ".join(sorted(q)) or "même coupe"), avec_q[0]
        elif en_saison:
            statut, raison, retenu = "POTENTIAL_MATCH", "même type, même genre, saison couverte, sans le trait créatif (" + (", ".join(sorted(q)) or "aucun trait lu") + ")", en_saison[0]
        elif cands:
            statut, raison, retenu = "INCOMPATIBLE", "même type et même genre, mais saison non couverte (" + ", ".join(sorted(cands[0]["_saisons"])) + ")", cands[0]
        elif tous_du_type:
            statut, raison, retenu = "MISSING", "le type existe, mais aucun article ne porte la nature demandée (" + ", ".join(sorted(nat)) + ")", None
        elif any(a["_type"] == t for a in autre_genre):
            statut, raison, retenu = "INCOMPATIBLE", "le type n'existe qu'en " + ("homme" if genre == "femme" else "femme"), next(a for a in autre_genre if a["_type"] == t)
        else:
            statut, raison, retenu = "MISSING", "aucune pièce de ce type pour ce genre", None
        # Manches : une référence à manches longues n'est pas satisfaite par un article à manches courtes (et réciproquement).
        manches_ref = norm(p.get("Longueur des manches"))
        if statut == "EXACT_MATCH?" and retenu and retenu["manches"]:
            if (manches_ref.startswith("longues") and retenu["manches"] in ("courtes", "sans")) or (manches_ref.startswith("courtes") and retenu["manches"] == "longues"):
                statut, raison = "POTENTIAL_MATCH", "même type et mêmes traits, mais manches " + retenu["manches"] + " (référence : " + str(p.get("Longueur des manches")) + ")"
        # Relecture pièce par pièce (30/10/2026) : correspondances automatiques écartées, raison écrite.
        if retenu and (p["ID"], retenu["id"]) in RELECTURE:
            statut, raison = RELECTURE[(p["ID"], retenu["id"])]
        if statut == "EXACT_MATCH?":
            statut = "EXACT_MATCH"
        resultats.append({
            "genre": genre,
            "id": p["ID"],
            "saison": saison,
            "categorie": p["Catégorie"],
            "piece": nom,
            "type": t,
            "traits": sorted(q),
            "occasions": [o.strip() for o in str(p.get(col_occ) or "").split(";") if o.strip()],
            "role": p.get("Rôle") or p.get("Rôle dans la capsule"),
            "couleurs": p.get("Couleurs indicatives"),
            "matieres": p.get("Matières indicatives"),
            "manches": p.get("Longueur des manches"),
            "coupe": p.get("Coupe normalisée"),
            "statut_auto": statut,
            "raison": raison,
            "retenu": None if not retenu else {"id": retenu["id"], "name": retenu["name"], "genre": retenu["genre"], "category": retenu["category"], "saisons": retenu["saison_capsule"], "styles": retenu["styles"], "statement": retenu["statement"]},
            "autres": [{"id": a["id"], "name": a["name"], "saisons": a["saison_capsule"]} for a in (avec_q or en_saison or cands)[1:4]],
        })

json.dump(resultats, open(OUT, "w"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(resultats), Counter((r["genre"], r["statut_auto"]) for r in resultats))
