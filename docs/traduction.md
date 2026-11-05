# Capsela en anglais

Demandé le 05/11/2026 : « l'app entièrement en anglais ». Module : `src/lib/langue.ts` ; table : `src/lib/traductions/en.ts`.

## Le principe

- **Le français est la clé.** Le code garde ses textes en français, passés à `t("…")`. La table anglaise associe à chacun sa
  traduction. Un texte absent de la table s'affiche en français (et un avertissement s'écrit dans la console en développement).
- **Les nombres** : `tn(n, "{n} pièce", "{n} pièces")` — chaque langue applique sa règle (français : 0 et 1 au singulier ;
  anglais : 1 seulement).
- **Les variables** : `t("Ma Capsule {saison}", { saison })` ; la table traduit le modèle entier, `{saison}` compris.
- **Les constantes de module** (listes d'onglets, libellés de catégories…) marquent leurs textes avec `aTraduire("…")` et l'écran
  les passe à `t()` au rendu. `t()` ne s'appelle jamais au chargement d'un module : la langue n'y est pas encore fixée.
- **Une langue par lancement** : fixée avant le premier rendu (`initialiserLangue`, App.tsx), d'après le choix des Préférences
  (gardé sur l'appareil), sinon la langue du téléphone (français s'il est en français, anglais sinon). En changer recharge l'app.
- **Test de couverture** (`langue.test.ts`) : il relève chaque `t("…")`, `tn(…)` et `aTraduire("…")` des sources et échoue si la
  table n'en traduit pas un. Un texte marqué est donc toujours traduit.

## L'anglais reste fermé tant que la traduction n'est pas finie

Tant que `NEXT_PUBLIC_ANGLAIS` ne vaut pas « 1 » (Vercel, workflows Android et iOS), l'app est en français pour tout le monde, et
la ligne « Langue » des Préférences reste un simple affichage. En mode démo, le choix est ouvert pour la vérification.

## Le ton

Le tutoiement devient « you ». Les règles de CLAUDE.md valent en anglais : aucun vocabulaire morphologique négatif (interdits :
hide, conceal, camouflage, correct, flaw, flatter/unflattering, slimming, make … look bigger/smaller), pas d'emoji. À faire relire
par une personne de langue maternelle anglaise avant l'ouverture.

## Avancement

| Lot | Contenu | État |
|---|---|---|
| Socle | `langue.ts`, table, test, choix dans les Préférences | fait (05/11/2026) |
| Navigation | barre du bas | fait |
| Écrans | un par un, du parcours d'arrivée aux écrans secondaires | en cours |
| Phrases du moteur | `src/lib` (raisons, explications, occasions, accords) | à faire |
| Catalogue | noms des pièces, couleurs, catégories, styles (colonne anglaise : migration à valider) | à faire |
| Serveur | fonctions Edge, e-mails Supabase, notifications | à faire |
| Légal et stores | CGU, confidentialité (relecture juridique), fiches Play et App Store | à faire |
