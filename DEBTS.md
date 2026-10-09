# Dettes techniques — quiz-live-server

Source de vérité unique des dettes assumées. Une dette **soldée est supprimée** (git garde l'historique), jamais barrée. Chaque ligne indique, quand il existe, le *pas séparé* qui la solderait. Mis à jour à chaque session, dans le commit de la session.

## questions/

- **Validateur instancié en dur dans la route** (DIP) — `new UuidFormatValidator()` dans le `POST` et le `GET` : deux occurrences. Injection via `QuestionRouteConfiguration` à la troisième (touche `question-route.test`, `server.test` ×2, `index.ts`).
- **Codes d'erreur en littéraux** — `'NOT_FOUND'`, `'INVALID_UUID'`, `'UNKNOWN_FIELDS'`, `'INVALID_BODY'`, `'VALIDATION_ERROR'` dans `question-route.ts` ; aucune constante correspondante dans `error-codes.ts`.
- **Codes d'erreur absents** — body `UNAUTHORIZED` du `401`.
- **`choices` requis à la route pour un MCQ seulement, `null` non gardé** — le schéma du `POST` porte `required: ['theme_id', 'title', 'type', 'level', 'time_limit', 'points', 'correct_answer']` : un body sans l'un des sept répond `400 VALIDATION_ERROR` (`Question <champ> is required.`, ou `Question <champ>, <champ> are required.` quand plusieurs manquent ; noms techniques lus dans `missingProperty`, dans l'ordre de `required`, `correct_answer` toujours nommé en dernier). `type` requis à la route double une garde du service (`must be MCQ or SPEED`, qui ne répond plus que pour une valeur invalide). La présence de `correct_answer` n'est gardée qu'à la route (décision #8) : le service appelé sans lui lève un `TypeError`. `choices` est requis par un `if` / `then` du schéma quand `type` est présent et vaut `MCQ` (CA-9) : absent, il répond `400 VALIDATION_ERROR` (`Question choices is required.`), testé sur un body où lui seul manque. `choices: null` sur un MCQ passe la route (`required` ne garde que la présence) → `TypeError` dans le service → `500` (lu dans le service, sondé le 2026-10-09 sur la route avec un service factice, non sondé avec le service réel). Quand `choices` manque avec un autre champ, il est nommé en premier (`Question choices, title are required.`, sonde du 2026-10-09, non committée) : aucun test ne fixe cet ordre. Plusieurs champs requis manquants : tous nommés, testé sur deux couples (`title` + `time_limit`, `theme_id` + `correct_answer`) ; la position de `correct_answer` dans le message n'est assertée par aucun test. Le libellé à plusieurs champs est une invention, la spec n'en prescrit aucun. Quand un champ requis manque **et** qu'un champ inconnu est présent, le manquant prime (décision #9), testé sur une combinaison. Non testé sur le serveur assemblé.
- **`createQuestion` accepte plus large que sa signature** — `CreateQuestionInput` décrit un body valide, mais le service reçoit un body dont seuls les noms de champs sont vérifiés : garde de `type`, `"choices" in input` sur un SPEED. Deux gardes que le type déclare impossibles ; les tests les atteignent par `as unknown as CreateQuestionInput`. *Pas séparé* : `required` et types dans le schéma, ou paramètre typé comme entrée non validée.
- **La garde ne reconnaît que trois mots-clés Ajv** — `type` répond `INVALID_BODY`, `required` répond `VALIDATION_ERROR` quel que soit le champ, tout le reste est lu comme un champ en trop (`params.additionalProperty`) : une erreur d'un autre mot-clé, ou un `required` sans `missingProperty` (cas non attendu d'Ajv, écarté par le test `!== undefined`), répondrait `Unknown field(s): .`. Le test `keyword === 'type'` ne vérifie pas que l'erreur porte sur la racine (`instancePath: ""`) : sans effet tant que les 8 champs sont déclarés `{}`, faux dès qu'un champ sera typé (`title: 42` répondrait `INVALID_BODY`). Les erreurs sont typées à la source par un type local `SchemaViolation` posé sur le `any` de Fastify : `tsc` vérifie désormais les lectures, mais le type est une affirmation sur la forme d'Ajv, non vérifiée à l'exécution. *Pas séparé* : trier par mot-clé et par `instancePath` à l'arrivée des types de champs.
- **`INVALID_BODY` testé sur le seul body `[]`** — `null` et les primitives produisent la même erreur Ajv (sonde du 2026-10-07, non committée) ; aucun test dédié, car aucune mutation ne les distinguerait du tableau.
- **`allErrors` sur une entrée non fiable** — l'Ajv du plugin valide le body jusqu'au bout pour nommer tous les champs inconnus ; la documentation d'Ajv le déconseille face à des entrées non fiables. Risque borné par le rate-limit et la taille maximale du body, non mesuré.
- **Liste des champs connus non figée par les tests** — ajouter un champ quelconque à `properties` ne fait rougir aucun test (mutant survivant assumé : seuls `image_path`, `audio_path`, `difficulty` sont nommés par les CA).
- **Messages d'erreur en dur** — « The requested question was not found. » (→ `NotFoundError(resource)` à la 2ᵉ ressource : quiz, partie) ; « The provided ID is not a valid UUID. » dans `sendInvalidUuid` (→ `common/` avec `sendErrorBody`, à la 3ᵉ route).
- **`sendErrorBody` / `ErrorBody` locaux à `question-route.ts`** — extraction vers `common/` à la 3ᵉ occurrence.
- **`ConflictError` et `ValidationError` en double** (`themes/`, `questions/`, classes identiques) — `NotFoundError` est déjà dans `common/` ; migration des autres erreurs génériques à la 3ᵉ occurrence.
- **`SELECT` de 3 lignes dupliqué** entre `getByTitle` et `getById` dans `SqliteQuestionRepository` — attend `getAll` (CA-26).
- **`row.choices!`** dans `rowToQuestion`.
- **`UNIQUE` sur le titre en base** = 2ᵉ source de vérité vis-à-vis de CA-5 (unicité insensible à la casse portée par le service).
- **Test `getByTitle` SPEED champ par champ** (13 `expect`). Cosmétique.
- **Payload SPEED de test dupliqué** → builder `aSpeedQuestion(theme)`.
- **`async () => { }` inline** dans trois montages de `question-route.test.ts`.
- **Cosmétique** : ligne vide manquante dans `theme-repository-existence-checker.test.ts`.

