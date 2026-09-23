<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:regle-audit -->
# Règle d'audit — mesure et arbitrage

Contraignante, pas indicative. Arrêtée le 29/08/2026 après que trois
conclusions de la phase 15 se sont révélées fausses non par erreur d'analyse,
mais parce qu'une mesure avait été prise dans de mauvaises conditions puis
transportée hors de son périmètre.

1. Geler explicitement la configuration expérimentale avant toute mesure.
2. Identifier les leviers testés, ceux qui restent fixes, et leurs
   interactions potentielles.
3. Mesurer la baseline, chaque levier seul, et les combinaisons pertinentes —
   dans la même exécution, sur les mêmes données.
4. Ne jamais extrapoler le résultat d'un scénario à un autre.
5. Étiqueter chaque conclusion : **DÉMONTRÉ**, **NON DÉMONTRÉ**, ou
   **ARBITRAGE ÉDITORIAL**.
6. Un arbitrage éditorial ne vaut qu'au niveau de granularité auquel il a été
   instruit.
7. Une décision prise sur une pièce, un style, une saison ou une occasion ne
   se généralise pas à un autre périmètre sans nouvelle justification.
8. Toute mesure nouvelle susceptible d'invalider une conclusion impose de
   rouvrir les conclusions qui en dépendent avant toute écriture en
   production.

## Les trois erreurs que cette règle existe pour empêcher

- « Le retag rend 3 cellules » a servi à déclasser le retag, alors que ce
  chiffre avait été mesuré sans le correctif saisonnier qui conditionnait son
  effet. Avec le correctif : 11 cellules. Violation des points 3 et 4.
- « #100891 n'entre dans aucune capsule » a servi à l'exclure du jeu de
  retags, alors que cette mesure avait été prise sans retag — or le retag
  modifie les occasions déclarées, donc le rang de sélection. Retaguée, elle
  entre aux quatre saisons et vaut 4 cellules. Violation des points 3 et 4.
- Un ensemble d'occasions instruit sur deux robes chemise a été étendu à cinq
  pièces sans examen individuel, dont une robe longue bohème pour laquelle il
  était faux. Violation des points 6 et 7.

## Conséquence pratique pour les scripts d'audit

Un audit qui compare un avant et un après doit mesurer les deux **dans la même
exécution**, sur le même pool, en ne faisant varier que le levier étudié. Les
paramètres optionnels du moteur (`capsuleSeason`, `SelectionStrategy`) existent
pour cela : les omettre reproduit le comportement d'origine sans dupliquer le
pipeline.
<!-- END:regle-audit -->

<!-- BEGIN:regle-verification -->
# Règle de vérification — avant tout commit

Contraignante, pas indicative. Arrêtée le 23/09/2026 après deux CI rouges
provoquées non par une erreur d'analyse, mais par une chaîne de vérification
locale incomplète — annoncée comme complète les deux fois.

1. La seule vérification qui compte est **`npm run verify`** : elle enchaîne
   exactement les quatre étapes de `ci.yml`, dans son ordre — `typecheck`,
   `lint`, `test`, `build`. Les lancer à la main expose à en oublier une.
2. **Ne jamais tuber la sortie** dans `tail`, `head` ou `grep` : le code de
   sortie renvoyé est alors celui du filtre, pas celui de l'étape. Rediriger
   vers un fichier et lire le code de sortie séparément.
3. Annoncer « tests verts » ne vaut que pour les tests. Tant que `verify`
   n'est pas passé en entier, la formule exacte est « tests verts, reste non
   vérifié ».
4. `verify` n'est pas identique à la CI : celle-ci part d'un `npm ci` sur un
   lockfile propre. Un `node_modules` local dérivé peut donc masquer un
   échec d'installation. En cas de doute, `npm ci` d'abord.
5. **`verify` échoue sur les erreurs ESLint, pas sur les avertissements** —
   la CI non plus. Un avertissement reste une trace à nettoyer, mais il ne
   sera signalé par rien : le lire dans la sortie fait partie de l'étape,
   pas seulement son code de sortie. Vérifié : une variable inutilisée
   (avertissement) laisse `verify` à 0 et va jusqu'au bout des quatre
   étapes ; une apostrophe non échappée en JSX (erreur) le met à 1 et
   l'arrête à la deuxième.

## Les deux erreurs que cette règle existe pour empêcher

- PR #11. `npx vitest run 2>&1 | tail -3 && npx next build` : le tube renvoie
  le code de sortie de `tail`, et `tail -3` a coupé la ligne d'échec. « 458
  tests » a été annoncé sans que le résultat ait été lu. Violation du point 2.
- PR #13. `typecheck`, `test` et `build` lancés, `lint` jamais — alors que la
  CI le lance en deuxième position. Deux problèmes ESLint sont passés, dont
  une erreur bloquante. « 474 tests et build verts » était exact et ne
  prouvait rien. Violation des points 1 et 3.

## Ce que la règle ne couvre pas

`verify` ne rend pas une capture d'écran. Tout changement visuel se vérifie en
rendu réel, aux largeurs utiles, et les cas limites ont leur propre mesure —
cf. la règle d'audit ci-dessus, point 4 : un scénario ne s'extrapole pas à un
autre.
<!-- END:regle-verification -->
