# Dettes techniques — quiz-live-server

Source de vérité unique des dettes assumées. Une dette **soldée est supprimée** (git garde l'historique), jamais barrée. Chaque ligne indique, quand il existe, le *pas séparé* qui la solderait. Mis à jour à chaque session, dans le commit de la session.

## questions/

- **Validateur instancié en dur dans la route** (DIP) — `new UuidFormatValidator()` dans le `POST` et le `GET` : deux occurrences. Injection via `QuestionRouteConfiguration` à la troisième (touche `question-route.test`, `server.test` ×2, `index.ts`).
- **Codes d'erreur en littéraux** — `'NOT_FOUND'`, `'INVALID_UUID'`, `'UNKNOWN_FIELDS'` dans `question-route.ts` ; aucune constante correspondante dans `error-codes.ts`.
- **Codes d'erreur absents** — body `UNAUTHORIZED` du `401`.
- **Champs obligatoires non vérifiés à la route** — le schéma du `POST` liste les champs connus mais n'a pas de `required` : `title` ou `choices` absents → `TypeError` dans le service → `500` au lieu de `400 VALIDATION_ERROR`. `correct_answer` seul est gardé au service (`== null`). *Pas séparé* : `required` dans le schéma, avec le message à définir.
- **`createQuestion` accepte plus large que sa signature** — `CreateQuestionInput` décrit un body valide, mais le service reçoit un body dont seuls les noms de champs sont vérifiés : garde de `type`, `correct_answer == null`, `"choices" in input` sur un SPEED. Trois gardes que le type déclare impossibles ; les tests les atteignent par `as unknown as CreateQuestionInput`. *Pas séparé* : `required` et types dans le schéma, ou paramètre typé comme entrée non validée.
- **Toute erreur de schéma répond `UNKNOWN_FIELDS`** — la garde `request.validationError` ne regarde pas le mot-clé Ajv. Un body non-objet (`[]`, `"texte"`) répondrait `Unknown field(s): undefined.` ; `params.additionalProperty` est typé trop large pour que `tsc` le signale. *Pas séparé* : distinguer les mots-clés quand `required` arrivera.
- **Un seul champ inconnu nommé** — Ajv s'arrête à la première erreur ; la spec prévoit `Unknown field(s): foo, bar.`. *Pas séparé* : `allErrors` sous un rouge à deux champs.
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
