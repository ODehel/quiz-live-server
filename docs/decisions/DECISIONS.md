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
