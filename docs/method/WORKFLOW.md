# Méthode de travail par session

Source de vérité de la méthode. Copie **identique** dans chaque dépôt Buzz'O'Live
(quiz-live-server, quiz-live-angular, quiz-live-buzzer). En cas de divergence entre
copies, celle du dépôt de travail fait foi pour la session ; on réaligne ensuite les autres.

## Principe

**Le réel fait foi, pas le handoff.** Le handoff est une hypothèse de continuité :
à chaque ouverture, on la confronte à l'état réel (git, tests, fichiers) et c'est
le réel qui tranche.

## Rôles

- **Claude** fait tout : code, tests, docs. Il crée la branche de session, commit, pousse
  et ouvre la PR. Il ne fusionne **jamais** une PR.
- **Olivier** relit la PR, la fusionne en squash, lance les smoke tests. Il ne code pas.

## Cycle d'une session

Une session = un commit = une branche `session/<titre-du-commit>` = une PR.
Le titre de la session est le titre du commit et de la PR.
Nom de branche sans parenthèses (ex. `session/test-questions-list-page-beyond-total`).

1. **Ouverture (scriptée)** : `scripts/session-open.ps1`
   - `git status` et `git log -5`.
   - Arbre non propre ou branche autre que `main` : stop, on le signale.
   - Création de la branche de session.
   - Confrontation du handoff précédent à l'état réel.
2. **Porte 1 : cadrage** (≤ 10 lignes), proposé par Claude. Cible de la session et
   choix de conception. Rien n'est écrit avant l'accord d'Olivier.
3. **Réalisation** sur la branche de session.
4. **Vérification** : tests, type-check, lint, mutations, puis smoke tests (voir ci-dessous).
5. **PR** : Claude pousse la branche et ouvre la PR, avec :
   - résumé par fichier et sorties des vérifications ;
   - points à challenger ;
   - section « ce que j'aurais pu faire autrement et pourquoi j'ai tranché ainsi ».
   Puis STOP : les corrections demandées en revue sont appliquées sur la branche
   (le squash garde un seul commit).
6. **Fusion** par Olivier, en squash. La branche de session est supprimée.
7. **Clôture** : voir « Handoff ».

## Smoke tests

Claude n'a pas PowerShell. Il écrit un bloc de commandes, Olivier le lance. La sortie va
dans `smoke-test-summary.txt` à la racine du dossier de travail d'Olivier ; Claude la lit
puis supprime le fichier.

## Handoff

- Fichiers dans `docs/sessions/` du dépôt travaillé, nommés `yyyy-MM-dd-HHmm.md`
  (modèle : `TEMPLATE.md`). Générés par `scripts/session-close.ps1 -Title "<titre>"`.
- Le handoff est ajouté à la branche de session, donc à la PR : il est fusionné avec
  le commit de la session (pas de second commit).
- Pas de handoff pour les sessions de workflow.
- Le SHA d'arrivée noté dans un handoff est celui de la branche de session. Après un squash
  il n'existe plus sur `main` : `session-open` le signale alors comme « inconnu, pas de comparaison ».

## Règles git

- Staging **fichier par fichier**, jamais `git add .`.
- Pas de force push, pas de commit direct sur `main`.
- Identité : celle d'Olivier ; le message porte les lignes `Co-Authored-By` et `Claude-Session`.
- **Un seul commit par session** (squash à la fusion).
- Les PR sont lancées sur `pull_request` : la CI du dépôt tourne avant la fusion.

## Pièges connus

- `core.autocrlf=true` chez Olivier : `git status` côté Claude voit de faux « modifiés »
  (CRLF). Restreindre chaque `git diff` à un fichier.
- `.claude/settings.local.json` est ignoré globalement chez Olivier, pas côté Claude :
  il apparaît non suivi, ne jamais l'indexer.
- Un git qui laisse un verrou (`.lock`) : `mv` le fichier plutôt que `rm`, sauf si la
  permission de suppression a été accordée.
- Clone en profondeur 1 : ajouter `+refs/heads/session/*:refs/remotes/origin/session/*`
  aux refspecs de `origin` pour que le suivi de branche fonctionne.

## Conventions

- **Types de commit**
  - `feat` : capacité atteignable en production.
  - `fix` : correction d'un comportement incorrect.
  - `chore` : code dormant (pas encore atteignable) ou outillage.
  - `refactor` : comportement inchangé.
  - `docs` : documentation seule.
- **Description** : à l'impératif, décrit la capacité observable, jamais le mécanisme.
- **Test né vert** = spec test : mutation obligatoire avant commit.
- **YAGNI** : on n'écrit que ce que la cible de la session exige.
- **Ordre** : la logique de `lib/` précède l'adaptateur de `src/`.
- **Dette et décisions** : `DEBTS.md` et `docs/decisions/DECISIONS.md` sont mis à jour
  dans le commit de session.
