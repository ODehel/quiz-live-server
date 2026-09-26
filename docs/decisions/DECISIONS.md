# Décisions de conception — quiz-live-server

Journal append-only des décisions de conception tranchées en session, avec le fait qui les a forcées. Une décision revue donne une **nouvelle** entrée qui référence l'ancienne, jamais une réécriture. Seules les décisions de *conception* y figurent (contrat, emplacement, responsabilité) ; les leçons de méthode restent dans les récaps.

Format : **Contexte** (le fait qui a forcé le choix) · **Décision** · **Conséquences** (ce que ça engage, dettes créées).

---

## #1 — Le lecteur valide la forme d'un UUID, le producteur garantit sa version

*Commit `ab00472` — US-005/CA-24.*

**Contexte.** `GET /api/v1/questions/:id` doit répondre `400 INVALID_UUID` sur un id « pas un UUID valide » (CA-24). Réutiliser `Uuidv7Validator` (déjà employé par le `POST` sur `theme_id`) a fait tomber CA-23 : l'id « inexistant » du curl de la spec, `018e4f5a-0000-0000-0000-000000000000`, a un nibble de version `0` — bien formé, mais pas v7.

**Décision.** Le `GET` valide la **forme** (`8-4-4-4-12` hexadécimal, toute version) via un nouveau `UuidFormatValidator`, distinct de `Uuidv7Validator`. Ce n'est pas au lecteur de vérifier la version : c'est le `POST` qui génère les ids et garantit v7. Exiger v7 en lecture ferait fuir une contrainte interne dans le contrat public. L'id du test CA-23 reste celui de la spec.

**Conséquences.** Deux validateurs derrière la même interface `UuidValidator`. Le `POST` exige encore v7 sur `theme_id` (CA-8 dit aussi « UUID valide ») : question ouverte, à trancher sous son propre rouge — si la même logique s'applique, `Uuidv7Validator` n'aura plus de consommateur dans les routes. Cf. `DEBTS.md`, questions/.

---

## #2 — Les erreurs génériques vivent dans `common/`, les erreurs métier restent locales

*Commit `89e51ef` — US-005/CA-23.*

**Contexte.** CA-23 demande un `404` avec le code **standard** `NOT_FOUND` (`error-codes.md`), là où les thèmes utilisent `ThemeNotFoundError` → `THEME_NOT_FOUND` (code non standard, format court). Il fallait choisir où faire naître l'exception que le service lève.

**Décision.** `NotFoundError` est créée dans `common/` — erreur générique, comme le code qu'elle porte. C'est la première classe dans `common/` (qui ne contenait que des interfaces et constantes). Elle reste **vide** (`extends Error {}`) : le message et la ressource sont produits par la route dans le body, aucun rouge n'a demandé plus. Les erreurs à code spécifique (`ThemeNotFoundError`, `ConflictError`, `InvalidThemeError`) restent locales à leur domaine ; migration vers `common/` à la troisième occurrence.

**Conséquences.** `ConflictError` existe en double (`themes/`, `questions/`) en attendant la 3ᵉ occurrence. `ThemeNotFoundError` rejoindra `NotFoundError` avec la mise au format standard des erreurs thèmes. Cf. `DEBTS.md`, questions/ et themes/.

---

## #3 — `GET /:id` ne traduit que `NotFoundError` ; les autres erreurs remontent brutes

*Commit `89e51ef` — US-005/CA-23.*

**Contexte.** Le `POST` enveloppe son appel service dans `try/catch → sendError` avec une chaîne `instanceof` qui couvre CA-54 (`500` sans détails). Pour le `GET`, deux chemins : (a) réutiliser `sendError` et y ajouter une branche `NotFoundError` — DRY, couvre CA-54 sur le `GET` **sans test** ; (b) `try/catch` local ne connaissant que `NotFoundError`, tout le reste relancé.

**Décision.** (b) — « aucun test ne le demande ». Le pas strictement minimal, qui laisse CA-54 sur le `GET` honnêtement ouvert plutôt que couvert sans preuve.

**Conséquences.** Une erreur inattendue sur le `GET` donne aujourd'hui le `500` par défaut de Fastify, pas le body standard. Dette explicite, un seul rouge pour la solder. Cf. `DEBTS.md`, questions/.
