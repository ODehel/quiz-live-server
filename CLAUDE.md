# Buzz'O'Live : méthode de travail

Détail complet : `docs/method/WORKFLOW.md` (source de vérité, copie identique dans chaque dépôt).

## Rôles
- Claude fait le code, les tests et les docs, crée la branche, commit, pousse et ouvre la PR.
- Olivier relit la PR, la fusionne en squash et lance les smoke tests. Il ne code pas.

## Une session = une PR unique
Le titre de la session est le titre de la PR et du commit de squash.
Branche `session/<titre-du-commit>`, sans parenthèses (ex. `session/test-questions-list-page-beyond-total`).

## Ouverture
`git status` et `git log -5`. Arbre non propre ou branche autre que `main` : stop et le dire.
Puis branche de session. Script : `scripts/session-open.ps1` (lecture seule).
Agent (espace Linux) : `sh scripts/prepare-agent-workspace.sh` depuis la racine, avant toute commande npm ; il active le hook pre-commit du clone.
Le `PATH` qu'il affiche se préfixe à CHAQUE commande : le shell d'un agent ne garde pas l'environnement d'une commande à l'autre.

## Les deux temps de validation
- **Porte 1 (cadrage)** : proposée par Claude, ≤ 10 lignes. Rien d'écrit avant l'accord.
- **Revue de PR** : Claude ouvre la PR (résumé par fichier, vérifications, points à challenger,
  « ce que j'aurais pu faire autrement et pourquoi j'ai tranché ainsi »). Puis il s'arrête :
  la fusion est faite par Olivier uniquement.

## Règles git
- Staging fichier par fichier, jamais `git add .`.
- Pas de force push, pas de commit direct sur `main`, jamais de fusion de PR par Claude.
- Une PR unique par session : plusieurs commits sur la branche sont acceptés, la PR est
  fusionnée en squash (un seul commit sur `main`).

## Smoke tests
Claude écrit un bloc PowerShell, Olivier le lance, la sortie va dans
`smoke-test-summary.txt` que Claude lit puis supprime.

## Duplication des tests
`npm run duplication:tests` échoue sur tout bloc absent de `.jscpd.tests.baseline.json` (chercher `[NEW]` dans la sortie).
- Régénérer l'état (`npm run duplication:tests:update-baseline`, fichier commité dans la même PR) seulement quand la PR
  retouche, supprime ou déplace un test porteur de blocs connus, ou renomme son fichier. Jamais pour une copie neuve.
- Revue du diff de l'état : chaque empreinte ajoutée correspond à une retouche ou à un déplacement visible dans le diff
  des tests ; un compteur qui augmente, ou un ajout sans cette contrepartie, est une copie admise.
- Pas de commentaire `jscpd:ignore` : il sort le code des deux contrôles de duplication.

