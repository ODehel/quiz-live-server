# Dettes techniques — quiz-live-server

Source de vérité unique des dettes assumées. Une dette **soldée est supprimée** (git garde l'historique), jamais barrée. Chaque ligne indique, quand il existe, le *pas séparé* qui la solderait. Mis à jour à chaque session, dans le commit de la session.

## questions/

- **`GET /:id` relance brut toute erreur autre que `NotFoundError`** — CA-54 non traduit sur le `GET` (choix (b), cf. `DECISIONS.md` #3). *Pas séparé* : `test(questions)`, rouge `mockImplementation(() => { throw new Error('SQLITE_BUSY') })` → `500` standard, réutilisation de `sendError`.
- **`POST` exige un UUID v7 sur `theme_id`** alors que CA-8 dit « UUID valide » — même question que CA-24 (cf. `DECISIONS.md` #1). Si la décision s'étend au `POST`, `Uuidv7Validator` n'a plus de consommateur dans les routes. *Pas séparé* : rouge CA-8 sur un `theme_id` non-v7 bien formé.
- **`POST` répond `400` sans body sur `theme_id` mal formé, `GET` `400` avec body** — deux traductions du même défaut dans `question-route.ts`. Se solde avec CA-8 (`INVALID_UUID` + body standard).
- **Validateur instancié en dur dans la route** (DIP) — `new UuidFormatValidator()` dans le `POST` et le `GET` : deux occurrences. Injection via `QuestionRouteConfiguration` à la troisième (touche `question-route.test`, `server.test` ×2, `index.ts`).
- **Codes d'erreur en littéraux** — `'NOT_FOUND'`, `'INVALID_UUID'` dans `question-route.ts` ; aucune constante correspondante dans `error-codes.ts`.
- **Codes d'erreur absents** — CA-6 `VALIDATION_ERROR` (`400` nu), body `UNAUTHORIZED` du `401`.
- **Messages d'erreur en dur** — « The requested question was not found. » (→ `NotFoundError(resource)` à la 2ᵉ ressource : quiz, partie) ; « The provided ID is not a valid UUID. » (→ `sendInvalidUuid(reply)` à la 2ᵉ occurrence : `PUT /:id`, `DELETE /:id`).
- **`sendErrorBody` / `ErrorBody` locaux à `question-route.ts`** — extraction vers `common/` à la 3ᵉ occurrence.
- **`ConflictError` en double** (`themes/`, `questions/`) — `NotFoundError` est déjà dans `common/` ; migration des autres erreurs génériques à la 3ᵉ occurrence.
- **`SELECT` de 3 lignes dupliqué** entre `getByTitle` et `getById` dans `SqliteQuestionRepository` — attend `getAll` (CA-26).
- **`row.choices!`** dans `rowToQuestion`.
- **`UNIQUE` sur le titre en base** = 2ᵉ source de vérité vis-à-vis de CA-5 (unicité insensible à la casse portée par le service).
- **Test `getByTitle` SPEED champ par champ** (13 `expect`). Cosmétique.
- **Payload SPEED de test dupliqué** → builder `aSpeedQuestion(theme)`.
- **`async () => { }` inline** dans trois montages de `question-route.test.ts`.
- **Cosmétique** : ligne vide manquante dans `theme-repository-existence-checker.test.ts`.

## themes/

- **Format court sur 10 branches de `theme-route.ts`** (`{ error: … }` au lieu du body standard) — `ThemeNotFoundError` porte un code non standard (`THEME_NOT_FOUND`). *Pas séparé* : série `feat(themes)`, migration vers `common/NotFoundError` incluse.
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
- **`correlation_id`** (US-022 CA-19), hors périmètre pour l'instant.
