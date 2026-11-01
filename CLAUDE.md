# Buzz'O'Live : méthode de travail

Détail complet : `docs/method/WORKFLOW.md` (source de vérité, copie identique dans chaque dépôt).

## Rôles
- Claude fait le code, les tests et les docs, crée la branche, commit, pousse et ouvre la PR.
- Olivier relit la PR, la fusionne en squash et lance les smoke tests. Il ne code pas.

## Une session = un commit
Le titre de la session est le titre du commit et de la PR.
Branche `session/<titre-du-commit>`, sans parenthèses (ex. `session/test-questions-list-page-beyond-total`).

## Ouverture
`git status` et `git log -5`. Arbre non propre ou branche autre que `main` : stop et le dire.
Puis branche de session. Script : `scripts/session-open.ps1` (lecture seule).

## Les deux temps de validation
- **Porte 1 (cadrage)** : proposée par Claude, ≤ 10 lignes. Rien d'écrit avant l'accord.
- **Revue de PR** : Claude ouvre la PR (résumé par fichier, vérifications, points à challenger,
  « ce que j'aurais pu faire autrement et pourquoi j'ai tranché ainsi »). Puis il s'arrête :
  la fusion est faite par Olivier uniquement.

## Règles git
- Staging fichier par fichier, jamais `git add .`.
- Pas de force push, pas de commit direct sur `main`, jamais de fusion de PR par Claude.
- Un seul commit par session (la PR est fusionnée en squash).

## Smoke tests
Claude écrit un bloc PowerShell, Olivier le lance, la sortie va dans
`smoke-test-summary.txt` que Claude lit puis supprime.

## Le réel fait foi
Le handoff (`docs/sessions/`) est une hypothèse. On le confronte à l'état réel à chaque
ouverture ; en cas d'écart, le réel gagne.

## Conventions de commit
`feat` (atteignable en prod), `fix` (correction), `chore` (code dormant, outillage),
`refactor` (comportement inchangé), `docs` (documentation seule).
Description à l'impératif, capacité observable, jamais le mécanisme.
