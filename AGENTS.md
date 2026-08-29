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