## Garde des duplications
`npm run duplication:guard` (étape de CI avant les deux contrôles, décision #108) échoue sur deux faux verts de jscpd :
- une ligne de `src` (production, tests, `test-support`, même dans une chaîne) qui contient `jscpd:ignore` : la sortie dit `fichier:ligne`. Un test qui doit écrire ce marqueur le construit à l'exécution.
- une `.jscpd.tests.json` sous laquelle deux copies neuves ne font plus échouer le contrôle (clé `failOnNewClones` absente, mal orthographiée, ≠ 0 ou mal typée), ou une `.jscpd.production.json` sous laquelle deux copies neuves ne sortent plus en code 1 (clé `exitCode` absente, mal orthographiée, à 0 ou à 2) : la garde rejoue chaque contrôle sur un témoin à la racine de `src` (`[NEW]` exigé pour les tests, `Clone found` pour la production) ; la sortie de jscpd est affichée.
- un contrôle qui analyse moins de fichiers de `src` qu'il ne devrait (`ignore`, `pattern` ou `path` qui en retire, décision #110) : la garde lance jscpd avec `-k 1 -l 1` (sans seuil, il compte tous les fichiers que la configuration laisse passer) et compare `statistics.total.sources` à un compte indépendant des `.ts` et `.mjs` de `src` : tests = `*.test.ts` et `test-support/`, production = le reste. La sortie dit `analyses N files of src, M expected`. Un fichier vide dans `src`, ou une extension nouvelle que jscpd reconnaît, fait échouer ce compte (`DEBTS.md`).
- une clé de `.jscpd.tests.json` ou de `.jscpd.production.json` hors de la liste permise (`allowed` dans `scripts/duplication-guard.mjs`) : seuils (`minTokens`, `minLines`…) et clés inconnues, que jscpd accepte sans effet (code 0), sont refusés. Changer un seuil, ou ajouter `ignoreIdentifiers`, est une décision de conception : la liste et un cas de test changent avec elle.
- Remède : retirer le commentaire (la copie se règle par un `refactor`, jamais par une exclusion) ; remettre la configuration. Ne pas relâcher le motif ni le témoin.
- `src/duplication-guard.test.ts` prouve ces refus ; une option de `.jscpd.tests.json` ou de `.jscpd.production.json` ajoutée, retirée ou changée s'y accompagne d'un cas.

## Complexité des fonctions
`npm run lint` échoue sur toute fonction de complexité cyclomatique supérieure à 10, tests compris.
Remède : extraire des fonctions nommées, sous tests verts. Pas de commentaire `eslint-disable` ni de seuil relevé.

## Couches du hub
`npm run layers` échoue sur tout import qui traverse une couche ; les couches et leurs règles sont dans `.dependency-cruiser.cjs`
(décision #103). Le nom de la règle dans la sortie dit laquelle est enfreinte.
- Remède : déplacer le code, ou injecter l'abstraction depuis la composition (`src/index.ts`) comme le fait `QuestionRouteConfiguration`
  pour le validateur d'UUID. Pas de règle relâchée, pas de dossier ou de fichier ajouté à une couche pour faire passer.
- Un nouveau dossier sous `src/` échoue tant qu'il n'est pas nommé dans la liste des couches ; le nommer est une décision de conception
  (`docs/decisions/DECISIONS.md`), pas un geste de dépannage.
- Pas de `severity` autre que `error`, pas de `--ignore-known`, pas de fichier de violations connues. `src/dependency-layers.test.ts`
  prouve que chaque règle mord ; une règle ajoutée ou changée s'y accompagne d'un cas qui la fait échouer.

## Mutants survivants
`npm run mutation:changed -- --base <réf>` (étape de CI avant les tests, décision #104) échoue quand un mutant survit, ou qu'aucun test ne couvre, dans un fichier de production
modifié depuis `<réf>` : `src/**/*.ts` hors `*.test.ts`, `*.interface.ts`, `src/test-support`, `index.ts` et `seed.ts` (liste dans `stryker.config.json`). Un `Timeout` vaut tué.
La sortie dit `fichier:ligne Statut Mutateur => remplacement`. Pour rejouer un fichier : `npx stryker run --mutate src/<dossier>/<fichier>.ts`.
- Remède : un test du comportement du CDC qui tue le mutant (le commit `spec:` cite le mutant tué). Un mutant équivalent, que nul test ne peut distinguer, se règle en changeant
  le code (`refactor`, comportement observable inchangé, suite verte). Un comportement que le CDC ne décrit pas ne se fige pas par un test pour tuer un mutant : le remonter.
- Interdit : `// Stryker disable` ou `restore` (la garde refuse le commentaire, même dans un fichier dont tous les mutants sont tués), `thresholds.break` abaissé, `ignorers`,
  fichier retiré de `mutate`. `src/mutation-guard.test.ts` prouve ces refus ; une option de `stryker.config.json` ajoutée, retirée ou changée s'y accompagne d'un cas.

## Le réel fait foi
Le handoff (`docs/sessions/`) est une hypothèse. On le confronte à l'état réel à chaque
ouverture ; en cas d'écart, le réel gagne.

## Conventions de commit
`feat` (atteignable en prod), `fix` (correction), `chore` (code dormant, outillage),
`refactor` (comportement inchangé), `docs` (documentation seule).
Description à l'impératif, capacité observable, jamais le mécanisme.
