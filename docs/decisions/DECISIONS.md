# Décisions de conception — quiz-live-server

Journal append-only des décisions de conception tranchées en session, avec le fait qui les a forcées. Une décision revue donne une **nouvelle** entrée qui référence l'ancienne, jamais une réécriture. Seules les décisions de *conception* y figurent (contrat, emplacement, responsabilité) ; les leçons de méthode restent dans les récaps.

Format : **Contexte** (le fait qui a forcé le choix) · **Décision** · **Conséquences** (ce que ça engage, dettes créées).

L'en-tête de chaque décision porte le **titre du commit** qui l'a livrée, pas son hash : le titre est connu avant le commit, et `git log --grep` le retrouve.

---

## #1 — Le lecteur valide la forme d'un UUID, le producteur garantit sa version

*`feat(questions): reject the retrieval of a question with a malformed id with a 400` — US-005/CA-24.*

**Contexte.** `GET /api/v1/questions/:id` doit répondre `400 INVALID_UUID` sur un id « pas un UUID valide » (CA-24). Réutiliser `Uuidv7Validator` (déjà employé par le `POST` sur `theme_id`) a fait tomber CA-23 : l'id « inexistant » du curl de la spec, `018e4f5a-0000-0000-0000-000000000000`, a un nibble de version `0` — bien formé, mais pas v7.

**Décision.** Le `GET` valide la **forme** (`8-4-4-4-12` hexadécimal, toute version) via un nouveau `UuidFormatValidator`, distinct de `Uuidv7Validator`. Ce n'est pas au lecteur de vérifier la version : c'est le `POST` qui génère les ids et garantit v7. Exiger v7 en lecture ferait fuir une contrainte interne dans le contrat public. L'id du test CA-23 reste celui de la spec.

**Conséquences.** Deux validateurs derrière la même interface `UuidValidator`. Le `POST` exige encore v7 sur `theme_id` (CA-8 dit aussi « UUID valide ») : question ouverte, à trancher sous son propre rouge — si la même logique s'applique, `Uuidv7Validator` n'aura plus de consommateur dans les routes. Cf. `DEBTS.md`, questions/.

---

## #2 — Les erreurs génériques vivent dans `common/`, les erreurs métier restent locales

*`feat(questions): reject the retrieval of an unknown question with a 404` — US-005/CA-23.*

**Contexte.** CA-23 demande un `404` avec le code **standard** `NOT_FOUND` (`error-codes.md`), là où les thèmes utilisent `ThemeNotFoundError` → `THEME_NOT_FOUND` (code non standard, format court). Il fallait choisir où faire naître l'exception que le service lève.

**Décision.** `NotFoundError` est créée dans `common/` — erreur générique, comme le code qu'elle porte. C'est la première classe dans `common/` (qui ne contenait que des interfaces et constantes). Elle reste **vide** (`extends Error {}`) : le message et la ressource sont produits par la route dans le body, aucun rouge n'a demandé plus. Les erreurs à code spécifique (`ThemeNotFoundError`, `ConflictError`, `InvalidThemeError`) restent locales à leur domaine ; migration vers `common/` à la troisième occurrence.

**Conséquences.** `ConflictError` existe en double (`themes/`, `questions/`) en attendant la 3ᵉ occurrence. `ThemeNotFoundError` rejoindra `NotFoundError` avec la mise au format standard des erreurs thèmes. Cf. `DEBTS.md`, questions/ et themes/.

---

## #3 — `GET /:id` ne traduit que `NotFoundError` ; les autres erreurs remontent brutes

*`feat(questions): reject the retrieval of an unknown question with a 404` — US-005/CA-23.*

**Contexte.** Le `POST` enveloppe son appel service dans `try/catch → sendError` avec une chaîne `instanceof` qui couvre CA-54 (`500` sans détails). Pour le `GET`, deux chemins : (a) réutiliser `sendError` et y ajouter une branche `NotFoundError` — DRY, couvre CA-54 sur le `GET` **sans test** ; (b) `try/catch` local ne connaissant que `NotFoundError`, tout le reste relancé.

**Décision.** (b) — « aucun test ne le demande ». Le pas strictement minimal, qui laisse CA-54 sur le `GET` honnêtement ouvert plutôt que couvert sans preuve.

**Conséquences.** Une erreur inattendue sur le `GET` donne aujourd'hui le `500` par défaut de Fastify, pas le body standard. Dette explicite, un seul rouge pour la solder. Cf. `DEBTS.md`, questions/.

---

## #4 — Le `POST` valide aussi la forme de `theme_id`, pas sa version

*`feat(questions): reject a question with a malformed theme_id with the INVALID_UUID error body` — US-005/CA-7, CA-8. Étend #1.*

**Contexte.** #1 laissait ouverte la question du `POST`, qui exigeait v7 sur `theme_id`. L'exemple curl de CA-7 (`US-005:262`) utilise `018e4f5a-0000-0000-0000-000000000000` — bien formé, version `0` — et attend `400 INVALID_THEME`. Le test CA-7 contournait le validateur v7 avec un id fabriqué ; remis sur l'id de la spec, il tombait en `INVALID_UUID`.

**Décision.** Le `POST` utilise `UuidFormatValidator` sur `theme_id`. Même argument que #1 : un `theme_id` référence un thème *existant*, dont la version est garantie par son producteur ; le lecteur ne vérifie que la forme. Le test CA-7 porte l'id de la spec. CA-8 répond désormais le body standard `INVALID_UUID`.

**Conséquences.** `Uuidv7Validator` n'a plus de consommateur dans les routes ; il reste testé et disponible pour le producteur d'ids (CA-16), pas de suppression sans rouge qui la demande. `sendInvalidUuid` extrait à la 2ᵉ occurrence, local à `question-route.ts`.

---

## #5 — `GET /:id` traduit toutes ses erreurs via `sendError`, comme le `POST`

*`feat(questions): translate an unexpected error on GET /:id into the standard 500 body` — US-005/CA-54. Révise #3.*

**Contexte.** CA-54 sur le `GET` : une erreur inattendue du service (`SQLITE_BUSY`) sortait avec le `500` par défaut de Fastify, message technique inclus dans le body. Le rouge a forcé la traduction que #3 avait laissée ouverte « faute de test ».

**Décision.** Le `GET` appelle `sendError`, où la branche `NotFoundError` a migré ; `POST` et `GET` ont le même `catch`. Un seul traducteur d'erreurs par route, lisible et DRY, plutôt que la forme alternative (`sendError` appelé depuis le `else` du `GET`, `NotFoundError` restant local).

**Conséquences.** Chaque route hérite de branches qu'elle ne lève pas (`404` sur le `POST`, `409`/`INVALID_THEME` sur le `GET`) : inertes, prix accepté d'une chaîne `instanceof` centralisée. Le log au niveau `error` sur le `GET` n'a pas de test propre : il est garanti par la réutilisation de `sendError`, testé sur le `POST`. Dette « `GET /:id` relance brut » soldée.

---

## #6 — Les règles métier vivent dans le service ; la route ne garde que la forme

*`feat(questions): reject an invalid question type with the VALIDATION_ERROR body carrying its message` — US-005/CA-6.*

**Contexte.** CA-6 : `type: "OPEN"` répondait `400` à body vide depuis une garde locale au `POST`, avant tout appel au service — et le service, lui, traitait `"OPEN"` comme un SPEED et créait la question. Deux couches, deux comportements, aucun conforme.

