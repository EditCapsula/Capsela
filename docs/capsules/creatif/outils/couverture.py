"""Couverture des occasions par les capsules Créatif : 8 occasions × 4 saisons × 2 genres, à trois niveaux, dans la même exécution.

A — la capsule de référence (Excel), telle qu'écrite ;
B — ce que le catalogue porte déjà exactement (EXACT_MATCH) ;
C — B + les correspondances potentielles (POTENTIAL_MATCH), si elles étaient toutes validées.

Une occasion d'une saison est COUVERTE quand une tenue complète s'y compose : (un haut et un bas) ou une pièce unique, plus des chaussures.
Les occasions d'une pièce sont celles de la référence Excel (c'est elle qui serait portée au catalogue) ; le moteur n'est pas exécuté.
"""
import json
import sys

R = json.load(open(sys.argv[1]))
OUT = sys.argv[2]

OCC = {
    "Quotidien": "quotidien", "Travail": "travail_formel", "Date": "date", "Soirée": "soiree", "Sport": "sport",
    "Cocooning": "cocooning", "Voyage": "voyage", "Cérémonie": "evenement_perso",
}
LIBELLES = {
    "quotidien": "Quotidien", "travail_formel": "Travail", "date": "Rendez-vous", "soiree": "Soirée", "sport": "Sport",
    "cocooning": "Cocooning", "voyage": "Voyage", "evenement_perso": "Événement / Cérémonie",
}
SAISONS = ["Printemps", "Été", "Automne", "Hiver"]
ROLE = {
    "haut": {"tshirt", "debardeur", "brassiere", "haut_technique", "top", "tunique", "blouse", "chemise", "surchemise", "polo", "pull", "sous_pull", "sweat"},
    "bas": {"jogging", "legging", "short", "jean", "pantalon", "jupe"},
    "unique": {"robe", "combinaison", "combishort", "ensemble"},
    "chaussures": {"baskets", "ballerines", "bottines", "bottes", "mocassins", "derbies", "mules", "sandales", "espadrilles"},
    # Une surchemise est rangée dans les hauts au catalogue (category « hauts ») : elle compte comme un haut.
    "couche": {"blazer", "veste", "doudoune", "manteau", "cardigan"},
}


def role(t):
    return next((r for r, ts in ROLE.items() if t in ts), "accessoire")


hors_taxonomie = sorted({o for x in R for o in x["occasions"] if o not in OCC})
# Pièces TRANSVERSALES du catalogue, communes à tous les styles (styles = les huit) : elles ne figurent pas dans la capsule de référence,
# mais le moteur les tire pour ces occasions — chaussures d'intérieur seules admises en Cocooning (R-B13), baskets de sport en Sport.
# Elles ne servent au style Créatif que si « Créatif » est ajouté à leur colonne styles (plan d'intégration) : mesuré à part (« +T »).
TRANSVERSALES = {
    ("femme", "cocooning"): "481 Chaussures d'intérieur", ("homme", "cocooning"): "520 Chaussures d'intérieur",
    ("femme", "sport"): "971 Baskets de sport", ("homme", "sport"): "972 Baskets de sport",
}
niveaux = {"A": lambda x: True, "B": lambda x: x["statut_auto"] == "EXACT_MATCH", "C": lambda x: x["statut_auto"] in ("EXACT_MATCH", "POTENTIAL_MATCH")}
resultat = {"hors_taxonomie": {o: [x["id"] for x in R if o in x["occasions"]] for o in hors_taxonomie}, "cellules": []}
for genre in ("femme", "homme"):
    for saison in SAISONS:
        for occ_xl, occ in OCC.items():
            cellule = {"genre": genre, "saison": saison, "occasion": occ, "libelle": LIBELLES[occ]}
            for n, garde in niveaux.items():
                ps = [x for x in R if x["genre"] == genre and x["saison"] == saison and occ_xl in x["occasions"] and garde(x)]
                roles = {}
                for x in ps:
                    roles.setdefault(role(x["type"]), []).append(x["id"])
                complete = bool(("haut" in roles and "bas" in roles) or "unique" in roles) and "chaussures" in roles
                manque = []
                if not (("haut" in roles and "bas" in roles) or "unique" in roles):
                    manque.append("haut + bas, ou pièce unique" if not ("haut" in roles or "bas" in roles) else ("bas" if "haut" in roles else "haut"))
                if "chaussures" not in roles:
                    manque.append("chaussures")
                cellule[n] = {"pieces": len(ps), "complete": complete, "manque": manque, "couche": "couche" in roles, "roles": {k: len(v) for k, v in roles.items()}}
                t = TRANSVERSALES.get((genre, occ))
                complete_t = complete or (manque == ["chaussures"] and t is not None)
                cellule[n + "+T"] = {"complete": complete_t, "manque": [] if complete_t else manque, "transversale": t if (t and not complete and complete_t) else None}
            resultat["cellules"].append(cellule)

json.dump(resultat, open(OUT, "w"), ensure_ascii=False, indent=1)
for genre in ("femme", "homme"):
    for n in ("A", "A+T", "B", "B+T", "C", "C+T"):
        c = [x for x in resultat["cellules"] if x["genre"] == genre]
        print(genre, n, sum(x[n]["complete"] for x in c), "/", len(c))
print("hors taxonomie :", resultat["hors_taxonomie"])