## themes/

- **Format court sur 10 branches de `theme-route.ts`** (`{ error: … }` au lieu du body standard, le `message` de `ValidationError` n'est donc pas transmis) — `ThemeNotFoundError` porte un code non standard (`THEME_NOT_FOUND`). *Pas séparé* : série `feat(themes)`, migration vers `common/NotFoundError` incluse.
- **Deux mécanismes pour `UNKNOWN_FIELDS`** — `bodyHasUnknownFields` (liste blanche, format court) dans `theme-route.ts`, schéma Ajv (body standard) dans `question-route.ts`. *Pas séparé* : série `feat(themes)`.
- **`500` des thèmes non conforme**, log non vérifié.
- **`429` des thèmes non re-testé** (`theme-route.test.ts:534`, statut seul). *Pas séparé* : `test(themes)` CA-34.
- **Couplage temporel `SqliteThemeRepository` → `T_QUESTION_QST`** (`isUsedInQuestions` suppose la table créée).
- **`count()` du repository thème** en `as { count: number }`.

## authentication/

- **`429` des tokens non re-testé** (`token-route.test.ts:113`, statut seul).
- **Test du `UserRepositoryParticipantResolver`** : fake inconditionnel.
- **`JwtValidator` / `JwtDecoder` instanciés deux fois** dans `index.ts`.

## infrastructure/ & composition

- **Message `Retry-After` et `timeWindow` découplés** dans le rate limit.
- **Signature `rateLimitMiddleware` / `middleware` dupliquée** entre les configurations de routes. *Pas séparé* : `refactor(infrastructure)`.
- **Composition `index.ts` non vérifiée à l'exécution** — smoke test (`npm start` + `curl`) jamais fait : `POST`, `GET /:id`, `404`, `400`.
- **Construction de `QuizServer` répétée** dans 6 `beforeEach`.

## outillage

- **Specs non type-checkées par Vitest** — `tsc --noEmit` obligatoire avant tout vert.
- **`noUnusedLocals` off**.

## spec (`quiz-buzzer-docs`)

- **Divergence sur le body `500`** entre la spec et l'implémentation.
- **CA-11 et CA-19 se contredisent sur `choices` d'un SPEED** — CA-11 exige `VALIDATION_ERROR`, CA-19 (« champs autorisés selon le type ») implique `UNKNOWN_FIELDS`. Arbitrage retenu : CA-19 prime. Non implémenté : le `POST` répond encore `VALIDATION_ERROR`. *Pas séparé* : schéma par type, décision à tracer, CA-11 à corriger dans la spec.
- **`correlation_id`** (US-022 CA-19), hors périmètre pour l'instant.