**Décision.** Le contrôle du type migre dans `createQuestion`, en première ligne (c'est le discriminant dont tout le reste dépend), et lève `ValidationError` porteuse d'un message. La route supprime sa garde et se contente de traduire : sa branche `VALIDATION_ERROR` renvoie `error.message`. La route ne garde que le contrôle de *forme* (`UuidFormatValidator`, #1) ; toute règle *métier* appartient au service.

**Conséquences.** `CreateQuestionInput` est exporté (type d'entrée réel du service). Le message est asserté au service, pas à la route (qui ne voit qu'un mock). Les autres règles lèvent encore `ValidationError()` sans message → `message: ""` dans le body : dette inscrite dans `DEBTS.md`.

---

## #7 — Le schéma du `POST` questions est compilé par un Ajv local au plugin

*`feat(questions): reject unknown fields on creation` — US-005/CA-18, CA-19.*

**Contexte.** CA-18 : `image_path` dans le body devait répondre `400 UNKNOWN_FIELDS`. Avec `additionalProperties: false` et l'Ajv par défaut de Fastify (`removeAdditional: true`), le champ était retiré en silence et la question créée (`201`).

**Décision.** `questionRoute` pose son propre compilateur (`setValidatorCompiler`, `new Ajv()` nu) plutôt que de régler `removeAdditional` sur l'instance Fastify. Le schéma et la règle qui lui donne son sens vivent dans le même fichier ; un `Fastify()` créé sans option ne peut pas faire mentir le schéma. L'erreur est traduite dans le handler (`attachValidation`), à côté de la garde UUID : la route garde la forme (#6).

**Conséquences.** `ajv` devient une dépendance directe (8.20.0, version partagée avec Fastify). Plus de coercition ni de valeurs par défaut Fastify pour ce plugin. Les thèmes gardent leur mécanisme (`bodyHasUnknownFields`) : deux mécanismes pour un même code, dette inscrite. Le schéma ne porte que la liste des champs connus : ni `required`, ni types.

---

## #8 — La présence d'un champ requis est une règle de forme, gardée par la route seule

*`refactor(questions): leave the correct_answer presence guard at the route only` — error-codes/VALIDATION_ERROR.*

**Contexte.** Depuis `feat(questions): name correct_answer among the missing fields at creation`, `correct_answer` figure dans le `required` du schéma : la route répond `400 VALIDATION_ERROR` avant d'appeler le service. La garde `correct_answer == null` de `createQuestion` n'était plus atteinte que par ses propres tests, au prix d'un `as unknown as CreateQuestionInput` : le type déclare `correct_answer: string`. La règle « champ requis » vivait à deux endroits, et pour ce seul champ.

**Décision.** « Ce champ est obligatoire » est une règle de *forme*, pas une règle *métier* au sens de #6 : elle appartient à la route. La garde du service et ses deux tests sont retirés. Le service garde ce qui porte sur la *valeur* de `correct_answer` (trim, longueur, appartenance aux `choices`).

**Conséquences.** `createQuestion` appelé hors route sans `correct_answer` lève un `TypeError` (`500`) et non plus une `ValidationError` : prix accepté, la route est le seul appelant et le service n'a de garde d'absence dédiée pour aucun autre champ requis. US-005/CA-12 « obligatoire » n'est plus couvert qu'à la route, sur un body SPEED. La garde de `type` reste au service : elle rejette aussi une valeur invalide.

---

## #9 — Un champ manquant est signalé avant un champ inconnu

*`test(questions): pin missing fields before unknown fields at creation` — error-codes/VALIDATION_ERROR, error-codes/UNKNOWN_FIELDS.*

**Contexte.** Un body peut à la fois omettre un champ requis et porter un champ inconnu. L'Ajv du plugin (`allErrors`) remonte les deux violations, mais une réponse ne porte qu'un code. La route traitait déjà les champs manquants en premier ; aucun test ne le fixait : inverser la priorité laissait toute la suite verte (mutation sur clone).

**Décision.** Le manquant passe avant l'inconnu : la route répond `400 VALIDATION_ERROR` en nommant les champs manquants, sans mentionner le champ inconnu. Raison : une donnée manquante est prioritaire, parce qu'on ne peut pas s'en passer ; un champ inconnu, à la limite, pourrait être ignoré. Le comportement est inchangé, un test le fixe désormais.

**Conséquences.** Le client qui cumule les deux erreurs les corrige en deux allers-retours : `UNKNOWN_FIELDS` n'apparaît qu'une fois le body complet. Le test porte sur un body SPEED sans `title` avec `difficulty` ; les autres combinaisons reposent sur la même branche. Un champ inconnu reste rejeté quand rien ne manque (#7) : « pourrait être ignoré » justifie l'ordre, pas une tolérance.

---

## #10 — Un champ mal typé est signalé avant un champ manquant ou inconnu

*`fix(questions): reject a question whose title is not a string` — US-005/CA-4, error-codes/VALIDATION_ERROR.*

**Contexte.** `title` devient le deuxième champ typé par le schéma du `POST`, après `choices`. Un body peut cumuler une violation de type avec un champ manquant, un champ inconnu ou une autre violation de type ; une réponse ne porte qu'un code et qu'un message. La garde de la route traitait déjà le mot-clé `type` en premier, pour `choices` seulement, sans qu'aucun test ni aucune décision ne le fixe. Avant le typage de `title`, `title: 42` sans `points` répondait `Question points is required.`, et avec un champ inconnu `UNKNOWN_FIELDS` : typer le champ a changé ces deux réponses.

**Décision.** Une violation de type passe avant un champ manquant et avant un champ inconnu : la route répond `400 VALIDATION_ERROR` en nommant le champ mal typé, sans mentionner les autres. Raison : il faut valider ce qui existe déjà avant de voir les manques. L'ordre complet devient type, puis manquant, puis inconnu ; la #9 n'est pas revue, elle ordonne les deux derniers. Entre deux champs mal typés, `choices` est signalé avant `title` : c'est l'ordre des branches de la garde, fixé par un test, sans raison métier.

**Conséquences.** Le client qui cumule les erreurs les corrige en plusieurs allers-retours : un champ manquant n'est nommé qu'une fois les types corrects. Testé pour `title` (`points` manquant, `difficulty` inconnu, `choices: null`) ; pour `choices` devant un champ manquant ou inconnu, la priorité repose sur la même branche et n'est que sondée. Chaque champ typé demande sa branche dans la garde : un chemin sans branche lève une exception (`500`) plutôt que de répondre un message faux, et sa place parmi les branches décide de sa priorité sur les autres champs typés.

---

## #11 — Le hub suit le corps natif de Fastify pour le `415`

*`docs(decisions): follow Fastify's native 415 body instead of error-codes.md` — error-codes/UNSUPPORTED_MEDIA_TYPE, US-005/CA-20, US-004/CA-08.*

**Contexte.** `error-codes.md` (l. 27 et l. 251) définit `UNSUPPORTED_MEDIA_TYPE` (`415`, « Content-Type must be 'application/json'. ») pour toutes les routes. Aucun code du hub ne le produit : Fastify rejette un `Content-Type` autre que JSON avant la route et répond son corps natif, `code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE'`, `message: 'Unsupported Media Type'`. Les tests des thèmes (US-004/CA-08 et CA-26) et du token fixent déjà ce corps ; le `POST` des questions rend le même (sondé le 2026-10-13, non testé). Le statut est conforme à la spec, le code et le message ne le sont pas.

**Décision.** Le hub garde le corps natif de Fastify pour le `415`, sur toutes les routes, existantes et à venir ; c'est `error-codes.md` qu'on corrige. Raison : le comportement natif ne coûte rien, alors que rendre le corps de la spec demande un gestionnaire d'erreur global pour un gain nul côté client, le statut étant déjà le bon. La spec a par ailleurs été écrite sans ce que Fastify rend déjà.

**Conséquences.** Une route qui voudrait rendre `UNSUPPORTED_MEDIA_TYPE` devra amender cette décision. `error-codes.md` reste faux sur le code et le message tant qu'il n'est pas corrigé : dette inscrite dans `DEBTS.md`, correction dans `quiz-buzzer-docs` lors d'une session dédiée. US-005/CA-20 n'est testé sur aucune route de questions ; le corps n'est fixé par test que sur les thèmes et le token. Les routes WebSocket ne sont pas concernées.

---

## #12 — Un paramètre de pagination valide s'écrit avec des chiffres seulement, sans zéro en tête

*`feat(questions): reject invalid pagination parameters` — US-005/CA-30, error-codes/INVALID_PAGINATION.*

**Contexte.** CA-30 demande `400 INVALID_PAGINATION` pour des paramètres « négatifs, zéro, non numériques ». `page` et `limit` arrivent en chaînes dans l'URL ; le cast du handler ne convertit rien, et toute comparaison avec `NaN` est fausse : `limit=A` passait les gardes `<= 0` et `> 100`. Le CA ne dit rien des décimaux, de la notation scientifique, de l'hexadécimal ni des zéros en tête.

**Décision.** La route juge la **forme écrite** avant la valeur : un paramètre est valide s'il ne contient que des chiffres et que son premier chiffre n'est pas `0` (`/^[1-9][0-9]*$/`). Sont donc rejetés `0`, les négatifs, `1.5`, `1e1`, `0x10`, `007`, les espaces et la valeur vide. Le plafond de `limit` (CA-29, `limit > 100`) s'applique ensuite. Même règle pour `page` et `limit`, contrôlée à la route, service non appelé en cas de rejet. Raison (Olivier) : un décimal est fonctionnellement erratique, et les écritures étranges d'un même nombre n'ont pas de raison d'être acceptées.

**Conséquences.** La règle est écrite deux fois dans le handler (une par paramètre) : extraction vers `common/` avec le `refactor(pagination)`. Les thèmes ne suivent pas cette règle (`paginationParametersAreInvalid` dans `theme-route.ts`). Un client qui envoyait `limit=010` ou `page=1.0` reçoit désormais `400`.

---

## #13 — Les thèmes suivent la règle de pagination et le corps d'erreur des questions

*`fix(themes): align the pagination rule and error body on the questions` — US-004/CA-16, CA-17, error-codes/INVALID_PAGINATION. Fait suite à la décision #12.*

**Contexte.** Après la #12, deux routes de liste jugeaient la pagination de deux façons. `paginationParametersAreInvalid` (thèmes) s'appuyait sur la coercition de `Number` : `page=007`, `1.5`, `1e1` ou `0x10` passaient. Le `400` des thèmes renvoyait `{ "error": "INVALID_PAGINATION" }`, alors que `error-codes.md` demande le corps standard `{ status, error, message }` avec `"Invalid pagination parameters."`.

**Décision.** Olivier aligne les thèmes sur les questions, règle et corps dans la même session. `GET /api/v1/themes` rejette en `400 INVALID_PAGINATION` tout paramètre qui n'est pas écrit en chiffres sans zéro en tête (`isWrittenPaginationNumber`, `common/`), puis applique le plafond `limit > 100` ; le corps est `{ status: 400, error: 'INVALID_PAGINATION', message: 'Invalid pagination parameters.' }`. Le service n'est pas appelé en cas de rejet.

**Conséquences.** Un client qui envoyait `page=1.0` ou `limit=010` aux thèmes reçoit désormais `400`. Le format court `{ error }` reste sur neuf autres branches de `theme-route.ts` (dette inchangée, décomptée à neuf). Le message n'est pas partagé avec la route des questions : il est écrit dans chaque route (même inertie que les défauts `page = 1` / `limit = 20`).

---

## #14 — Les thèmes migrent vers le corps d'erreur standard code par code

*`fix(themes): answer a mismatched theme ID with the standard error body` — US-004/CA-23, error-codes/ID_MISMATCH. Fait suite à la décision #13.*

**Contexte.** Huit branches de `theme-route.ts` répondent encore `{ "error": … }`. Quatre d'entre elles vivent dans `sendError`, partagé par quatre routes : migrer une branche de `sendError` change toutes les routes d'un coup, donc « une session par route » ne tient pas. De plus, `THEME_NOT_FOUND` s'écarte de la spec : US-004 CA-10, CA-25 et CA-29 écrivent `404 NOT_FOUND`, et `error-codes.md` donne le message « The requested theme was not found. ».

**Décision.** Olivier migre les thèmes vers `{ status, error, message }` **une session par code d'erreur** (`ID_MISMATCH`, `INVALID_UUID`, `THEME_ALREADY_EXISTS`, `VALIDATION_ERROR`, `UNKNOWN_FIELDS`, `THEME_NOT_FOUND`, `INTERNAL_SERVER_ERROR`), chaque session en `fix(themes)` (écart à la spec, comme #13). Le corps est écrit en ligne dans la route, comme `INVALID_PAGINATION`. `THEME_NOT_FOUND` devient `NOT_FOUND`, avec le message de la spec. Le `500` s'aligne sur celui des questions, sans `correlation_id` (dette, US-022 CA-19).

**Conséquences.** Un client des thèmes qui lisait `error: "THEME_NOT_FOUND"` recevra `NOT_FOUND` à la session concernée. Le remplacement de `ThemeNotFoundError` par `common/NotFoundError` reste un `refactor` séparé, jamais mêlé à un changement de corps. L'extraction d'un `sendErrorBody` commun attend la troisième route concernée (dette existante). L'ordre des sessions est indicatif ; seule `ID_MISMATCH` est décidée à ce jour.


---

## #15 — La réponse du token passe en snake_case à la route, le type `Token` reste en camelCase

*`fix(authentication): answer a token request with snake_case fields` — US-003/CA-1. Fait suite à la décision d'Olivier du 2026-11-03 (le code est corrigé, pas la spec).*

**Contexte.** `POST /api/v1/token` renvoyait l'objet `Token` tel quel (`expiresIn`, `tokenType`), alors que la spec (US-003, exemple de réponse) et le message WebSocket de `ws-route.ts` écrivent `expires_in` et `token_type`. Le front Angular ne lit que `token` : le changement de noms ne le casse pas.

**Décision.** Le nommage de la réponse HTTP est fixé à la route, qui construit `{ token, expires_in, token_type }` à partir du `Token`. L'interface `Token` et `JwtGenerator` gardent leurs noms camelCase : le snake_case est une convention du contrat d'API, pas du domaine.

**Conséquences.** Les specs du front (`app.config.spec.ts`, `app.config.websocket.spec.ts`, `auth.service.spec.ts`) simulent encore la réponse en camelCase : sans effet aujourd'hui, à aligner si le front lit un jour ces champs. Le mapping est écrit en ligne dans la route, sans fonction dédiée (YAGNI : un seul consommateur).


---

## #16 — `sendErrorBody` vit dans `common/` dès son deuxième consommateur

*`fix(authentication): answer an unauthenticated request with the standard error body` — US-004/CA-32, `error-codes.md` (`UNAUTHORIZED`). Déroge à la règle « à la troisième occurrence » écrite en #14.*

**Contexte.** Le `401` du middleware répondait sans corps. Le corps standard `{ status, error, message }` était écrit par `sendErrorBody`, une fonction locale à `question-route.ts`. La décision #14 attendait une troisième route avant de l'extraire.

**Décision.** Sur demande d'Olivier, `sendErrorBody` et `ErrorBody` passent dans `common/send-error-body.ts` avec le middleware pour deuxième consommateur. Le code `UNAUTHORIZED` rejoint `error-codes.ts` ; le message reste écrit en ligne dans le middleware.

**Conséquences.** `theme-route.ts` et `token-route.ts` écrivent encore leurs corps en ligne : leur migration est un `refactor` séparé (dette dans `DEBTS.md`), jamais mêlé à un changement de corps. Le corps du `403` du middleware reste vide (dette).


---

## #17 — Le corps du `403` suit `error-codes.md`, pas l'annexe de sécurité transversale

*`fix(authentication): answer an insufficient-role request with the standard error body` — US-004/CA-33, `error-codes.md` (`FORBIDDEN`). Fait suite à la décision #16.*

**Contexte.** Le middleware répondait `403` sans corps. Deux documents de la spec divergent sur ce corps : `error-codes.md` donne `FORBIDDEN` avec le message « You do not have permission to perform this action. » (corps standard à trois champs, comme le `401`) ; `SECURITE-TRANSVERSALE.md` montre deux champs et « Insufficient permissions for this operation. ».

**Décision.** Sur choix d'Olivier, `error-codes.md` fait foi : `{ status: 403, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }`, écrit par `sendErrorBody`. Le code `FORBIDDEN` rejoint `error-codes.ts` ; le message reste écrit en ligne dans le middleware (un seul consommateur). Le même corps sert au rôle insuffisant et au token valide mais non décodable.

**Conséquences.** L'annexe `SECURITE-TRANSVERSALE.md` n'est pas alignée (dette dans `DEBTS.md`). Le `403` n'est pas encore contrôlé au smoke test : session `chore(scripts)` à part.

---

## #18 — Les routes de questions n'acceptent que `application/json` ; seul le `DELETE` ignore le body

*`fix(questions): refuse a non-JSON content type when writing a question` — US-005/CA-41, CA-47. Prolonge le retrait de `text/plain` des thèmes.*

**Contexte.** Fastify parse `text/plain` en chaîne par défaut. Sur hub réel, `POST /api/v1/questions` répondait `400 INVALID_BODY` et `PUT /api/v1/questions/:id` répondait `400 TYPE_CHANGE_NOT_ALLOWED` (une chaîne n'a pas de `type`), au lieu de `415 FST_ERR_CTP_INVALID_MEDIA_TYPE`. Les thèmes ont réglé le cas en enveloppant leurs écritures dans une instance encapsulée qui retire le parseur.

**Décision.** Le plugin des questions retire le parseur `text/plain` pour toutes ses routes (`app.removeContentTypeParser` en tête de `questionRoute`). L'instance du `DELETE`, déjà dédiée à ignorer le body (CA-47), déclare ses propres parseurs `application/json` et `text/plain` qui jettent le body. Une seule ligne couvre `POST`, `PUT` et toute écriture future du plugin.

**Conséquences.** Deux formes cohabitent : thèmes (on encapsule les écritures) et questions (on retire au plugin, le `DELETE` fait exception). L'extraction attendue à la 3ᵉ occurrence (`authentication/`) devra en choisir une ; pas de factorisation avant (dette dans `DEBTS.md`).


---

## #19 — Un `PUT` SPEED refuse `choices` comme le `POST`, par une garde partagée du service

*`feat(questions): update a speed question` — US-005/CA-34.*

**Contexte.** Le `PUT` ne gérait que le MCQ : la signature du service était `CreateMcqInput` et `updateQuestion` écrivait `type: "MCQ"` en dur. La spec ne dit pas ce que devient un body SPEED qui porte des `choices`.

**Décision.** Sur choix d'Olivier, un body SPEED contenant `choices` est refusé (`400 VALIDATION_ERROR`), avec le message du `POST` : « Question choices must be absent for a SPEED question. » La garde est une méthode privée `rejectChoicesOnSpeed`, appelée par `createQuestion` et par `updateQuestion` (après le contrôle du type, avant celui du titre). Le service construit la question mise à jour selon le `type` du body.

**Conséquences.** Un body SPEED avec `choices` sur une question MCQ répond encore `TYPE_CHANGE_NOT_ALLOWED` (le type prime). La garde reste au service, pas dans un schéma de route : même dette que pour le `POST`.


---

## #20 — Le `type` d'un `PUT` est validé avant tout le reste, par la garde du `POST`

*`fix(questions): reject a missing or invalid type on update` — US-005/CA-43.*

**Contexte.** Le `PUT` comparait le `type` du body à celui de la question stockée sans le valider : un `type` absent ou `FOO` répondait `TYPE_CHANGE_NOT_ALLOWED`, un code qui affirme à tort qu'un changement de type était voulu.

**Décision.** Un `type` absent ou hors `MCQ` / `SPEED` répond `400 VALIDATION_ERROR` (« Question type must be MCQ or SPEED. »), message du `POST`. La garde est une méthode privée `rejectInvalidType`, appelée en tête de `createQuestion` et de `updateQuestion`, donc avant le `404` : un body invalide sur un id inconnu répond `400`, pas `404`. Même principe que la décision #10 : valider ce qui est présent avant de juger le reste.

**Conséquences.** Un `type` valide mais différent du type stocké répond toujours `TYPE_CHANGE_NOT_ALLOWED`. La garde reste au service (même dette que pour le `POST` : le type déclaré ne reflète pas l'entrée réelle). Le reste de la validation du `PUT` (CA-35, CA-43 pour les autres champs) reste à faire ; l'ordre `400` avant `404` vaudra pour elle, sauf décision contraire.


---

## #21 — Les champs inconnus d'un `PUT` sont refusés par le service, après le `type` et avant le `404`

*`fix(questions): reject unknown fields on update` — US-005/CA-42.*

**Contexte.** Le `PUT` n'avait aucun schéma : un body portant `image_path`, `audio_path` ou n'importe quel champ étranger répondait `200`, sans que ces champs soient lus (CA-43 : les médias ne sont jamais modifiés par ce `PUT`). La spec exige `400 UNKNOWN_FIELDS`.

**Décision.** Sur choix d'Olivier, le contrôle passe après celui du `type` (décision #20) et avant le `404` : un body invalide ne révèle pas si l'id existe. Il est porté par le service (`rejectUnknownFields`, liste `UPDATE_ALLOWED_FIELDS`, `id` toléré), qui lève `UnknownFieldsError` ; la route la traduit par `sendUnknownFields`, déjà utilisé par le `POST`. `choices` reste un champ permis : sur un SPEED, il est refusé ensuite par `rejectChoicesOnSpeed` (décision #19, `VALIDATION_ERROR`).

**Conséquences.** Un body invalide à la fois par un `type` faux et un champ inconnu répond sur le `type`. Un `id` différent de l'URL est encore refusé avant tout, par la route (`ID_MISMATCH`). Le message est construit deux fois (l'erreur et la route) : dette notée dans `DEBTS.md`. Le schéma Ajv du `POST` n'est pas réutilisé, faute de décision sur l'unification des mécanismes.


---

## #22 — Un `PUT` de question exige tous ses champs métier, présents et non `null`, nommés un par un

*`fix(questions): reject an update with a missing field` — US-005/CA-43.*

**Contexte.** Le `PUT` ne contrôlait que le `type` et les champs inconnus : un body sans `title`, `level` ou `points` répondait `200` et écrasait la question avec des valeurs `undefined`.

**Décision.** Sur choix d'Olivier, un champ `null` compte comme absent. La garde `rejectMissingFields` passe après `rejectUnknownFields` et avant le `404` (même principe que #20 et #21). Elle exige `theme_id`, `title`, `correct_answer`, `level`, `time_limit`, `points`, et `choices` pour un MCQ seulement ; `choices` reste interdit sur un SPEED (#19). Elle lève `ValidationError` (`400 VALIDATION_ERROR`, `Question <champ> is required.`) en nommant le premier champ manquant dans l'ordre `theme_id`, `title`, `choices`, `correct_answer`, `level`, `time_limit`, `points`.

**Conséquences.** Le message diffère de celui du `POST`, qui nomme tous les champs manquants (« are required. »). Aucune règle de forme ou de borne n'est reprise : elles relèvent de CA-35. Un body invalide ne révèle toujours pas si l'id existe.


---

## #23 — Un `PUT` de question applique les règles de forme du `POST`, par le même code, avant le `404` ; le `404` passe avant le `409`

*`fix(questions): reject an invalid update` — US-005/CA-35.*

**Contexte.** Après #22, un `PUT` portant tous ses champs mais un `level` de `99`, un titre de trois lettres ou une `correct_answer` absente des `choices` répondait encore `200` et écrivait la valeur en base. Le titre n'était pas normalisé (trim + collapse) avant la recherche du `409`, ni avant l'écriture.

**Décision.** Le `POST` et le `PUT` partagent la méthode privée `validateFields` (titre normalisé puis borné, `correct_answer` rognée, `choices` pour un MCQ, plages de `level`, `time_limit`, `points`), donc les mêmes règles et les mêmes messages. Les valeurs rognées et normalisées sont celles qui sont écrites, comme au `POST`. Sur choix d'Olivier, le `404` passe avant le `409`. La validation de forme passe avant le `404` (même principe que #20, #21 et #22 : un body invalide ne révèle pas si l'id existe), après les champs inconnus et manquants. Ordre complet : `type`, champs inconnus, champs manquants, titre, réponses, plages, `404`, changement de type, `choices` sur un SPEED, `409`.

**Conséquences.** Un seul `ValidationError` est levé à la fois, dans l'ordre titre, réponses, plages. Un body de type différent du type stocké, avec un champ de forme invalide, répond `VALIDATION_ERROR` et non `TYPE_CHANGE_NOT_ALLOWED`. Le type de chaque champ n'est pas contrôlé (un titre non-chaîne lève un `TypeError`, donc un `500`) : dette notée dans `DEBTS.md`, comme l'existence du thème. Le choix « validation avant `404` » est une lecture de la consigne d'Olivier, à confirmer en revue.

## #24 — Un `PUT` de question vérifie le type de ses champs avant leurs règles de forme, par la garde du service, dans l'ordre `correct_answer`, `choices`, `title`

*`fix(questions): reject a non-string field on update` — US-005/CA-35.*

**Contexte.** Après #23, un `PUT` dont `title` ou `correct_answer` n'était pas une chaîne, ou dont `choices` n'était pas un tableau de chaînes, levait un `TypeError` au service : `500 INTERNAL_SERVER_ERROR` sur hub réel (sondé le 2026-11-10), là où le `POST` répond `400` par son schéma de route. Le `PUT` n'a pas de schéma de route (le body est casté).

**Décision.** La garde vit au service, dans la méthode privée `rejectInvalidFieldTypes`, appelée en tête de `validateFields` : elle est donc partagée avec `createQuestion`, comme les règles de forme (#23). Elle exige une chaîne pour `correct_answer` et `title`, et pour un MCQ un tableau de chaînes pour `choices`, avec les messages de la route du `POST` (`Question correct_answer must be a string.`, `Question choices must be an array.`, `Question choices must contain only strings.`, `Question title must be a string.`). L'ordre `correct_answer`, `choices`, `title` reprend celui de la route du `POST` (décision #10 et dette « `choices` requis et typé à la route »). Pour un SPEED, `choices` n'est pas typé ici : sa présence est refusée plus loin par `rejectChoicesOnSpeed` (#19). Un schéma de route pour le `PUT` a été écarté : il aurait dupliqué `validateFields` et son ordre.

**Conséquences.** Ordre complet des contrôles du `PUT` : `type`, champs inconnus, champs manquants, type des champs, titre, réponses, plages, `404`, changement de type, `choices` sur un SPEED, `409`. Un champ `null` ou absent répond donc `is required.` (#22) et non l'erreur de type, alors que le schéma du `POST` signale le type avant le manque : écart assumé, sans raison métier. Un seul `ValidationError` à la fois. `level`, `time_limit` et `points` n'ont pas besoin de la garde : `Number.isInteger` les refuse déjà (`"3"` répond `400`). `theme_id` n'est pas couvert : `500` sur hub réel pour `42`, une chaîne mal formée et un UUID inconnu, dette notée dans `DEBTS.md`. Le message d'erreur est repris de la route du `POST` sur proposition de Claude, acceptée avec le choix de la cible.

## #25 — La forme de `theme_id` est contrôlée par le service, pour le `POST` et le `PUT`

*`fix(questions): reject a malformed theme on update` — US-005/CA-35 et CA-8. Précise #6, prolonge #4 et #24.*

**Contexte.** #6 réservait à la route le contrôle de *forme* d'un UUID (`UuidFormatValidator`). Le `POST` contrôlait donc `theme_id` à la route (#4). Le `PUT` n'avait aucun contrôle : `42`, une chaîne mal formée et un UUID inconnu répondaient `500` sur hub réel (sondé le 2026-11-10). Une garde de route aurait inversé la priorité de #22 pour le `PUT` : un `theme_id` absent ou `null` aurait répondu `INVALID_UUID` au lieu de `is required.`, car la route passe avant le service. Seul le service peut tenir l'ordre du `PUT`, comme pour le type des champs (#24).

**Décision.** `DefaultQuestionService` reçoit un `UuidValidator` par son constructeur (en production : `UuidFormatValidator`, qui ne vérifie que la forme, #1 et #4) et porte la garde privée `rejectMalformedThemeId`, qui lève `InvalidUuidError`. La route la traduit dans `sendError` en `400 INVALID_UUID` (corps existant de `sendInvalidUuid`) et perd sa garde de `theme_id` du `POST`. Elle garde le contrôle des `:id` de chemin (`GET`, `DELETE`), qui sont de la forme de l'URL. Sur choix d'Olivier (option B), la garde est appelée à deux endroits, avec la même méthode : en premier de `createQuestion`, donc la priorité du `POST` ne change pas (la forme de `theme_id` passait déjà avant toute règle du service) ; dans `updateQuestion` après `rejectMissingFields`, donc avant le type des champs, le `404` et le `409`. Un body invalide ne révèle pas si l'id existe (#20 à #23).

**Conséquences.** Ordre complet des contrôles du `PUT` : `type`, champs inconnus, champs manquants, forme de `theme_id`, type des champs, titre, réponses, plages, `404`, changement de type, `choices` sur un SPEED, `409`. Un `theme_id` mal formé sur un id de question inconnu répond désormais `400 INVALID_UUID` et non plus `404`. `InvalidUuidError` reste locale à `questions/` (#2) : elle passera dans `common/` au second consommateur. L'existence du thème au `PUT` (`InvalidThemeError`, UUID bien formé mais inconnu, toujours `500`) reste à faire dans la session suivante. Le `POST` et le `PUT` n'ont pas le même ordre de la forme de `theme_id` par rapport aux champs manquants : écart assumé, sans raison métier, déjà présent pour le type des champs (#24).

## #26 — L'existence du thème d'un `PUT` est contrôlée par le service, après le `404` et avant le `409`

*`fix(questions): reject an unknown theme on update` — US-005/CA-35 et CA-7. Prolonge #23 et #25.*

**Contexte.** Après #25, un `PUT` dont le `theme_id` est un UUID bien formé mais inconnu répondait encore `500` sur hub réel (sondé le 2026-11-10), alors que le `POST` répond `400 INVALID_THEME` (CA-7). Le service du `PUT` n'avait pas la vérification que `createQuestion` porte. La spec (CA-35) dit que les règles du `POST` s'appliquent, sans fixer l'ordre de ce contrôle par rapport au `404` et au `409`.

**Décision.** La vérification d'existence (`ThemeExistenceChecker`, déjà injecté) est extraite de `createQuestion` dans la méthode privée `rejectUnknownTheme`, qui lève `InvalidThemeError` ; le `PUT` l'appelle aussi. La route n'a rien à changer : `sendError` traduit déjà `InvalidThemeError` en `400 INVALID_THEME`. Sur choix d'Olivier, l'ordre est le `404`, puis le thème, puis le `409`. Choix de Claude, à challenger en revue : le contrôle passe après le changement de type et après `choices` sur un SPEED, juste avant la recherche du titre, comme au `POST` où `rejectChoicesOnSpeed` précède déjà le thème (le lire « juste après le `404` » aurait aussi respecté la consigne).

**Conséquences.** Ordre complet des contrôles du `PUT` : `type`, champs inconnus, champs manquants, forme de `theme_id`, type des champs, titre, réponses, plages, `404`, changement de type, `choices` sur un SPEED, existence du thème, `409`. Le `POST` est inchangé. L'existence du thème coûte une lecture : elle passe donc après la forme et après le `404`. Conséquence assumée : un body au thème inconnu répond `404` sur un id de question inconnu et `400 INVALID_THEME` sur un id connu, donc l'existence d'une question se devine par ce body ; le principe de #20 à #25 (un body invalide ne révèle pas si l'id existe) vaut pour la forme, pas pour l'existence. Si ce principe doit couvrir aussi l'existence, le contrôle passe avant le `404` (un test d'ordre à inverser).

## #27 — Un `PUT` qui porte les données stockées rend la question telle quelle, sans écriture

*`feat(questions): leave a question untouched when an update changes nothing` — US-005/CA-37. Prolonge #23 à #26.*

**Contexte.** La spec (CA-37) veut qu'un `PUT` aux données identiques réponde `200` avec la question inchangée et `last_updated_at` non modifié. Avant cette session, `updateQuestion` réécrivait `last_updated_at` à chaque appel (sondé le 2026-11-10 sur hub réel). La spec ne dit pas ce que « identiques » compare : le body brut, ou le body après la normalisation de CA-35 ; ni si l'ordre des `choices` compte.

**Décision.** Le service compare le body brut aux valeurs stockées (`theme_id`, `title`, `correct_answer`, `level`, `time_limit`, `points`, et `choices` élément par élément, dans l'ordre, pour un MCQ) par la méthode privée `carriesTheStoredData`. S'ils sont tous égaux, il rend la question stockée telle quelle : ni `update` du repository, ni nouveau `last_updated_at`. Le contrôle passe après le `409` et avant l'écriture : un body identique a déjà franchi toutes les validations, et le `404` reste le premier verdict d'un id inconnu. Choix de Claude, à challenger en revue : la comparaison littérale, plutôt que sur les valeurs normalisées, pour ne rien inventer là où la spec se tait ; elle ne se trompe que dans un sens (elle traite un doute comme un changement, jamais l'inverse).

**Conséquences.** Ordre complet des contrôles du `PUT` : `type`, champs inconnus, champs manquants, forme de `theme_id`, type des champs, titre, réponses, plages, `404`, changement de type, `choices` sur un SPEED, existence du thème, `409`, puis comparaison avec le stocké. La route et le repository sont inchangés. Un body qui ne diffère que par des espaces superflus ou par l'ordre des `choices` réécrit `last_updated_at` avec des valeurs identiques : dette consignée dans `DEBTS.md`, à cadrer dans une session dédiée (trou de la spec).

## #28 — Le rôle du jeton est écrit en libellé et converti aux bords : `toRoleLabel` à l'émission, `fromRoleLabel` au décodage

*`fix(authentication): name the role in the token as admin or buzzer` — US-003/CA-3.*

**Contexte.** La spec (US-003 CA-3) veut un claim `role` à `"admin"` ou `"buzzer"`. Le jeton portait le numérique de `UserRole` (`0` ou `1`), constaté le 2026-11-03 ; le canal WebSocket (`auth_success`) utilisait déjà `toRoleLabel`. Le seul lecteur du rôle d'un jeton est `authenticationMiddleware`, par `TokenDecoder`, qui compare à `UserRole.ADMIN`. Émettre le libellé obligeait donc à le relire au décodage.

**Décision.** `JwtGenerator` écrit `toRoleLabel(user.role)`. `JwtDecoder` lit le claim par `fromRoleLabel` (nouvelle fonction de `users/role-label.ts`, inverse de `toRoleLabel`) et rend `undefined` quand le claim n'est ni `"admin"` ni `"buzzer"` : rôle numérique de l'ancien format, libellé inconnu, claim absent. Sur choix d'Olivier (2026-11-10), l'ancien format n'est plus lu, sans tolérance transitoire. Choix de Claude, à challenger en revue : la conversion se fait aux bords du jeton, `DecodedToken.role` reste un `UserRole` (aucun double de test du middleware, de `server.test.ts` ni de `theme-route.test.ts` ne change), plutôt que de faire circuler le libellé dans le domaine ; et un jeton illisible reste un `403` du middleware (cas « jeton valide mais indécodable »), pas un `401`.

**Conséquences.** Un jeton émis avant ce commit (signature valide, `role` numérique) répond `403` et non plus `200` sur les routes d'administration, jusqu'à expiration (3600 s par défaut) : sondé sur hub réel le 2026-11-10. Les deux tables de libellés (`roleLabels` et `rolesByLabel`) peuvent diverger : un test aller-retour (`fromRoleLabel(toRoleLabel(r)) === r`) les garde cohérentes. Le contrôle « CA-3 claim role » de `scripts/smoke-themes.ps1` n'est plus un écart connu. L'état des lieux du socle hub décrit encore l'écart : dette consignée dans `DEBTS.md`.

## #29 — « Identiques » (CA-37) se juge après normalisation ; l'ordre des `choices` compte

*`docs(specs): settle how an update that changes nothing is compared` — US-005/CA-37. Précise #27.*

**Contexte.** La spec (CA-37) veut qu'un `PUT` aux données identiques réponde `200` sans toucher `last_updated_at`, mais ne dit pas ce que « identiques » compare. #27 a livré une comparaison littérale sur le body brut, en la signalant comme un choix provisoire : un body qui ne diffère du stocké que par des espaces superflus réécrit `last_updated_at` avec des valeurs identiques (relevé au smoke test d'Olivier le 2026-11-10). Le cadrage a posé deux questions séparées : les espaces, et l'ordre des `choices`.

**Décision.** Sur choix d'Olivier (2026-11-10) : (1) « identiques » se juge sur les valeurs **après** la normalisation du CA-35, c'est-à-dire celles qui seraient écrites (titre rogné et à espaces fusionnés, réponse rognée, `choices` rognés) ; un body qui ne diffère que par des espaces superflus est donc identique et rend la question telle quelle. (2) L'ordre des `choices` compte : un même ensemble dans un autre ordre est un changement, car les buzzers affichent les propositions A/B/C/D dans l'ordre du tableau (US-011 CA-10). La spec (CA-37, ligne du tableau et note de la section) est précisée dans ce sens.

**Conséquences.** Le point 2 est déjà celui du code livré en #27. Le point 1 ne l'est pas : `carriesTheStoredData` compare encore le body brut, il faudra une session `fix(questions)` dédiée (rouge au service avec un titre, une réponse et un choix qui ne diffèrent que par des espaces), consignée dans `DEBTS.md`. Aucun code n'est modifié par cette session. Le contrôle passe toujours après tous les autres, le `409` compris (#27). Non décidé ici : la priorité de `INVALID_UUID` et d'`ID_MISMATCH` et le contrôle du `:id` du chemin (CA-38), session de cadrage à part.

## #30 — Au `PUT` d'une question, la forme des ID se contrôle avant leur comparaison : `INVALID_UUID` passe avant `ID_MISMATCH`

*`docs(specs): settle the priority of INVALID_UUID and ID_MISMATCH on update` — US-005/CA-38. Précise #6 et #29 (dernier point resté ouvert).*

**Contexte.** La spec (CA-38) dit que l'`id` du body, s'il est présent, doit correspondre à l'URL, sinon `400 ID_MISMATCH`. Elle ne dit rien de la forme de ces ID au `PUT`. Le code ne contrôlait ni l'`:id` du chemin, ni l'`id` du body : un `:id` ou un `id` mal formé finissait en `ID_MISMATCH` (body différent) ou en `404` (body absent). `GET` (CA-24) et `DELETE` (CA-46) répondent `400 INVALID_UUID` pour un `:id` mal formé, et le diagramme du `PUT` place déjà « UUID valide ? » en premier. Le cadrage a posé une seule question : quelle erreur prime quand un ID est à la fois mal formé et différent.

**Décision.** Sur choix d'Olivier (2026-11-10, `INVALID_UUID` d'abord), le contrôle de forme précède la comparaison. Au `PUT`, dans l'ordre : l'`:id` du chemin mal formé → `400 INVALID_UUID` ; l'`id` du body présent et mal formé → `400 INVALID_UUID`, même s'il diffère de l'URL ; l'`id` du body bien formé mais différent → `400 ID_MISMATCH`. Ces contrôles restent à la route (forme d'un ID d'URL ou de body, #6, avec le `UuidFormatValidator` déjà en place) et passent avant tout contrôle du service : un ID mal formé ne révèle donc pas si une question existe, comme pour `GET` et `DELETE`. Choix de Claude, à challenger en revue : un `id` présent dans le body qui n'est pas une chaîne (`null`, nombre…) est « mal formé », donc `INVALID_UUID` (lecture littérale de « pas un UUID valide », CA-24), plutôt qu'`ID_MISMATCH` ; et le contrôle de l'`:id` du chemin est inclus dans cette décision, la spec n'en parlant pour le `PUT` que par le diagramme.

**Conséquences.** Rien n'est codé dans cette session : le `fix(questions)` qui aligne la route est consigné dans `DEBTS.md` (rouges à la route, service simulé non appelé). Ordre du `PUT` après ce fix : `:id` du chemin, `id` du body (forme puis comparaison), puis les contrôles de #20 à #29 inchangés. Le même trou existe pour `PUT /api/v1/themes/:id` (US-004 CA-23) et le futur `PUT` de quiz (US-008 CA-32) : non décidé ici, une session par US. Le diagramme `US-005-crud-questions.mmd` montre encore le `404` avant la validation (donc avant `idMismatch`) : il ne suit déjà plus l'ordre des décisions #20 à #29, hors de cette session.


## #31 — Sur une route protégée, une méthode non supportée répond après l'authentification et le rôle : `401` → `403` → `405`

*`docs(specs): settle which of 401 and 405 wins on an unsupported method` — US-005/CA-53 (et CA-35 d'US-004, CA-16 d'US-006, CA-23 d'US-007, CA-48 d'US-008, CA-56 d'US-010, qui renvoient tous à l'annexe `CA-MethodNotAllowed`).*

**Contexte.** L'annexe `SECURITE-TRANSVERSALE.md` donne le `405` avec un token valide (`PATCH /api/v1/themes` → `405`, `Allow: GET, POST`) et le `401` pour tout accès sans token valide, mais ne dit pas lequel prime quand les deux s'appliquent : une méthode non supportée sans token, ou avec le token d'un `buzzer`. Aucun `405` n'existe dans `src/` (`ETAT-DES-LIEUX-socle-hub.md`, dette C) : l'ordre est une décision de conception qui commande où le `405` se branchera. `/api/v1/token` est publique et a déjà son `405` (US-003 CA-16), sans conflit possible.

**Décision.** Sur choix d'Olivier (2026-11-11, option « 401 → 403 → 405 »), sur une route protégée l'authentification puis le rôle passent avant la méthode : token absent, invalide ou expiré → `401 UNAUTHORIZED` ; token valide de rôle `buzzer` avec une méthode d'écriture (`POST`, `PUT`, `PATCH`, `DELETE`) → `403 FORBIDDEN` ; sinon `405 METHOD_NOT_ALLOWED` avec le header `Allow`. Raison : un anonyme n'apprend pas quelles méthodes une route supporte, comme un ID mal formé ne révèle pas l'existence d'une question (#30) et comme l'annexe veut des `401` indiscernables (« timing attacks »). Choix de Claude, à challenger en revue : le `403` se juge sur la méthode de la requête, selon la liste des méthodes d'écriture de l'annexe (`POST`, `PUT`, `PATCH`, `DELETE`) ; un `buzzer` qui envoie `GET`, `HEAD` ou `OPTIONS` sur une méthode non supportée reçoit donc `405`, pas `403`. Le `429` n'est pas concerné : l'annexe l'applique déjà à toutes les routes.

**Conséquences.** Rien n'est codé dans cette session : le `feat` du `405` est consigné dans `DEBTS.md` (rouges à écrire sur le serveur assemblé, un par ligne du tableau de l'annexe). Le `405` devra donc passer par la même authentification et le même contrôle de rôle que les routes protégées ; comment le brancher reste à cadrer sous le premier rouge. Non décidé ici : une route inconnue (`404`, avec ou sans token), le contenu exact du header `Allow` quand des méthodes sont ajoutées automatiquement (`HEAD` pour un `GET`), et le message du `405` (l'annexe dit « Method not allowed on this resource. », `error-codes.md` dit « HTTP method <METHOD> is not allowed on this resource. », même écart que le `403` en #17).


## #32 — `HEAD` n'est jamais une méthode supportée : il répond `405`, et le header `Allow` ne le liste jamais

*`docs(specs): settle HEAD and Allow on an unsupported method` — US-020/CA-8 et annexe `CA-MethodNotAllowed` (CA-35 d'US-004, CA-16 d'US-003, CA-53 d'US-005, etc.). Fait suite à la décision #31.*

**Contexte.** La décision #31 laissait non décidé « le contenu exact du header `Allow` quand des méthodes sont ajoutées automatiquement (`HEAD` pour un `GET`) ». Les cahiers des charges disent déjà : `SECURITE-TRANSVERSALE.md` (« Autres méthodes (`HEAD`, `OPTIONS`, etc.) → `405` », `Allow` = « les méthodes supportées pour cette ressource ») et US-020 CA-8 (« Méthode HTTP autre que `GET` » → `405` avec `Allow: GET`). Sondé le 2026-11-11 sur Fastify 5 sans rien committer : une route `GET` répond `200` à un `HEAD` (route `HEAD` ajoutée automatiquement), sans `Allow`. Ce comportement natif contredit les textes ; rien n'est codé aujourd'hui, donc aucun `405`.

**Décision.** Sur choix d'Olivier (2026-11-11, option 1 sur trois), lecture littérale de la spec : `HEAD` n'est **pas** supporté, y compris sur une route `GET`. Une requête `HEAD` sur une ressource de l'API suit la même règle que toute méthode non supportée (#31) : `401` sans token valide sur une route protégée, sinon `405 METHOD_NOT_ALLOWED` ; `405` direct sur une route publique (`/api/v1/token`, `/api/v1/health`). Le header `Allow` ne liste que des méthodes parmi `GET`, `POST`, `PUT`, `PATCH`, `DELETE` effectivement servies par la ressource, jamais `HEAD` ni `OPTIONS` (exemple : `Allow: GET` sur `/api/v1/health`, `Allow: GET, POST` sur `/api/v1/themes`). Écartées : « `HEAD` supporté sur les `GET` » (RFC 9110 : `HEAD` → `200` sans corps, `Allow: GET, HEAD, POST`), qui contredit l'annexe et US-020 CA-8 et obligerait à les corriger ; et la même session que le message du `405`, qui ôterait son sujet unique à la session. Choix de Claude, à challenger en revue : « `Allow` ne liste jamais `HEAD` » est déduit de « `Allow` liste les méthodes supportées » et de « `HEAD` n'est pas supporté », pas écrit tel quel dans la spec.

**Conséquences.** Rien n'est codé dans cette session. Le `feat` du `405` devra empêcher Fastify d'exposer `HEAD` automatiquement sur les routes `GET` ; comment, et où, reste à cadrer sous le premier rouge. Une ligne `HEAD` rejoint le tableau des rouges du `feat` (`admin` + `HEAD` sur une route `GET` → `405`, `Allow` sans `HEAD`). Non décidé ici, inchangé par rapport à #31 : le message du `405` (annexe contre `error-codes.md`, session `docs(specs)` dédiée, avec #17 pour précédent) et une route inconnue (`404`, avec ou sans token).


## #33 — Le corps du `405` suit `error-codes.md`, pas l'annexe de sécurité transversale ni US-020 : trois champs et un message dynamique

*`docs(specs): settle the message of an unsupported method` — US-005/CA-53 (et CA-35 d'US-004, CA-16 d'US-003, CA-8 d'US-020, etc.), annexe `CA-MethodNotAllowed`. Fait suite aux décisions #31 et #32.*

**Contexte.** Trois textes donnaient trois corps différents au `405` : `error-codes.md` (« HTTP method <METHOD> is not allowed on this resource. », trois champs), l'annexe `SECURITE-TRANSVERSALE.md` (« Method not allowed on this resource. », deux champs, sans `status`) et US-020 (« Method Not Allowed. »). Même écart que le `403` en #17. Aucun `405` n'existe dans `src/`.

**Décision.** Sur choix d'Olivier (2026-11-11, option A ; le champ `status` fait partie de la décision, comme en #17), `error-codes.md` fait foi : `{ "status": 405, "error": "METHOD_NOT_ALLOWED", "message": "HTTP method <METHOD> is not allowed on this resource." }`, où `<METHOD>` est la méthode de la requête, écrite telle que reçue (`PATCH`, `HEAD`, `OPTIONS`…). Le corps est le corps standard à trois champs, comme le `401`, le `403` et les autres erreurs. Le message est identique sur toutes les routes, publiques comme protégées, y compris `/api/v1/health` et `/api/v1/token`. L'annexe (bloc « Format de la réponse ») et la ligne `METHOD_NOT_ALLOWED` d'US-020 sont alignées sur `error-codes.md`, qui précise désormais ce que vaut `<METHOD>`. Écartées : l'annexe (message fixe, `status` ajouté) et US-020 (« Method Not Allowed. », qui ne vaut que pour `/health`).

**Conséquences.** Rien n'est codé dans cette session : le `feat` du `405` écrit ce corps (rouge sur le corps, un par ligne du tableau de l'annexe). Choix de Claude, à challenger en revue : « telle que reçue » est une lecture de `<METHOD>` que `error-codes.md` ne précise pas ; que Node refuse déjà une méthode inconnue avant Fastify (donc que `<METHOD>` ne peut pas porter de contenu arbitraire) n'est pas prouvé ici, il se prouve sous le rouge du `feat`. Non décidé, inchangé par rapport à #31 et #32 : une route inconnue (`404`, avec ou sans token).


## #34 — Le corps du `500` est le corps standard à trois champs ; `correlation_id` arrive avec US-022

*`docs(specs): settle the body of an unexpected error` — US-005/CA-54 (et CA-17 d'US-003, CA-36 d'US-004, CA-17 d'US-006, CA-24 d'US-007, CA-49 d'US-008, etc.), annexe `CA-InternalError`. Fait suite aux décisions #17 et #33.*

**Contexte.** Trois textes donnaient trois corps au `500` : `error-codes.md` (`status`, `error`, `message`, plus `correlation_id`), l'annexe `SECURITE-TRANSVERSALE.md` (`error` et `message` seulement, sans `status` ni `correlation_id`) et US-022 CA-19 (quatre champs). US-020 écrit déjà `{ status, error, message }`. Le code répond trois champs (`question-route.ts`, `theme-route.ts`) et aucun test ne contient `correlation_id`. Même écart que le `403` en #17 et le `405` en #33.

**Décision.** Sur choix d'Olivier (2026-11-11, option A, sans `correlation_id` dans cette session), `error-codes.md` fait foi sur `status` : `{ "status": 500, "error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred. Please try again later." }`, comme le `401`, le `403`, le `405` et les autres erreurs. L'annexe est alignée. Le champ `correlation_id` (US-022 CA-19) s'ajoute quand US-022 est livrée (middleware `correlationId`, CA-16) ; tant qu'elle ne l'est pas, le corps à trois champs est conforme, et non un écart. `error-codes.md` le précise. Écartée : cadrer l'ajout du `correlation_id` maintenant, qui dépend de CA-16 à CA-18 (génération, propagation, header `X-Correlation-Id`), non codés.

**Conséquences.** Rien n'est codé dans cette session. Les tests existants du `500` (`POST`, `GET /`, `GET /:id`) restent conformes. Les tests à venir sur `PUT` et `DELETE` (CA-54) n'ont plus de trou de spec : ils assertent les trois champs. Le jour où US-022 CA-19 est codée, le corps gagne `correlation_id` et tous les tests du `500` changent dans cette session-là. Choix de Claude, à challenger en revue : « conforme tant qu'US-022 n'est pas livrée » est une lecture de la dépendance de CA-19 à CA-16 ; aucun texte ne la dit tel quel. Non décidé : le `500` du token (`token-route.ts` sans traitement du `500`, CA-17 d'US-003, dette D de l'état des lieux).


## #35 — Une route inconnue répond `404 NOT_FOUND` au corps standard, sans exiger de token

*`docs(specs): settle the answer to an unknown route` — US-005/CA-53 (et CA-35 d'US-004, CA-16 d'US-003, CA-8 d'US-020, etc.), annexe `CA-MethodNotAllowed`. Fait suite aux décisions #31 à #33, qui laissaient cette question « non décidée ».*

**Contexte.** Aucun cahier des charges ne dit ce que répond une URL qui ne correspond à aucune ressource de l'API. `error-codes.md` donne `NOT_FOUND` (`404`, « The requested `<resource>` was not found. », ressource inexistante) sans cas de route. Sondé le 2026-11-11 sur Fastify 5, sans rien committer : une route inconnue répond `404` au corps natif `{ "message": "Route GET:/nope not found", "error": "Not Found", "statusCode": 404 }`, sans token requis, et l'URL y est reprise (encodée). Ce corps n'a pas les trois champs de #17, #33 et #34. Sondé aussi, sur Node 22 : une méthode dont le jeton n'est pas un jeton HTTP connu (`FOO`, `get`, `a<b`) est refusée en `400 Bad Request` par Node avant Fastify ; les méthodes rares mais standard (`PURGE`, `LINK`, `M-SEARCH`) passent jusqu'à l'application.

**Décision.** Sur choix d'Olivier (2026-11-11, option 1A, option 2A, et le token d'un `buzzer` suit la même règle), toute requête dont l'URL ne correspond à aucune ressource de l'API répond `404 NOT_FOUND` avec le corps standard à trois champs : `{ "status": 404, "error": "NOT_FOUND", "message": "The requested resource was not found." }`. `<resource>` vaut `resource`, valeur générique, puisqu'une route inconnue n'a pas de ressource à nommer. La règle vaut pour toute méthode et ne demande aucun token : un token absent, invalide, expiré ou de rôle `buzzer` ne change rien, le `404` passe avant l'authentification et avant le contrôle de rôle (#31 ne s'applique pas, il ne vaut que pour une ressource qui existe). Le message ne reprend ni la méthode ni l'URL de la requête. Écartées : le `401` d'abord sous `/api/v1/` (option 1B : hook global et liste de préfixes publics, sans CA qui l'exige) ; le corps natif de Fastify (option 1C : contredit #17, #33 et #34) ; un message qui reprend méthode et chemin (option 2B : surface de réflexion, sans CA qui l'exige).

**Conséquences.** Rien n'est codé dans cette session : le `feat` de la route inconnue est consigné dans `DEBTS.md` (rouge sur le serveur assemblé, sans token, avec un token `admin`, avec un token `buzzer`, une méthode d'écriture et une méthode `GET`). Il est indépendant du `feat` du `405` : une URL inconnue n'a pas de méthodes supportées, donc pas de `Allow`. Ce que #33 laissait à prouver sous le rouge du `405` est prouvé ici : `<METHOD>` ne peut pas porter de contenu arbitraire, Node refuse un jeton inconnu en `400` avant Fastify (sonde jetable, Node 22, non committée) ; le `405` n'a donc pas à le prouver. Choix de Claude, à challenger en revue : « routes de l'API » désigne ici toute URL qu'aucune route enregistrée ne sert, y compris hors `/api/v1/` (ex. `/`, `/favicon.ico`) ; aucun texte ne limite le `404` à un préfixe. Non décidé : le rate limiting (`429`) sur une route inconnue (l'annexe l'impose à « toutes les routes », mais le middleware est aujourd'hui branché route par route) ; et la route WebSocket (`/ws`), qui suit US-009 et non cette décision.


## #36 — Le header `Retry-After` d'un `429` vaut toujours `60`, pas le temps restant de la fenêtre

*`docs(specs): settle the Retry-After of a rate limited request` — US-005/CA-52 (et CA-13 d'US-003, CA-34 d'US-004, CA-15 d'US-006, CA-22 d'US-007, CA-47 d'US-008, CA-55 d'US-010, CA-27 d'US-016, CA-33 d'US-017, CA-13 d'US-013), annexe `CA-RateLimit`. Fait suite à la décision #35, qui laissait le `429` sur route inconnue au code seul.*

**Contexte.** Tous les cahiers des charges écrivent `Retry-After: 60`, sans dire si c'est une constante ou le délai restant avant la fin de la fenêtre d'une minute. Le code laisse `@fastify/rate-limit` poser le header (`rate-limit-middleware.ts`, `timeWindow: '1 minute'`, `errorResponseBuilder` ne fixe que le corps, au message `Please retry in 60 seconds.`). Sondé le 2026-11-11 sur la version installée, avec une limite de 1 et sans rien committer : le premier `429` répond `Retry-After: 60`, le suivant 3 secondes plus tard `57` ; le header est donc le temps restant de la fenêtre. Le smoke test d'Olivier sur le hub réel (`feat(errors)` de la route inconnue) l'a constaté : `54`. Les tests existants (`server.test.ts`, `question-route.test.ts`) assertent `60` sur un premier `429`, où les deux lectures coïncident.

**Décision.** Sur choix d'Olivier (2026-11-11, « toujours 60 »), tout `429` répond `Retry-After: 60`, quelle que soit la position de la requête dans la fenêtre. La valeur est une constante, alignée sur le message du corps (« retry in 60 seconds ») ; le header n'est pas le temps restant. `error-codes.md` et l'annexe `SECURITE-TRANSVERSALE.md` le disent. Écartée : le temps restant de la fenêtre, ce que fait aujourd'hui la bibliothèque (plus fidèle à la fin réelle de la fenêtre, mais contredit la lecture littérale de tous les CA et le message du corps, qui annonce toujours 60).

**Conséquences.** Rien n'est codé dans cette session : le code est en écart avec la spec, consigné dans `DEBTS.md` (`fix(errors)` à venir : un test qui laisse passer du temps dans la fenêtre avant le `429`, rouge sur `Retry-After` inférieur à 60, la bibliothèque ne le fixe pas toute seule). Les tests existants restent conformes mais ne prouvent pas la constante. Choix de Claude, à challenger en revue : la décision porte sur le header seulement ; le message du corps est déjà constant dans le code. Non décidé : le libellé du message (`error-codes.md` : « retry in 60 seconds », annexe : « retry after 60 seconds »), et le corps de l'annexe, qui n'a pas le champ `status` (même écart que le `403` en #17 et le `405` en #33), relevés dans `DEBTS.md`.


## #37 — Le corps du `429` est le corps standard à trois champs, au message « Please retry in 60 seconds. »

*`docs(specs): settle the body of a rate limited response` — US-005/CA-52 (et CA-13 d'US-003, CA-34 d'US-004, CA-15 d'US-006, CA-22 d'US-007, CA-47 d'US-008, CA-55 d'US-010, CA-27 d'US-016, CA-33 d'US-017, CA-13 d'US-013), annexe `CA-RateLimit`. Fait suite à la décision #36, qui laissait le libellé et le champ `status` « non décidés ».*

**Contexte.** Deux textes donnaient deux corps au `429` : `error-codes.md` (`status`, `error`, `message`, « Too many requests. Please retry in 60 seconds. ») et l'annexe `SECURITE-TRANSVERSALE.md` (`error` et `message` seulement, sans `status`, « Too many requests. Please retry after 60 seconds. »). Le code répond le corps de `error-codes.md` (`rate-limit-middleware.ts`), asserté en entier par `server.test.ts` et `question-route.test.ts`. Même écart que le `403` en #17, le `405` en #33 et le `500` en #34.

**Décision.** Sur choix d'Olivier (2026-11-11, option A : `error-codes.md` fait foi), le corps d'un `429` est `{ "status": 429, "error": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please retry in 60 seconds." }`, comme le `401`, le `403`, le `405`, le `500` et les autres erreurs. Le message est fixe et identique sur toutes les routes ; il annonce le même `60` que le header (#36). L'annexe (bloc « Format de la réponse `429` ») est alignée sur `error-codes.md`, qui renvoie désormais à cette décision. Écartée : le corps de l'annexe (sans `status`, « retry after »), qui contredit #17, #33 et #34 et ne correspond à aucun test.

**Conséquences.** Rien n'est codé dans cette session, et aucun comportement observable ne change : le code et les tests existants sont déjà conformes. Le `429` des thèmes et celui des tokens, assertés au statut seul (`DEBTS.md`), peuvent désormais asserter le corps sans trou de spec. Choix de Claude, à challenger en revue : « message fixe, identique sur toutes les routes » est une lecture de `error-codes.md`, qui ne le dit pas tel quel ; le message n'est pas calculé à partir de la fenêtre. Non décidé, inchangé : fenêtre fixe ou glissante, compteur par plugin, `/health` et `/ws` hors limite (dette « Rate limit » de `DEBTS.md`).


## #38 — Le `405` se décide au gestionnaire de route inconnue, d'après un catalogue des routes `/api/v1/` ; `HEAD` n'est plus exposé

*`feat(errors): answer an unsupported method with a standard 405` — US-005/CA-53, US-004/CA-35, US-003/CA-16 et annexe `CA-MethodNotAllowed`. Met en œuvre les décisions #31, #32 et #33.*

**Contexte.** Fastify répond par son gestionnaire de route inconnue (#35) à une méthode non supportée sur une URL qu'il connaît ; il expose aussi un `HEAD` automatique sur chaque route `GET`. Les décisions #31 à #33 fixent le résultat (`401` → `403` → `405`, `Allow`, corps) sans dire où le brancher.

**Décision.** Le `405` est décidé dans `routes/not-found-route.ts`, là où arrive déjà toute requête sans route. `QuizServer` enregistre les routes `/api/v1/` dans un `RouteCatalog` (hook `onRoute`) ; si l'URL demandée correspond à une ressource du catalogue (un segment `:id` accepte tout ce que le routeur de Fastify route lui-même, y compris vide), le gestionnaire applique : ressource publique (`/api/v1/token`) → `405` direct ; sinon `401` (token absent ou refusé), `403` (rôle autre qu'`admin` avec `POST`, `PUT`, `PATCH` ou `DELETE`), puis `405` avec `Allow` (méthodes `GET`, `POST`, `PUT`, `PATCH`, `DELETE` de la ressource, dans cet ordre). Une URL hors catalogue reste un `404` (#35). `HEAD` n'est plus exposé automatiquement (`exposeHeadRoutes: false`), donc il suit le même chemin (#32). Écartées : un `405` par plugin (une liste de méthodes à tenir par route, et Fastify refuse deux routes sur la même URL et la même méthode) ; un `onRequest` global (il répondrait `401` aux routes inconnues, contre #35).

**Conséquences.** `/health` et `/ws` ne sont pas dans le catalogue (hors CDC `/api/v1/`) : leur comportement ne change pas, sauf `HEAD /health`, qui répondait `200` et répond `404`. Choix de Claude, à challenger en revue : le `401` et le `403` sont réécrits dans le gestionnaire (`refuseAccess`) au lieu d'appeler `authenticationMiddleware` ; le validateur et le décodeur du token viennent de la configuration des thèmes ; `/api/v1/token` est la seule ressource publique, écrite en dur dans `QuizServer` ; une URL à segment vide (`/api/v1/themes/`) est une ressource connue, comme pour le routeur. Non décidé, inchangé : `/api/v1/health` (US-020, route absente), `PATCH` des questions (US-007).



## #39 — Le CDC fait foi pour le nom des variables d'environnement ; `SQLITE_DB_PATH` et `MAX_REQUESTS_PER_MINUTE` sont inscrits au CDC

*`docs(specs): settle the names of the environment variables` — US-003/CA-2 et CA-4, US-002/CA-2 et CA-4, US-001/CA-5, annexe `CA-RateLimit`. Solde la ligne « Noms des variables d'environnement : le code et les CDC divergent » de `DEBTS.md`.*

**Contexte.** Le code et les CDC ne nomment pas les mêmes variables. `AUTHENTIFICATION.md` et US-003 (CA-2, CA-4, tableau des variables) écrivent `JWT_SECRET` (obligatoire, 32 caractères minimum, sans défaut) et `JWT_EXPIRATION` (secondes, `3600` par défaut) ; US-002 écrit `SEED_PASSWORD_ADMIN` et `SEED_PASSWORD_BUZZER_01` à `SEED_PASSWORD_BUZZER_10`, sans défaut, le seed refusant un mot de passe absent ou de moins de 12 caractères. `ProcessEnvironment` lit `JWT_SECRET_KEY` (défaut `MySecretKey`, 11 caractères), `JWT_EXPIRATION_TIME`, `ADMIN_PASSWORD` (défaut `admin123`) et `BUZZER_DEFAULT_PASSWORD` (défaut `player123`). À l'inverse, le code lit `SQLITE_DB_PATH` (défaut `quiz.db`) et `MAX_REQUESTS_PER_MINUTE` (défaut `100`), que les CDC ne nomment nulle part : ils fixent le plafond de 100 requêtes par minute et par IP (`SECURITE-TRANSVERSALE.md`, US-003 CA-13), pas le nom d'un réglage. `PORT` (défaut `3000`, US-001 CA-5) est identique des deux côtés. Relevé le 2026-11-11 par l'agent frais du smoke test du `405`, qui écrit à partir des CDC seuls.

**Décision.** Sur choix d'Olivier (2026-11-11), le CDC fait foi : les noms en contradiction sont ceux des CDC (`JWT_SECRET`, `JWT_EXPIRATION`, `SEED_PASSWORD_*`), et c'est le code qui diverge. `JWT_SECRET` est obligatoire, d'au moins 32 caractères, sans défaut ; les onze `SEED_PASSWORD_*` sont obligatoires, d'au moins 12 caractères, sans défaut. Pour les deux variables sur lesquelles le CDC était muet, les noms du code sont inscrits au CDC : `SQLITE_DB_PATH` (défaut `quiz.db`) et `MAX_REQUESTS_PER_MINUTE` (défaut `100`, la valeur du CDC). Un tableau unique les liste toutes (nom, rôle, obligatoire, défaut, US source) dans `docs/shared/CONVENTIONS-TECHNIQUES.md` ; les autres documents y renvoient et n'en citent pas d'autre nom. Écartées : aligner les CDC sur le code (`JWT_SECRET_KEY`, `JWT_EXPIRATION_TIME`, `ADMIN_PASSWORD`, `BUZZER_DEFAULT_PASSWORD` : défauts de 8, 9 et 11 caractères contraires à la politique de 12 et de 32 caractères que le CDC pose, et une seule variable de mot de passe pour dix buzzers, contraire à US-002) ; garder les deux jeux de noms (une variable à deux noms, sans CA qui l'exige) ; renommer `SQLITE_DB_PATH` et `MAX_REQUESTS_PER_MINUTE` (aucun CDC ne propose un autre nom, et le code et ses tests les emploient déjà).

**Conséquences.** Rien n'est codé dans cette session, et aucun comportement observable ne change aujourd'hui : le code garde ses noms jusqu'aux trois `fix` consignés dans `DEBTS.md` (lecture de `JWT_SECRET` et `JWT_EXPIRATION` ; secret obligatoire de 32 caractères sans défaut ; seed lu dans les onze `SEED_PASSWORD_*`, sans défaut). Tant qu'ils ne sont pas faits, le hub lit des noms que le CDC ne connaît pas et retombe sur un secret de 11 caractères. Choix de Claude, à challenger en revue : l'emplacement du tableau (`CONVENTIONS-TECHNIQUES.md`, qui porte déjà les conventions communes à toutes les US) ; `MAX_REQUESTS_PER_MINUTE` est présenté comme le plafond de l'annexe `CA-RateLimit` et de US-003 CA-13 (le code applique une seule valeur à tous les plugins) ; les variables que d'autres US citent déjà (`NODE_ENV`, `BCRYPT_COST`, `SERVER_BASE_URL`) sont signalées sous le tableau sans y figurer, puisque leur nom n'est pas en cause. Non décidé, inchangé : ce que fait le hub quand `JWT_SECRET` manque ou fait moins de 32 caractères (le CDC dit « obligatoire » et « min 32 caractères », sans dire s'il refuse de démarrer, contrairement au seed d'US-002) ; le comportement du hub quand `PORT`, `JWT_EXPIRATION` ou `MAX_REQUESTS_PER_MINUTE` n'est pas un entier (le CDC n'en dit rien) ; `HOST`, que US-001 écarte (YAGNI).


## #40 — Un `JWT_SECRET` absent ou trop court, ou une `JWT_EXPIRATION` invalide, empêche le hub de démarrer

*`docs(specs): settle what the hub does when the JWT secret is missing or too short` — US-003/CA-2 et CA-4, nouveaux CA-19 et CA-20, `AUTHENTIFICATION.md`, tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Fait suite à la décision #39, qui fixait la règle de `JWT_SECRET` sans dire ce que fait le hub quand elle n'est pas respectée.*

**Contexte.** Le CDC veut `JWT_SECRET` obligatoire, de 32 caractères minimum, sans défaut (#39), mais ne dit pas ce que fait le hub quand il manque ou qu'il est trop court ; il ne dit rien non plus d'une `JWT_EXPIRATION` qui n'est pas un nombre. Le seul précédent écrit est celui du seed (US-002 : « le script refuse de s'exécuter », message qui identifie le compte sans exposer le mot de passe). Aujourd'hui le code retombe sur `MySecretKey` (11 caractères) et lit `JWT_EXPIRATION` sans la contrôler.

**Décision.** Sur choix d'Olivier (2026-11-11) : le hub refuse de démarrer, comme le seed, et `JWT_EXPIRATION` entre dans la même session. Le refus a les mêmes effets dans les deux cas : le serveur n'écoute sur aucun port, le processus se termine avec le code `1`, la console affiche un message qui nomme la variable et sa règle et ne reprend jamais la valeur. Le contrôle se fait au démarrage, avant d'écouter, jamais au premier token. Règles : `JWT_SECRET` absent, vide ou de moins de 32 caractères → refus (CA-19) ; `JWT_EXPIRATION` absente ou vide → `3600`, renseignée mais qui n'est pas un entier strictement positif écrit en chiffres seulement → refus (CA-20). Écartées : garder le défaut `MySecretKey` avec un avertissement (une clé publique connue signerait des tokens valides) ; refuser seulement au premier token (le hub semblerait sain jusque-là).

**Conséquences.** Rien n'est codé dans cette session. `DEBTS.md` consigne le `fix(authentication)` qui suit : un rouge par règle (secret absent ou vide, secret de 31 caractères, durée invalide), smoke test requis puisque le comportement observable change. Choix de Claude, à challenger en revue : un secret de 32 espaces est accepté (aucune règle de contenu, YAGNI) ; les 32 caractères se comptent tels quels, sans suppression des espaces ; une chaîne vide vaut absente, pour les deux variables ; aucune borne haute pour `JWT_EXPIRATION` ; `0`, les négatifs, les décimaux, la notation exponentielle, un signe `+` et les espaces en tête ou en fin sont refusés ; le libellé du message est un exemple (CA-19), le préfixe `Server starting failed: ` est celui que le hub affiche déjà pour tout échec de démarrage ; le CA-19 ne fixe pas l'ordre des contrôles entre les deux variables quand les deux sont fautives. Non décidé, inchangé : `BCRYPT_COST` (US-002), `PORT` invalide, `SQLITE_DB_PATH` et `MAX_REQUESTS_PER_MINUTE` mal formés.

## #41 — Le contrôle du JWT vit dans `readJwtSettings`, appelé en tête de `index.ts` ; `JWT_SECRET` est contrôlé avant `JWT_EXPIRATION`

*`fix(authentication): refuse to start when the JWT secret or expiration is invalid` — US-003/CA-19 et CA-20. Applique la décision #40.*

**Contexte.** La décision #40 fixe ce que le hub refuse, pas où se place le contrôle ni lequel des deux passe en premier quand les deux variables sont fautives. `ProcessEnvironment`, qui portait la lecture de `JWT_SECRET` (avec le défaut `MySecretKey`) et de `JWT_EXPIRATION` (`parseInt`), est aussi instancié par `npm run seed`, qui ne doit pas exiger le JWT (choix de la porte 1).

**Décision.** Le contrôle est la fonction `readJwtSettings(source)` (`authentication/jwt-settings.ts`), appelée en première instruction utile de `index.ts` avant toute ouverture de base et tout `listen` ; une `Error` lève le message, que `index.ts` affiche avec le préfixe `Server starting failed: ` avant `process.exit(1)` (même fonction que le `.catch` du démarrage). `ProcessEnvironment` ne porte plus ni le secret ni la durée : le seed n'est pas touché et le défaut `MySecretKey` n'existe plus. Quand les deux variables sont fautives, `JWT_SECRET` est refusé en premier (ordre du tableau des variables, le secret étant l'erreur la plus grave) : un seul message à la fois. Messages : `JWT_SECRET is required and must contain at least 32 characters.` et `JWT_EXPIRATION must be a strictly positive integer, in seconds.`

**Conséquences.** Les règles de #40 sont codées telles quelles (chaîne vide = absente, 32 caractères comptés sans rognage, durée en chiffres ASCII seulement et non nulle, aucune borne haute). Une durée à zéros en tête (`0036`) est acceptée et vaut `36` (chiffres seulement, strictement positive). Dettes : `JWT_EXPIRATION` sans borne haute et deux lectures de l'environnement (`DEBTS.md`).


## #42 — `BCRYPT_COST` est un entier de 4 à 31 contrôlé par le seed ; le seed dit quand il ne fait rien ; `JWT_EXPIRATION` reste sans borne haute

*`docs(specs): settle the BCRYPT_COST rule, the JWT_EXPIRATION ceiling and the seed message for existing accounts` — US-002/CA-6 et CA-7, US-003/CA-20, tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Fait suite aux décisions #39 et #40.*

**Contexte.** US-002 dit que le coût bcrypt vaut 12 et « peut être ajusté » par `BCRYPT_COST`, sans dire quelles valeurs sont acceptées ni ce que fait le seed d'une valeur invalide ; le code fige `COST_FACTOR = 12` et ignore la variable. Le CDC ne dit pas non plus ce que le seed affiche quand `T_USER_USR` contient déjà des comptes (CA-3 : « le script ne fait rien »), ni si `JWT_EXPIRATION` a une borne haute (#40 n'en posait aucune, une durée de vingt chiffres étant acceptée). Seul le seed hache un mot de passe ; le hub ne fait que comparer, et `compare` lit le coût dans le hash stocké.

**Décision.** Sur choix d'Olivier (2026-11-11) : (1) `BCRYPT_COST` est un entier de 4 à 31 (bornes de bcrypt), écrit en chiffres seulement ; absente ou vide, elle vaut `12` ; renseignée autrement, le seed refuse de s'exécuter comme pour un mot de passe invalide : aucun compte créé, code de sortie `1`, message qui nomme `BCRYPT_COST` et la règle (US-002 CA-6). Le hub ne lit pas cette variable. (2) Quand la table contient déjà des comptes, le seed ne modifie rien, affiche une ligne qui le dit et se termine avec le code `0` (US-002 CA-7), pour que `npm run migrate && npm run seed` puisse être rejoué. (3) `JWT_EXPIRATION` n'a pas de borne haute : la décision #40 est confirmée et le CA-20 le dit. Écartées : un coût de 10 à 14 (refuserait le 4 pratique en tests), un coût sans plafond (31 est accepté mais très lent), un plafond de 24 h ou de 7 jours pour `JWT_EXPIRATION`, un message suivi du code `1` (ferait échouer un enchaînement rejoué), le silence du seed.

**Conséquences.** Rien n'est codé dans cette session. `DEBTS.md` consigne les deux `fix(seed)` qui suivent (CA-6, CA-7), un par CA, smoke test requis puisque le comportement observable change. Choix de Claude, à challenger en revue : `BCRYPT_COST` est lue et contrôlée après la vérification de la table (étape 4 du workflow, avec les mots de passe), parce que le workflow arrête déjà le seed à l'étape 2 avant toute lecture de l'environnement : sur une table non vide, un `BCRYPT_COST` invalide ne change donc rien (message du CA-7, code `0`) ; quand un mot de passe et `BCRYPT_COST` sont fautifs, le mot de passe est refusé en premier, un seul message à la fois ; comme pour `JWT_EXPIRATION` (#41), les zéros en tête sont acceptés (`012` vaut 12) et les formes de #40 sont refusées (`12.5`, `1e1`, signe, espaces) ; les libellés des deux messages sont des exemples, le CA-7 reprenant la langue du message de succès du CDC (« Seed terminé — 11 comptes créés. »). Non décidé, inchangé : le message de succès du seed reste celui de l'étape 8 ; `NODE_ENV` et `SERVER_BASE_URL` ne sont pas au tableau des variables.


## #43 — Le schéma de `T_USER_USR` : noms de colonnes du code, contraintes du CDC, pas de dates, login sensible à la casse

*`docs(specs): settle the schema of the users table` — US-003 (schéma et flux d'émission), US-022 (CA-28 et sa section SQL). Fait suite à la décision #42.*

**Contexte.** Le CDC (US-003, section « Schéma de la table ») et le code (`sqlite-user-repository.ts`) divergeaient sur `T_USER_USR` : le CDC écrivait `USR_USERNAME` (`UNIQUE COLLATE NOCASE`), `USR_PASSWORD`, `USR_ROLE` (`DEFAULT 'buzzer'`, `CHECK`), `USR_CREATED_AT` et `USR_LAST_UPDATED_AT` ; le code crée `USR_LOGIN` (`UNIQUE`), `USR_HASH_PASSWORD` et `USR_ROLE SHORT NOT NULL`, sans dates. Le smoke test du `fix(seed)` « refuse to seed when BCRYPT_COST is invalid » l'a relevé : 19 assertions sur 68 en échec, le script, écrit d'après le CDC, lisant des colonnes que la table du code n'a pas.

**Décision.** Sur choix d'Olivier (2026-11-11, option C, porte 1) : noms de colonnes du code, contraintes du CDC, pas de dates. Schéma : `USR_ID TEXT PRIMARY KEY` ; `USR_LOGIN TEXT NOT NULL UNIQUE` (sensible à la casse, sans `COLLATE NOCASE`) ; `USR_HASH_PASSWORD TEXT NOT NULL` (hash bcrypt) ; `USR_ROLE TEXT NOT NULL DEFAULT 'buzzer' CHECK (USR_ROLE IN ('admin', 'buzzer'))`. Plus de `USR_CREATED_AT` ni de `USR_LAST_UPDATED_AT` : « ça n'a pas d'intérêt pour ce projet ». Le login reste sensible à la casse (`Admin` ≠ `admin`, comme aujourd'hui) : le flux d'émission d'US-003 cherche l'utilisateur par `USR_LOGIN` sans normaliser la casse. Le champ `username` du body de `POST /api/v1/token` ne change pas de nom. US-022 (CA-28) nomme `USR_HASH_PASSWORD` comme champ masqué. Écartées : A, le CDC fait foi tel quel (renommer les colonnes du code, ajouter les dates, login insensible à la casse) ; B, le code fait foi tel quel (retirer `DEFAULT` et `CHECK` du CDC).

**Conséquences.** Rien n'est codé dans cette session. Le CDC fait foi, le code est aligné dans une session séparée (dette dans `DEBTS.md`). Écart de stockage relevé en cadrant la rédaction : le code écrit dans `USR_ROLE` les entiers 0 / 1 de `UserRole` (`ADMIN = 0`, `PLAYER = 1`) ; `toRoleLabel` / `fromRoleLabel` ne servent qu'au claim JWT. Le `CHECK` du CDC rejette ces entiers (sondé sur SQLite de Node 22, table de test) : le repository et le seed doivent stocker et relire les libellés `'admin'` / `'buzzer'`, et le `CREATE TABLE` s'aligner (`TEXT`, `DEFAULT`, `CHECK`). Une base existante ne migre pas (`CREATE TABLE IF NOT EXISTS`) et contient des entiers : les bases locales sont à recréer. Choix de Claude, à challenger en revue : `DEFAULT 'buzzer'` et `CHECK` sont conservés parce qu'Olivier a retenu « contraintes du CDC ». Le script de smoke test CA-6 (hors dépôt) est à relancer après cette PR.

## #44 — `USR_ROLE` stocke le libellé `'admin'` / `'buzzer'` ; la conversion vit dans le repository SQLite

*`fix(users): reject a role other than admin or buzzer` — aligne le code sur le schéma de la décision #43.*

**Contexte.** Le code écrivait dans `USR_ROLE SHORT NOT NULL` les entiers 0 / 1 de `UserRole` (`ADMIN = 0`, `PLAYER = 1`) ; le schéma du CDC (US-003, décision #43) exige `TEXT NOT NULL DEFAULT 'buzzer' CHECK (USR_ROLE IN ('admin', 'buzzer'))`, dont le `CHECK` rejette les entiers.

**Décision.** Option 1 retenue par Olivier à la porte 1 : le `CREATE TABLE` de `sqlite-user-repository.ts` reprend le schéma du CDC ; `insert` écrit `toRoleLabel(user.role)` ; `retrieveByLogin` et `retrieveById` relisent via `fromRoleLabel` (fonction `toUser`, interne au fichier). Le type `User` garde `role: UserRole` : le service, le seed, le JWT et les routes ne changent pas, le claim `role` reste `admin` / `buzzer`. Le seed passe toujours un `UserRole` : la conversion est un détail de persistance, elle n'a pas à y figurer. Pas de migration : une base existante (entiers) est à recréer. Choix de Claude, non observable : `toUser` utilise `fromRoleLabel(...)!`, la valeur lue étant garantie par le `CHECK` sur une base créée par ce code ; sur une base ancienne la garantie tombe (voir `DEBTS.md`). Écartée : stocker l'entier et retirer le `CHECK` du CDC (le CDC fait foi, #43).

**Conséquences.** Une insertion hors `'admin'` / `'buzzer'` (entiers compris) est refusée par la base ; une insertion sans rôle prend `'buzzer'`. Tests : stockage des libellés, relecture par id et par login pour les deux rôles, refus de `0`, `1`, `'superadmin'`, `'Admin'`, `''`, `NULL`, défaut `'buzzer'`, type de colonne (`PRAGMA table_info`), seed + repository réel (libellés stockés, seed idempotent).

## #45 — Un `PORT` défini qui n'est pas un entier de 1 à 65535 empêche le hub de démarrer, la chaîne vide comprise

*`docs(specs): refuse to start when PORT is empty or not a valid port number` — US-001/CA-5 et nouveau CA-7, tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Fait suite à la décision #40, qui laissait `PORT` invalide non décidé.*

**Contexte.** US-001 CA-5 rend le port configurable par `PORT` (défaut `3000`) sans dire ce que fait le hub d'une valeur qui n'est pas un port. Le code lit `parseInt(process.env.PORT ?? "3000")`. Sondé le 2026-11-14 sur Fastify (sonde non committée) : `PORT=` et `PORT=abc` donnent `NaN`, que l'écoute refuse avec une erreur technique de Node (`ERR_SOCKET_BAD_PORT`) ; `8080abc` est lu comme `8080` et le serveur écoute ; `0` fait écouter un port libre choisi par le système, que le message de démarrage ne reflète pas ; `65536` et `-1` sont refusés par l'écoute. Le comportement observable dépend donc de la valeur, sans règle écrite. Précédents : `JWT_EXPIRATION` (US-003 CA-20) et `BCRYPT_COST` (US-002 CA-6), où une valeur invalide refuse, mais où vide vaut absente.

**Décision.** Sur choix d'Olivier (2026-11-14) : le hub refuse de démarrer comme au CA-19 et au CA-20 d'US-003 : le serveur n'écoute sur aucun port, le processus se termine avec le code `1`, la console affiche un message qui nomme `PORT` et sa règle et ne reprend jamais la valeur (US-001 CA-7). Règle : `PORT` absente → `3000` ; `PORT` définie, **chaîne vide comprise**, qui n'est pas un entier de 1 à 65535 écrit en chiffres seulement → refus. Écartées : vide vaut absente, comme `JWT_EXPIRATION` et `BCRYPT_COST` (Olivier veut que `PORT=` refuse) ; un repli sur `3000` pour une valeur invalide (le hub écouterait ailleurs que demandé) ; accepter `0` (port choisi par le système, message de démarrage faux).

**Conséquences.** Rien n'est codé dans cette session. `DEBTS.md` consigne le `fix(environment)` qui suit : un rouge par règle (chaîne vide, non numérique, `8080abc`, décimal, `0`, `65536`), smoke test requis puisque le comportement observable change. Choix de Claude, à challenger en revue : les zéros en tête sont acceptés (`08080` vaut 8080), comme pour `JWT_EXPIRATION` (#41) et `BCRYPT_COST` (#42) ; le signe `+`, les espaces en tête ou en fin et la notation exponentielle sont refusés ; le libellé du message est un exemple, le préfixe `Server starting failed: ` est celui que le hub affiche déjà pour tout échec de démarrage ; le CA-7 ne fixe pas l'ordre des contrôles entre `PORT` et les variables JWT quand plusieurs sont fautives. Les diagrammes d'US-001 (images) ne montrent pas ce refus. Non décidé, inchangé : un port déjà occupé, `SQLITE_DB_PATH` et `MAX_REQUESTS_PER_MINUTE` mal formés.

## #46 — « Chiffres seulement » veut dire chiffres ASCII de 0 à 9 pour `PORT` ; les zéros en tête sont acceptés

*`docs(specs): settle which PORT values are refused` — US-001/CA-7, tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Précise la décision #45.*

**Contexte.** La décision #45 refuse un `PORT` défini qui n'est pas un entier de 1 à 65535 écrit en chiffres seulement, et le CA-7 en cite neuf exemples. Elle laissait à l'état de choix de Claude, à challenger, les zéros en tête acceptés et le refus du signe `+`, des espaces et de la notation exponentielle ; le CA-7 ne citait ni le `+` ni l'espace en fin. Le CDC ne disait rien de la tabulation, de l'hexadécimal, des chiffres d'autres écritures ni d'un séparateur de chiffres. Sondé le 2026-11-14 (sonde non committée) sur `readPort` et sur le hub réel (`npm start`, `JWT_SECRET` valide, base jetable) : `8080 ` (espace en fin), `+8080`, une espace puis une tabulation en tête de `8080`, `0x1F90`, `٨٠٨٠` (chiffres arabo-indiens), `８０８０` (chiffres pleine chasse) et `8_080` sont refusés, chacun avec le message `PORT must be an integer between 1 and 65535.`, sans reprendre la valeur ; le hub sort avec le code `1` et n'écoute sur aucun port. `08080` est lu comme 8080 ; `00` vaut 0 et est refusé.

**Décision.** Sur choix d'Olivier (2026-11-14, porte 1) : le CA-7 liste ces sept cas en plus des neuf d'avant, tous refusés comme eux (même refus : le hub ne démarre pas, code de sortie `1`, message qui nomme `PORT` et la règle sans reprendre la valeur, aucun port n'écoute) ; « en chiffres seulement » s'entend de chiffres ASCII de `0` à `9`, sans signe, sans espace ni tabulation, sans préfixe ni séparateur. Les zéros en tête sont acceptés et c'est un énoncé du CDC (`08080` vaut 8080 et le hub écoute sur 8080 ; `00` vaut 0 et est refusé par la borne basse) : ce n'est plus un choix de Claude à challenger, la décision #45 ne l'est donc plus sur ce point. Ligne `PORT` du tableau des variables de `CONVENTIONS-TECHNIQUES.md` alignée. Non retenu : refuser les zéros en tête, que le code accepte et que `JWT_EXPIRATION` (#41) et `BCRYPT_COST` (#42) acceptent aussi.

**Conséquences.** Rien n'est codé dans cette session : le comportement observable ne change pas, le CDC inscrit ce que le hub fait déjà. `DEBTS.md` consigne le `test(environment)` qui reste : `read-port.test.ts` couvre déjà l'espace en tête, l'espace en fin, le `+` et les zéros en tête, pas la tabulation, l'hexadécimal, les deux écritures de chiffres ni le séparateur. Inchangé et hors de cette décision : le libellé du message reste un exemple, l'ordre des contrôles entre `PORT` et les variables JWT, un port déjà occupé, l'interface d'écoute, `JWT_EXPIRATION` (US-003 CA-20) et `BCRYPT_COST` (US-002 CA-6), dont les CA disent aussi « en chiffres seulement » sans préciser l'écriture des chiffres.

## #47 — L'heure de lancement est l'heure locale de la machine, pas l'UTC

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-2.*

**Contexte.** US-001 CA-2 demande l'heure de lancement au format `HH:mm:ss` sans dire dans quel fuseau. Le hub affiche l'heure locale de la machine (`getHours`) ; la sonde du 2026-11-14 (base jetable) l'a constaté sur le hub réel. La dette « Heure de lancement : locale ou UTC » le consignait.

**Décision.** Sur choix d'Olivier (2026-11-14) : l'heure de lancement est l'heure locale de la machine (US-001 CA-2). Le CDC s'aligne sur le comportement réel. Écartée : l'UTC.

**Conséquences.** Le code est déjà conforme, rien n'est codé dans cette session. Le test existant fige une horloge construite en heure locale ; il ne dépend donc pas du fuseau. La dette « Heure de lancement » est soldée, donc supprimée de `DEBTS.md`.

## #48 — Un hub qui ne peut pas se mettre en écoute refuse de démarrer (nouveau CA-8)

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-8 (nouveau).*

**Contexte.** La décision #45 laissait « un port déjà occupé » non décidé. Sondé le 2026-11-14 (base jetable) : quand le port est pris, le processus se termine avec le code `1` et la sortie d'erreur porte `Server starting failed: listen EADDRINUSE: address already in use 0.0.0.0:<port>` ; rien n'écoute. Le code de sortie et le préfixe sont ceux de tout échec de démarrage.

**Décision.** Sur choix d'Olivier (2026-11-14) : nouveau CA-8, dans le style du CA-7. Si le serveur ne peut pas se mettre en écoute (port déjà occupé, ou toute autre erreur système d'écoute), `npm start` refuse de démarrer : code de sortie `1`, message `Server starting failed: <cause>` sur la sortie d'erreur, rien n'écoute. La cause est celle du système ; le libellé `listen EADDRINUSE: …` est un exemple non normatif (décision #53).

**Conséquences.** Le code est déjà conforme, rien n'est codé. Le port occupé n'a aucun test : seule la sonde manuelle le couvre (`DEBTS.md`, « `index.ts` et `seed.ts` sans test »). Le CA-8 prend le numéro suivant le CA-7, le CA-6 étant retiré (décision #54).

## #49 — Quand `PORT` et `JWT_*` sont invalides ensemble, seule l'erreur des variables `JWT_*` est rapportée

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-7.*

**Contexte.** La décision #45 notait que le CA-7 ne fixe pas l'ordre des contrôles entre `PORT` et les variables JWT. Sondé le 2026-11-14 (base jetable) : `PORT=abc` avec un `JWT_SECRET` trop court ne rapporte que le secret ; le code lit `JWT_*` puis `PORT`, dans le même `try`, et s'arrête à la première erreur.

**Décision.** Sur choix d'Olivier (2026-11-14) : quand `PORT` et `JWT_SECRET` / `JWT_EXPIRATION` sont invalides ensemble, une seule erreur est rapportée, celle des variables `JWT_*` d'abord. Le serveur refuse de démarrer dans les deux cas (code `1`).

**Conséquences.** Le code est déjà conforme, rien n'est codé. Aucun test ne fixe cet ordre (`DEBTS.md`). L'ordre entre `JWT_SECRET` et `JWT_EXPIRATION` eux-mêmes n'est pas fixé par cette décision, ni par US-003 CA-19 et CA-20.

## #50 — Les messages de démarrage sortent sur la sortie standard, les messages d'échec sur la sortie d'erreur

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-2, CA-3, CA-4, CA-7, CA-8.*

**Contexte.** Le CDC ne dit pas sur quel flux sortent les messages. Sondé le 2026-11-14 (base jetable) : au démarrage normal, la sortie standard porte `🚀 Server started at HH:mm:ss` et `📡 Listening on http://<IP>:<PORT>`, plus des lignes JSON de journalisation de Fastify (`Server listening at http://…`) ; en échec, la sortie d'erreur porte `Server starting failed: <cause>` et le code de sortie vaut `1`.

**Décision.** Sur choix d'Olivier (2026-11-14) : les messages de démarrage (CA-2, CA-3, CA-4) sortent sur la sortie standard ; le message d'échec (CA-7, CA-8 et refus des variables `JWT_*`, US-003 CA-19 et CA-20) sur la sortie d'erreur. Les lignes JSON `Server listening at …` que Fastify écrit sur la sortie standard au démarrage normal ne sont ni prescrites ni interdites : elles ne font partie d'aucun CA (point de vigilance d'US-001).

**Conséquences.** Le code est déjà conforme, rien n'est codé. `src/index.test.ts` lit le message d'échec du `PORT` invalide sur la sortie standard et la sortie d'erreur mêlées : le flux de chaque message n'est pas asserté (`DEBTS.md`). US-003 n'est pas modifiée par cette session : son CA-19 et son CA-20 ne nomment pas le flux, la précision vit ici et dans US-001.

## #51 — Le hub écoute sur toutes les interfaces IPv4

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-1.*

**Contexte.** Le CDC ne dit pas sur quelle adresse le hub écoute. Le code écoute sur `0.0.0.0` (constaté le 2026-11-14, base jetable, dans le libellé `listen EADDRINUSE: … 0.0.0.0:<port>` de la décision #48).

**Décision.** Sur choix d'Olivier (2026-11-14) : le hub écoute sur toutes les interfaces IPv4 (`0.0.0.0`), pas seulement sur le loopback (US-001 CA-1). Le point de vigilance d'US-001 sur une éventuelle variable `HOST` reste inchangé (YAGNI).

**Conséquences.** Le code est déjà conforme, rien n'est codé. Aucun test ne vérifie l'adresse d'écoute sur le processus réel.

## #52 — Un fichier `.env` est lu au démarrage ; la variable d'environnement réelle prime

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-5 et CA-7, tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** `index.ts` charge `dotenv/config` : un fichier `.env` alimente les variables, sans que le CDC le dise. Sondé le 2026-11-14 (base jetable) : `PORT=4888` dans l'environnement bat `PORT=4777` dans `.env`. Un `PORT=` vide dans `.env` est une chaîne vide, que la décision #45 refuse.

**Décision.** Sur choix d'Olivier (2026-11-14) : un fichier `.env` est lu au démarrage ; la variable d'environnement réelle prime sur `.env`. Un `PORT=` vide dans `.env` est refusé comme toute chaîne vide (US-001 CA-7, décision #45). La règle vaut pour toutes les variables du tableau de `CONVENTIONS-TECHNIQUES.md`, qui la rappelle.

**Conséquences.** Le code est déjà conforme, rien n'est codé. Aucun test ne couvre le rôle de `.env` ni sa priorité (`DEBTS.md`). Où le fichier est cherché n'est pas prescrit.

## #53 — Les libellés « Ex : » sont des exemples non normatifs ; le repli du CA-4 affiche `localhost:<PORT>`

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-2, CA-3, CA-4, CA-8.*

**Contexte.** Le CA-7 dit déjà que son libellé est un exemple ; les CA-2, CA-3 et CA-4 écrivent « Ex : » sans le dire, et l'exemple du CA-4 ne montre que le port `3000`. Constaté le 2026-11-14 : le message de repli affiche le `PORT` configuré.

**Décision.** Sur choix d'Olivier (2026-11-14) : les libellés « Ex : » des CA-2, CA-3 et CA-4 sont des exemples non normatifs, comme celui du CA-7 (et celui du CA-8). Sont normatifs : le format `HH:mm:ss`, l'adresse IPv4 et le port. Le message de repli du CA-4 affiche `localhost:<PORT>`, le `PORT` configuré, pas toujours `3000`.

**Conséquences.** Le code est déjà conforme, rien n'est codé. Les tests de `src/server.test.ts` assertent déjà les libellés actuels : ils ne deviennent pas normatifs pour autant.

## #54 — CA-6 d'US-001 (couverture ≥ 90 %) est retiré, la numérotation est conservée

*`docs(specs): settle the startup behaviours that US-001 leaves unspecified` — US-001/CA-6.*

**Contexte.** CA-6 (« Les tests couvrent les cas : démarrage normal, absence d'interface réseau, port personnalisé ; couverture ≥ 90 % ») n'est pas un comportement observable du hub : la couverture relève de la méthode TDD (`docs/method/WORKFLOW.md`, `CONVENTIONS-TECHNIQUES.md`). Le CA-7 est cité par les décisions #45 et #46, par `CONVENTIONS-TECHNIQUES.md`, par les tests et par les handoffs.

**Décision.** Sur choix d'Olivier (2026-11-14) : la ligne CA-6 est supprimée du tableau d'US-001, une note datée sous le tableau dit que CA-6 est retiré et que la numérotation est conservée ; il n'y a donc pas de CA-6, le nouveau CA est le CA-8. Le bandeau « Exigence de couverture » est retiré d'US-001 (il justifiait ce seul CA) ; la ligne « Tests unitaires avec couverture ≥ 90% » du périmètre aussi. Les autres US gardent leur CA de couverture et leur bandeau.

**Conséquences.** Rien n'est codé. Dette consignée dans `DEBTS.md` : les vingt et une autres US portent encore un CA de couverture et le bandeau. Références à CA-6 d'US-001 laissées en l'état : `docs/specs/ETAT-DES-LIEUX-socle-hub.md` (relevé daté, hors périmètre, session des diagrammes) et les handoffs passés.

## #55 — Un hub dont la base de données ne peut pas être ouverte refuse de démarrer (nouveau CA-9)

*`docs(specs): refuse to start when the database cannot be opened` — US-001/CA-9 (nouveau), CA-7, tableau des spécifications propres d'US-001, tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** US-001 dit « Base de données : Non utilisée dans cette US », alors que `index.ts` ouvre la base (`new Database(processEnvironment.sqliteDbPath)`) après les contrôles de `JWT_*` et de `PORT`, avant l'écoute. Sondé le 2026-11-14 : avec `SQLITE_DB_PATH` dans un dossier inexistant, `npm start` sort en code `1` sur une pile d'erreur brute non interceptée (`TypeError: Cannot open database because the directory does not exist`), sans le message `Server starting failed: …` du CA-8 ; l'ouverture est hors du `try` qui ne garde que `JWT_*` et `PORT`.

**Décision.** Sur choix d'Olivier (2026-11-14) : nouveau CA-9, dans le style du CA-8. Si la base de données ne peut pas être ouverte, `npm start` refuse de démarrer : code de sortie `1`, message `Server starting failed: <cause>` sur la sortie d'erreur (décision #50), rien n'écoute. La cause est celle du système ; le libellé de l'exemple est non normatif (décision #53). L'ordre des contrôles reste l'ordre actuel : variables `JWT_*`, puis `PORT`, puis ouverture de la base ; une seule erreur est rapportée, comme pour `PORT` et `JWT_*` (décision #49). La ligne « Base de données » du tableau des spécifications propres d'US-001 et la section Périmètre sont corrigées en conséquence.

**Conséquences.** Le code n'est pas encore conforme : un `fix(startup)` à venir (session séparée, smoke test requis) interceptera l'échec d'ouverture ; puis un `test(startup)`. Rien n'est codé ici. Ne sont pas décidés : un fichier qui n'est pas une base SQLite, les permissions, la création automatique d'un fichier absent dans un dossier existant (sondés, consignés dans `DEBTS.md`). Le CA-9 prend le numéro suivant le CA-8, le CA-6 étant retiré (décision #54).

## #56 — Un fichier qui n'est pas une base SQLite entre dans le CA-9 ; un fichier de base absent est créé

*`docs(specs): settle what happens to a database file that is missing or not a SQLite database` — US-001/CA-9, tableau des spécifications propres d'US-001, Périmètre d'US-001, ligne `SQLITE_DB_PATH` et phrase sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** La décision #55 laisse deux cas non décidés, sondés le 2026-11-14 : un fichier qui n'est pas une base SQLite, et un fichier absent dans un dossier existant. Resondés le même jour, hors dépôt (dossier jetable, `tsx src/index.ts`, `JWT_SECRET` valide) : (a) un fichier texte, puis 200 octets aléatoires : code `1` sur une pile brute non interceptée (`SqliteError: file is not a database`), levée à la première instruction préparée (la création des tables dans le constructeur de `SqliteUserRepository`), donc après l'ouverture du fichier et avant la mise en écoute ; le fichier est laissé intact ; (b) un fichier absent dans un dossier existant : le fichier est créé (36 864 octets, les trois tables) et le hub écoute normalement ; (c) un fichier vide (zéro octet) existant : traité comme une base neuve, les tables y sont créées et le hub écoute.

**Décision.** Sur choix d'Olivier (2026-11-14), pour le fichier qui n'est pas une base SQLite : il entre dans le CA-9, même refus que « base non ouvrable » : code de sortie `1`, `Server starting failed: <cause>` sur la sortie d'erreur (décision #50), rien n'écoute. L'erreur peut survenir après l'ouverture du fichier, à la première instruction adressée à la base : elle compte tant qu'elle précède la mise en écoute. La cause est celle du système ; l'exemple (`file is not a database`, relevé en sondant) est non normatif (décision #53). Le critère du CA-9 est élargi en conséquence ; l'ordre des contrôles reste `JWT_*`, puis `PORT`, puis la base, une seule erreur rapportée (décisions #49 et #55).

**Constat reporté, pas un choix d'Olivier**, pour le fichier absent dans un dossier existant : Olivier a demandé que le cas soit spécifié, sans en dicter le contenu ; le CDC reporte donc le constat réel comme règle : le fichier est créé automatiquement au chemin `SQLITE_DB_PATH` et le hub démarre normalement (phrase du CA-9, ligne « Base de données » d'US-001, ligne `SQLITE_DB_PATH` des conventions). À challenger par Olivier : rien n'établit que la création automatique soit voulue plutôt que subie.

**Conséquences.** Le code n'est pas encore conforme pour le fichier non SQLite : le `fix(startup)` à venir (session séparée, smoke test requis, deux agents) devra intercepter l'échec d'ouverture et l'échec de la première instruction, tous deux avant l'écoute ; puis un `test(startup)`. Le code est déjà conforme pour le fichier absent. Rien n'est codé ici. Le fichier vide (zéro octet) est sondé et non spécifié : aucune règle écrite, consigné dans `DEBTS.md`, comme les permissions (non sondées, session en root). Le CA-9 garde son numéro, aucun nouveau CA n'est créé : le refus est le même, seul son critère s'élargit. La décision #55 n'est pas modifiée.

## #57 — Un hub dont `SQLITE_DB_PATH` est définie mais vide refuse de démarrer (nouveau CA-10)

*`docs(specs): refuse to start when SQLITE_DB_PATH is empty` — US-001/CA-10 (nouveau), CA-7, CA-9, tableau des spécifications propres et Périmètre d'US-001, ligne `SQLITE_DB_PATH` et phrases sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** Le CDC ne dit rien d'une `SQLITE_DB_PATH` définie mais vide, relevé le 2026-11-14 en sondant le fichier de base absent (décision #56). Le code lit `process.env.SQLITE_DB_PATH || "quiz.db"` (`ProcessEnvironment`) : la chaîne vide vaut absente et le hub ouvre `quiz.db` dans le dossier courant. Sondé le 2026-11-14, hors dépôt (dossier jetable, `tsx src/index.ts`, `JWT_SECRET` valide) : `SQLITE_DB_PATH=` crée `quiz.db` (36 864 octets) et le hub écoute. `PORT`, elle, refuse la chaîne vide (décision #45), à la différence de `JWT_EXPIRATION` et de `BCRYPT_COST`.

**Décision.** Sur choix d'Olivier (2026-11-14) : quand `SQLITE_DB_PATH` est définie mais vide, le hub la refuse, comme `PORT` (décision #45) : `npm start` refuse de démarrer, code de sortie `1`, message `Server starting failed: <message>` sur la sortie d'erreur (décision #50), le message nommant `SQLITE_DB_PATH` et la règle (le chemin de la base ne peut pas être vide) sans reprendre la valeur ; rien n'écoute. Absente, la variable vaut `quiz.db` (inchangé). Le CDC fait foi : cette règle l'emporte sur le code. Forme : nouveau CA-10, dans le style du CA-7, pour garder le CA-9 centré sur l'ouverture de la base. Place dans l'ordre des erreurs : dans l'étape « base de données », après les contrôles de `JWT_*` et de `PORT` et avant l'ouverture de la base, une seule erreur rapportée (décisions #49, #55 et #56). Le libellé de l'exemple est non normatif (décision #53).

**Conséquences.** Le code n'est pas encore conforme : la chaîne vide vaut encore absente. Le `fix(startup)` à venir (session séparée, smoke test requis) devra aussi couvrir ce cas, en plus de l'échec d'ouverture et du fichier non SQLite (décisions #55 et #56) ; puis un `test(startup)`. Rien n'est codé ici. Ne sont pas spécifiés, sondés et consignés dans `DEBTS.md` : une valeur faite d'espaces seuls et les autres valeurs inhabituelles, ainsi que le comportement de `seed.ts`, qui lit la même variable par `ProcessEnvironment` (le CDC d'US-002 est muet : non décidé). La décision #55 et la décision #56 ne sont pas modifiées.

## #58 — Un fichier de base existant de zéro octet est traité comme une base neuve

*`docs(specs): treat an empty database file as a new database` — US-001/CA-9, tableau des spécifications propres d'US-001, ligne `SQLITE_DB_PATH` du tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** La décision #56 a sondé et laissé non spécifié un fichier de base existant de zéro octet (cas (c)). Resondé le 2026-11-14, hors dépôt (dossier jetable, `tsx src/index.ts`, `JWT_SECRET` valide) : avant, le fichier fait 0 octet ; après, il fait 36 864 octets et contient les trois tables (`T_USER_USR`, `T_THEME_THM`, `T_QUESTION_QST`) ; le hub écoute (`/health` répond `200`) et la sortie d'erreur reste vide. SQLite traite un fichier de zéro octet comme une base vide, ce qui le distingue d'un fichier non vide qui n'est pas une base SQLite (décision #56).

**Décision.** Sur choix d'Olivier (2026-11-14) : constat reporté. Olivier a demandé que le cas soit spécifié, sans en dicter le contenu, et a validé que le CDC reporte le constat actuel : un fichier de base existant de zéro octet est traité comme une base neuve ; les tables sont créées dedans et le hub démarre normalement (il écoute). Ce n'est pas une erreur du CA-9 : le refus du fichier qui n'est pas une base SQLite (décision #56) ne le vise pas. Forme : une phrase de plus dans le CA-9, à la suite de celle du fichier absent (même nature : un fichier qui n'est pas une erreur), sans nouveau CA ; le CA-9 garde son numéro. À challenger par Olivier : rien n'établit que ce comportement soit voulu plutôt que subi (par exemple, un fichier vide laissé par une erreur de manipulation est accepté sans avertissement).

**Conséquences.** Le code est déjà conforme : rien n'est codé, aucune modification sous `src/`. Point de test à venir : un test de `src/index.test.ts` (`test(startup)`, après le `fix(startup)`) prouvera le fichier de zéro octet (le hub écoute, les tables sont créées), avec le fichier absent. Ne sont pas touchés : `SQLITE_DB_PATH` vide pour le seed et `SQLITE_DB_PATH` faite d'espaces seuls, non décidés (sessions séparées). Les décisions #55, #56 et #57 ne sont pas modifiées.

## #59 — Un seed dont `SQLITE_DB_PATH` est définie mais vide refuse de s'exécuter (nouveau CA-8 d'US-002)

*`docs(specs): refuse to seed when SQLITE_DB_PATH is empty` — US-002/CA-8 (nouveau), workflow et Périmètre d'US-002, renvoi depuis US-001/CA-10, ligne `SQLITE_DB_PATH` et phrases sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** La décision #57 laisse le seed non décidé : il lit `SQLITE_DB_PATH` par `ProcessEnvironment` (`process.env.SQLITE_DB_PATH || "quiz.db"`) et le CDC d'US-002 ne cite pas la variable. Sondé le 2026-11-14, hors dépôt (dossier jetable, `tsx src/seed.ts`, onze mots de passe valides, `BCRYPT_COST=4`) : (a) `SQLITE_DB_PATH=` vide : `quiz.db` créé (16 384 octets), onze comptes écrits, code `0`, sorties vides, comme pour une variable absente ; (b) un `SQLITE_DB_PATH=` vide dans un fichier `.env`, sans variable réelle : même résultat ; la variable réelle prime sur `.env` (décision #52) ; (c) ordre actuel des contrôles : la base est ouverte en premier (`new Database(…)` en tête de `seed.ts`, qui crée le fichier et la table), puis la table est lue (non vide : ligne du CA-7, code `0`, même avec un mot de passe trop court et `BCRYPT_COST=abc`), puis les mots de passe (le premier compte fautif est nommé), puis `BCRYPT_COST` ; un refus de mot de passe ou de coût laisse donc un `quiz.db` créé, table vide, zéro compte (16 384 octets) ; (d) `SQLITE_DB_PATH` vide avec un mot de passe trop court ou `BCRYPT_COST=abc` : le mot de passe, ou le coût, est refusé, après création de `quiz.db` (le contrôle du chemin n'existe pas).

**Décision.** Sur choix d'Olivier (2026-11-14) : quand `SQLITE_DB_PATH` est définie mais vide, le seed la refuse, comme le hub (US-001 CA-10, décision #57) : `npm run seed` refuse de s'exécuter, code de sortie `1`, message sur la sortie d'erreur qui nomme `SQLITE_DB_PATH` et la règle (le chemin de la base ne peut pas être vide) sans reprendre la valeur, rien n'est écrit en base. Absente, la variable vaut `quiz.db` (inchangé). Le CDC fait foi : cette règle l'emporte sur le code. Forme : nouveau CA-8 d'US-002, dans le style du CA-6 (refus : code `1`, message qui nomme la variable et la règle, exemple non normatif, décision #53), pour ne pas toucher au CA-6, qui dit l'inverse (vide vaut absente pour `BCRYPT_COST`) ; le workflow d'US-002 et son Périmètre sont mis à jour, le CA-10 d'US-001 renvoie au CA-8. Place dans l'ordre des contrôles : en premier, avant l'ouverture de la base, donc avant la vérification de la table (CA-7), des mots de passe (CA-4) et de `BCRYPT_COST` (CA-6), cohérente avec US-001 où le contrôle de la variable précède l'ouverture (décision #57) ; une seule erreur est rapportée, celle de `SQLITE_DB_PATH`, et ni la ligne du CA-7 ni un fichier de base ne sont produits. Le `SQLITE_DB_PATH=` vide d'un fichier `.env` est refusé comme toute chaîne vide (décision #52). Le libellé de l'exemple (`User seeding failed: SQLITE_DB_PATH cannot be empty.`) est non normatif (décision #53) : il reprend le préfixe que `seed.ts` affiche déjà pour ses refus. La sortie d'erreur est nommée ici ; les CA-4 et CA-6 ne nomment pas le flux (le code y écrit déjà par `console.error`).

**Conséquences.** Le code n'est pas encore conforme : la chaîne vide vaut encore absente et la base est ouverte avant tout contrôle. Le `fix(seed)` à venir (session séparée, smoke test requis) devra lire la valeur brute (sans `||`) et refuser avant `new Database(…)`, en même temps que le `fix(startup)` du hub (décision #57), qui partage `ProcessEnvironment` ; puis un test du seed par processus enfant (code `1`, sortie d'erreur qui nomme la variable sans la reprendre, aucun fichier créé, une seule erreur avec un mot de passe ou `BCRYPT_COST` fautif aussi, `.env` vide refusé). Rien n'est codé ici, aucune modification sous `src/`. Non décidé, inchangé : `SQLITE_DB_PATH` faite d'espaces seuls, pour le hub comme pour le seed (sondé : le seed sort en code `0` sur une base en mémoire, sans fichier, comme le hub) ; le seed avec une base non ouvrable ou non SQLite, que le CDC d'US-002 ne spécifie pas (sondé : code `1`, pile brute, sans `User seeding failed: …`). Les décisions #55, #56, #57 et #58 ne sont pas modifiées.


## #60 — Une `SQLITE_DB_PATH` faite uniquement d'espaces est refusée comme une valeur vide, par le hub (CA-10) et par le seed (CA-8)

*`docs(specs): refuse a SQLITE_DB_PATH made only of spaces` — US-001/CA-10, US-002/CA-8, ligne `SQLITE_DB_PATH` et phrases sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`.*

**Contexte.** Les décisions #57 (hub) et #59 (seed) refusent une `SQLITE_DB_PATH` définie mais vide et laissent non décidée la valeur faite d'espaces seuls. Resondé le 2026-11-14, hors dépôt (dossier jetable, `tsx src/index.ts` avec `JWT_SECRET` valide, `tsx src/seed.ts` avec onze mots de passe valides et `BCRYPT_COST=4`, environnement explicite) : (a) `"   "` (trois espaces) et `" "` (un espace) : le hub écoute (`/health` répond `200`), la sortie d'erreur est vide, aucun fichier n'est créé ; le seed sort en code `0`, sorties vides, aucun fichier créé (base en mémoire, aucun compte ne survit au processus) ; (b) une tabulation seule, un mélange d'espaces et de tabulation, un saut de ligne seul : même constat que (a), hub et seed ; (c) ` quiz.db` (espace en tête) et `quiz.db ` (espace en fin) : le hub écoute et le seed sort en code `0`, avec un fichier `quiz.db` créé, sans espace dans son nom ; (d) cause : `better-sqlite3` 13.0.3 applique `trim()` au nom de fichier (`lib/database.js`), donc retire tous les blancs de JavaScript, pas seulement U+0020, et traite un nom devenu vide comme une base en mémoire ; (e) `SQLITE_DB_PATH=` vide, pour mémoire : `quiz.db` créé, le hub écoute, le seed écrit onze comptes (constat des décisions #57 et #59, inchangé).

**Décision.** Sur choix d'Olivier (2026-11-14) : une `SQLITE_DB_PATH` définie mais faite uniquement d'espaces est refusée, comme une valeur vide, par le hub (US-001 CA-10, décision #57) et par le seed (US-002 CA-8, décision #59) : même refus (hub : `npm start` se termine avec le code `1`, message `Server starting failed: <message>` sur la sortie d'erreur qui nomme `SQLITE_DB_PATH` et la règle, rien n'écoute ; seed : code `1`, message sur la sortie d'erreur qui nomme `SQLITE_DB_PATH` et la règle, aucune base ouverte, aucun fichier créé ni modifié, aucun compte créé), même position dans l'ordre des contrôles (hub : après `JWT_*` et `PORT`, avant l'ouverture de la base ; seed : en premier, avant l'ouverture), une seule erreur rapportée (décisions #49, #55, #57 et #59). Le message ne reprend pas la valeur ; la règle devient « le chemin de la base ne peut être ni vide ni fait uniquement d'espaces » et les exemples non normatifs (décision #53) deviennent `Server starting failed: SQLITE_DB_PATH cannot be empty or made only of spaces.` et `User seeding failed: SQLITE_DB_PATH cannot be empty or made only of spaces.` Absente, la variable vaut toujours `quiz.db`. Le CDC fait foi : cette règle l'emporte sur le code. Forme : le CA-10 d'US-001 et le CA-8 d'US-002 sont étendus (critère et phrases), sans nouveau CA ; la numérotation est conservée (pas de CA-6 dans US-001, décision #54).

**Contenu de la règle.** Olivier a dit « espaces seuls » : la règle vise un ou plusieurs espaces U+0020 et rien d'autre. Le choix tient à cette lettre ; l'effet de bord de la bibliothèque (constat (d)) n'est pas pris pour une règle.

**Sondé, non spécifié, non décidé** (à décider par Olivier, comme la décision #46 l'a fait pour `PORT`) : une tabulation seule ; un mélange d'espaces et de tabulation ; un chemin non vide avec des espaces en tête ou en fin (` quiz.db`, qui ouvre `quiz.db`) ; un saut de ligne seul. Aucune règle écrite ; le CDC ne les mentionne que pour dire qu'ils ne sont pas spécifiés ; consignés dans `DEBTS.md`. À challenger : une tabulation seule suit le même chemin de code que des espaces seuls (base en mémoire) mais n'est pas refusée par le CDC ; le refus de l'une et pas de l'autre est une incohérence apparente, assumée tant qu'Olivier n'a pas élargi la règle.

**Conséquences.** Le code n'est pas encore conforme, hub et seed : la valeur faite d'espaces seuls est passée telle quelle à `new Database(…)`, qui ouvre une base en mémoire. Le `fix(startup)` à venir (session séparée, smoke test requis, deux agents), avec le `fix(seed)` (`ProcessEnvironment` est partagé), devra lire la valeur brute et la refuser avant `new Database(…)` avec un contrôle exact sur U+0020 (par exemple `^ +$`) et non un `trim()`, qui refuserait aussi les valeurs non spécifiées ; puis des tests par processus enfant (`src/index.test.ts` pour le hub, un test du seed) : code `1`, message sur la sortie d'erreur qui nomme la variable sans la reprendre, rien n'écoute (hub) ou aucun fichier créé (seed), une seule erreur quand d'autres contrôles échouent aussi ; ces tests ne fixent pas les valeurs non spécifiées. Rien n'est codé ici, aucune modification sous `src/`. Le `.env` n'est pas étendu : seule la chaîne vide d'un `.env` est visée (décisions #52, #57 et #59) ; une `SQLITE_DB_PATH` faite d'espaces écrite dans un `.env` n'a pas été sondé. Les décisions #55 à #59 ne sont pas modifiées.

## #61 — `SQLITE_DB_PATH` : une valeur faite uniquement de blancs est refusée, quels que soient les blancs ; les blancs qui bordent un chemin sont ignorés

*`docs(specs): ignore the whitespace around SQLITE_DB_PATH and refuse a blank one` — US-001/CA-10, US-002/CA-8, ligne `SQLITE_DB_PATH` et phrases sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Précise la décision #60 ; les décisions #57, #59 et #60 ne sont pas modifiées.*

**Contexte.** La décision #60 refuse une `SQLITE_DB_PATH` faite d'espaces U+0020 seuls et laisse « sondés, non spécifiés, non décidés » la tabulation seule, le mélange, le saut de ligne seul et le chemin non vide bordé de blancs. Olivier (2026-11-14) veut que le refus vise les blancs en général, et que le chemin bordé de blancs soit spécifié. Sondé le 2026-11-14, hors dépôt (dossier jetable, `tsx src/index.ts` avec `JWT_SECRET` valide et `PORT` libre, `tsx src/seed.ts` avec onze mots de passe valides et `BCRYPT_COST=4`, environnement explicite, rien de committé), hub et seed, même constat pour les deux : (a) valeur faite d'un seul caractère parmi U+0020, U+0009, U+000A, U+000B, U+000C, U+000D, U+00A0, U+1680, U+2003 (échantillon de U+2000 à U+200A), U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF, ou d'un mélange (espace, tabulation, LF, CR ; NBSP, U+3000, BOM) : le hub écoute (`/health` répond `200`), le seed sort en code `0`, sorties vides, aucun fichier créé (base en mémoire) ; (b) U+200B seul, U+0085 seul, U+180E seul, U+200B suivi d'une espace : le hub écoute et le seed sort en code `0`, avec un fichier créé dont le nom est ce caractère (sans l'espace finale pour U+200B suivi d'une espace) ; ce ne sont pas des blancs ; (c) chemin non vide bordé de blancs (` quiz.db`, `quiz.db `, tabulation + LF avant et CR + LF après ; NBSP et U+3000 des deux côtés ; BOM en tête) : `quiz.db` créé, sans les blancs dans son nom ; un U+200B en tête n'est pas retiré (le fichier porte U+200B dans son nom) ; un blanc à l'intérieur est conservé (`qu iz.db` crée un fichier de ce nom) ; (d) cause lue dans `node_modules/better-sqlite3/lib/database.js` (13.0.3, ligne 29) : le nom de fichier est passé à `trim()` ; un nom devenu vide, ou `:memory:`, est une base anonyme. Les caractères que `trim()` retire sont, vérifié sous Node 22 sur tous les points de code, exactement les 25 de la liste ci-dessous ; la bibliothèque a été sondée (appel direct de `new Database`, puis hub et seed pour les caractères cités) de U+0000 à U+3100 par plages, plus U+FEFF ; ailleurs, le traitement est déduit de la source et de `trim()`, non sondé ; (e) `.env` (seed, dossier jetable) : `SQLITE_DB_PATH=   ` non quotée est lue vide par le lecteur de `.env` (`quiz.db` créé, comme une valeur vide), `SQLITE_DB_PATH="   "` quotée est lue avec ses espaces (base en mémoire), `SQLITE_DB_PATH=  quiz.db  ` et `" quiz.db "` donnent `quiz.db` ; (f) `SQLITE_DB_PATH=:memory:` (et ` :memory: `) : base en mémoire, hub et seed (constat de la bibliothèque, non spécifié) ; (g) à titre de comparaison, `PORT` bordé d'un blanc est refusé (CA-7, décision #46), alors que le chemin bordé est ici ignoré : asymétrie assumée, à challenger.

**Décision.**
1. **Sur choix d'Olivier (2026-11-14)** : le refus de `SQLITE_DB_PATH` ne vise plus les seuls espaces U+0020 ; il vise toute valeur définie faite uniquement de blancs, quels qu'ils soient (espace, tabulation, saut de ligne, mélanges, etc.), comme la chaîne vide : mêmes refus, message, code `1` (hub : rien n'écoute ; seed : aucune base ouverte, aucun fichier créé ni modifié, aucun compte créé), place dans l'ordre des contrôles et unicité de l'erreur (décisions #49, #55, #57, #59 et #60). Le message dit « ni vide ni fait uniquement de blancs » ; les exemples non normatifs (décision #53) deviennent `Server starting failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.` et `User seeding failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.`
2. **Constat reporté, à challenger (règle de lecture des blancs de bordure ; Olivier a demandé que le cas soit spécifié sans en dicter le contenu, la règle écrite reprend le comportement actuel sondé)** : la valeur de `SQLITE_DB_PATH` est lue sans les blancs qui l'entourent (début et fin) ; les blancs intérieurs sont conservés ; si le résultat est vide, le démarrage (hub) ou l'exécution (seed) est refusé comme pour une valeur vide ; sinon c'est le chemin nettoyé qui est utilisé (` quiz.db` ouvre `quiz.db`). Les deux points forment une seule règle : la lecture nettoie, puis le vide est refusé ; la liste des blancs est la même pour les deux.
3. **Liste normative des blancs** (liste fermée, 25 caractères, sans mécanisme dans le CDC) : U+0020 espace, U+0009 tabulation, U+000A saut de ligne, U+000B tabulation verticale, U+000C saut de page, U+000D retour chariot, U+00A0 espace insécable, U+1680, U+2000 à U+200A (onze espaces typographiques), U+2028, U+2029, U+202F, U+205F, U+3000 espace pleine chasse, U+FEFF BOM. Les caractères sondés qui ne sont pas retirés (U+200B espace de largeur nulle, U+0085, U+180E) ne sont pas des blancs pour la règle : seuls, ils forment un chemin valide d'un caractère, non refusé (le fichier créé a un nom invisible ; conséquence assumée de la règle, à challenger).
4. Forme : le CA-10 d'US-001 et le CA-8 d'US-002 sont réécrits, sans nouveau CA (même refus, même place) ; la numérotation est conservée (pas de CA-6 dans US-001, décision #54). La règle de lecture et la liste sont écrites dans les deux CA, identiques ; elles portent sur la valeur reçue par le processus, de l'environnement réel ou d'un `.env`. Absente, la variable vaut toujours `quiz.db`. Le CDC fait foi : cette règle l'emporte sur le code.

**Conséquences.**
- Le code n'est pas conforme, hub et seed. Hub : la valeur faite de blancs seuls ouvre une base en mémoire et le hub écoute (la vide vaut `quiz.db`, `|| "quiz.db"` dans `ProcessEnvironment`). Seed : code `0` sur une base en mémoire (vide : onze comptes dans `quiz.db`). Le chemin bordé est déjà ignoré par accident (le `trim()` de la bibliothèque), sans contrôle explicite.
- Le `fix(startup)` à venir (session séparée, smoke test requis, deux agents), avec le `fix(seed)` (`ProcessEnvironment` est partagé), devra lire la valeur brute (sans `||`), retirer les blancs de bordure selon la liste ci-dessus (pas selon la valeur de la bibliothèque : le contrôle ne doit pas dépendre de la version de `better-sqlite3`), refuser si le résultat est vide, avant `new Database(…)`, puis passer le chemin nettoyé à la base. Le choix du mécanisme (par exemple une expression régulière sur ces 25 caractères) revient au fix, pas au CDC.
- Tests à prévoir, par processus enfant (`src/index.test.ts` pour le hub, un test du seed) : pour chaque blanc de la liste, seul puis répété, refus code `1`, message sur la sortie d'erreur qui nomme `SQLITE_DB_PATH` sans reprendre la valeur, rien n'écoute (hub) ou aucun fichier créé (seed), une seule erreur avec d'autres contrôles fautifs ; mélanges ; U+200B, U+0085 et U+180E seuls : non refusés ; chemin bordé de blancs (tabulation, LF, CR, NBSP, U+3000, BOM) : le fichier nettoyé est créé, le hub écoute, le seed écrit ses onze comptes ; blanc intérieur conservé ; couche `ProcessEnvironment` testée aussi (la chaîne vide, absente de `process-environment.test.ts`, doit l'être).
- Restent non spécifiés, consignés « sondé, non spécifié » dans `DEBTS.md` : `SQLITE_DB_PATH=:memory:` (base en mémoire) ; l'écriture des blancs dans un `.env` (guillemets) ; les permissions (non sondées, session en root) ; les caractères au-delà de U+3100 autres que U+FEFF (déduits de la source, non sondés). Le sujet « seed sur base non ouvrable ou non SQLite » reste intact (session séparée).
- Rien n'est codé ici, aucune modification sous `src/`. Les décisions #55 à #60 ne sont pas modifiées.
