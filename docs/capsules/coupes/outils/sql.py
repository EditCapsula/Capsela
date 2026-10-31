"""Lot 5 — SQL des coupes à partir du fichier validé (31/10/2026).

Usage : python3 -I sql.py coupes-catalogue-a-valider.xlsx sql/
Colonne « validation » : vide ou « Oui » → la coupe proposée ; « Non » → rien ; Serré / Ajusté / Ample → cette valeur.
Le SQL ne remplit que les coupes VIDES de pièces non gelées : il n'écrase jamais une valeur existante.
"""
import sys
from openpyxl import load_workbook

XLSX, DOSSIER = sys.argv[1], sys.argv[2].rstrip("/")
VALEURS = {"serré": "Serré", "ajusté": "Ajusté", "ample": "Ample"}
ws = load_workbook(XLSX).active
retenues = []
for r in ws.iter_rows(min_row=2, values_only=True):
    pid, cat, nom, _g, _s, _m, proposee, _motif, validation = r[:9]
    v = (validation or "").strip().lower()
    if v == "non":
        continue
    coupe = VALEURS.get(v) or (proposee if v in ("", "oui") else None)
    if not coupe:
        continue
    if not str(pid).isdigit():
        raise SystemExit(f"Pièce sans identifiant : {nom}")
    retenues.append((int(pid), coupe, nom))
retenues.sort()
vals = "\n".join(f"  ({i}, '{c}'){',' if k < len(retenues) - 1 else ' '}  -- {n.replace(chr(39), ' ')}" for k, (i, c, n) in enumerate(retenues))
ids = ", ".join(str(i) for i, _, _ in retenues)
open(f"{DOSSIER}/01-completer-coupes.sql", "w").write(f"""-- Lot 5 — compléter la colonne `coupe` du catalogue (docs/capsules/coupes/README.md).
-- {len(retenues)} pièces. Ne remplit QUE les coupes vides de pièces non gelées : aucune valeur existante n'est écrasée.

update public.vestiaire_universel v
set coupe = x.coupe
from (values
{vals}
) as x(id, coupe)
where v.id = x.id
  and (v.coupe is null or btrim(v.coupe) = '')
  and v.frozen = false
returning v.id, v.name, v.coupe;

-- Contrôle : coupes par valeur après l'exécution (attendu : Ample et Ajusté augmentés, Serré inchangé).
-- select coupe, count(*) from public.vestiaire_universel group by coupe order by 2 desc;
""")
open(f"{DOSSIER}/02-annuler.sql", "w").write(f"""-- Annulation du lot 5 : remet à vide les seules coupes que 01 a écrites (même identifiants, même valeur).
update public.vestiaire_universel v
set coupe = null
from (values
{vals}
) as x(id, coupe)
where v.id = x.id and v.coupe = x.coupe
returning v.id, v.name;
""")
print(len(retenues), "pièces ; ids :", ids[:120], "…")
