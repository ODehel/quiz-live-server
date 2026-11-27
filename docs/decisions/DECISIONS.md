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

## #62 — Un seed dont la base de données ne peut pas être ouverte refuse de s'exécuter (nouveau CA-9 d'US-002)

*`docs(specs): refuse to seed when the database cannot be opened` — US-002/CA-9 (nouveau), renvoi d'ordre dans le CA-8, workflow, structure des fichiers et Périmètre d'US-002, renvoi depuis US-001/CA-9, phrase sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Complète les décisions #55, #56 et #59 pour le seed ; elles ne sont pas modifiées.*

**Contexte.** Le hub refuse de démarrer quand sa base ne peut pas être ouverte ou n'est pas une base SQLite (US-001 CA-9, décisions #55 et #56). La décision #59 a laissé le seed hors de ce refus : « le seed avec une base non ouvrable ou non SQLite, que le CDC d'US-002 ne spécifie pas ». Resondé le 2026-11-14, hors dépôt (dossier jetable, `seed.ts` lancé par `tsx`, onze mots de passe valides, `BCRYPT_COST=4`, environnement explicite, rien de committé) : (a) dossier inexistant : code `1`, sortie standard vide, pile brute `TypeError: Cannot open database because the directory does not exist`, levée par `new Database(…)` en tête de `seed.ts`, hors de toute capture ; rien n'est créé ; (b) chemin qui désigne un dossier : code `1`, pile brute `SqliteError: unable to open database file`, rien n'est créé ni modifié ; (c) fichier texte : code `1`, pile brute `SqliteError: file is not a database`, levée à la première instruction adressée à la base (`createTableIfNotExists`, dans le constructeur de `SqliteUserRepository`), donc après l'ouverture du fichier et avant la lecture de la table ; le fichier reste intact, aucun compte ; (d) les refus du seed qui ont un libellé (CA-4 : `User seeding failed: Invalid password for account admin` ; CA-6 : `User seeding failed: BCRYPT_COST must be an integer between 4 and 31.`) passent par la capture de la promesse de `seed()` : préfixe `User seeding failed: `, message sur la sortie d'erreur, code `1` ; la pile brute n'y passe pas, parce que l'erreur est levée de façon synchrone avant l'appel à `seed()` ; (e) ordre réel des contrôles, sondé : ouverture de la base (et première instruction), puis table non vide (CA-7), puis mots de passe (CA-4), puis `BCRYPT_COST` (CA-6) ; un dossier inexistant avec un mot de passe trop court et `BCRYPT_COST=abc`, ou un fichier texte avec les mêmes fautes, ne rapporte que l'erreur de la base (pile brute, code `1`) ; une base valide absente avec un mot de passe trop court crée le fichier (16 384 octets), rapporte le mot de passe et laisse zéro compte ; (f) fichier absent dans un dossier existant : fichier créé (16 384 octets), onze comptes écrits, code `0`, sorties vides ; un second lancement affiche la ligne du CA-7, code `0` ; (g) fichier existant de zéro octet : traité comme une base neuve (16 384 octets), onze comptes écrits, code `0`, sorties vides.

**Décision.**
1. **Sur choix d'Olivier (2026-11-14)** : quand la base de données ne peut pas être ouverte, ou que le fichier désigné n'est pas une base SQLite (dossier inexistant, chemin qui désigne un dossier, fichier qui n'est pas une base SQLite, avec une erreur qui peut survenir après l'ouverture, à la première instruction adressée à la base), le seed refuse de s'exécuter, comme le hub (US-001 CA-9, décisions #55 et #56) : code de sortie `1`, message sur la sortie d'erreur avec le préfixe du seed, `User seeding failed: <cause>`, la cause étant celle que donne le système, aucun compte créé. Les exemples (`Cannot open database because the directory does not exist`, `unable to open database file`, `file is not a database`, relevés en sondant) sont non normatifs (décision #53). Le CDC fait foi : cette règle l'emporte sur le code.
2. **Constat reporté, à challenger (ordre des contrôles ; Olivier a demandé que l'ordre réel soit spécifié)** : le contrôle d'ouverture vient après celui de `SQLITE_DB_PATH` (CA-8, décision #59, qui reste le premier et refuse avant toute ouverture) et avant la vérification de la table (CA-7), des mots de passe (CA-4) et de `BCRYPT_COST` (CA-6) ; une seule erreur est rapportée ; la ligne du CA-7 n'est pas affichée quand la base ne s'ouvre pas. C'est l'ordre sondé (constat (e)), complété du CA-8 de la décision #59.
3. Forme : nouveau CA-9 d'US-002, dans le style du CA-8 et dans la section « Chemin de la base de données », plutôt qu'une extension du CA-8 : le critère est différent (l'état de la base, non la valeur de la variable) et le hub a fait le même choix (nouveau CA-9, décision #55). Le CA-8 gagne seulement le renvoi « avant l'ouverture de la base (CA-9) ». Le workflow (étape 1), la structure des fichiers (« CA-1 à CA-9 ») et le Périmètre d'US-002 sont mis à jour ; le CA-9 d'US-001 et la phrase sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md` renvoient au CA-9 d'US-002. La numérotation est conservée.

**Sondé, non spécifié, non décidé** (pour le hub, ils sont spécifiés par les décisions #56 et #58 ; la symétrie avec le seed n'a pas été décidée) : un fichier absent dans un dossier existant (constat (f) : créé, onze comptes, code `0`) et un fichier existant de zéro octet (constat (g) : base neuve, onze comptes, code `0`). Le CA-9 le dit explicitement et ne fixe rien ; consignés dans `DEBTS.md`. Le sujet `SQLITE_DB_PATH=:memory:` n'est pas traité ici (session séparée à suivre).

**Conséquences.**
- Le code n'est pas conforme : le code de sortie est déjà `1`, mais l'erreur sort en pile brute, sans le préfixe `User seeding failed: `, parce que `new Database(…)` et la construction de `SqliteUserRepository` s'exécutent au niveau du module de `seed.ts`, hors de la capture de la promesse de `seed()`. Le `fix(seed)` à venir (session séparée, smoke test requis ; il est à regrouper avec le `fix(startup)` du hub, `ProcessEnvironment` étant partagé avec les décisions #57, #59, #60 et #61) devra intercepter l'erreur d'ouverture de la base ET celle levée à la première instruction adressée à la base, y compris dans les constructeurs de repositories (`SqliteUserRepository` crée sa table à l'instanciation), et les rapporter par le même chemin que les autres refus : préfixe, sortie d'erreur, code `1`. Il doit aussi garder le CA-8 avant l'ouverture. Le choix du mécanisme (par exemple faire entrer l'ouverture dans la capture) revient au fix, pas au CDC.
- Tests à prévoir, par processus enfant (un test du seed, qui n'existe pas encore) : dossier inexistant, chemin qui désigne un dossier, fichier texte, 200 octets aléatoires : code `1`, sortie d'erreur qui commence par `User seeding failed: ` suivi d'une cause non vide, pas de pile, sortie standard vide, aucun compte ; une seule erreur quand un mot de passe est trop court et que `BCRYPT_COST` est invalide aussi ; le fichier texte reste intact ; la place du CA-8 avant l'ouverture reste couverte par les tests du CA-8 (décision #59). Ces tests ne fixent pas le fichier absent ni le fichier de zéro octet.
- Rien n'est codé ici, aucune modification sous `src/`. Les décisions #55, #56, #57, #58, #59, #60 et #61 ne sont pas modifiées.

## #63 — `SQLITE_DB_PATH=:memory:` n'est pas refusée : le hub démarre et le seed réussit, sur une base en mémoire

*`docs(specs): settle the :memory: database path` — US-001/CA-10, renvoi dans le CA-9, tableau des spécifications propres et Périmètre d'US-001 ; US-002/CA-8, workflow et Périmètre d'US-002 ; phrase sous le tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Tranche le point « `:memory:` non spécifié » laissé par la décision #61 ; les décisions #55 à #62 ne sont pas modifiées.*

**Contexte.** La décision #61 a sondé `SQLITE_DB_PATH=:memory:` (constat (f)) et l'a laissé « non spécifié » : `better-sqlite3` traite `:memory:` comme une base anonyme. Resondé le 2026-11-14, hors dépôt (dossier jetable, supprimé ensuite, rien de committé ; Node 22 local alors que `engines` demande 26 ; environnement explicite) : (a) hub, `tsx src/index.ts` avec `JWT_SECRET` de 32 caractères, `PORT` libre, `SQLITE_DB_PATH=:memory:` : il écoute (`GET /health` répond `200`), affiche les deux lignes de démarrage (CA-2 et CA-3) sur la sortie standard, la sortie d'erreur est vide, aucun fichier n'est créé ; (b) seed, `tsx src/seed.ts` avec onze mots de passe valides et `BCRYPT_COST=4` : code de sortie `0`, sorties vides, aucun fichier créé, onze comptes écrits dans une base qui disparaît avec le processus ; (c) ` :memory: ` (espaces autour) pour le hub et le seed, et une tabulation + retour chariot + saut de ligne autour de `:memory:` pour le seed et le hub : même résultat que (a) et (b), ce qui est la règle de lecture de la décision #61 (blancs de bordure retirés, liste de 25 caractères) appliquée avant.

**Décision.**
1. **Sur choix d'Olivier (2026-11-14)** : `:memory:` est une valeur valide, non vide, qui n'est pas faite de blancs : elle n'est donc refusée ni par le CA-10 d'US-001 (hub) ni par le CA-8 d'US-002 (seed). Le CDC le dit, sous forme de constat reporté et non de refus.
2. **Hub (US-001 CA-10)** : il démarre normalement et écoute ; la base est en mémoire, rien n'est persisté, les données disparaissent à l'arrêt du processus ; aucun fichier n'est créé. Le CA-9 gagne un renvoi : `:memory:` n'ouvre aucun fichier, ce n'est pas une base qui ne peut pas être ouverte.
3. **Seed (US-002 CA-8)** : il réussit (code de sortie `0`, sorties vides, aucun fichier créé) ; les comptes sont écrits dans une base en mémoire et ne survivent pas au processus. Olivier a choisi de le dire sans le refuser : l'effet (un seed qui ne persiste rien) est écrit tel quel.
4. **Lecture** : la règle de lecture de la décision #61 s'applique avant : ` :memory: ` désigne `:memory:`. Constat sondé (c), dit dans le CDC seulement parce qu'il a été constaté. Aucune règle de #57 à #62 n'est modifiée.
5. **Non spécifiés, inchangés** : le fichier absent et le fichier de zéro octet côté seed (symétrie avec le hub, #56 et #58, non décidée) ; l'écriture de blancs dans un `.env` (le `.env` n'a pas été sondé pour `:memory:`) ; les permissions ; les caractères au-delà de U+3100 autres que U+FEFF.
6. Forme : une phrase de plus dans le CA-10 d'US-001 et dans le CA-8 d'US-002 (même critère : la valeur de la variable), sans nouveau CA ; numérotation conservée (pas de CA-6 dans US-001, décision #54). Les libellés des lignes de démarrage restent non normatifs (décision #53).

**Conséquences.**
- Le code est déjà conforme : aucun fix, rien n'est codé, aucune modification sous `src/`. Le comportement du hub et du seed est inchangé.
- Tests à prévoir, par processus enfant : `src/index.test.ts` (`test(startup)`) : le hub écoute avec `SQLITE_DB_PATH=:memory:` et aucun fichier n'est créé dans le dossier de travail ; un test du seed (qui n'existe pas encore) : code `0`, sorties vides, aucun fichier créé. Ces tests ne fixent ni les lignes de démarrage de Fastify (décision #50) ni les cas non spécifiés du point 5.
- Consigné dans `DEBTS.md` : `:memory:` spécifié (#63), code conforme, non testé ; retiré des « non spécifiés, non décidés ».
- À challenger : un seed qui réussit sans rien persister est silencieux (le seed n'affiche rien quand il réussit, voir `DEBTS.md`) ; un `SQLITE_DB_PATH=:memory:` laissé dans un `.env` par erreur donnerait un hub dont les données disparaissent au redémarrage, sans avertissement ; accepté tant qu'Olivier n'a pas décidé autrement.

## #64 — Un seed dont le fichier de base est absent ou de zéro octet s'exécute normalement : constat reporté, comme le hub

*`docs(specs): settle seeding on a missing or empty database file` — US-002/CA-9, workflow et Périmètre d'US-002, renvoi depuis US-001/CA-9, ligne `SQLITE_DB_PATH` du tableau des variables de `CONVENTIONS-TECHNIQUES.md`. Tranche le point « symétrie avec le hub non décidée » laissé par les décisions #62 et #63 ; les décisions #55 à #63 ne sont pas modifiées.*

**Contexte.** Pour le hub, un fichier de base absent dans un dossier existant (décision #56) et un fichier existant de zéro octet (décision #58) sont spécifiés : ce ne sont pas des erreurs. Pour le seed, le CA-9 d'US-002 (décision #62) les disait « non spécifiés » et la symétrie n'était pas décidée. Sondés le 2026-11-14, hors dépôt (dossier jetable, supprimé ensuite, rien de committé ; Node 22 local alors que `engines` demande 26 ; `tsx src/seed.ts`, onze `SEED_PASSWORD_*` valides, `BCRYPT_COST=4`, environnement explicite, répertoire courant vide) : (a) fichier absent dans un dossier qui existe : le fichier est créé au chemin `SQLITE_DB_PATH` (16 384 octets), onze comptes écrits (lus ensuite dans `T_USER_USR`), code de sortie `0`, sortie standard et sortie d'erreur vides ; un second lancement affiche la ligne du CA-7 (`Seed ignoré — la table T_USER_USR contient déjà des comptes.`), code `0` ; (b) fichier existant de zéro octet : 0 octet avant, 16 384 octets après, onze comptes écrits, code `0`, sorties vides ; un second lancement affiche la ligne du CA-7, code `0` ; (c) cause : comme pour le hub (décision #58), SQLite traite un fichier de zéro octet comme une base vide, ce qui le distingue d'un fichier non vide qui n'est pas une base SQLite (décision #62, constat (c)) ; l'ouverture d'un fichier absent le crée. Les deux cas passent donc par l'ordre sondé des contrôles (décision #62) : le contrôle de `SQLITE_DB_PATH` (CA-8), l'ouverture sans erreur (CA-9), puis la table, vide dans une base neuve, donc le CA-7 ne s'applique pas, puis les mots de passe (CA-4) et `BCRYPT_COST` (CA-6).

**Décision.**
1. **Sur choix d'Olivier (2026-11-14)** : constat reporté, comme pour le hub (décisions #56 et #58). Olivier a demandé que les deux cas soient spécifiés pour le seed comme pour le hub, sans en dicter le contenu ; le CDC reporte le comportement sondé comme règle, sans en faire un refus.
2. **Fichier absent dans un dossier qui existe** : ce n'est pas une erreur. Le fichier est créé automatiquement au chemin `SQLITE_DB_PATH` et le seed se déroule normalement : onze comptes créés (CA-1), code de sortie `0`, sorties vides ; un second lancement affiche la ligne du CA-7, code de sortie `0`.
3. **Fichier existant de zéro octet** : ce n'est pas une erreur non plus. Il est traité comme une base neuve et le seed se déroule normalement : onze comptes créés, code de sortie `0`, sorties vides. Il ne relève pas du refus « fichier qui n'est pas une base SQLite » du CA-9 (décision #62), pas plus que pour le hub (décisions #56 et #58).
4. Forme : la phrase « Non spécifiés pour le seed » du CA-9 d'US-002 est remplacée par deux constats, à la suite du refus (même nature que dans le CA-9 d'US-001 : des fichiers qui ne sont pas des erreurs), sans nouveau CA ; l'ordre des contrôles de la décision #62 est inchangé, et le CA-9 garde son numéro. Le workflow (étape 1) et le Périmètre d'US-002 sont mis à jour ; la phrase correspondante du CA-9 d'US-001 renvoie au CA-9 d'US-002 ; la ligne `SQLITE_DB_PATH` du tableau des variables de `CONVENTIONS-TECHNIQUES.md` dit que le fichier absent est créé « au démarrage du hub et à l'exécution du seed » et que le fichier de zéro octet est traité comme une base neuve par les deux. La table `T_USER_USR` n'est pas nommée dans la règle : la section « Dépendance avec US-003 » d'US-002 (« le seed ne crée pas la table ») est antérieure et n'est pas touchée.
5. **Non touchés, inchangés** : `SQLITE_DB_PATH=:memory:` (décision #63) ; l'écriture de blancs dans un `.env` ; les permissions (non sondées, session en root) ; les caractères au-delà de U+3100 autres que U+FEFF. Sondé dans la décision #59 et toujours non spécifié : un refus de mot de passe (CA-4) ou de `BCRYPT_COST` (CA-6) sur un fichier absent laisse le fichier créé, table vide, zéro compte ; le CDC ne le dit pas.

**Conséquences.**
- Le code est déjà conforme : aucun fix, rien n'est codé, aucune modification sous `src/`. Le comportement du seed est inchangé.
- Tests à prévoir, par processus enfant (un test du seed, qui n'existe pas encore) : fichier absent dans un dossier existant : fichier créé, onze comptes, code `0`, sorties vides, second lancement avec la ligne du CA-7 et code `0` ; fichier de zéro octet : même constat. Ces tests ne fixent pas les cas du point 5.
- Consigné dans `DEBTS.md` : la clause « sondé, non spécifié, non décidé, côté seed » est retirée ; les deux cas sont spécifiés (#64), code conforme, non testé.
- À challenger : un seed lancé avec un chemin mal tapé dans un dossier existant crée sans avertissement une nouvelle base et y écrit onze comptes, au lieu d'échouer ; un fichier vide laissé par une erreur de manipulation est accepté de la même façon (même réserve que pour le hub, décisions #56 et #58). Le seed est silencieux quand il réussit (voir `DEBTS.md`), donc rien n'indique que le fichier a été créé. Accepté tant qu'Olivier n'a pas décidé autrement.

## #65 — Un refus du seed (CA-4, CA-6) ou un échec d'écoute du hub (CA-8) laisse en place le fichier de base que l'ouverture a créé : constat reporté

*`docs(specs): settle the database file left behind by a refused seed or a failed listen` — US-001/CA-8, US-002/CA-4, CA-6 et CA-9. Tranche le point « le CDC ne dit rien de ce fichier orphelin » laissé par les décisions #59 et #62 ; les décisions #55 à #64 ne sont pas modifiées.*

**Contexte.** L'ouverture de la base précède les contrôles des mots de passe (US-002 CA-4) et de `BCRYPT_COST` (CA-6) pour le seed (décision #62), et la mise en écoute pour le hub (US-001 CA-9 avant CA-8). Un refus qui suit l'ouverture laisse donc ce que l'ouverture a fait. Sondé le 2026-11-17, hors dépôt (dossier jetable supprimé ensuite, rien de committé ; Node 22 local alors que `engines` demande 26 ; `tsx`, environnement explicite, `BCRYPT_COST=4` sauf mention) : (a) seed, fichier absent, `BCRYPT_COST=abc`, ou mot de passe d'`admin` trop court, ou `SEED_PASSWORD_BUZZER_03` vide : code `1`, `User seeding failed: …`, fichier créé de 16 384 octets, table `T_USER_USR` présente, zéro compte ; (b) seed, fichier de zéro octet, mot de passe trop court : même résultat (16 384 octets, table, zéro compte) ; (c) hub, fichier absent, port occupé : code `1`, `Server starting failed: listen EADDRINUSE: …`, fichier créé de 36 864 octets avec `T_USER_USR`, `T_THEME_THM` et `T_QUESTION_QST`, vides ; (d) hub, fichier de zéro octet, port occupé : même résultat, trois tables vides ; (e) hub, base existante avec onze comptes, port occupé : code `1`, onze comptes conservés. Les refus du CA-9 d'US-001 et d'US-002 (base inutilisable) et ceux des variables (`JWT_*`, `PORT`, `SQLITE_DB_PATH`) précèdent l'ouverture ou n'en laissent rien.

**Décision.**
1. **Sur choix d'Olivier (2026-11-17, option 1)** : constat reporté. Le fichier créé par l'ouverture n'est pas supprimé quand un refus ultérieur survient. Une base neuve et vide est valide (décisions #56 et #58) ; le lancement suivant la réutilise.
2. **Seed** (US-002 CA-9, renvois dans CA-4 et CA-6) : fichier absent : créé, table `T_USER_USR` vide, zéro compte ; fichier de zéro octet : reçoit la table, zéro compte ; base existante : non touchée. Le lancement suivant trouve la table vide et applique le CA-1.
3. **Hub** (US-001 CA-8) : même règle quand l'écoute échoue : le fichier créé ou rempli par l'ouverture reste, avec les tables du hub, vides ; une base existante garde ses données.
4. **Non retenu** : supprimer un fichier créé par un lancement refusé. Cela demanderait de savoir si le fichier préexistait, et le risque d'effacer un fichier qui existait déjà dépasse l'hygiène gagnée. À rouvrir seulement sur décision d'Olivier (un `fix` avec smoke test).
5. **Non touchés, inchangés** : la ligne `SQLITE_DB_PATH` du tableau des variables de `CONVENTIONS-TECHNIQUES.md` (à compléter par une session suivante), `:memory:` (aucun fichier), les permissions, les blancs d'un `.env`, les caractères au-delà de U+3100.

**Conséquences.**
- Le code est déjà conforme : aucun fix, rien n'est codé, aucune modification sous `src/`.
- Tests à prévoir, par processus enfant : seed (fichier absent, puis zéro octet) avec un mot de passe invalide et avec `BCRYPT_COST` invalide : code `1`, fichier présent, table vide, zéro compte, base existante non touchée ; hub (fichier absent, zéro octet, base existante avec comptes) avec un port occupé : code `1`, fichier présent, tables vides ou comptes conservés ; lancement suivant après correction.
- Consigné dans `DEBTS.md` : le point 4 de « `SQLITE_DB_PATH` : points sondés, non spécifiés, non décidés » devient « spécifié, non testé ».
- À challenger : une base vide laissée par une erreur de mot de passe est acceptée sans avertissement ; un hub dont l'écoute échoue laisse un fichier de 36 864 octets qu'un chemin mal tapé aurait créé à tort.

## #66 — La ligne du seed sur une table non vide sort sur la sortie standard, avec le code `0` ; seul son sens est normatif : constat reporté

*`docs(specs): settle the output the seed writes its skipped-seed line on` — US-002/CA-7 et workflow (étape 2). Tranche le point « le CDC ne dit pas sur quelle sortie la ligne s'écrit, ni si son libellé est normatif » laissé par la décision #42 ; les décisions #1 à #65 ne sont pas modifiées.*

**Contexte.** La décision #42 fait dire au seed, quand `T_USER_USR` contient déjà des comptes, qu'il n'a rien créé, avec le code `0` (US-002 CA-7). Le CA-7 ne nomme pas la sortie et ne dit pas si l'exemple de libellé est normatif ; US-001 le dit pour ses messages (décisions #50 et #53). Sondé le 2026-11-18, hors dépôt (dossier jetable supprimé ensuite, rien de committé ; Node 22 local alors que `engines` demande 26 ; `tsx src/seed.ts`, onze `SEED_PASSWORD_*` valides, `BCRYPT_COST=4`, `JWT_SECRET` de 32 caractères, stdout, stderr et code capturés séparément) : (a) premier lancement : code `0`, sortie standard et sortie d'erreur vides, onze comptes ; (b) second lancement : code `0`, sortie standard `Seed ignoré — la table T_USER_USR contient déjà des comptes.` (une seule ligne), sortie d'erreur vide, fichier de base inchangé (sha256 identique avant et après) ; (c) second lancement avec `SEED_PASSWORD_ADMIN` trop court, `SEED_PASSWORD_BUZZER_03` vide ou absente, `BCRYPT_COST=abc`, ou un mot de passe trop court avec `BCRYPT_COST=abc` : même résultat qu'en (b), code `0` (ordre déjà spécifié : CA-9, CA-7, CA-4, CA-6).

**Décision.**
1. **Sur choix d'Olivier (2026-11-18)** : la ligne du CA-7 sort sur la **sortie standard** ; la sortie d'erreur reste vide dans ce cas ; code de sortie `0`.
2. **Normatif** : la ligne dit qu'aucun compte n'a été créé parce que la table n'est pas vide, et tient sur une seule ligne. L'exemple `Seed ignoré — la table T_USER_USR contient déjà des comptes.` est **non normatif**, comme ceux d'US-001 (décision #53). Seul le sens est déclaré normatif ; le CDC ne déclare normatifs ni la langue, ni la ponctuation, ni le nom de la table.
3. Le seed ne modifie rien dans ce cas (déjà écrit au CA-3) : rappelé au CA-7, pas réécrit.
4. Forme : le CA-7 et l'étape 2 du workflow d'US-002 sont précisés, sans nouveau CA ; le CA-7 garde son numéro.

**Conséquences.**
- Le code est déjà conforme : aucun fix, rien n'est codé, aucune modification sous `src/`. Le comportement du seed est inchangé.
- Test à prévoir, par processus enfant (`src/seed.test.ts`) : second lancement : code `0`, ligne sur la sortie standard, sortie d'erreur vide, base inchangée ; mêmes constats avec un mot de passe fautif ou absent et avec `BCRYPT_COST` invalide. Un tel test fixerait le sens (aucun compte créé, table non vide), pas le libellé exact.
- Consigné dans `DEBTS.md` : le second lancement du seed reste non testé sur processus ; sa sortie est désormais spécifiée.
- À challenger : le nom de la table `T_USER_USR` n'est pas déclaré normatif dans la ligne (le code l'écrit, le CDC ne l'exige pas) ; faut-il l'exiger, comme US-001 exige l'adresse et le port ? Tant qu'Olivier n'a pas décidé, ne compter que sur le sens de la ligne et sur le code `0`.

## #67 — Le seuil de couverture est global au projet, appliqué par la CI ; ce n'est plus un critère d'acceptance d'US

*`docs(specs): describe the real runtime and test tooling in the technical conventions` — `CONVENTIONS-TECHNIQUES.md` (stack, couverture, organisation des tests, ligne `SQLITE_DB_PATH`). Prolonge la décision #54 ; les décisions #1 à #66 ne sont pas modifiées.*

**Contexte.** Les conventions disaient « couverture ≥ 90 % pour chaque US, non négociable », mesurée par Jest, alors que la décision #54 avait retiré le CA de couverture d'US-001. Le seuil réel est global : `vitest.config.ts` fixe 90 sur les quatre métriques et la CI lance `npm run test:coverage`. Le document décrivait aussi un autre outillage (Jest, `@swc/jest`, `supertest`, Node 24, type stripping, ES Modules, `__tests__/`) que le réel (Vitest, `inject` de Fastify, Node 26, `tsx` en CommonJS, tests à côté du code).

**Décision.**
1. **Sur choix d'Olivier (2026-11-18)** : le seuil de couverture est **global au projet**, ≥ 90 % sur les quatre métriques, mesuré par Vitest (`npm run test:coverage`) et appliqué par la CI via `vitest.config.ts`. Ce n'est plus un critère d'acceptance de chaque US.
2. La règle « un CA = au moins un test, nom du test référençant le CA » est inchangée : c'est la méthode.
3. Les conventions décrivent l'outillage réel (renvoi à `package.json` et `.nvmrc` pour les versions).

**Conséquences.**
- Le code était déjà conforme : aucune modification sous `src/` ni de configuration.
- L'encadré « Exigence de couverture » et le CA de couverture restent dans les US existantes qui les portent, jusqu'à leur alignement (une session `docs(specs)` par lot) ; les conventions le disent sans prescrire de recopier l'encadré dans les nouvelles US.
- À challenger : tant que les encadrés subsistent, 21 US disent « Couverture globale ≥ 90 % » sans dire « du projet » ; le lien d'ancre `#-exigence-de-couverture-des-tests` reste valide.

## #68 — Le hub n'a pas de script `dev` : `npm start` est son seul script de lancement

*`docs(specs): drop the dev script from the startup scripts` — US-001 (bloc « Scripts npm »). Annule la décision du 2026-11-15 d'ajouter un script `dev` au code ; les décisions #1 à #67 ne sont pas modifiées.*

**Contexte.** `DEBTS.md` portait la dette « Script `dev` absent » : le 2026-11-15, il avait été décidé d'ajouter un script `dev` au code, et le bloc « Scripts npm » d'US-001 ne devait le lister qu'une fois ajouté. Ni le CDC ni le code n'ont jamais eu de script `dev`. Or `start` lance déjà `tsx src/index.ts`, sans étape de build ; `dev` ne ferait que `tsx watch src/index.ts`, c'est-à-dire relancer le hub à chaque sauvegarde. Ce rechargement sert à qui écrit lui-même le code et relance le hub en continu ; ici le code est écrit par Claude.

**Décision.**
1. **Sur choix d'Olivier (2026-11-18)** : pas de script `dev`, ni maintenant ni plus tard. La décision du 2026-11-15 est annulée.
2. `npm start` est le seul script de lancement du hub ; `npm run seed` est celui du seed.
3. Le bloc « Scripts npm » d'US-001 est inchangé ; une phrase le dit sous le bloc.

**Conséquences.**
- Aucune modification de code : rien sous `src/`, `package.json` et les configurations inchangés, comportement observable inchangé.
- La dette « Script `dev` absent » est soldée et supprimée de `DEBTS.md`.
- Si un besoin de rechargement à chaud apparaît, une nouvelle décision le rouvrira.

## #69 — Un fichier de base existant en lecture seule, qui contient déjà les tables du hub, n'est pas une erreur : le hub démarre et écoute ; ses écritures échouent ensuite, sans avertissement au démarrage : constat reporté

*`docs(specs): settle the start on a read-only database file` — US-001/CA-9 (liste « Cas qui ne sont pas des erreurs »), cellule du CA-9 du tableau, ligne « Base de données » des spécifications propres, note « Acceptés, sans refus » des deux diagrammes ; ligne `SQLITE_DB_PATH` de `CONVENTIONS-TECHNIQUES.md`. Prolonge les décisions #56, #58, #63 et #65 (« les permissions, non sondées ») ; les décisions #1 à #68 ne sont pas modifiées.*

**Contexte.** Le CA-9 d'US-001 dit que le hub refuse de démarrer quand la base « ne peut pas être ouverte ». Les décisions #56, #58 et #63 ont listé les cas qui n'en sont pas (fichier absent, fichier de zéro octet, `:memory:`) ; les permissions restaient « non sondées : session en root » (décisions #64 et #65, `DEBTS.md`). Sondé le 2026-11-18, Linux, compte non-root `probe` (hors dépôt, rien de committé ; Node 26.13.1 ; `tsx src/index.ts` et `tsx src/seed.ts`, environnement explicite, `JWT_SECRET` de 32 caractères, `BCRYPT_COST=4` ; les bases d'essai sont celles que le hub crée, trois tables `T_USER_USR`, `T_THEME_THM`, `T_QUESTION_QST`, puis onze comptes écrits par le seed). Résultats pour le hub :

| Cas | Résultat |
|---|---|
| (a) base existante avec les trois tables et onze comptes, `chmod 444` | le hub démarre et écoute (deux lignes de démarrage sur la sortie standard, sortie d'erreur vide, processus vivant jusqu'au délai) |
| (b) base inscriptible avec les trois tables, dans un dossier `chmod 555` | le hub démarre et écoute (même sortie) |
| (c) base existante `chmod 000` | code `1`, `Server starting failed: unable to open database file` |
| (d) fichier de zéro octet en lecture seule | code `1`, `Server starting failed: attempt to write a readonly database` (les tables ne peuvent pas y être créées) |
| (e) fichier absent dans un dossier `chmod 555` | code `1`, `Server starting failed: unable to open database file` |
| (f) base en lecture seule (`chmod 444`) qui ne contient que `T_USER_USR` (créée par le seed seul) | code `1`, `Server starting failed: attempt to write a readonly database` (les deux autres tables ne peuvent pas être créées) |
| (g) même base inscriptible dans un dossier `chmod 555` | code `1`, même message |
| (h) `listen EACCES` : port 80, compte non-root | code `1`, `Server starting failed: listen EACCES: permission denied 0.0.0.0:80` (CA-8, conforme) |

Sur les cas (a) et (b), le hub démarré (processus vivant, `GET /health` répond) a été éprouvé ensuite, avec le compte `admin` : `POST /api/v1/token` répond `200` et un token ; `GET /api/v1/themes` répond `200` (`{"data":[],"limit":20,"page":1,"total":0,"total_pages":0}`) ; `POST /api/v1/themes` (`{"name":"Musique"}`, token admin) répond `500`, corps standard `{"status":500,"error":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred. Please try again later."}` (le message de l'erreur SQLite n'est pas dans le corps) ; le hub écrit l'erreur technique (`SqliteError: attempt to write a readonly database`, niveau 50) dans ses lignes JSON sur la sortie standard et reste vivant. Les deux cas se comportent de la même façon : lecture possible, écriture en échec (dans le dossier en lecture seule, SQLite ne peut pas créer son fichier journal). Le CA-9 couvre déjà (c) à (g) : la base « ne peut pas être ouverte », ou la première instruction qui lui est adressée échoue (« Moment de l'erreur »).

**Décision.**
1. **Sur choix d'Olivier (2026-11-18, porte 1)** : constat reporté. Un fichier de base existant en lecture seule, ou inscriptible mais dans un dossier en lecture seule, n'est **pas une erreur** quand il contient déjà les tables du hub : le hub démarre et écoute, comme pour `:memory:` (#63), le fichier de zéro octet (#58) et le fichier orphelin (#65). Pas de refus, pas de changement de code.
2. **Condition sondée** : le fichier contient déjà les tables que le hub crée au démarrage. Un fichier qui doit en recevoir (zéro octet, ou base qui n'a pas les trois tables) n'est pas dans ce cas : les cas (d), (f) et (g) restent refusés, par le CA-9, sans règle nouvelle. La phrase d'Olivier (« existant mais en lecture seule ») est donc écrite avec cette condition, qui est un constat de la sonde et pas une restriction décidée.
3. **Ce que le hub fait ensuite, constaté** : lecture et émission de token fonctionnent ; une écriture répond `500` au corps standard, sans le message technique, et l'erreur est journalisée. Le CDC ne le prescrit pas : il le consigne comme constat daté (« sondé le 2026-11-18, Linux non-root »), sans en faire une règle d'US-001.
4. **Aucun avertissement au démarrage** : le hub n'affiche rien de plus quand la base est en lecture seule ; la sortie est celle d'un démarrage normal.
5. **Limite de la sonde** : le comportement sous Windows (attribut « lecture seule », droits NTFS) n'est PAS sondé ; le CDC le dit. Une sonde sur la machine Windows du propriétaire viendra plus tard.
6. **Seed** : hors périmètre, non spécifié. Constaté seulement (même sonde, `tsx src/seed.ts` comme `npm run seed`, onze `SEED_PASSWORD_*` valides) : base en lecture seule avec les onze comptes : code `0`, ligne « Seed ignoré » sur la sortie standard (le seed n'écrit rien) ; même chose pour une base inscriptible dans un dossier en lecture seule ; base en lecture seule avec les trois tables mais sans compte : code `1`, `User seeding failed: attempt to write a readonly database` ; fichier de zéro octet en lecture seule : code `1`, même message ; base inscriptible dans un dossier en lecture seule, sans compte : code `1`, même message. US-002 n'est pas touché.
7. Forme : une puce de plus dans la liste « Cas qui ne sont pas des erreurs » du CA-9, qui renvoie à cette décision ; la cellule du CA-9 du tableau, la ligne « Base de données » des spécifications propres, la ligne `SQLITE_DB_PATH` des conventions et la note « Acceptés, sans refus » des deux diagrammes le citent en une expression courte. Le texte des CA-8 et CA-10 n'est pas touché ; pas de nouveau CA ; numérotation conservée.

**Conséquences.**
- Le code est déjà conforme : aucun fix, rien n'est codé, aucune modification sous `src/`, aucune configuration modifiée. Le comportement observable du hub ne change pas.
- Dettes créées dans `DEBTS.md` : (a) un hub qui démarre sur une base en lecture seule voit ses écritures échouer en `500`, sans avertissement au démarrage ; (b) le seed sur base en lecture seule n'est pas spécifié (constaté au point 6) ; (c) le comportement sous Windows n'est pas sondé. Le point « permissions (non sondées : session en root) » de la dette `SQLITE_DB_PATH` est mis à jour : sondé en non-root sous Linux, reste à tester.
- Tests à prévoir, par processus enfant (`src/index.test.ts`, `test(startup)`) : une base en lecture seule qui contient les trois tables : le hub écoute, sortie d'erreur vide ; les refus (c) à (e) et `EACCES` du CA-8 ; sauts explicites sous root (les permissions n'y valent rien) et sous Windows.
- Condition de réouverture : une décision future de refuser le démarrage sur une base en lecture seule, ou d'avertir au démarrage (un `fix` ou un `feat` avec smoke test).
- À challenger : un hub qui annonce un démarrage normal alors qu'aucune écriture ne peut aboutir (création de thème, de question) est trompeur pour le maître du jeu ; accepté tant qu'Olivier n'a pas décidé autrement. La condition « contient déjà les tables du hub » rend la règle moins simple à énoncer que « un fichier en lecture seule n'est pas une erreur » : à confirmer.

## #70 — Le comportement sous Windows d'un fichier de base en lecture seule ou illisible, d'un dossier fermé et du port privilégié est sondé et consigné au CDC : constat reporté, pas une règle

*`docs(specs): record the Windows behaviour of a read-only or unreadable database file and of the privileged port` — US-001/CA-9 (liste « Cas qui ne sont pas des erreurs »), US-001/CA-8 (cellule du tableau). Lève la limite du point 5 de la décision #69 (« le comportement sous Windows n'est PAS sondé ») ; les décisions #1 à #69 ne sont pas modifiées.*

**Contexte.** La décision #69 a sondé la lecture seule sous Linux et dit que Windows ne l'était pas ; le CA-9 d'US-001 le disait aussi, et les tests de permissions de `src/index.test.ts` se sautent sous Windows sans que l'on sache ce qui s'y passe. Sondé le 2026-11-18 par Olivier, script PowerShell (constats, aucune assertion) : Windows 11 Famille build 26300, PowerShell 5.1, Node 26.13.0, npm 11.21.1, session non administrateur, dépôt à `95c22bc`, disque NTFS, dossier jetable dans `%TEMP%`, `tsx src/index.ts` (et `npm start` pour deux cas), environnement explicite. Résultats :

| Cas | Résultat |
|---|---|
| base à trois tables, attribut « lecture seule » du fichier | le hub démarre et écoute, sortie d'erreur sans échec de démarrage ; `GET /api/v1/themes` répond `200`, `POST /api/v1/themes` répond `500` au corps d'erreur standard, journal `attempt to write a readonly database` (comme Linux, #69) |
| base à trois tables, ACL qui refuse la lecture | code `1`, `Server starting failed: unable to open database file` (comme `chmod 000`) |
| fichier de zéro octet, attribut « lecture seule » | code `1`, `Server starting failed: attempt to write a readonly database` |
| fichier absent, dossier dont l'ACL refuse l'écriture et la création (`WD,AD`) | code `1`, `unable to open database file`, aucun fichier créé |
| base du seed seul (`T_USER_USR` seule, onze comptes), attribut « lecture seule » | code `1`, `attempt to write a readonly database`, fichier intact |
| attribut « lecture seule » posé sur le dossier | sans effet : un fichier peut y être créé, le hub démarre normalement |
| base à trois tables inscriptible, dossier dont l'ACL refuse (`WD,AD`) | le hub démarre et écoute ; `GET /api/v1/themes` `200` ; `POST /api/v1/themes` `500` au corps standard, mais cause journalisée `unable to open database file` et non `readonly` (le fichier journal ne peut pas être créé) : constat absent de #69 |
| port 80, compte non administrateur | le hub écoute (aucun `EACCES` sous Windows) |
| port dans une plage exclue administrée (`50000-50059`, port 50029) | le hub écoute (`EACCES` non reproduit par ce moyen) |
| port déjà occupé (écouteur .NET sur `0.0.0.0`) | code `1`, `Server starting failed: listen EADDRINUSE: address already in use 0.0.0.0:<port>` ; `npm start` identique, le code `1` traverse npm |
| nouvelle base dans un dossier existant | créée, trois tables, zéro compte ; `npm start` idem |

Hors spec : l'avertissement `DEP0205` (`tsx`, `module.register()`) précède toujours la ligne de refus sur la sortie d'erreur ; dette `chore(deps)` déjà connue. La sonde n'a laissé ni ACL ni attribut et n'a touché aucun fichier du dépôt.

**Décision.**
1. **Constat reporté, pas une règle** : le CDC consigne ces résultats comme constats datés (« sondé le 2026-11-18, Windows 11, compte non administrateur »), sans « le hub doit ». Pas de refus nouveau, pas de changement de code, pas de nouveau CA ; numérotation conservée.
2. **Pour le fichier, les issues sont celles de Linux** : l'attribut « lecture seule » du fichier tient lieu de `chmod 444`, une ACL qui refuse la lecture de `chmod 000`. Les refus restent ceux du CA-9 (la base « ne peut pas être ouverte » ou la première instruction qui lui est adressée échoue) ; le démarrage sur une base à trois tables en lecture seule reste le constat de #69.
3. **Pour le dossier, deux écarts avec Linux, écrits tels quels** : l'attribut « lecture seule » d'un dossier est sans effet sous Windows ; une ACL qui refuse l'écriture et la création dans le dossier donne les mêmes issues que `chmod 555` (fichier absent refusé, base à trois tables qui démarre), mais la cause journalisée de l'écriture en échec est `unable to open database file` et non `attempt to write a readonly database`.
4. **Port privilégié** : sous Windows, par ces moyens, le CA-8 ne rencontre pas `EACCES` (port 80 ouvrable sans droits d'administrateur, port d'une plage exclue ouvrable) ; le texte du CA-8 dit déjà « la cause que donne le système » et n'est pas durci. La sonde de la plage exclue n'est consignée qu'ici, pas en dette (choix d'Olivier).
5. **Limite de la sonde** : une seule machine, disque NTFS, compte non administrateur ; ni session administrateur, ni autre système de fichiers, ni autre version de Windows. Aucun test de permissions Windows en CI (la CI tourne sous Ubuntu). Les écarts documentés (points 3 et 4) valent pour cette machine, ils ne sont pas généralisés.
6. **Seed** : non sondé sous Windows (la sonde porte sur le hub, plus la base du seed seul comme fichier de départ) ; l'état du seed sur base en lecture seule reste celui de la dette qui lui est consacrée. US-002 n'est pas touché.
7. Forme : la phrase « Le comportement sous Windows n'est pas sondé » de la liste « Cas qui ne sont pas des erreurs » du CA-9 est remplacée par le constat condensé ; une phrase de plus dans la cellule du CA-8 du tableau. Les diagrammes ne sont pas concernés (leur contenu ne change pas).

**Conséquences.**
- Aucun changement de comportement : rien n'est codé. Un seul fichier de `src/` est touché, `src/index.test.ts`, pour un commentaire (« pas sondé » devient « sondé, voir #70 ») ; aucun test ajouté, retiré ou renommé.
- `DEBTS.md` : la dette « Comportement sous Windows non sondé » est supprimée (soldée) ; les dettes `SQLITE_DB_PATH` et « Hub qui démarre sur une base en lecture seule » disent que Windows est sondé ; une dette courte est créée : les tests de permissions se sautent sous Windows alors que la sonde montre qu'on pourrait les rejouer (attribut « lecture seule » et `icacls`).
- Condition de réouverture : une régression de permissions constatée sous Windows, une autre machine ou un autre compte qui donne un autre résultat, ou un besoin de couverture Windows (ce qui rouvrirait aussi la dette de test).
- À challenger : le constat « base inscriptible dans un dossier fermé : le hub écoute, l'écriture échoue en `500` » est le même risque de démarrage trompeur que #69, avec une cause journalisée différente ; une sonde sur une seule machine ne dit pas ce que fait un dossier réseau ou un disque non NTFS.

## #71 — Un `.env` écrit les blancs de `SQLITE_DB_PATH` comme la bibliothèque `dotenv` les lit : la règle du CA-10 s'applique à la valeur qu'elle produit : constat reporté, pas une règle

*`docs(specs): settle how a .env file writes the blanks of SQLITE_DB_PATH` — US-001/CA-10 (paragraphe « Origine de la valeur »), US-002/CA-8 (même paragraphe, en miroir), ligne « fichier `.env` » de `CONVENTIONS-TECHNIQUES.md`, limite dite de `ETAT-DES-LIEUX-socle-hub.md`. Lève le « non spécifié » laissé par les décisions #60, #61 et #63 ; les décisions #1 à #70 ne sont pas modifiées.*

**Contexte.** Les décisions #60 et #61 ont arrêté la règle de lecture de `SQLITE_DB_PATH` (blancs de bordure ignorés, refus du vide et des blancs seuls) et #63 le cas `:memory:`, en la disant portée sur « la valeur telle que le processus la reçoit ». La façon dont un `.env` écrit ces valeurs (guillemets, valeur non quotée) restait « non spécifiée » : sondée le 2026-11-14 pour deux cas, `DEBTS.md` listait le reste comme non sondé. Sondé le 2026-11-19 (hors dépôt, rien de committé ; Linux ; Node 26.13.1 ; `dotenv` 17.4.0 ; d'abord `dotenv.parse` puis `readDatabasePath` sur quatorze valeurs, puis `tsx src/index.ts` comme `npm start` sur quatre d'entre elles, dossier jetable, `JWT_SECRET` valide) :

| Écriture dans le `.env` | Valeur lue par `dotenv` | Issue |
|---|---|---|
| non quotée, blancs seuls (espaces, tabulations, U+3000) | vide | refus, message des blancs (hub réel : code `1`, aucun fichier créé) |
| entre `"`, `'` ou `` ` ``, blancs seuls, ou `"\n"` | blancs conservés | refus, même message |
| non quotée, blanc intérieur (`my data.db`) | conservée | acceptée, fichier `my data.db` créé (hub réel) |
| non quotée, blancs de bordure | rognée par `dotenv` | acceptée, chemin nettoyé |
| entre guillemets, blancs de bordure (`"  padded.db  "`) | conservés par `dotenv` | acceptée, rognée par la règle du CA-10, fichier `padded.db` créé (hub réel) |
| non quotée avec ` # note` (`real.db # note`) | `real.db` | acceptée, fichier `real.db` créé (hub réel) |
| `:memory:` non quotée, ou `" :memory: "` | `:memory:` | acceptée, base en mémoire |
| U+200B seul, non quoté | conservé | acceptée (n'est pas un blanc, décision #61) |

**Décision.**
1. **Sur choix d'Olivier (2026-11-19, porte 1)** : constat reporté. Le CDC écrit que le `.env` est lu par `dotenv`, que la valeur contrôlée est celle qu'elle produit, et il consigne les cas constatés ci-dessus. Il n'ajoute aucune règle d'écriture du `.env` ; le code ne change pas.
2. **Sur choix d'Olivier (2026-11-19, porte 1)** : le même paragraphe est ajouté en miroir à US-002/CA-8 : le seed charge `dotenv` de la même façon et lit la valeur par la même fonction. Les cas ont été sondés sur le hub seulement, ce que la phrase dit.
3. Le ` #` non quoté qui coupe la valeur est consigné comme les autres cas : il ne fait pas l'objet d'une règle.
4. Forme : le paragraphe « Origine de la valeur » d'US-001 remplace la phrase « n'est pas spécifiée » ; US-002 reçoit la phrase miroir ; une phrase de plus dans le paragraphe `.env` de `CONVENTIONS-TECHNIQUES.md` ; la « limite dite » de l'état des lieux est mise à jour. Pas de nouveau CA ; numérotation conservée.

**Conséquences.**
- Le code est déjà conforme : rien n'est codé, aucune modification sous `src/`. Le comportement observable ne change pas.
- `DEBTS.md` : le point (2) de la dette `SQLITE_DB_PATH` dit que ces écritures sont sondées et consignées ; reste un `test(startup)` de ces cas sur processus réel (nés verts, avec mutation), à planifier quand Olivier le décide.
- Condition de réouverture : une mise à jour de `dotenv` qui change l'un de ces constats, ou la décision de refuser un chemin dont `dotenv` a rogné ou coupé quelque chose (un `fix(startup)` avec smoke test).
- À challenger : (a) un chemin non quoté qui contient ` #` est coupé sans bruit, donc le hub peut démarrer sur un autre fichier que celui voulu, comme pour un `:memory:` laissé par erreur (#63) ; (b) le CDC s'appuie sur le comportement d'une bibliothèque sans le figer dans le code ; (c) les cas n'ont pas été sondés sur le seed lui-même.

## #72 — Un seed lancé contre une base SQLite en lecture seule : il réussit sans rien écrire quand les comptes existent, il refuse (code `1`) quand il devrait en écrire : constat reporté, pas une règle

*`docs(specs): specify how the seed behaves on a read-only database` — US-002/CA-9 (nouveau paragraphe « Base en lecture seule », en miroir du constat de la décision #69 pour le hub), workflow (étapes 1 et 2), périmètre. Lève le « non spécifié » du point 6 de la décision #69 ; les décisions #1 à #71 ne sont pas modifiées.*

**Contexte.** US-002 ne dit rien du seed lancé contre une base en lecture seule ; la décision #69 (point 6) n'a fait que constater, hors périmètre, la sortie du seed sur la sonde du hub, et la dette « Seed sur base en lecture seule : non spécifié » la gardait. Re-sondé le 2026-11-19, Linux, **utilisateur non-root** (uid 65534, `runuser -u nobody`, la session tournant en root, qui ignore les permissions), Node 26.13.1, `tsx src/seed.ts` comme `npm run seed`, répertoire de travail temporaire hors dépôt (donc aucun `.env` lu), environnement explicite (onze `SEED_PASSWORD_*` valides, `BCRYPT_COST=4`), bases jetables (rien n'est committé). Les résultats reprennent ceux du 2026-11-18 sans écart ; le fichier a été comparé (taille et date de modification) avant et après, et le contenu du dossier relevé :

| Cas | Résultat |
|---|---|
| (a) base en lecture seule (`chmod 444`) avec les onze comptes | code `0`, ligne « Seed ignoré — la table T_USER_USR contient déjà des comptes. » sur la sortie standard, sortie d'erreur vide, fichier inchangé, aucun autre fichier |
| (b) base inscriptible avec les onze comptes, dans un dossier en lecture seule (`chmod 555`) | même issue, dossier inchangé (le seul fichier est la base) |
| (c) base en lecture seule avec les trois tables et zéro compte | code `1`, `User seeding failed: attempt to write a readonly database` sur la sortie d'erreur, sortie standard vide, fichier inchangé, zéro compte |
| (d) base en lecture seule à la seule table `T_USER_USR` (celle qu'un seed refusé a laissée), zéro compte | même issue que (c) : pour le seed, seule compte la présence de `T_USER_USR` |
| (e) fichier de zéro octet en lecture seule | même issue que (c), le fichier reste vide |
| (f) base inscriptible avec les trois tables et zéro compte, dans un dossier en lecture seule | même issue que (c), fichier inchangé, dossier inchangé |
| (g) fichier absent dans un dossier en lecture seule | code `1`, `User seeding failed: unable to open database file`, rien n'est créé |
| (h) comme (a), avec un mot de passe invalide et `BCRYPT_COST=abc` | code `0`, ligne « Seed ignoré » : le CA-7 passe avant le CA-4 et le CA-6 |
| (i) comme (c) ou (d), avec un mot de passe invalide | code `1`, `User seeding failed: Invalid password for account admin` : le mot de passe est refusé avant toute écriture |
| (j) comme (c), avec `BCRYPT_COST=abc` et des mots de passe valides | code `1`, `User seeding failed: BCRYPT_COST must be an integer between 4 and 31.` |
| (k) comme (e), avec un mot de passe invalide | code `1`, `attempt to write a readonly database` : l'échec précède le contrôle des mots de passe |

Lecture de ces résultats : un seed qui trouve des comptes n'écrit rien (CA-7), donc une base en lecture seule n'y change rien ((a), (b), (h)) ; un seed qui doit écrire échoue, et c'est l'écriture qui échoue, à deux endroits : à la création de `T_USER_USR` quand elle manque ((e), (k) : première instruction adressée à la base, avant la vérification de la table, place que le CA-9 décrit déjà), sinon à la première insertion, après le contrôle des mots de passe et de `BCRYPT_COST` et après le hachage ((c), (d), (f), (i), (j)). Sondé aussi en root, pour mémoire : un fichier de zéro octet en `chmod 444` y est écrit, onze comptes, code `0` (les permissions n'y valent rien). Dans les cas sondés, la base n'est pas modifiée.

**Décision.**
1. **Sur choix d'Olivier (2026-11-19, porte 1)** : spécifier le comportement du seed sur une base en lecture seule, dans US-002 seulement ; périmètre figé (pas de nouveau CA, numérotation conservée, pas de code, pas d'autre US, pas de test). **Forme choisie par Claude, non par Olivier : constat reporté**, comme #65, #69, #70 et #71. Le comportement actuel est consigné comme constat daté (« sondé le 2026-11-19, Linux, non-root »), sans « le seed doit » ; le code est déjà conforme et ne change pas.
2. **Quand les comptes existent**, le seed n'écrit rien : la ligne du CA-7 et le code `0`, que la base soit en lecture seule ou dans un dossier en lecture seule ((a), (b), (h)). Pas de règle nouvelle : c'est le CA-7 et le CA-3.
3. **Quand il devrait écrire** (zéro compte), il refuse : code `1`, `User seeding failed: <cause>` sur la sortie d'erreur, même préfixe que les autres refus du seed, sortie standard vide, aucun compte créé, base intacte ((c) à (g)). La cause constatée est `attempt to write a readonly database` (ou `unable to open database file` pour un fichier absent dans un dossier fermé) ; le texte exact est celui que donne le système, comme au CA-9, et n'est pas imposé.
4. **Ordre** : constaté (cas (h) à (k), « Lecture de ces résultats ») ; le CA-7 passe avant le CA-4 et le CA-6, qui passent avant l'écriture à l'insertion ; l'échec de création de `T_USER_USR` (fichier de zéro octet ; une base qui a d'autres tables mais pas celle-ci n'est pas sondée) précède, lui, ces contrôles, comme le CA-9 le dit de toute première instruction qui échoue. Les phrases du CA-9 sur le fichier absent et le fichier de zéro octet (« le seed se déroule normalement ») valent pour un fichier ou un dossier où l'on peut écrire : le paragraphe le dit, sans modifier ces phrases.
5. **Condition sondée** : pour le seed, la table qui compte est `T_USER_USR` seule ; le hub, lui, a besoin des trois tables (#69). C'est un constat de la sonde, pas une restriction décidée.
6. **Limites** : Windows n'est pas sondé pour le seed (la décision #70 sonde le hub, point 6) ; le CDC le dit. Une seule machine Linux, un seul compte non-root. En root, les permissions sont ignorées et le seed écrit.
7. Forme : un paragraphe « Base en lecture seule » à la fin de la cellule du CA-9 d'US-002 (après « Base laissée par un refus ultérieur »), une ligne à l'étape 1 et une à l'étape 2 du workflow, une ligne au périmètre. Le texte des CA-4, CA-6, CA-7, CA-8 n'est pas touché. Les deux diagrammes ne montrent ni le CA-8 ni le CA-9 (ils ne montrent que le chemin nominal, le refus d'un mot de passe et l'arrêt idempotent) : aucun n'est faux, aucun n'est modifié. `CONVENTIONS-TECHNIQUES.md` (ligne `SQLITE_DB_PATH`) et l'état des lieux ne sont pas touchés : aucune phrase n'y devient fausse.

**Conséquences.**
- Le code est déjà conforme : rien n'est codé, aucune modification sous `src/`, aucune configuration modifiée. Le comportement observable ne change pas ; pas de smoke test.
- `DEBTS.md` : la dette « Seed sur base en lecture seule : non spécifié » devient « spécifié (décision #72, constat reporté), reste le test sur processus réel » ; la dette « Le seed n'affiche rien quand il réussit » note la demande d'Olivier du 2026-11-19 (message de l'étape 8), pour une session `docs(specs)` dédiée, rien d'autre.
- Tests à prévoir (`src/seed.test.ts`, `test(seed)`, processus enfant comme `npm run seed`) : les cas (a) à (g), l'ordre (h) à (k), la base laissée intacte ; nés verts, avec mutation ; sauts explicites en root et sous Windows.
- Condition de réouverture : une décision de donner au seed un message propre à la lecture seule (par exemple qui dise que la base n'est pas inscriptible), un constat sous Windows ou sur une autre machine qui diffère, une mise à jour de `better-sqlite3` ou de SQLite qui change la cause, ou la décision de refuser d'abord (avant le hachage) quand la base n'est pas inscriptible.
- À challenger : (a) un seed sur base en lecture seule, avec zéro compte, ne dit pas que c'est la lecture seule qui est en cause : `attempt to write a readonly database` est exact mais opaque pour l'administrateur ; accepté tant qu'il n'est pas tranché ; (b) quand `T_USER_USR` existe, le seed hache les onze mots de passe (coût 12 par défaut : plusieurs secondes) avant de découvrir qu'il ne peut pas écrire ; le refus est le même, seule la durée change, et le CDC ne la fixe pas ; (c) la forme « constat reporté » plutôt qu'une règle (« le seed refuse quand il ne peut pas écrire ») est le choix de Claude : une règle serait plus simple à tester mais engagerait le seed à un message et à un ordre que personne n'a demandés ; (d) le seed qui « réussit » sur une base pleine en lecture seule est cohérent avec le CA-7, mais l'administrateur peut croire qu'il a créé quelque chose : c'est le même défaut de visibilité que la dette sur le message de succès.


## #73 — Quand le seed crée les onze comptes, il affiche une ligne de succès sur la sortie standard (code `0`, sortie d'erreur vide) ; le texte de la ligne est un exemple, pas une règle

*`docs(specs): settle the message the seed prints when it creates the accounts` — US-002/CA-1 (résultat attendu), workflow (étape 8), périmètre, les trois endroits du CA-9 et du CA-8 qui disaient « sorties vides » pour une création réussie, références `seed.js` d'US-002 (script npm, structure des fichiers, workflow) et libellé du diagramme de séquence. Lève la contradiction entre l'étape 8 d'US-002 et le comportement décidé en #58, #63 et #64 ; les décisions #1 à #72 ne sont pas modifiées.*

**Contexte.** L'étape 8 d'US-002 disait : « Affichage du résultat : "Seed terminé — 11 comptes créés." », sans CA, sans flux de sortie, sans dire si le texte est normatif. Les décisions #58, #63 et #64 (et les phrases correspondantes des CA-8 et CA-9) décrivaient, elles, une création réussie avec « code de sortie `0`, sorties vides ». Le code est conforme à ces dernières : `seed()` rend `{ created: true }` et `seed.ts` n'affiche rien (seul le cas « table non vide » affiche une ligne, CA-7, décision #66) ; `src/seed.test.ts` fige les sorties vides sur les créations. Le CDC était donc contradictoire sur un comportement observable. Olivier a dit le 2026-11-19 vouloir ce message (dette « Le seed n'affiche rien quand il réussit »).

**Décision.**
1. **Sur choix d'Olivier (2026-11-19, porte 1)** : quand le seed crée les onze comptes, il affiche **une ligne de succès sur la sortie standard** ; la sortie d'erreur reste vide ; code de sortie `0`. Le texte `Seed terminé — 11 comptes créés.` est **un exemple, non normatif**, comme la ligne du CA-7 (décision #66).
2. **Ce que dit la partie normative : choix de Claude, non d'Olivier.** Par symétrie avec le CA-7 (« la ligne dit qu'aucun compte n'a été créé parce que la table n'est pas vide »), la ligne **dit que les onze comptes ont été créés**. Olivier a dit « exemple non normatif » sans préciser ce qui reste normatif : le sens est le seul point que j'ai fixé, ni la langue, ni le nombre en chiffres, ni la ponctuation. À challenger en revue.
3. **Où le CDC l'écrit** : le résultat attendu du CA-1 (pas de nouveau CA, numérotation conservée), l'étape 8 du workflow, une ligne au périmètre. Les phrases des CA-8 (`:memory:`) et CA-9 (fichier absent, fichier de zéro octet) qui disaient « sorties vides » pour une création réussie disent désormais « la ligne de succès du CA-1 sur la sortie standard et la sortie d'erreur vide ». Le sens des refus ne change pas (sortie standard vide, sortie d'erreur `User seeding failed: <cause>`) ni celui du CA-7.
4. **Décisions passées** : les « sorties vides » des constats des décisions #58, #62, #63 et #64 décrivent le comportement du code à leur date ; elles ne sont pas réécrites. Pour la sortie standard d'une création réussie, la présente décision prime.
5. **Références `seed.js`** (demandé par Olivier, même session) : le script npm d'US-002 devient `tsx src/seed.ts` (comme US-001 et `package.json`), la structure des fichiers cite `src/seed.ts`, `src/seed.test.ts` (processus réel), `src/users/seed-users.ts` et son test, le workflow cite `src/seed.ts`, le diagramme de séquence nomme « Script seed.ts » (PNG régénéré avec `mmdc`). Le diagramme de flux n'est pas modifié : « Seed terminé » n'y est pas faux.

**Conséquences.**
- **Le code n'est pas aligné** : rien n'est codé, aucune modification sous `src/`, aucune configuration modifiée. À ce jour, le CDC demande une ligne que le code n'écrit pas. `DEBTS.md` consigne le `fix(seed)` à faire (US-002 CA-1), un seul commit : le comportement observable change, donc smoke test et deux agents ; `src/seed.test.ts` met à jour dans le même commit ses assertions de sorties vides sur les créations.
- Condition de réouverture : une décision de rendre la ligne normative mot à mot, de l'envoyer sur la sortie d'erreur, ou de nommer les comptes créés.
- À challenger : (a) le sens normatif (point 2) est de Claude ; (b) le CDC est en avance sur le code jusqu'au `fix(seed)` : un smoke test lancé avant constaterait l'absence de la ligne ; (c) un seed qui crée sur `:memory:` affiche « 11 comptes créés » alors que rien ne survit au processus : cohérent avec #63 (« le seed réussit »), mais l'administrateur peut croire que les comptes existent ; (d) la dette de visibilité de la décision #72 (seed qui « réussit » sans rien écrire sur base pleine en lecture seule) reste : la ligne du CA-7 la dit déjà, ce n'est pas nouveau.


## #74 — Mot de passe du seed : de 12 à 72 caractères ASCII imprimables, pas uniquement des espaces ; `BCRYPT_COST` sans zéro en tête ; refus sur la sortie d'erreur ; le seed crée la table

*`docs(specs): settle the password rules and the open points of the seed errors` — US-002/CA-4 et CA-6, workflow (étapes 3 et 4), tableau « Politique de mot de passe », périmètre, sections « Dépendance avec US-003 » et « Facteur de coût bcrypt », variables `SEED_PASSWORD_*` et `BCRYPT_COST` de `CONVENTIONS-TECHNIQUES.md`. Solde la dette « US-002 : quatre points muets relevés par l'agent frais du smoke test CA-6 ». Fait suite aux décisions #42, #64, #65, #72 et #73 ; les décisions #1 à #73 ne sont pas modifiées.*

**Contexte.** Le CA-4 disait « 12 caractères minimum » (la borne de 72 et les caractères admis n'étaient que dans la politique et le workflow), sans dire quel flux porte le message, ce qui est normatif dans le message, ni ce que vaut un mot de passe fait de blancs. Le CA-6 listait six valeurs refusées et laissait quatre points muets, relevés par l'agent frais du smoke test : le flux du message, la valeur faite de blancs, les valeurs hors liste, et la phrase d'US-002 qui disait que le seed ne crée pas la table (`npm run migrate && npm run seed`), alors qu'aucun script `migrate` n'existe (`package.json`) et que le repository du code la crée à l'instanciation (décisions #64 et #72 : fichier absent ou de zéro octet, le seed réussit).

Constats sur le processus réel (`tsx src/seed.ts`, base jetable, `BCRYPT_COST=4` sauf mention, environnement propre ; relevés le 2026-11-19, le code n'est pas modifié) :
- `BCRYPT_COST` refusée avec `User seeding failed: BCRYPT_COST must be an integer between 4 and 31.` sur la sortie d'erreur, sortie standard vide, code `1` : `abc`, un blanc, une tabulation, `0`, `4.0`, `+5`, `٤`, `99999999999999999999`. Acceptée (code `0`) : `004` (lue comme 4, `readDigitsOnlyInteger` ne rejette que les non-chiffres) ; vide : code `0` (vaut 12).
- Mot de passe : `Abcdefghijé1` (12 caractères dont un hors ASCII), 11 caractères et 73 caractères ASCII refusés ; 72 caractères ASCII acceptés ; une tabulation à l'intérieur refusée ; variable définie mais vide : `Invalid password for account quiz_buzzer_03` ; **douze espaces acceptés** (code `0`, onze comptes créés) : `OwaspPasswordValidator` applique `/^[\x20-\x7E]+$/` et une longueur de 12 à 72, rien d'autre. Variable non définie : `Missing password for account <login>`.
- Le code nomme un seul compte : `readValidPasswords` parcourt `admin` puis `quiz_buzzer_01` à `quiz_buzzer_10` et s'arrête au premier refus. Le CDC ne fixait pas cet ordre ; il n'est pas écrit dans le CDC (voir « À challenger »).

**Décision.**
1. **Sur choix d'Olivier (2026-11-19, porte 1)** : un mot de passe fait de **12 à 72 caractères, tous de l'ASCII imprimable (U+0020 à U+007E)**. La règle est **normative** (CA-4). 72 caractères valent 72 octets, la limite de bcrypt.
2. **Sur choix d'Olivier** : un mot de passe fait **uniquement de blancs** (espaces U+0020, les seuls blancs de l'ASCII imprimable) est **interdit** : refusé comme tout mot de passe invalide, même s'il compte douze caractères ou plus.
3. **Sur choix d'Olivier** : message du CA-4. Seuls sont normatifs le préfixe `User seeding failed: `, le nom du compte concerné et l'absence du mot de passe dans le message ; sortie d'erreur, sortie standard vide, code `1`. `Missing password for account <login>` (variable non définie) et `Invalid password for account <login>` (tout autre refus, variable définie mais vide comprise) sont des **exemples non normatifs**, comme les lignes des décisions #66 et #73. Le message nomme **un seul compte** à la fois ; le CDC ne dit pas lequel quand plusieurs sont invalides (choix de Claude : ne pas écrire l'ordre du code, voir « À challenger »).
4. **Sur choix d'Olivier** : le message du refus de `BCRYPT_COST` (CA-6) va sur la **sortie d'erreur**, comme ceux des CA-8 et CA-9, avec le préfixe `User seeding failed: ` ; sortie standard vide, code `1`. Le libellé reste un exemple non normatif.
5. **Sur choix d'Olivier** : `BCRYPT_COST` faite de **blancs seuls est refusée** ; seule la chaîne vide (ou l'absence) vaut `12`.
6. **Sur choix d'Olivier** : sont refusés, en plus de `abc`, `12.5`, `3`, `32`, `-1` et ` 12` : `0`, `4.0`, `+5`, les chiffres non ASCII (par exemple arabo-indiens) et les entiers hors de la plage de lecture (par exemple vingt chiffres). **`004` est refusée aussi** : la règle devient « chiffres ASCII seulement, sans zéro en tête ». **`BCRYPT_COST` diffère donc de `PORT`** ([US-001](../specs/US-001-server-startup.md) CA-7, décision #46), qui accepte les zéros en tête (`08080` vaut 8080) : choix d'Olivier, `PORT` n'est pas modifié ; l'écriture d'un coût sans zéro en tête a été préférée à la tolérance de `PORT`, et le CDC l'écrit dans le CA-6 et la ligne `BCRYPT_COST` de `CONVENTIONS-TECHNIQUES.md`.
7. **Sur choix d'Olivier** : le seed **crée `T_USER_USR` si elle manque**, conformément aux décisions #64 et #72. La phrase « Cette US-002 ne crée pas la table : elle suppose que la base a déjà été initialisée (migration) » et la recommandation `npm run migrate && npm run seed` sont retirées ; aucun script `migrate` n'existe. La définition du schéma reste celle de l'US-003 (décision #43), le code la lui doit : `CREATE TABLE IF NOT EXISTS` dans `SqliteUserRepository`.
8. **Choix de Claude, à challenger** : le CDC n'ajoute pas de CA (numérotation conservée) ; les règles sont écrites dans le critère et le résultat attendu des CA-4 et CA-6, dans le tableau de la politique, au workflow et au périmètre ; la liste des valeurs refusées du CA-6 est dans la colonne « Critère », celle du CA-4 dans le résultat attendu.

**Conséquences.**
- **Le code n'est pas aligné sur deux points** : rien n'est codé, aucune modification sous `src/`, aucune configuration modifiée. À ce jour, le CDC refuse un mot de passe de douze espaces et `BCRYPT_COST=004` que le code accepte. `DEBTS.md` consigne le `fix(seed)` à faire, un pas séparé : le comportement observable change, donc smoke test et deux agents, à faire avant le `test(seed)` de CA-4 et CA-6 sur processus réel. Le reste est déjà conforme (flux, préfixe, valeurs hors liste, table créée, 72 caractères).
- Les décisions antérieures qui disent « chiffres seulement » (#42) ou citent `npm run migrate && npm run seed` (#42, contexte) décrivent l'état à leur date ; elles ne sont pas réécrites. Pour les zéros en tête et pour la table, la présente décision prime.
- US-003 (« Politique de mots de passe ») et ses diagrammes ne sont pas modifiés : voir « À challenger » (c).
- Condition de réouverture : une décision d'accepter d'autres caractères (accents, Unicode), de refuser aussi d'autres formes de mots de passe faibles, de rendre le libellé du message normatif, de nommer tous les comptes invalides, ou d'aligner `BCRYPT_COST` sur `PORT` (zéros en tête acceptés) ; un `fix(seed)` qui révélerait un cas non listé.
- À challenger : (a) `004` refusée et `08080` acceptée pour `PORT` : deux règles de lecture d'entier dans le dépôt, l'une stricte, l'autre tolérante ; assumé par Olivier ; (b) le CDC dit « un seul compte nommé » sans dire lequel (le code : le premier dans l'ordre `admin`, `quiz_buzzer_01` à `10`) ; un test sur processus réel avec deux mots de passe invalides ne pourrait fixer que ce que le CDC dit ; (c) US-003 écrit « Aucune règle de complexité imposée » et ne parle ni d'ASCII ni de blancs : cette décision ne vaut que pour le seed, pas pour un futur changement de mot de passe ; (d) la règle porte sur la valeur que le processus reçoit : via un `.env`, `dotenv` rogne les valeurs non quotées et coupe sur ` #` (décision #71, sondé pour `SQLITE_DB_PATH` seulement), donc un mot de passe de douze espaces non quoté y devient vide ; l'issue est la même (refus) mais le message est `Invalid`, et un mot de passe avec ` #` non quoté serait coupé : non sondé pour les mots de passe, non écrit ; (e) un mot de passe ASCII imprimable mais faible (`aaaaaaaaaaaa`, `            a`) est accepté : OWASP sans règle de complexité, comme US-003.


## #75 — Les placeholders du bloc dotenv d'US-002 valent `<a_changer>` (11 caractères) : un `.env` copié sans édition est refusé par le CA-4 ; choix de rédaction du modèle, pas une règle de comportement

*`docs(specs): make the .env example placeholders fail the password policy` — US-002 (bloc dotenv de « Format du fichier `.env` », note sous le bloc, point de vigilance « Sécurité des mots de passe »). Fait suite à la décision #74 (CA-4) ; les décisions #1 à #74 ne sont pas modifiées.*

**Contexte.** Le bloc dotenv d'US-002 donnait des placeholders du type `<mot_de_passe_admin_min_12_car>` (31 caractères). Ils passent la politique du CA-4 (12 à 72 caractères ASCII imprimables, pas uniquement des espaces) : un `.env` copié tel quel, sans édition, fait créer par le seed onze comptes dont les mots de passe sont publics (ils sont écrits dans le dépôt). Le `.env.example` introduit par la PR #161 (`chore(seed)`, fusionnée) reprend ces placeholders ; sa sonde du 2026-11-20 l'a constaté (`Seed terminé — 11 comptes créés.`, code `0`).

Sonde du 2026-11-20 (non committée), Linux, Node 22.23.5, root, dossier jetable hors dépôt, `env -i`, `.env` à onze variables `SEED_PASSWORD_*=<a_changer>`, `SQLITE_DB_PATH` vers une base jetable, `BCRYPT_COST=4`, `tsx src/seed.ts` : code `1`, sortie standard vide (0 octet), sortie d'erreur `User seeding failed: Invalid password for account admin` (le `.env` est bien lu : un fichier ignoré aurait donné `Missing password`), la base jetable est créée avec sa table `T_USER_USR` et zéro compte (CA-9, décision #65 : la base qu'a créée l'ouverture n'est pas supprimée).

**Décision.**
1. **Sur choix d'Olivier (2026-11-20, porte 1)** : chacune des onze variables du bloc dotenv prend le placeholder `<a_changer>`, qui compte 11 caractères, **un de moins que le minimum de 12 du CA-4**. Un `.env` copié du modèle sans être édité est refusé par le seed au titre du CA-4 : code `1`, sortie standard vide, sortie d'erreur `User seeding failed: ` et un message qui nomme un seul compte, aucun compte créé.
2. **Choix de rédaction du modèle, pas une règle de comportement** : le seed ne change pas, ne connaît pas ce placeholder et n'applique que le CA-4. Le CDC ne fige que ce que le CA-4 dit déjà (préfixe, un seul compte nommé, code `1`) ; `Invalid password for account admin` est le libellé constaté, un exemple non normatif, et le compte nommé (`admin`, le premier de l'ordre du code) n'est pas écrit.
3. **En-tête du bloc** : `# Mots de passe du seed — NE PAS VERSIONNER CE FICHIER` devient `# Modèle du .env du seed : copier en .env (non versionné), puis remplacer chaque valeur`. Le bloc est un modèle versionné (`.env.example`), pas le contenu du `.env` ; l'ancien en-tête s'adressait au mauvais fichier.
4. **Lien avec le minimum du CA-4** : 11 caractères valent un de moins que le minimum. Si le minimum du CA-4 change un jour, le placeholder doit changer avec lui (et rester plus court que le nouveau minimum). Le CDC le dit dans la note sous le bloc dotenv.
5. **Autres endroits alignés** : l'exemple du point de vigilance « Sécurité des mots de passe » d'US-002 cite `<a_changer>` (et renvoie à la note). `grep -rn "min_12_car\|NE PAS VERSIONNER" docs src` hors `docs/sessions` : plus aucune occurrence dans `docs/` ; il reste celles de `src/env-example.test.ts` et de `.env.example`, laissés à la session suivante (point 7). Les handoffs passés ne sont pas réécrits.
6. **Matrice CA × couches d'US-002 inchangée** : aucun test, aucun code ; le CA-4 est déjà prouvé sur processus réel.
7. **Suite prévue, non faite ici** : une session `chore(seed)` alignera `.env.example` (placeholders et en-tête) et `src/env-example.test.ts` (qui fige l'ancien en-tête et les placeholders `<mot_de_passe_<compte>_min_12_car>`). Tant qu'elle n'est pas faite, le CDC et `.env.example` divergent. `DEBTS.md` le consigne.

**Alternatives écartées.**
- **Accepter et assumer** (garder les placeholders de 31 caractères, compter sur l'édition de l'administrateur) : écartée, un `.env` copié et oublié crée onze comptes à mots de passe publics sans aucun signal, sur un hub dont c'est le seul jeu de comptes.
- **Règle « le seed refuse les valeurs de la forme `<...>` »** : écartée. Elle changerait le comportement observable du seed (nouveau refus, donc `fix`, smoke test, deux agents, nouveau CA) et refuserait des mots de passe légitimes que le CA-4 autorise, comme `<abcdefghijkl>` (14 caractères ASCII imprimables).
- **Placeholder vide (`SEED_PASSWORD_ADMIN=`)** : non retenu ; le modèle perd son indication de ce qu'il faut écrire, et un `.env` partiellement édité est moins lisible (la variable vide donne `Invalid`, comme `<a_changer>`, sans le signal visuel).

**Conséquences.**
- Aucune modification sous `src/`, aucun changement de comportement : pas de smoke test, un seul agent.
- `DEBTS.md` : nouvelle ligne « `.env.example` porte encore les placeholders de la PR #161 », avec le pas séparé `chore(seed)`.
- Condition de réouverture : un changement du minimum du CA-4 (le placeholder suit) ; la décision de faire refuser par le seed une forme de valeur (`<...>`) ou une liste de mots de passe faibles ; un `.env.example` qui reviendrait à des valeurs de longueur valide.
- À challenger : (a) le refus d'un `.env` non édité repose sur la longueur et non sur l'intention : c'est le CA-4 qui refuse, et le message dit « Invalid password », pas « modèle non édité » : l'administrateur doit comprendre que `<a_changer>` veut dire « à changer » ; (b) un administrateur qui n'édite que `SEED_PASSWORD_ADMIN` apprend une erreur à la fois (le seed nomme un compte, #74) : onze lancements au pire ; (c) le couplage « 11 < minimum » est un invariant écrit dans le CDC, que rien ne teste tant que `src/env-example.test.ts` n'est pas aligné et ne fige pas la longueur ; (d) le CDC et `.env.example` divergent jusqu'au `chore(seed)` ; (e) `US-003` (point de vigilance « .env ») dit « `.env.example` (sans valeurs) » : formulation différente d'US-002 (« valeurs fictives »), non touchée, hors périmètre.


## #76 — Le modèle `.env.example` couvre aussi le hub pour les variables JWT : `JWT_SECRET` sans valeur (une copie non éditée est refusée par le hub), `JWT_EXPIRATION` en ligne commentée ; choix de rédaction du modèle, pas une règle de comportement

*`docs(specs): settle what the .env.example template holds` — US-003 (point de vigilance « Fichier `.env` et sécurité »), US-002 (en-tête du bloc dotenv, note sous le bloc, point de vigilance « Sécurité des mots de passe » et encadré « Sécurité »). Solde le point (e) de « À challenger » de la décision #75 ; les décisions #1 à #75 ne sont pas modifiées.*

**Contexte.** US-003 écrivait « Un fichier `.env.example` (sans valeurs) est versionné comme template » ; US-002 écrivait « valeurs fictives » (décision #75 : placeholders `<a_changer>`, plus courts que le minimum du CA-4, donc refusés par le seed). Les deux phrases ne disent pas la même chose, et le `.env.example` réel (`chore(seed)`, #163) ne porte que les variables du seed : ni `JWT_SECRET` ni `JWT_EXPIRATION`. Un administrateur qui copie le modèle en `.env` n'apprend donc rien du secret du hub avant le refus du démarrage.

Règles déjà écrites, que la décision ne modifie pas : `JWT_SECRET` est obligatoire, sans défaut, de 32 caractères minimum ; absent, vide ou plus court, le hub refuse de démarrer (code `1`, message qui nomme `JWT_SECRET` et la règle, aucune écoute ; [US-001](../specs/US-001-server-startup.md) CA-1, [US-003](../specs/US-003-authentication-token.md) CA-19), et ce contrôle passe avant ceux de `PORT` et de la base. `JWT_EXPIRATION` : entier strictement positif en chiffres seulement ; **absente ou vide, elle vaut `3600`** (CA-4 et CA-20) ; renseignée autrement, le hub refuse de démarrer. Une chaîne vide vaut donc absente pour `JWT_EXPIRATION`, comme pour `BCRYPT_COST`, à la différence de `JWT_SECRET`, `PORT` et `SQLITE_DB_PATH`.

Sonde du 2026-11-20 (non committée), Linux, Node 22.23.5, root, dossier jetable hors dépôt, `env -i` avec environnement explicite (`SQLITE_DB_PATH` vers une base jetable, `PORT` libre), `tsx src/index.ts` (ce que lance `npm start`), `.env` = copie du `.env.example` de `main` (#163) plus `JWT_SECRET=` : code `1`, sortie standard vide (0 octet), sortie d'erreur `Server starting failed: JWT_SECRET is required and must contain at least 32 characters.`, connexion au port refusée après la sortie, la base jetable n'est pas créée (le contrôle précède la base). Avec `JWT_SECRET` de 32 caractères et `JWT_EXPIRATION` absente, le hub démarre et écoute ; il démarre aussi avec `JWT_EXPIRATION=` vide. La sonde ne lit pas la durée appliquée : le défaut `3600` n'est pas observé ici, il reste celui du CA-4 et des tests existants.

**Décision.**
1. **Sur choix d'Olivier (2026-11-20, porte 1)** : le modèle versionné `.env.example` couvre aussi le hub **pour les variables JWT**. `JWT_SECRET=` y figure avec une **valeur vide** : une copie non éditée est refusée par le hub au démarrage (US-001 CA-1 : `JWT_SECRET` absent ou vide refusé). C'est la même logique de refus que la décision #75, par l'absence de valeur au lieu d'un placeholder trop court : une copie non éditée du modèle ne démarre pas le hub avec un secret connu.
2. **`JWT_EXPIRATION` y figure en ligne commentée avec son défaut** (`# JWT_EXPIRATION=3600`), comme `BCRYPT_COST`. Une chaîne vide vaut absente pour cette variable (CA-20) : la ligne reste commentée parce que le modèle ne la fait varier que sur choix de l'administrateur, pas parce que sa valeur vide serait refusée.
3. **Phrase d'US-003 réécrite** : « (sans valeurs) » devient la description exacte du modèle : `JWT_SECRET` sans valeur, refusé tant qu'il n'est pas renseigné ; `JWT_EXPIRATION` commentée ; mots de passe du seed en placeholders `<a_changer>`, avec renvoi à US-002 (décision #75).
4. **US-002** : l'en-tête du bloc dotenv n'est plus celui du seul seed ; il devient `# Modèle du .env : copier en .env (non versionné), puis remplacer chaque valeur`. Une note sous le bloc dit que le modèle est partagé avec le hub, renvoie à la présente décision et à US-003 pour les lignes JWT ; le bloc ne montre que les lignes du seed. L'encadré « Sécurité » et le point de vigilance « Sécurité des mots de passe » ne disent plus « valeurs fictives » sans réserve : `JWT_SECRET` y est sans valeur.
5. **Hors périmètre** : les autres variables du hub (`PORT`, `MAX_REQUESTS_PER_MINUTE`) ne sont pas ajoutées au modèle par cette décision ; `SQLITE_DB_PATH` y figure déjà en ligne commentée. Voir « À challenger » (c).
6. **Choix de rédaction, pas une règle de comportement** : le hub ne change pas, ne connaît pas le modèle et n'applique que le CA-1 et le CA-19. Le CDC ne fige que ce que ces CA disent (code `1`, `JWT_SECRET` nommé, aucune écoute) ; le libellé constaté est un exemple non normatif.
7. **Suite prévue, non faite ici** : une session `chore(seed)` ou `chore(startup)` alignera `.env.example` (ligne `JWT_SECRET=` vide, ligne `# JWT_EXPIRATION=3600`) et `src/env-example.test.ts` (qui exige aujourd'hui « exactement les onze variables du seed et rien d'autre »), avec un test sur processus réel : copie de `.env.example` en `.env`, le hub refuse de démarrer (code `1`, `JWT_SECRET` nommé, aucune écoute). Tant qu'elle n'est pas faite, le CDC et `.env.example` divergent. `DEBTS.md` le consigne.
8. **Matrice CA × couches d'US-002 inchangée** : aucun test, aucun code.

**Alternatives écartées.**
- **Le modèle ne couvre que le seed ; on aligne seulement la phrase d'US-003** (« sans valeurs » devient « placeholders du seed ») : écartée. Elle ne coûte rien, mais un administrateur qui copie le modèle ne voit pas `JWT_SECRET` et n'apprend son existence que par le refus du démarrage.
- **`JWT_SECRET=<a_changer>`** (placeholder, comme le seed) : écartée, mais pas pour la raison d'un secret qui serait accepté : une règle de longueur est écrite (32 caractères minimum, CA-19), et `<a_changer>` (11 caractères) serait refusé par elle. Le refus reposerait alors sur un invariant « placeholder plus court que 32 » à tenir avec la règle du secret, comme la décision #75 le tient avec le minimum du CA-4 ; une valeur vide est refusée quelle que soit la règle de longueur, et ne peut jamais devenir un secret valide si ce minimum baisse.
- **`JWT_EXPIRATION=3600` non commentée** : écartée. Une copie non éditée fixerait la durée au lieu de laisser le défaut du CA-4 s'appliquer ; la ligne commentée la documente sans la figer, comme `BCRYPT_COST`.

**Conséquences.**
- Aucune modification sous `src/`, ni de `.env.example` : pas de smoke test, un seul agent.
- `DEBTS.md` : deux lignes dans « outillage » : « `.env.example` ne porte pas encore les lignes JWT du CDC » (pas séparé : `chore` et test sur processus réel du hub) et « le minimum du CA-4 (12) est écrit en dur dans `owasp-password-validator.ts`, non exporté » (pas séparé : `refactor(users)`).
- Condition de réouverture : un changement du comportement de `JWT_SECRET` vide (par exemple un secret généré au démarrage : le refus ne protégerait plus rien ; un changement du minimum de 32 ne touche pas le modèle, aucun invariant de longueur ne lui est lié) (par exemple un secret généré au démarrage : le refus ne protégerait plus rien) ; la décision d'ajouter d'autres variables du hub au modèle ; un hub qui lirait un secret par défaut.
- À challenger : (a) l'administrateur apprend les refus un à un et par processus : le hub nomme `JWT_SECRET`, le seed nomme un mot de passe à la fois (onze lancements au pire, #75) ; (b) le refus du hub dit « `JWT_SECRET is required` », pas « modèle non édité » : l'administrateur doit comprendre qu'une ligne vide veut dire « à renseigner » ; (c) le modèle couvre `JWT_*` mais pas `PORT` ni `MAX_REQUESTS_PER_MINUTE` (ni, pour le seed, rien de plus que `BCRYPT_COST` et `SQLITE_DB_PATH` commentées) : le modèle reste partiel pour le hub, non décidé ; (d) la sonde a porté sur le hub ; que le seed ignore `JWT_SECRET` quand il figure dans le `.env` n'est pas sondé ici ; (e) le fichier et `src/env-example.test.ts` divergent du CDC jusqu'au `chore`, et ce test exige aujourd'hui l'absence de toute variable autre que celles du seed : il rougira à l'alignement, comme prévu.


## #77 — Le seed est tout ou rien (onze comptes ou aucun, arrêt brutal compris) et l'instance perdante d'une course ne modifie rien, affiche la ligne du CA-7 et sort en code `0` ; la spec dit la garantie, pas le mécanisme

*`docs(specs): settle what the seed returns when a concurrent seed run wins the race` — US-002 (CA-3, CA-7, point de vigilance « Idempotence stricte », workflow étapes 2 et 7, périmètre, deux diagrammes). Solde le trou « que rend l'instance perdante ? » consigné par la dette « Seed (US-002) » ; les décisions #1 à #76 ne sont pas modifiées.*

**Contexte.** La spec écrivait, aux points de vigilance, que la vérification de la table « doit être atomique » pour les instances simultanées, sans dire ce que rend l'instance perdante ni ce que laisse un seed interrompu. `SeedUsers.seed` fait un `count()`, onze hachages, puis onze `insert` séparés, sans transaction ; la contrainte `USR_LOGIN UNIQUE` tient lieu de garde.

Sondes du 2026-11-21, hors dépôt (dossier `/tmp`, rien de committé), Linux, Node 22.23.5 (le dépôt demande Node 26), root, `BCRYPT_COST=4`, `tsx src/seed.ts`, onze `SEED_PASSWORD_*` valides :
- **Course** : deux seeds lancés ensemble sur une base neuve, avec des mots de passe **différents** (`AAAA-…` et `BBBB-…`), 20 essais ; chaque hash relu en base est rapproché des deux jeux par `compareSync` de bcryptjs. Résultat : **jamais de compte mélangé** (onze comptes, tous du même lancement, à chaque essai : 12 fois le lancement A, 8 fois le B ; aucun doublon). La perdante sort en code `1` avec `User seeding failed: UNIQUE constraint failed: T_USER_USR.USR_LOGIN` dans **15 essais** et en code `0` avec la ligne du CA-7 dans **5** ; le gagnant sort toujours en `0` avec la ligne du CA-1. Explication **lue dans le code, non prouvée** : l'ordre d'insertion est fixe (`quiz_buzzer_01` à `_10`, puis `admin`), donc les deux instances visent `quiz_buzzer_01` en premier et celle qui ne l'obtient pas échoue avant d'avoir écrit quoi que ce soit.
- **Arrêt brutal** : un module préchargé (`NODE_OPTIONS=--require`) enveloppe le `run()` des `INSERT INTO T_USER_USR` de `better-sqlite3` et envoie `SIGKILL` au processus juste après le N-ième `INSERT` réussi ; N de 1 à 10, 2 essais par N, **20 essais** ; puis un relancement normal sur la même base. Résultat, identique aux 20 essais : code 137, rien sur la sortie standard ; la base garde exactement **N comptes** (`quiz_buzzer_01` à `quiz_buzzer_N`, jamais l'admin) ; le relancement affiche la ligne du CA-7, code `0`, sortie d'erreur vide, et **ne crée pas les comptes manquants** (N lignes avant et après).
- Conclusion des sondes : « aucun compte partiel » ne tient aujourd'hui, pour la course, que par l'ordre d'insertion fixe, et elle est **fausse après un arrêt brutal** : l'administrateur se retrouve avec une base qui ne porte qu'une partie des comptes, sans que le seed la répare ni la signale.

**Décision.**
1. **Sur choix d'Olivier (2026-11-21, option 1 retenue après la remontée de la première sonde, puis après celle de l'arrêt brutal)** : **tout ou rien**. Quel que soit le moment où le processus du seed s'arrête, arrêt brutal compris, la table `T_USER_USR` contient ensuite les onze comptes ou aucun, jamais une partie. Un lancement qui suit un arrêt qui n'a rien laissé trouve la table vide et crée les onze comptes (CA-1). Écrit au CA-3 et aux points de vigilance.
2. **Course** : quand deux instances s'exécutent en même temps sur une table vide, une seule crée les onze comptes (code `0`, ligne du CA-1). La perdante ne modifie rien, affiche la ligne du CA-7 sur la **sortie standard** (même ligne, mêmes règles de flux que le CA-7, décision #66 : seul le sens est normatif), sort en code **`0`**, sortie d'erreur vide, **dans tous les cas** : plus de code `1` ni de `UNIQUE constraint failed` pour cette cause. Écrit au CA-7, dont la condition vise aussi la table remplie entre le contrôle de l'étape 2 et l'écriture.
3. **Les refus ne changent pas** : mot de passe (CA-4), `BCRYPT_COST` (CA-6), chemin et base (CA-8, CA-9) gardent leurs règles, leur ordre et leur code `1`. La table vide laissée par un refus reste (décision #65). Une instance qui voit la table vide à l'étape 2 et dont un mot de passe est invalide se refuse avant toute écriture, même si une autre instance a gagné entre-temps : la course ne se joue qu'à l'écriture. Le seed en lecture seule (décision #72) reste conforme : il n'écrit rien, donc zéro compte.
4. **Choix de rédaction, non observable : la spec n'impose pas de transaction unique.** Elle fixe la garantie (tout ou rien, perdante en `0` avec la ligne du CA-7) et laisse le mécanisme au `fix(seed)` ; une transaction qui englobe la vérification et les onze insertions est le moyen évident, mais seul le comportement est un critère. Ce choix ne s'observe pas ; le tenir est l'affaire du code.
5. **« Table non vide » reste vrai après le fix** : le tout ou rien garantit qu'une table non vide porte les onze comptes, donc le CA-7 (« au moins un compte ») et le CA-3 (« si les comptes existent déjà ») ne se contredisent pas ; le CA-7 garde son numéro, aucun CA n'est ajouté (comme la décision #66). **Constat reporté, pas une règle** : une base déjà laissée partielle par un seed antérieur à cette décision reste ignorée par le CA-7 comme toute table non vide ; ses comptes manquants ne sont pas créés (le CDC ne prévoit pas de réparation).
6. **Le code n'est pas aligné** : la décision décrit un comportement que `SeedUsers.seed` ne tient pas. `DEBTS.md` : le `fix(seed)` d'abord (comportement observable : smoke test d'Olivier et deux agents), puis le `test(seed)` de la course et de l'arrêt brutal sur processus réel (le test d'arrêt brutal peut s'appuyer sur un module préchargé de type `NODE_OPTIONS=--require`, ce que la spec n'impose pas). `ETAT-DES-LIEUX-socle-hub.md` : CA-3 et CA-7 d'US-002 passent de solides à partiels, le trou de CDC est retiré.
7. **Diagrammes** : séquence et flux d'US-002 montrent l'écriture des onze comptes « tout ou rien » et la sortie de la perdante (« Seed ignoré », code `0`). PNG régénérés avec `mmdc` et `google-chrome`.

**Alternatives écartées.**
- **Limiter la règle à la course** (laisser l'arrêt brutal hors spec, comme l'option « 1 » d'avant la seconde sonde) : écartée par Olivier, la sonde a montré des comptes partiels et un relancement qui ne les complète pas ; écrire « aucun compte partiel » en ne tenant que la course aurait annoncé une garantie fausse.
- **Spécifier la transaction unique** : écartée, elle fige un mécanisme que rien d'observable ne distingue d'un autre qui tiendrait les deux garanties.
- **Le seed complète une base partielle** (créer les comptes manquants au relancement) : non retenue ; elle ajoute une règle (quels comptes, avec quels hashs ?) que le tout ou rien rend inutile pour tout seed corrigé.
- **Perdante en code `1`** (message dédié) : écartée par Olivier, la perdante a le même effet qu'un seed lancé sur une table non vide (CA-7).

**Conséquences.**
- Aucune modification sous `src/`, aucun changement de comportement du code : pas de smoke test, un seul agent. Le comportement du seed est décrit, pas corrigé.
- `DEBTS.md` : la dette « atomicité … non spécifiée » est remplacée par « tout ou rien et perdante d'une course non tenus par le code » (pas séparé : `fix(seed)`, puis `test(seed)`).
- Condition de réouverture : un seed qui ne serait plus lancé par un administrateur seul (une instance par service, un orchestrateur qui relance après un arrêt) ; la décision de réparer une base partielle ; un moteur de base qui ne tiendrait pas le tout ou rien.
- À challenger : (a) « dans tous les cas » : la spec ne dit rien de l'attente d'un verrou d'écriture qui dépasse le délai de la base (`better-sqlite3`, 5 s par défaut) ; le comportement observable dans ce cas n'est pas décidé, le `fix(seed)` devra le sonder ; (b) la perdante dit que la table « contient déjà des comptes », ce qui est vrai à la fin de la course mais pas au moment où elle a lu la table ; (c) l'arrêt brutal peut manquer la ligne de succès du CA-1 alors que les onze comptes sont écrits : le lancement suivant affiche la ligne du CA-7, l'administrateur ne voit jamais « 11 comptes créés » ; (d) le tout ou rien ne couvre pas une base partielle laissée par un seed antérieur : aucun chemin de réparation, une table à vider à la main ; (e) la sonde de course est sur Linux, Node 22, root, une seule machine, base sur disque local ; non sondée sous Windows ni sur un disque réseau, où le verrouillage SQLite se comporte autrement ; (f) 20 essais de course ne prouvent pas l'absence de compte mélangé, seule la lecture du code l'explique.


## #78 — Le seed écrit ses onze comptes par une seule opération du repository qui prend le verrou d'écriture avant de recompter la table ; le hachage reste hors verrou

*`fix(seed): create the eleven accounts all or none and skip the run that loses a race` — US-002/CA-3 et CA-7 (partie course), décision #77. Choisit le mécanisme que la décision #77 laissait au `fix(seed)` ; les décisions #1 à #77 ne sont pas modifiées.*

**Contexte.** La décision #77 fixe deux garanties observables (tout ou rien, arrêt brutal compris ; la perdante d'une course ne modifie rien, affiche la ligne du CA-7, sort en code `0`) et laisse le mécanisme au `fix(seed)`. `SeedUsers.seed` faisait un `count()`, onze hachages, puis onze `insert` séparés sans transaction. Contraintes constatées en sondant sur processus réels (Linux, Node 22, base SQLite en fichier, mode de journal par défaut) : une transaction qui lit la table puis écrit (différée) fait échouer l'une des deux instances au lieu de la faire attendre (`database is locked`, code `1`) ; une transaction qui prend le verrou d'écriture dès son début fait attendre la seconde instance jusqu'au commit de la première, puis elle lit la table remplie ; un processus tué avant le `COMMIT` ne laisse aucun compte (SQLite annule la transaction à la réouverture du fichier).

**Décision.**
1. `UserRepository` gagne `insertAllIfEmpty(users): Promise<boolean>` : une transaction unique, dont le verrou d'écriture est pris dès le début (`immediate` de `better-sqlite3`), qui recompte la table, n'écrit rien et rend `false` si elle porte un compte, sinon écrit tous les utilisateurs et rend `true`. La vérification et les onze insertions forment ainsi un seul pas pour les autres connexions.
2. `SeedUsers.seed` garde son ordre : `count()` (CA-7, avant toute lecture de mot de passe), mots de passe (CA-4), `BCRYPT_COST` (CA-6), hachage des onze mots de passe, puis `insertAllIfEmpty`. Le hachage reste **hors verrou** : le verrou n'est tenu que le temps des onze insertions, pas celui de onze hachages bcrypt. Un `false` rend `{ created: false, message }` avec le message du CA-7 (le même que le `count()` initial). Un échec d'écriture (autre que le verrou) reste une erreur : code `1`, comme avant.
3. Le `count()` initial est conservé : il sert l'ordre des contrôles (une table non vide refuse avant les mots de passe) ; le recomptage dans la transaction ne le remplace pas, il ne sert que la course.
4. `insert` reste dans l'interface (tests, mocks) ; il n'a plus de consommateur de production (dette).

**Alternatives écartées.**
- **Transaction différée** (lire puis écrire) : la perdante échoue en `database is locked` (code `1`) dès que les deux instances lisent avant que l'une écrive ; sondé, 15 essais sur 15 avec une fenêtre élargie.
- **Attraper la violation d'unicité et la traduire en « perdante »** : écarte le message `UNIQUE` mais laisse un compte partiel possible après un arrêt brutal entre deux `insert` ; ne tient pas le tout ou rien.
- **Hacher dans la transaction** : tient le verrou pendant onze hachages au coût configuré (jusqu'à 31), sans bénéfice observable.
- **Une interface d'écriture propre au seed** (`authentication/` ne dépendrait pas de `insertAllIfEmpty`) : plus propre, plus large que ce `fix` ; consignée en dette.

**Conséquences.**
- Comportement observable : CA-3 et CA-7 tenus par le code (voir `DEBTS.md` pour ce qui est prouvé et non prouvé) ; aucun autre refus ni sortie ne change.
- **Hors périmètre, non décidé** : l'attente du verrou au-delà du délai de la base (5 s) : sondée, le seed sort en code `1` avec `User seeding failed: database is locked` ; aucun code dédié, aucun test (« À challenger (a) » de la décision #77, dette).
- Les mocks de `UserRepository` d'`authentication/` déclarent la nouvelle méthode (changement de type seulement).
- À challenger : le choix de l'`immediate` n'est tué par aucun test committé, seulement par la sonde de course à fenêtre élargie ; le `test(seed)` de la course doit le tuer. La perdante qui attend le verrou affiche la ligne du CA-7 après l'attente (jusqu'à 5 s) : sans conséquence observable pour la spec.


## #79 — La ligne de la perdante d'une course n'est normative que par son sens (pas d'égalité mot à mot avec celle d'un second lancement) ; l'existence de la table après un arrêt qui n'a rien laissé n'est pas imposée (constat reporté)

*`docs(specs): settle the skipped-seed line of a lost race and the table left by a killed seed` — US-002 (CA-3, CA-7). Solde les trous de CDC T1 et T10 consignés par `DEBTS.md` après le `test(seed)` de la course ; les décisions #1 à #78 ne sont pas modifiées.*

**Contexte.** Le CA-7 (décision #77) dit que la perdante d'une course « affiche cette même ligne » que le seed lancé sur une table non vide, alors que la décision #66 ne rend normatif que le sens de cette ligne : le CDC ne disait pas si l'égalité mot à mot était exigée (T1). Le CA-3 dit que la table contient « les onze comptes ou aucun » après un arrêt brutal, sans dire si la table `T_USER_USR` doit exister quand l'arrêt tombe avant tout compte (T10).

Sondes du 2026-11-21, hors dépôt (`/tmp/probe79`, rien de committé), Linux, Node 22.23.5 (le dépôt demande Node 26), root, `BCRYPT_COST=4`, `tsx src/seed.ts`, base neuve, `SIGKILL` : juste avant la création de la table, code 137, fichier de base présent **sans table** ; juste après la création, code 137, **table présente et vide** ; juste après le premier `INSERT` de l'écriture (module préchargé du `test(seed)`), code 137, table présente, **zéro compte**. Après chacun des deux premiers arrêts, un relancement crée les onze comptes (code `0`, ligne du CA-1).

**Décision.**
1. **T1, sur choix d'Olivier (2026-11-21)** : seul le **sens** de la ligne de la perdante est normatif, comme pour la ligne du CA-7 (décision #66) : une ligne sur la sortie standard qui dit qu'aucun compte n'a été créé parce que la table n'est pas vide. Le texte exact n'est pas imposé, ni son égalité avec la ligne d'un second lancement, ni sa différence avec celle du gagnant. Écrit au CA-7 (« même sens, pas forcément même texte »).
2. **T10, sur choix d'Olivier (2026-11-21), constat reporté, pas une règle** : le CDC n'impose pas que la table `T_USER_USR` existe après un arrêt avant tout compte. Constaté : elle peut être absente (fichier de base sans table) ou présente et vide ; dans les deux cas elle ne porte aucun compte et le lancement suivant crée la table si elle manque (CA-9) puis les onze comptes (CA-1). Écrit au CA-3.
3. **Aucun comportement ne change** : ni le code, ni un test, ni un diagramme. Aucun CA n'est ajouté.

**Alternatives écartées.**
- **Égalité mot à mot de la ligne de la perdante avec celle d'un second lancement** : écartée, elle ferait de l'exemple non normatif du CA-7 une règle de texte que la décision #66 a refusée.
- **Imposer que la table existe après un arrêt** : écartée, elle fige un moment de création de la table (à l'instanciation du repository, hors de la transaction d'écriture) que rien d'observable ne distingue de l'autre issue, pour le seul administrateur qui relance le seed.

**Conséquences.**
- `DEBTS.md` : les lignes T1 et T10 sont soldées et supprimées ; une ligne consigne que les deux issues de T10 ne sont pas assertées (le module préchargé ne sait pas arrêter le processus avant ou juste après la création de la table).
- Condition de réouverture : une exigence de message sur la perdante (par exemple un outil qui lirait la ligne), ou un consommateur qui lirait la table après un arrêt.
- À challenger : (a) les sondes sont sur Linux, Node 22, root, une machine, disque local ; non jouées sous Windows ni sur un disque réseau ; (b) « même sens » reste un jugement : aucun test ne peut le prouver mot à mot, comme pour la ligne du CA-7 (dette existante, décision #66).


## #80 — Ce que rend le seed quand son écriture n'obtient pas le verrou d'écriture de la base dans le délai n'est pas imposé (constat reporté)

*`docs(specs): settle what the seed returns when it cannot get the write lock` — US-002 (CA-7, étape 7 du flux). Solde « À challenger (a) » de la décision #77, consigné par la décision #78 et par `DEBTS.md` ; les décisions #1 à #79 ne sont pas modifiées.*

**Contexte.** La décision #77 garantit le tout ou rien et la perdante d'une course en code `0`, mais le CDC ne disait rien du cas où l'écriture du seed n'obtient pas le verrou d'écriture de la base dans le délai de celle-ci (`better-sqlite3`, 5 s par défaut). La décision #78 l'a laissé hors périmètre. Ce cas n'est pas la course : l'autre processus qui tient le verrou n'est pas forcément un seed gagnant, donc il n'y a pas de « perdante » au sens du CA-7.

Sondes du 2026-11-21, hors dépôt (`/tmp/probe_lock`, rien de committé), Linux, Node 22.23.5 (le dépôt demande Node 26), root, `BCRYPT_COST=4`, `tsx src/seed.ts`, base jetable dont la table `T_USER_USR` existe et est vide, un second processus Node qui tient `BEGIN IMMEDIATE` : verrou tenu 10 s, trois essais : code `1`, sortie standard vide, sortie d'erreur `User seeding failed: database is locked`, table vide, 5,59 s et 5,61 s au total (démarrage de `tsx` compris, environ 0,5 s sans verrou) pour deux d'entre eux, 7,9 s pour le premier, à froid ; verrou tenu 3 s, relâché avant la fin du délai : code `0`, ligne de succès du CA-1, sortie d'erreur vide, onze comptes, 3,0 s ; verrou tenu 9 s : code `1`, même sortie d'erreur, 5,5 s, table vide.

**Décision.**
1. **Sur choix d'Olivier (2026-11-21), constat reporté, pas une règle** : le CDC n'impose pas ce que rend le seed quand son écriture n'obtient pas le verrou d'écriture dans le délai de la base. Constaté : il attend, puis sort en code `1`, sortie standard vide, sortie d'erreur `User seeding failed: database is locked`, aucun compte écrit ; si le verrou est relâché avant la fin du délai, il réussit normalement. Écrit au CA-7 (à côté de la course) et à l'étape 7 du flux.
2. Le texte exact, la durée de l'attente et la cause sont ceux du système et de la base et ne sont pas imposés ; seul le préfixe `User seeding failed: ` suit la convention des autres refus (CA-4, CA-6, CA-8 et CA-9).
3. **Aucun comportement ne change** : ni le code, ni un test, ni un diagramme. Aucun CA n'est ajouté.

**Alternatives écartées.**
- **Imposer le code `1` et le message** : écartée, elle figerait le texte et le délai de la base, que rien n'impose à un administrateur qui relance le seed.
- **Faire du verrou tenu par un autre processus un cas du CA-7 (code `0`, ligne « ignoré »)** : écartée, le CA-7 décrit une table qui porte des comptes ; ici la table est vide et rien n'a été écrit, une sortie en code `0` annoncerait un état que le seed n'a pas atteint.
- **Un code ou un message dédié** : écartée, aucun besoin exprimé ; elle ajouterait une règle à tenir par le code et par un test.

**Conséquences.**
- `DEBTS.md` : la ligne de l'attente du verrou est soldée côté spec et supprimée ; une ligne consigne que ce constat n'est asserté par aucun test (`test(seed)` d'un verrou tenu par un autre processus, facultatif).
- `ETAT-DES-LIEUX-socle-hub.md` : la « Limite dite » de la section US-002 renvoie au CA-7 et à la décision #80 au lieu de la dette.
- Condition de réouverture : une exigence de message ou de délai sur ce refus (par exemple un orchestrateur qui relance le seed et qui lirait la sortie), ou un moteur de base dont le délai ne serait pas celui de `better-sqlite3`.
- À challenger : (a) sondes sur Linux, Node 22, root, une machine, disque local, mode de journal par défaut ; non jouées sous Windows ni sur un disque réseau, où le verrouillage SQLite se comporte autrement ; (b) le délai de 5 s est celui de `better-sqlite3` aujourd'hui ; une mise à jour de la bibliothèque ou un réglage du délai le changerait sans changer le constat de la spec ; (c) le verrou n'a été tenu que par `BEGIN IMMEDIATE` sur une table existante : un verrou exclusif, une base dont la table est à créer, ou un verrou tenu pendant la lecture initiale de la table ne sont pas sondés.


## #81 — US-003 n'exige que le contenu et le niveau des logs de connexion (CA-14, CA-15), pas leur format ; le format est celui d'US-022

*`docs(specs): require only the content of the login logs of US-003, not their format` — US-003 (CA-14, CA-15, section « Logging structuré », diagramme de flux), renvoi à US-022 (CA-6 à CA-8). Les décisions #1 à #80 ne sont pas modifiées.*

**Contexte.** US-003 CA-14 et CA-15 demandaient un « log structuré JSON » avec `timestamp`, et sa section « Logging structuré » donnait deux exemples (`timestamp` ISO, `level` en chaîne, `event` `LOGIN_SUCCESS` / `LOGIN_FAILURE`). Ce format est celui que définit US-022 (CA-6 : `timestamp`, `level`, `event` ; CA-7 : ISO 8601 UTC avec millisecondes ; CA-8 : `level` en chaîne), pour toute entrée de log. US-022 n'est pas implémentée : `src/` ne contient aucun logger singleton. Le code de `token-route.ts` écrit `request.log.warn` et `request.log.info` avec `{ username, ip }`, donc le format natif de pino (niveau numérique, `time`, `msg`, pas d'`event`). US-003 exigeait donc un format que seule US-022 peut produire : un test de CA-14 ou CA-15 ne pouvait pas être écrit sans inventer ce format ici.

**Décision.**
1. **Sur choix d'Olivier (2026-11-21)** : CA-14 et CA-15 n'exigent que le **contenu** et le **niveau** : une ligne de log portant le `username` (celui tenté pour un échec) et l'adresse IP de la requête, au niveau `INFO` pour une connexion réussie, `WARN` pour une connexion échouée. `timestamp` sort des deux CA.
2. La **forme** de la ligne (champs `timestamp`, `level`, `event`, représentation du niveau, ISO 8601) relève d'US-022, qui s'applique à toute entrée de log, celles-ci comprises. US-003 le dit sous les deux CA.
3. Les exemples JSON de la section « Logging structuré » deviennent des exemples **non normatifs** du format d'US-022 (renvoi à ses CA-6 à CA-8). Le diagramme de flux de US-003 ne nomme plus `LOGIN_SUCCESS` / `LOGIN_FAILURE` ni `timestamp` ; la ligne « Périmètre » de la section est reformulée de même.
4. **Aucun comportement ne change** : ni le code, ni un test. Aucun CA n'est ajouté ni retiré.

**Alternatives écartées.**
- **Garder l'exigence de format dans US-003** : écartée, elle est impossible à tenir avant US-022 et obligerait un test de CA-14 / CA-15 à figer un format qui n'est pas le sien (ou à rester rouge jusqu'à US-022).
- **Différer CA-14 et CA-15 à US-022** : écartée, le contenu et le niveau (`username`, IP, `INFO` / `WARN`) sont observables et testables dès maintenant ; les différer laisserait deux CA d'US-003 sans preuve pour une raison qui ne concerne que la forme.

**Conséquences.**
- `DEBTS.md` : la ligne des logs de CA-14 et CA-15 dit que le CDC n'exige plus que le contenu et le niveau ; le pas `test(authentication)` les prouvera sans asserter le format. La dette n'est pas soldée.
- Quand US-022 sera implémentée, le format des deux lignes suivra US-022 sans changer US-003 ; les tests de contenu de CA-14 et CA-15 ne devront pas dépendre du format (champs lus par leur contenu, pas par la forme de la ligne).
- `ETAT-DES-LIEUX-socle-hub.md` : aucun passage n'est devenu faux (il constate l'absence de test sur ces logs), non modifié.
- Condition de réouverture : une exigence d'exploitation qui imposerait le format des logs de connexion avant US-022 (par exemple un outil qui les lirait), ou une évolution d'US-022 qui exclurait ces lignes de CA-6 à CA-8.
- À challenger : (a) « une ligne de log porte le `username` et l'IP » laisse ouverte la forme de ces champs (un champ nommé, ou le texte du message) tant que US-022 n'est pas là : un test de contenu devra choisir un moyen de lire ces valeurs sans figer la forme ; (b) le diagramme de flux d'US-003 écrit toujours « > 5 req/min » alors que CA-13 dit 100 req/min : écart préexistant, non traité ici ; (c) le diagramme `US-003-authentication-token.png` a été régénéré avec `mmdc` sous Linux, pas sous la machine d'Olivier : la mise en page a pu bouger de quelques pixels.


## #82 — Un `Content-Type` absent ou vide est un type non conforme sur toute route avec corps ; `415 FST_ERR_CTP_INVALID_MEDIA_TYPE`, corps natif (#11), corps vide ou non

*`docs(specs): settle what POST /api/v1/token answers when the Content-Type header is absent` — US-003 (CA-7), `SECURITE-TRANSVERSALE.md` (tableau « Content-Type obligatoire », CA-ContentType), `error-codes.md` (ligne du `415`). Solde la dette « `POST /api/v1/token` sans `Content-Type` » de `DEBTS.md` côté spec ; les décisions #1 à #81 ne sont pas modifiées.*

**Contexte.** US-003 CA-7 dit « le `Content-Type` doit être `application/json` », sinon `415 FST_ERR_CTP_INVALID_MEDIA_TYPE`. Le CDC ne disait pas si l'absence d'en-tête relevait de ce CA. Le `fix(authentication)` du 2026-11-21 (`text/plain`, CA-7) l'a relevé sans le trancher. Constats du 2026-11-21 (sondes `app.inject` jetables des sessions précédentes et du cadrage, hors dépôt, rien de committé ; non rejouées dans cette session, qui n'a pas pu installer les dépendances) : sur Fastify nu, un `POST` avec corps et sans `Content-Type` répond `415` ; un `Content-Type` présent mais vide répond `415`, comportement natif ; sur le plugin de `POST /api/v1/token`, un `POST` sans corps et sans `Content-Type` répond `400 FST_ERR_VALIDATION` (« body must be object »).

**Décision.**
1. **Sur choix d'Olivier (2026-11-21)** : un `Content-Type` absent est un type non conforme. Un `POST` sans `Content-Type` répond `415 FST_ERR_CTP_INVALID_MEDIA_TYPE`, que le corps soit vide ou non.
2. Un `Content-Type` présent mais vide est traité comme l'absence : même réponse `415`, avec ou sans corps.
3. La règle est **transversale** : elle vaut pour toute route avec corps (`POST`, `PUT`, `PATCH`). `GET` et `DELETE` ignorent toujours le `Content-Type`. Écrite dans `SECURITE-TRANSVERSALE.md` (tableau et CA-ContentType), reprise par une phrase au CA-7 d'US-003 ; `error-codes.md` dit « incorrect ou absent » sur la ligne du `415`.
4. Le corps de la réponse reste le corps natif de Fastify (décision #11).
5. **Aucun CA n'est ajouté, retiré ni renuméroté.** Aucun comportement ne change par cette session : ni le code, ni un test.

**Alternatives écartées.**
- **Traiter l'absence comme `application/json`** : écartée, CA-7 dit « doit être `application/json` » ; une requête sans en-tête ne le déclare pas, et le code natif de Fastify la refuse déjà quand elle porte un corps.
- **Distinguer l'absence de l'en-tête vide** : écartée, aucun besoin exprimé, et le comportement natif les confond ; deux réponses obligeraient à tenir deux règles pour un même constat.
- **Limiter la règle à `POST /api/v1/token`** : écartée, la règle de `SECURITE-TRANSVERSALE.md` porte déjà sur toutes les routes avec corps ; une exception ici contredirait le tableau.
- **Une note « Écart connu » dans la spec** : écartée sur choix d'Olivier, l'écart du code est consigné en dette seulement.

**Conséquences.**
- Le code est conforme, sauf `POST /api/v1/token` sans corps et sans `Content-Type` : `400 FST_ERR_VALIDATION` aujourd'hui, au lieu de `415`. Un `fix(authentication)` à venir le corrige ; il solde la dette (pas de pas séparé).
- `DEBTS.md` : la ligne `POST /api/v1/token` sans `Content-Type` est remplacée par ce constat ; deux lignes consignent que la conformité à #82 n'est pas sondée sur les thèmes et les questions (`POST`, `PUT`, `PATCH` sans `Content-Type`).
- Condition de réouverture : un client légitime qui enverrait un `POST` sans `Content-Type` et qu'il faudrait accepter, ou un changement de Fastify qui modifierait le traitement natif de l'absence d'en-tête.
- À challenger : (a) les constats viennent de sondes d'autres sessions sur Fastify nu et sur le plugin des tokens (Linux, Node 22), pas sous Windows ni sur le hub assemblé, et cette session ne les a pas rejouées ; thèmes et questions ne sont pas sondés (`better-sqlite3` ne s'installe pas dans l'environnement de Claude) ; (b) US-004 CA-8 et US-007 CA-18 disent encore « Content-Type incorrect » : ils restent vrais, la règle transversale précise leur lecture, non modifiés ici ; (c) `application/json; charset=utf-8` accepté ou non, et l'ordre `405` contre `415`, restent hors CDC.


## #83 — Une erreur inattendue sur `POST /api/v1/token` est journalisée au niveau `ERROR`, avec l'erreur technique (message et pile) dans le log seulement ; le code actuel n'y est pas conforme

*`docs(specs): settle what POST /api/v1/token logs when it answers 500` — US-003 (CA-17), renvoi à `SECURITE-TRANSVERSALE.md` (« Erreurs serveur (500) ») et à US-022 (format des logs). Solde côté spec le point (4) de la dette « `500` de `POST /api/v1/token` : quatre points que les CDC ne fixent pas » ; les décisions #1 à #82 ne sont pas modifiées. Fait suite à #34, qui laissait « Non décidé : le `500` du token ».*

**Contexte.** US-003 CA-17 dit « Erreur serveur inattendue → `500 INTERNAL_SERVER_ERROR` (aucun détail technique exposé) » et ne dit rien du journal. `SECURITE-TRANSVERSALE.md` (« Erreurs serveur ») veut les détails techniques « uniquement dans les logs serveur » ; son exemple `UNHANDLED_EXCEPTION` est non normatif. Le format des logs relève d'US-022 (CA-6 à CA-8), pas d'US-003 (décision #81 pour CA-14 et CA-15). Le code : `setErrorHandler` de `token-route.ts` répond le `500` standard à trois champs (#34) mais ne journalise rien, alors que `theme-route.ts` et `question-route.ts` appellent `reply.log.error(error)`. Le détail technique n'est donc ni exposé, ni tracé.

**Décision.**
1. **Sur choix d'Olivier (2026-11-22)** : une erreur inattendue sur `POST /api/v1/token` est journalisée au niveau `ERROR`, comme sur les thèmes et les questions.
2. **Contenu** : la ligne de log porte l'erreur technique (message et pile). Ces détails ne figurent que dans le log serveur, jamais dans la réponse, qui reste le `500` standard à trois champs (#34).
3. **Niveau** : `ERROR`.
4. Comme CA-14 et CA-15 (#81), CA-17 n'exige que le contenu et le niveau. La **forme** de la ligne (champs, événement, horodatage) relève d'US-022 ; US-003 ne l'exige pas. Rien d'autre n'est exigé : ni `username`, ni adresse IP, ni nom d'événement.
5. Écrit dans une note sous le tableau « Sécurité et transversalité » d'US-003, et dans la cellule du CA-17. **Aucun CA n'est ajouté, retiré ni renuméroté.**

**Alternatives écartées.**
- **Ne rien exiger du journal** (état actuel) : écartée, le `500` serait muet côté serveur, donc inexploitable, alors que `SECURITE-TRANSVERSALE.md` place les détails dans les logs.
- **Exiger aussi `username`, adresse IP ou un nom d'événement** : écartée, rien dans les CDC ne les demande pour une erreur inattendue (la requête a pu échouer avant toute lecture du body) ; l'événement et la forme sont ceux d'US-022.
- **Exiger le format de l'exemple `UNHANDLED_EXCEPTION`** : écartée, exemple non normatif, forme d'US-022.

**Conséquences.**
- Le code **n'est pas conforme** : le `500` de `token-route.ts` ne journalise pas l'erreur. Un `fix(authentication)` suit (test né rouge sur assertion : une ligne de niveau `error` capturée porte l'erreur, la réponse ne contient ni message ni pile). Il passera par deux agents et un smoke test.
- `DEBTS.md` : la ligne « l'erreur du `500` n'est pas journalisée » devient la dette du code, conforme au CDC décidé ; le point (4) de la ligne « quatre points » est retiré, les points (1) à (3) restent non tranchés.
- Condition de réouverture : US-022 livrée (le log du `500` suivra sa forme sans changer US-003), ou une exigence d'exploitation qui demanderait d'autres champs (`username`, IP, `correlation_id`).
- À challenger : (a) « message et pile » est ma lecture de « détails techniques » (`SECURITE-TRANSVERSALE.md` cite stack trace, message SQL, chemins internes, sans définir le contenu du log) ; (b) `username` et IP auraient pu aider à relier un `500` à une connexion, non ajoutés (aucun texte ne les demande) ; (c) « erreur inattendue » est, dans le code, toute erreur qui n'est pas un statut 4xx : le CA ne le dit pas autrement.


---

## #84 — `POST /api/v1/token` juge une requête dans un ordre fixe : limite de débit, méthode ou `Content-Type`, JSON, type, champ manquant, champ inconnu, identifiants

*`docs(specs): settle the order of the checks on POST /api/v1/token` — US-003 (CA-6, CA-7, CA-9 à CA-13, CA-16), diagrammes de flux et de séquence d'US-003. Solde la dette « Diagrammes d'US-003 : ordre des contrôles non identique… » et la ligne « `UNKNOWN_FIELDS` prime sur un champ manquant… » ; les décisions #1 à #83 ne sont pas modifiées (#9 et #10 restent celles des questions).*

**Contexte.** Une requête peut cumuler plusieurs erreurs, une réponse ne porte qu'un code. Les deux diagrammes d'US-003 divergeaient : le flux plaçait le rate limit en premier puis les champs inconnus avant les champs manquants (comme le code), la séquence plaçait `Content-Type`, `405`, rate limit, puis les champs manquants avant les inconnus (comme #9). Aucun CDC ne fixait l'ordre, et le code laissait un champ mal typé au corps natif de Fastify. `SECURITE-TRANSVERSALE.md` dit déjà que le `429` s'applique « y compris sur une méthode non supportée ».

**Décision.**
1. **Sur choix d'Olivier (2026-11-22)** : un champ manquant ou vide est signalé avant un champ inconnu (`400 VALIDATION_ERROR` avant `400 UNKNOWN_FIELDS`), comme #9 pour les questions et pour la même raison : une donnée manquante est prioritaire.
2. **Sur choix d'Olivier** : le `429` passe avant le `405` et le `415`. Toute requête compte dans la limite, y compris celle qui sera refusée plus loin. Le `405` (méthode autre que `POST`) et le `415` (`POST`) ne se cumulent jamais.
3. **Sur choix d'Olivier** : un champ `username` ou `password` présent mais qui n'est pas une chaîne répond `400 VALIDATION_ERROR`, avant le manquant et l'inconnu, comme #10.
4. **Sur choix d'Olivier** : l'ordre complet est inscrit dans un tableau « Ordre des contrôles » d'US-003 et dans les deux diagrammes (images régénérées) : 1 limite de débit ; 2 méthode ou `Content-Type` ; 3 JSON ; 4 type ; 5 manquant ou vide ; 6 inconnu ; 7 identifiants. Le JSON précède les champs parce qu'il faut un body lu pour juger ses champs : ordre non discuté, imposé par la lecture.
5. **Aucun CA n'est ajouté, retiré ni renuméroté.** Le texte du message de `VALIDATION_ERROR` quand les deux champs sont en échec n'est pas tranché ici.

**Alternatives écartées.**
- **L'inconnu avant le manquant** (état du code et du diagramme de flux) : écartée, divergerait de #9 sans raison métier consignée.
- **Ne fixer aucun ordre** (constat reporté) : écartée, un client ne saurait pas quelle erreur il obtient en premier et les deux diagrammes continueraient de se contredire.
- **Le `415` avant le `429`** : écartée, contredirait le CDC (le `429` s'applique à toutes les routes) et le code ; une requête au `Content-Type` invalide ne serait pas comptée.
- **Laisser le champ mal typé en corps natif, ou le placer après le manquant** : écartées, une seule forme de `400` pour ce cas, et l'ordre complet d'US-005 (#10, type d'abord) vaut aussi ici.

**Conséquences.**
- Le code **n'est pas conforme** sur deux points : `{ "username": "a", "foo": 1 }` répond `UNKNOWN_FIELDS` (attendu : `VALIDATION_ERROR`), `{ "username": 42, "password": "x" }` répond le corps natif de Fastify (attendu : `400 VALIDATION_ERROR`). Le reste de l'ordre est conforme d'après la lecture du code (non rejoué : cette session ne change aucun comportement). Un `fix(authentication)` suit, avec deux agents et un smoke test.
- `DEBTS.md` : les deux lignes sur l'ordre sont soldées côté spec ; une ligne consigne l'écart du code ; la ligne sur le message à deux champs manquants est mise à jour (le type est tranché, le body qui n'est pas un objet reste non fixé).
- Condition de réouverture : un client qui exigerait `UNKNOWN_FIELDS` d'abord, ou la migration des thèmes et des questions vers un ordre commun.
- À challenger : (a) l'ordre 4, 5, 6 repose sur l'analogie avec les questions (#9, #10) : les thèmes ont un ordre propre qui n'a pas été relu ; (b) le `429` compte les requêtes refusées plus loin : cela ouvre aux clients malformés un moyen d'épuiser leur propre quota, voulu par « toutes les routes » mais non discuté pour le `415` ; (c) « le code est conforme sur le reste » vient de la lecture de `token-route.ts`, pas d'une sonde rejouée.


---

## #85 — Les `400 VALIDATION_ERROR` de `POST /api/v1/token` ont un message normatif et ne nomment qu'un champ, `username` avant `password` ; un corps JSON qui n'est pas un objet y répond aussi

*`docs(specs): settle the message POST /api/v1/token answers when both fields are missing` — US-003 (CA-9, CA-10, tableau « Ordre des contrôles »). Précise #84 sur le texte des réponses ; #9, #10 et #84 ne sont pas modifiées.*

**Contexte.** #84 fixe l'ordre des contrôles et le code `VALIDATION_ERROR`, mais aucun CDC ne fixait le texte des messages ni le champ nommé quand plusieurs sont en échec. Le code répond `Username is required.` / `Password is required.` (libellés écrits par le code, jamais décidés) et ne nomme que `username` quand les deux manquent ; la dette affirmait à tort que les questions nomment tous les champs manquants : `rejectMissingFields` utilise `find` et n'en nomme qu'un. Un champ mal typé et un corps JSON qui n'est pas un objet répondent le corps natif de Fastify (`FST_ERR_VALIDATION`).

**Décision.**
1. **Sur choix d'Olivier (2026-11-22)** : une réponse `VALIDATION_ERROR` ne nomme qu'un champ ; si `username` et `password` sont tous deux manquants ou vides, c'est `username`, sans mentionner `password` (comme #10).
2. **Sur choix d'Olivier** : les messages sont normatifs mot à mot : `Username is required.`, `Password is required.`.
3. **Sur choix d'Olivier** : un corps JSON valide qui n'est pas un objet (`null`, tableau, chaîne, nombre, booléen) répond `400 VALIDATION_ERROR` au corps standard, message `Request body must be a JSON object.`, au rang 4 de #84.
4. **Sur choix d'Olivier** : un champ présent mais qui n'est pas une chaîne répond `Username must be a string.` ou `Password must be a string.`, `username` avant `password`.
5. Écrit dans les cellules de CA-9 et CA-10, le tableau « Ordre des contrôles » et une section « Messages de `VALIDATION_ERROR` » d'US-003. **Aucun CA n'est ajouté, retiré ni renuméroté.**

**Alternatives écartées.**
- **Nommer les deux champs dans un message** : écartée, diverge de #10 et des questions, change le code.
- **Seul le code normatif, ou seul le champ nommé** : écartées, un test ne pourrait pas asserter le message.
- **Corps non objet laissé au corps natif de Fastify** : écartée, un seul format de `400` (corps standard à trois champs) pour toute la route.

**Conséquences.**
- Le code **n'est pas conforme** pour le champ mal typé et le corps non objet (corps natif de Fastify). Les messages de CA-9 et CA-10 et le champ nommé quand les deux manquent le sont déjà, mais aucun test ne les asserte. Un `fix(authentication)` suit (avec celui de #84 : un seul commit, deux agents et smoke test).
- `DEBTS.md` : la ligne « Le `VALIDATION_ERROR` de CA-9 et CA-10 ne nomme qu'un champ… » est soldée côté spec ; la ligne de l'écart de #84 reprend le champ mal typé et le corps non objet.
- Condition de réouverture : un client qui voudrait tous les champs fautifs dans une réponse, ou des messages localisés.
- À challenger : (a) `Request body must be a JSON object.` et les deux `must be a string.` sont mes libellés, validés par Olivier sans variante proposée ; (b) un corps non objet au rang 4 : un `null` n'est pas « un champ mal typé », c'est un choix de regroupement ; (c) l'état du code est lu dans `token-route.ts`, non rejoué ici (Node 26 absent).


## #86 — Sur `POST /api/v1/token`, un `username` ou un `password` à `null` compte comme manquant ; `error-codes.md` garde `INVALID_BODY` avec l'exception du token

*`docs(specs): settle null as a field value and align error-codes with the validation order on POST /api/v1/token` — US-003 (CA-9, CA-10, tableau « Ordre des contrôles », section « Messages de `VALIDATION_ERROR` »), `error-codes.md`. Précise #84 et #85 ; elles ne sont pas modifiées.*

**Contexte.** Le CDC ne disait pas si `{"username":null}` est un champ « mal typé » (rang 4) ou « manquant » (rang 5). Le code répond « mal typé » (`Username must be a string.`). La décision #22 traite déjà `null` comme absent au `PUT` d'une question. Par ailleurs `error-codes.md` (ligne 17) donnait `400 INVALID_BODY` pour un corps JSON non objet, alors que #85 impose `400 VALIDATION_ERROR` au token ; `INVALID_BODY` reste écrit par la route des questions et cité par US-008 (CA-14) et US-010 (CA-13). Enfin US-003 disait à la fois « `username` avant `password` » et « le type d'abord » : pour `{"password":42}`, la première donne `Username is required.`, la seconde `Password must be a string.`.

**Décision.**
1. **Sur choix d'Olivier (2026-11-22)** : une valeur `null` pour `username` ou `password` compte comme **manquante** : rang 5, `400 VALIDATION_ERROR`, `Username is required.` / `Password is required.` (comme #22). Le `null` du corps entier reste un corps non objet (rang 4, #85).
2. **Sur choix d'Olivier** : `error-codes.md` garde `INVALID_BODY` et note l'exception de `POST /api/v1/token` (`VALIDATION_ERROR`, #85) ; aucun code touché.
3. **Sur choix d'Olivier (arbitrage du 2026-11-22, « le type d'abord »)** : « `username` avant `password` » ne joue qu'entre deux champs en échec au **même** rang de l'ordre des contrôles ; entre rangs, l'ordre des contrôles prévaut (`{"password":42}` → `Password must be a string.`).
4. Écrit dans les cellules de CA-9 et CA-10, le tableau « Ordre des contrôles », la section « Messages de `VALIDATION_ERROR` » et les deux diagrammes d'US-003 (PNG regénérés), et dans `error-codes.md`. **Aucun CA n'est ajouté, retiré ni renuméroté.**

**Alternatives écartées.**
- **`null` mal typé** : écartée, diverge de #22, et `Username is required.` est le message le plus utile à un client qui envoie un champ vide.
- **Retirer `INVALID_BODY` du catalogue** : écartée pour cette session (touche la route des questions et deux CDC) ; consignée en dette avec sa condition de réouverture.

**Conséquences.**
- Le code **n'est pas conforme** pour `null` (il répond « mal typé »). Un `fix(authentication)` suit (deux agents et smoke test), avec le test des deux champs manquants (dette existante). `DEBTS.md` : les « trois points de CDC » sont soldés, une ligne d'écart de code et une ligne `INVALID_BODY` les remplacent ; le titre collé d'US-003 est corrigé.
- Condition de réouverture de 2 : voir la dette `INVALID_BODY`.
- À challenger : (a) `null` = manquant s'écarte du mot « présent » du rang 4 (« présent, non `null` ») ; (b) `{"username":null,"password":42}` répond `Password must be a string.` (rang 4 avant rang 5) : conséquence de #84, non demandée explicitement ; (c) les PNG sont regénérés avec `mmdc` côté Claude, relus à l'œil ; (d) l'état du code est lu dans `token-route.ts`, non rejoué (Node 26 absent).

---

## #87 — Le `null` d'un champ de `POST /api/v1/token` passe le schéma Ajv et se lit comme manquant dans le gestionnaire de la route

*`fix(authentication): treat null as a missing username or password on POST /api/v1/token` — `token-route.ts`. Choix d'implémentation, non observable ; le comportement est celui de #86.*

**Contexte.** Le schéma Ajv de la route type `username` et `password` en `string`, donc un `null` y produisait une violation de type (rang 4), alors que #86 en fait un champ manquant (rang 5).

**Décision.** Le schéma type les deux champs `['string', 'null']` : un `null` n'est plus une violation de type, et `minLength` ne vise que les chaînes. Le gestionnaire lit le `null` dans le corps (`isNull`) et le compte comme manquant au rang 5, que le schéma ait par ailleurs une violation (champ inconnu, rang 6, qui passe après) ou aucune. Le contrôle de type (rang 4) reste celui d'Ajv, donc un champ d'un autre type prime sur le `null` de l'autre champ (`{"username":null,"password":42}` → `Password must be a string.`).

**Alternatives écartées.**
- **Retirer le `null` du corps avant validation** : écartée, elle réécrit l'entrée pour une règle de lecture, et un `null` retiré devient un `required` Ajv, dont l'ordre avec le champ inconnu est déjà celui de #84 mais que le code ne distinguerait plus d'un champ réellement absent.

**Conséquences.** Le `null` est lu à deux endroits du gestionnaire (avec les violations, puis seul quand le schéma ne trouve rien) ; la lecture partage `isNull` et `sendValidationError`. Dette d'écart de code de #86 soldée.

---

## #88 — Un login inconnu sur `POST /api/v1/token` déclenche une comparaison bcrypt factice contre un hash bidon de coût 12 constant

*`fix(authentication): keep the response time constant for an unknown username on POST /api/v1/token` — `jwt-authentication-service.ts`. Choix d'implémentation, non observable : la réponse (`401 INVALID_CREDENTIALS`, message générique) ne change pas.*

**Contexte.** Le CDC (US-003, « Temps de réponse constant (timing attack) » ; `SECURITE-TRANSVERSALE.md`, « Timing attacks ») veut une comparaison bcrypt factice quand le login n'existe pas. `authenticate` rendait `undefined` sans appeler `hasher.compare`. Le CDC ne fixe ni le hash bidon ni son coût.

**Décision.**
1. Pour un login inconnu, `authenticate` appelle `hasher.compare(password, DUMMY_PASSWORD_HASH)`, ignore le résultat (même un `true` ne donne jamais un utilisateur) et rend `undefined`.
2. `DUMMY_PASSWORD_HASH` est une constante nommée : un vrai hash bcrypt valide de **coût 12** (défaut du seed, `BCRYPT_COST=12`), engendré à partir d'un mot de passe sans lien avec un compte réel. Un hash invalide ferait rendre `false` à `compare` sans payer le coût.
3. Preuve : un test observe l'appel (mot de passe fourni, hash qui satisfait `^$2[aby]$12$` + 53 caractères), un test vérifie que le résultat reste `undefined`, un test vérifie qu'un login connu ne déclenche qu'une comparaison, contre le hash de l'utilisateur. Aucune mesure de durée.

**Alternatives écartées.**
- **Lire le coût d'un vrai hash** (par exemple celui d'un compte existant) : écartée, elle couple le hash bidon à une ligne de la base, absente sur une base vide, et la lecture d'un compte réel est une fuite de plus.
- **Dériver le coût de `BCRYPT_COST`** : écartée pour cette session (touche l'injection de configuration dans le service) ; consignée en dette.
- **Mesurer la durée** : écartée, flaky et sans valeur de CDC.

**Conséquences.** Dette « Login inconnu : pas de comparaison bcrypt factice » soldée (supprimée) ; une dette sur le coût figé et la preuve non mesurée la remplace. Le test existant « Login inexistant » passait `{} as Hasher` : il passe désormais un hasher complet.
- À challenger : (a) le coût 12 constant est mon choix, validé en porte 1 mais divergent dès que `BCRYPT_COST` change ; (b) l'égalité de temps n'est pas mesurée ; (c) code lu et testé sous Node 22, Node 26 non vérifié en local.


## #89 — Un `Content-Type` JSON est lu sans tenir compte de la casse ; `charset=utf-8` est conforme, un paramètre inconnu est ignoré, un autre `charset` répond `415` ; règle transversale

*`docs(specs): specify how POST /api/v1/token treats the charset and the case of Content-Type` — US-003 (CA-7), `SECURITE-TRANSVERSALE.md` (tableau « Content-Type obligatoire »). Solde côté spec la dette « `application/json; charset=utf-8` et la casse du type non spécifiés » de `DEBTS.md` ; les décisions #1 à #88 ne sont pas modifiées (elle précise #82).*

**Contexte.** CA-7 et #82 ne disent rien d'un paramètre `charset`, de la casse du type ni d'un autre paramètre ; #82 laissait « `charset=utf-8` accepté ou non » hors CDC. Sonde du 2026-11-23 (jetable, hors dépôt, rien de committé ; Fastify 5.8.4 nu, `app.inject`, Linux, Node 22) : `application/json`, `application/json; charset=utf-8`, `Application/JSON`, `charset=UTF-8`, `; foo=bar`, `APPLICATION/JSON; CHARSET=UTF-8`, mais aussi `charset=iso-8859-1` et `charset=utf-16` répondent tous `200`. Le hub décode toujours en `utf-8`.

**Décision.** Toutes sur choix d'Olivier (2026-11-23) :
1. `application/json; charset=utf-8` est conforme : traité comme `application/json`.
2. La casse du type est ignorée : `Application/JSON` est conforme (un type de média est insensible à la casse, RFC 9110). Par cohérence, `charset=UTF-8` est conforme aussi.
3. Un `charset` autre qu'`utf-8` (`iso-8859-1`, `utf-16`…) est un type non conforme : `415 FST_ERR_CTP_INVALID_MEDIA_TYPE`, corps natif (#11). Le hub décodant toujours en `utf-8`, accepter un autre `charset` mentirait sur le décodage.
4. Un paramètre inconnu (`; foo=bar`) est ignoré : seul `charset` est interprété.
5. La règle est **transversale** : toute route avec corps (`POST`, `PUT`, `PATCH`), comme #82. `GET` et `DELETE` ignorent toujours le `Content-Type`. Écrite dans `SECURITE-TRANSVERSALE.md`, reprise par une phrase au CA-7 d'US-003.
6. **Aucun CA n'est ajouté, retiré ni renuméroté.** Aucun code ni test ne change dans cette session.

**Alternatives écartées.**
- **Refuser `charset=utf-8` (valeur exacte seule)** : écartée, casserait des clients courants sans gain.
- **Casse exacte exigée** : écartée, contraire à la RFC 9110 et à la décision 1.
- **Accepter tout `charset` en l'ignorant** : écartée, un corps `iso-8859-1` serait décodé en `utf-8` et donnerait des caractères faux.
- **Refuser tout paramètre autre que `charset=utf-8`** : écartée, rejette un en-tête légitime sans gain de sécurité.
- **Limiter la règle à `POST /api/v1/token`** : écartée, deux règles pour le même en-tête selon la route.
- **S'en remettre au comportement natif de Fastify** : écartée pour le `charset`, qu'il accepte quelle que soit la valeur.

**Conséquences.**
- Écart code/CDC : un `charset` autre qu'`utf-8` répond `200` au lieu de `415`. Dette dans `DEBTS.md` (« Content-Type : un `charset` autre qu'`utf-8` est accepté »), soldée par un `fix(authentication)` puis un `test(authentication)` des cinq cas ; la dette « charset et casse non spécifiés » est remplacée par elle.
- Les routes des thèmes et des questions ne sont pas sondées : même dette, même fix s'il est posé pour toutes les routes.
- Condition de réouverture : un client légitime qui enverrait un autre `charset` et qu'il faudrait accepter, ou un changement de Fastify qui modifierait le traitement natif des paramètres.
- À challenger : (a) la sonde porte sur Fastify nu (version exacte `5.8.4`, la plage du projet est `^5.8.4`), pas sur le hub assemblé ni sous Windows ; (b) le refus d'un autre `charset` est un choix strict que l'on peut juger inutile pour un hub de LAN ; (c) la lecture sans casse de `charset=UTF-8` est ma déduction de la décision 2, non tranchée séparément ; (d) US-004 CA-8 et US-007 CA-18 disent encore « Content-Type incorrect » : vrais, non modifiés.

## #90 — Une méthode autre que `POST` sur `/api/v1/token` répond `405` avant la lecture du corps, quel que soit ce corps

*`docs(specs): specify the answer of a method other than POST on /api/v1/token when the JSON body is invalid or empty` — US-003 (CA-16, « Ordre des contrôles »). Précise #84 ; les décisions #1 à #89 ne sont pas modifiées.*

**Contexte.** CA-16 dit `405` pour une méthode non supportée, et l'ordre des contrôles de #84 met le `405` au rang 2, avant le `400 INVALID_JSON` du rang 3 ; mais son intitulé parle d'« une requête `POST /api/v1/token` ». Sonde du 2026-11-23 (jetable, hors dépôt, `server.inject` sur `QuizServer` assemblé) : `PUT` ou `DELETE` avec `application/json` et un corps invalide (`{bad`) ou vide répondent `400` natif de Fastify (`FST_ERR_CTP_INVALID_JSON_BODY`, `FST_ERR_CTP_EMPTY_JSON_BODY`), sans `Allow` ; `GET` et `PUT` avec un corps valide répondent `405`, `Allow: POST`. Trois lectures des CDC étaient en conflit : l'ordre des contrôles (`405` d'abord), `SECURITE-TRANSVERSALE.md` (`405` direct), la dette D (`INVALID_JSON` propre au `POST`).

**Décision.** Toutes sur choix d'Olivier (2026-11-23) :
1. Toute méthode autre que `POST` sur `/api/v1/token` répond `405 METHOD_NOT_ALLOWED`, `Allow: POST`, quel que soit son corps : JSON invalide, vide ou valide. Le corps n'est jamais jugé pour ces méthodes.
2. L'ordre de #84 est confirmé tel quel : le `405` et le `415` ne se cumulent jamais ; le `405` prime donc aussi sur un `Content-Type` non conforme d'une méthode autre que `POST`.
3. La règle ne vaut que pour le token. `themes/` et `questions/` ne sont pas tranchés : leur `405` est jugé après l'authentification (#31), cas différent à sonder avant de trancher.
4. **Aucun CA n'est ajouté, retiré ni renuméroté.** Aucun code ni test ne change dans cette session.

**Alternatives écartées.**
- **`400` d'abord** : écartée, contredit l'ordre des contrôles et fait répondre un `400` natif sans `Allow` à une route qui ne supporte pas la méthode.
- **Distinguer `GET` (corps jamais lu) des autres méthodes** : écartée, plus de cas sans bénéfice pour le client.
- **Règle transversale à toutes les routes** : écartée, le cas des routes protégées (`401` avant `405`, #31) n'est pas sondé.

**Conséquences.**
- Écart code/CDC : `PUT` et `DELETE` avec un corps JSON invalide ou vide répondent `400` natif au lieu de `405`. Dette dans `DEBTS.md`, soldée par un `fix(authentication)` puis ses tests.
- Condition de réouverture de la portée : une sonde de `themes/` et `questions/` avec une méthode non supportée et un corps invalide.
- À challenger : (a) la sonde porte sur Linux et Node 22, `better-sqlite3` non compilé ; (b) `PATCH` n'a pas été sondé, il est couvert par le principe « toute méthode autre que `POST` » ; (c) le `HEAD` et l'`OPTIONS` ne sont pas sondés avec un corps.


---

## #91 — Le `500` de `POST /api/v1/token` suit la décision #34 : corps exact à trois champs, message constant, `Content-Type` JSON

*`docs(specs): specify the body, headers and technical details of the 500 answer of POST /api/v1/token` — US-003 (CA-17), renvoi à `SECURITE-TRANSVERSALE.md` (« Erreurs serveur (500) »), `error-codes.md` et à la décision #34, qui laissait « Non décidé : le `500` du token ».*

**Contexte.** La décision #34 fixe le corps du `500` des thèmes et des questions, et laisse le token « non décidé ». CA-17 d'US-003 dit « aucun détail technique exposé » sans le définir ; seule l'annexe `SECURITE-TRANSVERSALE.md` le fait (pas de pile, pas de message SQL, pas de chemin interne). Aucun CDC ne fixe le `Content-Type` ni les en-têtes du `500`. Le smoke test du `500` du token (17 PASS, 0 FAIL) reposait sur des marqueurs heuristiques de l'agent de smoke test pour ces trois points, faute de CDC.

**Décision.** Sur choix d'Olivier (2026-11-23, trois questions, option recommandée à chacune) :
1. **Corps** : la décision #34 vaut pour `POST /api/v1/token`. Un `500` répond `{ "status": 500, "error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred. Please try again later." }`, comme les autres routes ; `correlation_id` arrive avec US-022 (#34).
2. **« Aucun détail technique exposé »** : CA-17 renvoie à `SECURITE-TRANSVERSALE.md` (pas de pile, pas de message SQL, pas de chemin interne) et le corps est **exactement** les trois champs ci-dessus, le `message` étant constant et jamais issu de l'erreur. Un corps différent, quel qu'en soit l'écart, est un écart au CDC : l'égalité du corps est assertable sans heuristique.
3. **En-têtes** : le `Content-Type` est de type `application/json` ; son paramètre `charset` n'est pas imposé. Aucun autre en-tête n'est exigé.

**Alternatives écartées.**
- **Corps propre au token** : écartée, exception à `error-codes.md` sans besoin observable.
- **Attendre US-022** : écartée, le corps à trois champs est déjà conforme tant qu'US-022 n'est pas livrée (#34).
- **Renvoi à l'annexe seul / liste élargie dans CA-17** : écartées, la première laisse des marqueurs heuristiques, la seconde est plus stricte que l'annexe et oblige à aligner les autres US.
- **`application/json; charset=utf-8` exact** : écartée, dépend du comportement actuel de Fastify.

**Conséquences.**
- **Aucun CA n'est ajouté, retiré ni renuméroté.** Une note est ajoutée à CA-17 d'US-003 ; aucun code ni test ne change dans cette session.
- Les tests existants du `500` du token (`token-route.test.ts`) assertent déjà le corps à trois champs ; le `Content-Type` n'y est pas asserté : à vérifier à la prochaine session `test(authentication)`, sans trou de spec.
- Le contenu du log du `500` (CA17-8, `err.message` / `err.stack`) reste une autre dette, hors de cette décision.
- À challenger en revue : « message constant, jamais issu de l'erreur » est une lecture de « aucun détail technique » (corps exact) ; aucun texte ne la dit tel quel.

## #92 — Une méthode non supportée sur une route protégée répond `401`, `403` ou `405` sans jamais juger le corps, quel que soit ce corps ; règle transversale

*`docs(specs): specify the 405 answer of themes and questions for an invalid body` — US-004 (CA-35), US-005 (CA-53), `SECURITE-TRANSVERSALE.md` (« Méthodes HTTP non supportées », annexe CA-MethodNotAllowed). Étend #90 (point 3 révisé) ; précise #31 ; les décisions #1 à #91 ne sont pas modifiées.*

**Contexte.** #90 a posé « `405` avant la lecture du corps » pour `/api/v1/token` seul, en laissant `themes/` et `questions/` à sonder (#90, point 3, condition de réouverture). Sonde du 2026-11-23 (jetable, hors dépôt, `server.inject` sur `QuizServer` assemblé, Linux, Node 22 ; 336 cas : `PATCH`, `OPTIONS`, `HEAD` sur `themes/`, `themes/:id`, `questions/`, `questions/:id`, quatre appelants : anonyme, token invalide, `buzzer`, `admin` ; sept corps). `PATCH` et `OPTIONS` avec `application/json` et un corps invalide, vide ou `charset=latin1` invalide répondent le `400 Bad Request` natif de Fastify, sans `Allow`, pour les quatre appelants (24 cas chacun) : un anonyme reçoit `400` au lieu de `401`, un `buzzer` en écriture `400` au lieu de `403`, un `admin` `400` au lieu de `405`. Les corps valides, `text/plain`, `application/xml` et sans `Content-Type` répondent `401`, `403` ou `405` conformes. `HEAD` répond conformément dans tous les cas, corps invalide compris.

**Décision.** Toutes sur choix d'Olivier (2026-11-23, trois questions, option recommandée à chacune) :
1. **Ordre** : pour une méthode non supportée sur une route protégée, `401` (token absent, invalide ou expiré), puis `403` (`buzzer`, méthode d'écriture), puis `405` avec `Allow`. Le corps n'est jamais jugé : JSON invalide, vide, `Content-Type` non conforme, `charset` autre qu'`utf-8` ou corps valide ne produisent ni `400` ni `415` et ne changent aucun de ces trois résultats. Un `400 INVALID_JSON` ou un `415` ne se rend que sur une méthode supportée par la ressource.
2. **Portée** : transversale, écrite dans `SECURITE-TRANSVERSALE.md` ; elle vaut pour toute route protégée, des US futures comprises. Le point 3 de #90 (« la règle ne vaut que pour le token ») est révisé : #90 pour le token (route publique, sans `401` ni `403`) et #92 pour les routes protégées forment une seule règle.
3. **Forme** : une note sur CA-35 (US-004) et sur CA-53 (US-005), un paragraphe et quatre exemples dans `SECURITE-TRANSVERSALE.md`. Aucun CA n'est ajouté.

**Alternatives écartées.**
- **`401`/`403` d'abord, puis `400` pour un corps invalide, `405` ensuite** : écartée, un `admin` apprendrait un `400` sur une route qui ne supporte pas la méthode, sans `Allow` ; même raisonnement que #90.
- **Ne rien changer, assumer le `400` natif** : écartée, contredit #31 pour l'anonyme et le `buzzer`.
- **Règle limitée à `themes/` et `questions/`, ou aux seuls CA-35 et CA-53** : écartées, chaque US future devrait re-trancher.
- **Un nouveau CA par US** : écartée, comme pour #90 ; la note suffit tant que le `fix` n'a pas besoin d'un CA numéroté.

**Conséquences.**
- **Aucun CA n'est ajouté, retiré ni renuméroté.** Aucun code ni test ne change dans cette session.
- Écart code/CDC : `PATCH` et `OPTIONS` avec un corps JSON invalide ou vide répondent `400` natif au lieu de `401`, `403` ou `405` sur `themes/` et `questions/` (le `PATCH` des questions n'existe pas encore, US-007, et suivra la règle). Dette dans `DEBTS.md`, soldée par un `fix` puis ses tests, sur le serveur assemblé.
- `HEAD` est déjà conforme à la sonde ; `HEAD` et `OPTIONS` avec un corps sur `/api/v1/token` restent non décidés (hors périmètre, dette conservée).
- À challenger : (a) la sonde porte sur Linux, Node 22, `better-sqlite3` non compilé, comme #90 ; (b) `POST`, `PUT` et `DELETE` supportés avec un corps JSON invalide répondent aussi le `400` natif sur `themes/` et `questions/` : CA propres à chaque US, hors de #92 (dette `INVALID_JSON`, non sondée) ; (c) l'URL à segment vide (`PATCH /api/v1/themes/`) reste muette dans le CDC ; (d) « corps jamais jugé » est étendu aux autres méthodes non listées (`TRACE`, `CONNECT`, méthodes inconnues) par le principe, non sondées.

---

## #93 — `HEAD` et `OPTIONS` sur `/api/v1/token` répondent `405` sans juger le corps ; un segment vide est un `:id` vide jugé comme un `:id` mal formé

*`docs(specs): specify the HEAD and OPTIONS answers of the token route and the empty-segment URL` — US-003 (CA-16), US-004 (CA-35), US-005 (CA-53), `SECURITE-TRANSVERSALE.md` (annexe CA-MethodNotAllowed). Précise #90 et #92 ; les décisions #1 à #92 ne sont pas modifiées.*

**Contexte.** #90 pose « toute méthode autre que `POST` » sur `/api/v1/token` : `405`, `Allow: POST`, corps jamais jugé ; #32 pose que `HEAD` n'est jamais supporté. #90 notait pourtant que `HEAD` et `OPTIONS` n'étaient pas sondés avec un corps. En réel (lecture de `routes/not-found-route.ts`) : le hook `onRequest` ne traite que `GET`, `POST`, `PUT`, `PATCH`, `DELETE` sur une URL publique, donc `OPTIONS` + `{bad` répond le `400` natif (constat du handoff du 2026-11-23, test témoin). Pour l'URL à segment vide, les CDC sont muets ; le catalogue de routes transforme déjà `:id` en `[^/]*`, et une sonde jetable sur Fastify seul (hors dépôt) montre que `GET /api/v1/themes/` correspond à la route `themes/:id` avec `id = ""`.

**Décision.** Toutes sur choix d'Olivier (2026-11-23, trois questions, option recommandée à chacune) :
1. **Token** : lecture littérale de #90. `HEAD` et `OPTIONS` sur `/api/v1/token`, avec ou sans corps (JSON invalide, vide ou valide), répondent `405 METHOD_NOT_ALLOWED`, `Allow: POST`. Pas de décision propre à `OPTIONS` : l'écart du réel est un écart code/CDC, pas un trou de CDC.
2. **Segment vide** : sur une ressource à identifiant, un segment vide est un `:id` vide, jugé comme un `:id` mal formé (#30). Méthode supportée par la route `/:id` : `400 INVALID_UUID`. Méthode non supportée : `401`, `403` ou `405` avec le `Allow` de la route `/:id`, dans l'ordre de #92. Ce n'est pas la collection.
3. **Forme** : comme #92. Une note sur CA-16 (US-003), CA-35 (US-004) et CA-53 (US-005), deux paragraphes dans `SECURITE-TRANSVERSALE.md`. Aucun CA n'est ajouté, retiré ni renuméroté.

**Alternatives écartées.**
- **Décision propre à `OPTIONS` (ex. `204`)** : écartée, contredit #32 et #90 sans bénéfice.
- **Segment vide = la collection** : écartée, demande un changement de routage et contredit le réel.
- **Segment vide = route inconnue (`404`)** : écartée, demande un changement de routage et une règle de plus à tester.
- **Nouveaux CA dédiés** : écartée, comme pour #90 et #92.

**Conséquences.**
- **Aucun CA n'est ajouté, retiré ni renuméroté.** Aucun code ni test ne change dans cette session.
- Écart code/CDC : `OPTIONS` + corps invalide sur le token répond le `400` natif. Dette dans `DEBTS.md`, soldée par un `fix(errors)` puis ses tests ; le test témoin de `server.test.ts` (qui épingle le `400` natif) devra être inversé.
- À challenger : (a) `HEAD` du token avec un corps non sondé sur le hub réel (Fastify ne lit pas le corps d'un `HEAD`, supposé) ; (b) `GET`, `PUT`, `DELETE` à segment vide non sondés sur le hub réel, seulement sur Fastify seul ; (c) `/api/v1/themes//` (deux segments vides) reste muet ; (d) `docs/shared/SECURITE-TRANSVERSALE.md` est une copie partagée : les autres dépôts devront la recevoir (à vérifier) ; (e) la sonde porte sur Linux et Node 22.

## #94 — Une `MAX_REQUESTS_PER_MINUTE` définie qui n'est pas un entier de 1 à 2147483647 empêche le hub de démarrer, la chaîne vide comprise ; ordre des refus : `JWT_*`, `PORT`, `MAX_REQUESTS_PER_MINUTE`, base de données

*`docs(specs): specify the answer to an invalid MAX_REQUESTS_PER_MINUTE` — US-003 (CA-13, nouveau CA-21), US-001 (CA-1, CA-7, CA-9, CA-10, périmètre), tableau des variables de `CONVENTIONS-TECHNIQUES.md`, `SECURITE-TRANSVERSALE.md` (rate limiting). Fait suite à la décision #39, qui ne portait que sur le nom, et à la décision #45 (`PORT`) dont elle reprend la forme ; l'ordre des contrôles des décisions #49, #55, #56, #57, #60 et #61 gagne une étape. Les décisions #1 à #93 ne sont pas modifiées.*

**Contexte.** Le CDC dit le nom (#39), le défaut `100` et ce qui se passe au-delà du plafond (US-003 CA-13, `SECURITE-TRANSVERSALE.md`), mais rien d'une valeur invalide. Le code lit `parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? "100")` (`common/process-environment.ts`) et passe le résultat à `@fastify/rate-limit` sans contrôle. Sondé le 2026-11-24 (sonde jetable non committée, hors dépôt) : Fastify seul, `@fastify/rate-limit` 10.3.0, Node 22.23.5 (le dépôt exige Node 26), `max` = `parseInt(<valeur>)` comme le code, huit `GET` d'une même adresse dans la minute, via `inject`. Constat, sans décision :

| Valeur | `max` reçu | Réponses des huit requêtes |
|---|---|---|
| chaîne vide, `abc` | `NaN` | huit `200` : plus aucune limite, sans erreur ni message |
| `8080abc` | `8080` | huit `200` (lue comme 8080) |
| `1.5` | `1` | `200` puis sept `429` (lue comme 1) |
| `0` | `0` | huit `429` : toute requête refusée, la première comprise |
| `-1` | `-1` | huit `200` : plus aucune limite |
| `+5`, ` 5` | `5` | cinq `200` puis `429` (lues comme 5) |
| `2147483648` | `2147483648` | huit `200` (acceptée comme plafond énorme) |

Une valeur mal écrite fait donc, selon sa forme, soit disparaître la limite sans le dire (vide, non numérique, négatif), soit refuser toutes les requêtes (`0`), soit être lue autrement que ce qui est écrit (`8080abc`, `1.5`, `+5`). Le plugin ne borne pas `max` à 2147483647 : cette borne est un choix, pas une contrainte du plugin. Précédents : `PORT` (US-001 CA-7, #45 et #46), `JWT_EXPIRATION` (US-003 CA-20) et `BCRYPT_COST` (US-002 CA-6).

**Décision.** Toutes sur choix d'Olivier (2026-11-24) :
1. **Valeur invalide** : toute valeur qui n'est pas un entier compris entre 1 et 2147483647 (maximum d'un entier signé de 32 bits).
2. **Réaction** : le hub refuse de démarrer, comme pour `PORT` (#45) et `JWT_*` (US-003 CA-19 et CA-20) : le serveur n'écoute sur aucun port, le processus se termine avec le code de sortie `1`, la console affiche un message qui nomme `MAX_REQUESTS_PER_MINUTE` et sa règle et ne reprend jamais la valeur (US-001 CA-7).
3. **Forme** : chiffres ASCII seulement, sans signe, sans espace ni tabulation, sans préfixe ni séparateur, comme `PORT`, `JWT_EXPIRATION` et `BCRYPT_COST`. Les zéros en tête sont acceptés (`0100` vaut 100). Refusés : `+5`, les espaces ou tabulations, `1.5`, `1e3`, `8080abc`, `0`, les négatifs, `2147483648`.
4. **Vide** : définie mais vide (`MAX_REQUESTS_PER_MINUTE=`), la valeur est refusée, comme `PORT` et à la différence de `JWT_EXPIRATION`. Absente, la variable vaut `100`, inchangé. Une valeur faite uniquement de blancs est refusée par la règle de forme, comme pour `PORT` : aucun blanc n'est ignoré (à la différence de `SQLITE_DB_PATH`, US-001 CA-10, dont les blancs de bordure sont retirés).
5. **Message** : il nomme `MAX_REQUESTS_PER_MINUTE` et la règle (entier de 1 à 2147483647 écrit en chiffres seulement), sans la valeur reçue. Le libellé exact est un choix de rédaction (voir Conséquences).
6. **Ordre des refus de démarrage** (une seule erreur rapportée à la fois) : `JWT_*`, puis `PORT`, puis `MAX_REQUESTS_PER_MINUTE`, puis la base de données (`SQLITE_DB_PATH`, puis l'ouverture).

**Alternatives écartées.**
- **Repli sur `100` avec un `WARN`** : écartée, le hub tournerait avec un plafond que l'administrateur n'a pas demandé, et un avertissement se perd dans la console.
- **Repli silencieux sur `100`** : écartée, c'est le défaut actuel sous une autre forme, sans aucun signal.
- **Forme sans zéro en tête** (`0100` refusée, comme `BCRYPT_COST`) : écartée, `PORT` accepte les zéros en tête et la variable lui ressemble ; `00`, qui vaut 0, reste refusé.
- **Toute écriture d'entier acceptée, signe `+` et espaces compris** : écartée, c'est la lecture de `parseInt` qui a produit les surprises du constat (`+5`, ` 5`, `8080abc`).
- **Vide vaut absente** (comme `JWT_EXPIRATION`) : écartée, Olivier veut que `MAX_REQUESTS_PER_MINUTE=` refuse, comme `PORT=`.
- **Autres positions dans l'ordre** (avant `PORT`, avant `JWT_*`, ou après la base) : écartées. `MAX_REQUESTS_PER_MINUTE` passe après `PORT` : les variables qui décident de l'écoute et des tokens d'abord, puis le plafond, puis tout ce qui touche à la base.

**Conséquences.**
- **Nouveau CA-21 dans US-003** (numéro libre suivant : CA-18 est retiré, CA-19 et CA-20 existent, aucun CA-21 ne l'était), avec une section de détail sur le modèle du CA-7 d'US-001. CA-13 renvoie au CA-21. Aucun autre CA n'est retiré ni renuméroté. Les passages d'US-001 qui énoncent l'ordre (CA-1, CA-7, CA-9, CA-10, périmètre) et le tableau des variables de `CONVENTIONS-TECHNIQUES.md` sont alignés ; `SECURITE-TRANSVERSALE.md` renvoie à la règle.
- **Rien n'est codé dans cette session** : aucun code, aucun test. Écart code/CDC jusqu'au `fix(environment)` qui suit, consigné dans `DEBTS.md` : un rouge par règle (vide, non numérique, `8080abc`, décimal, `0`, `2147483648`, `+5`, ` 5`, ordre des refus), smoke test requis puisque le comportement observable change.
- Choix de Claude, à challenger en revue : le libellé du message est un exemple, `Server starting failed: MAX_REQUESTS_PER_MINUTE must be an integer between 1 and 2147483647, written with digits only.`, aligné sur `PORT must be an integer between 1 and 65535.` et sur `JWT_EXPIRATION must be a strictly positive integer, in seconds.` (le préfixe est celui que le hub affiche déjà) ; la numérotation en CA-21 et la section de détail ; la formulation de la règle de forme reprend celle d'US-001 CA-7 ; la liste des valeurs refusées du CA-21 est celle de la décision, complétée de `5 ` (espace en fin) et des blancs seuls, qui découlent de la règle de forme.
- Non décidé, inchangé : ce que fait le seed d'une valeur invalide (la règle est écrite pour le hub ; le seed instancie `ProcessEnvironment`, qui lit la variable sans l'utiliser : un contrôle placé dans son constructeur le ferait refuser, ce que le CDC ne dit pas) ; une valeur écrite dans un `.env` du répertoire de travail (non prouvée sur le hub réel, voir `DEBTS.md`) ; `trustProxy` ; le câblage du `429` sur les thèmes et les questions ; `.env.example`, qui ne porte pas cette variable. Les diagrammes d'US-001 et d'US-003 (images) ne montrent pas ce refus.
- Dans le code, l'ordre `JWT_*`, `PORT`, `SQLITE_DB_PATH` puis la base est déjà celui de `createServer` (`index.ts`) ; `MAX_REQUESTS_PER_MINUTE` est lue dans le constructeur de `ProcessEnvironment`, qui contrôle déjà `SQLITE_DB_PATH` : le `fix(environment)` devra faire passer le contrôle du plafond avant celui de `SQLITE_DB_PATH`.
- `ETAT-DES-LIEUX-socle-hub.md` (audit daté) cite encore la valeur invalide comme dette non décidée : non touché.

## #95 — Le seed ignore `MAX_REQUESTS_PER_MINUTE`, quelle que soit sa valeur : elle n'a aucun effet sur lui

*`docs(specs): specify the seed's answer to an invalid MAX_REQUESTS_PER_MINUTE` — US-002 (nouveau CA-10, workflow, Périmètre), US-003 (CA-21, « Portée »), tableau des variables et paragraphe `.env` de `CONVENTIONS-TECHNIQUES.md`. Complète la décision #94, qui ne réglait que le hub et laissait le seed « non décidé ». Les décisions #1 à #94 ne sont pas modifiées.*

**Contexte.** La décision #94 (US-003 CA-21, « Portée ») dit que le refus d'une `MAX_REQUESTS_PER_MINUTE` invalide est celui du hub (`npm start`) et que le seed n'utilise pas cette variable ; ce qu'il fait d'une valeur invalide n'était pas décidé. US-002 est muet sur cette variable, et `CONVENTIONS-TECHNIQUES.md` dit que le `.env` est lu par le hub et par le seed. Constat du `fix(environment)` du 2026-11-24, sondé le même jour (sonde jetable hors dépôt, non committée ; seule `MAX_REQUESTS_PER_MINUTE=abc` change) : `src/seed.ts` instancie `ProcessEnvironment`, dont le constructeur contrôle maintenant `MAX_REQUESTS_PER_MINUTE` avant `SQLITE_DB_PATH`. Le seed refuse donc aujourd'hui une valeur invalide (code `1`, `User seeding failed: MAX_REQUESTS_PER_MINUTE must be an integer between 1 and 2147483647, written with digits only.` sur la sortie d'erreur, aucun fichier de base créé), alors qu'avant ce fix le même seed réussissait (`Seed terminé — 11 comptes créés.`, code `0`). C'est une conséquence constatée du fix, pas un choix. Précédent : `JWT_*`, que le seed ne contrôle pas (US-003 CA-19).

**Décision.** Sur choix d'Olivier (2026-11-24) : le seed **ignore** `MAX_REQUESTS_PER_MINUTE`. Quelle que soit sa valeur (absente, valide, chaîne vide, blancs seuls, `abc`, `0`, hors plage, etc.), elle n'a aucun effet sur le seed : il réussit ou échoue exactement comme si elle n'existait pas, avec les mêmes sorties et le même code de sortie. Même principe que `JWT_SECRET` et `JWT_EXPIRATION` (US-003 CA-19 : le seed ne refuse ni un secret JWT absent ni une durée invalide). Le refus d'une valeur invalide reste celui du hub, inchangé (#94). Raison : une variable que le seed n'emploie pas ne doit pas le faire échouer ; la décision rétablit le comportement d'avant le `fix(environment)`.

**Conséquences.**
- **Nouveau CA-10 dans US-002** (CA-5 est retiré, CA-1 à CA-9 existent, aucun CA-10 ne l'était), sur le procédé de CA-8 et CA-9 : une règle observable est un CA numéroté. Le workflow du seed et le Périmètre d'US-002 le citent. **US-003 CA-21, « Portée »** : « non décidé » est remplacé par la règle, avec renvoi à #95 ; aucun CA n'est ajouté ni renuméroté dans US-003. Le tableau des variables et le paragraphe `.env` de `CONVENTIONS-TECHNIQUES.md` disent que le seed ne lit pas la variable.
- **Le code n'est pas aligné** : tant que `seed.ts` instancie `ProcessEnvironment` dont le constructeur contrôle le plafond, le seed refuse encore une valeur invalide (écart code/CDC, consigné dans `DEBTS.md` : « décidé le 2026-11-24 (#95), non codé »). Session suivante proposée : `fix(seed)` ou `refactor(environment)` (sortir la lecture du plafond du constructeur de `ProcessEnvironment`, ou la lire à la demande), avec un test sur le seed réel (processus enfant, `MAX_REQUESTS_PER_MINUTE` invalide, mêmes sorties et même code que sans la variable) ; le comportement observable change, donc smoke test à prévoir.
- **Aucun code, aucun test** dans cette session.
- Choix de Claude, à challenger en revue : CA-10 en nouveau CA plutôt qu'en note datée ; la règle est écrite « comme si absente » (mêmes sorties, même code de sortie), y compris quand le seed échoue pour une autre cause (mot de passe, `BCRYPT_COST`, base) ; elle vaut aussi pour une valeur écrite dans un `.env`.
- `ETAT-DES-LIEUX-socle-hub.md` (audit daté) n'est pas touché, comme pour #94.


## #96 — Une URL inconnue est soumise à la limite de débit (`429` avant le `404`) ; un seul compteur commun par adresse IP pour toute l'API, et toute requête y compte quelle que soit sa réponse

*`docs(specs): specify the answer of an unknown route to the rate limit` — annexe `CA-RateLimit` et tableau de la route inconnue de `SECURITE-TRANSVERSALE.md`, US-003 (CA-13). Complète la décision #35, qui laissait le `429` sur route inconnue « non décidé », et lève le « compteur par plugin » que #37 laissait « non décidé, inchangé ». Les décisions #36 (`Retry-After: 60`) et #37 (corps du `429`) s'appliquent telles quelles et ne sont pas modifiées. Les décisions #1 à #95 ne sont pas modifiées.*

**Contexte.** La décision #35 écrit : « Non décidé : le rate limiting (`429`) sur une route inconnue (l'annexe l'impose à "toutes les routes", mais le middleware est aujourd'hui branché route par route) ». L'annexe `CA-RateLimit` demande 100 requêtes par minute et par adresse IP sur « toutes les routes », et aucun texte ne dit ce que répond une URL inconnue au-delà de la limite, ni si le compteur est commun à toute l'API. Le code soumet déjà la route inconnue à une limite (`routes/not-found-route.ts` : `setNotFoundHandler` avec `preHandler: app.rateLimit()`), mais chaque plugin (jetons, thèmes, questions, route inconnue) enregistre son propre `@fastify/rate-limit` et donc son propre compteur : un client peut dépasser 100 requêtes au total. Constaté le 2026-11-24 (smoke test du `fix(environment)`, `DEBTS.md`) : sur `/api/v1/token`, les `GET` (réponse `405`, compteur de la route inconnue) et les `POST` (compteur des jetons) ne partagent pas le leur. Le CDC était muet sur ce point.

**Décision.** Sur choix d'Olivier (2026-11-25) :
1. **Une URL inconnue est soumise à la limite de débit.** Au-delà de la limite, elle répond `429 RATE_LIMIT_EXCEEDED` (corps de #37, `Retry-After: 60` de #36) ; ce `429` passe avant le `404` de #35. En dessous de la limite, elle répond `404 NOT_FOUND` comme avant. Choix : « Oui, 429 standard » (option recommandée, acceptée).
2. **Un seul compteur commun par adresse IP pour toute l'API**, route inconnue comprise : c'est la lettre de l'annexe (« limite globale », « toutes les routes »). Un client ne peut pas dépasser la limite en répartissant ses requêtes entre les jetons, les thèmes, les questions et les URL inconnues. Le code actuel, qui compte par plugin, est un écart à corriger (voir Conséquences).
3. **Toute requête compte dans la limite commune, quelle que soit sa réponse** (`200`, `400`, `401`, `403`, `404`, `405`) ; le `429` passe avant tout autre contrôle ou réponse : il est rendu avant l'authentification (`401`), le contrôle de rôle (`403`), le `405`, le `404` et le jugement du corps. Cela vaut aussi pour la requête qui est refusée.

Laissés ouverts volontairement, non décidés ici : (a) `GET /health` (US-020) et `/ws` (US-009) dans ou hors de la limite commune ; (b) fenêtre d'une minute fixe ou glissante ; (c) `trustProxy` (adresse IP vue par le hub derrière un proxy). Écartées : un `404` même au-delà de la limite (une URL inconnue deviendrait un moyen d'envoyer des requêtes sans limite, contraire à « toutes les routes ») ; un compteur par plugin ou par famille de routes (contredit « limite globale » de l'annexe) ; ne compter que les requêtes réussies ou authentifiées (une salve de `401` ou de `404` échapperait à la limite, ce que l'annexe veut justement borner).

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** dans cette session : documentation seule.
- **Annexe `SECURITE-TRANSVERSALE.md`** : `CA-RateLimit` (tableau et exemple), tableau de la route inconnue et ordre des contrôles d'une méthode non supportée disent les trois règles et renvoient à #96. US-003 CA-13 précise que le compteur de `/token` est le compteur commun. Les autres CA « Rate limiting (voir annexe CA-RateLimit) » renvoient à l'annexe et restent exacts.
- **Code en écart (point 2), consigné dans `DEBTS.md`** : un `feat` séparé, à écrire après cette session, remplace les quatre `@fastify/rate-limit` par plugin par un seul compteur à la racine de l'application, hooks hérités par tous les plugins. Test rouge attendu : sur le serveur assemblé, avec une limite basse (par exemple 3), un client d'une même adresse envoie une requête à une route des jetons, une à une route des thèmes, une à une URL inconnue, puis une quatrième à n'importe laquelle de ces trois familles : la quatrième doit répondre `429` ; aujourd'hui chaque plugin repart de zéro et elle répond `200` ou `404`. Compléments : trois requêtes `401`, `400`, `404` ou `405` (réponses non `2xx`) comptent, la quatrième répond `429` sans jamais produire son `401`, `400`, `404` ou `405` ; une seconde adresse garde son propre compteur ; le `429` garde `Retry-After: 60` et le corps de #37. Le `feat` change un comportement observable : smoke test à prévoir. Le test du point 1 sur le hub réel (trois requêtes `404` d'une même adresse, la quatrième `429`) passe déjà avec un compteur par plugin ; il peut s'écrire sans attendre le `feat`.
- **Écart déjà constaté, soldé par ce `feat`** : les `GET` en `405` et les `POST` de `/api/v1/token` ne partagent pas leur compteur (`DEBTS.md`) ; le point 3 le tranche : ils le partagent.
- `ETAT-DES-LIEUX-socle-hub.md` (audit daté) n'est pas touché : aucune de ses lignes ne devient fausse.
- Choix de Claude, à challenger en revue : (1) **découpage** : une seule décision pour les trois points, parce qu'ils se décident ensemble (le point 3 n'a de sens que dans le compteur commun du point 2, et le `429` avant `404` du point 1 en est le cas particulier) ; trois entrées auraient dispersé les renvois, #94 groupe de même plusieurs règles d'une même variable ; (2) « toute requête compte » est lu « une fois » : une requête consomme une unité de la limite commune, jamais deux, quel que soit le nombre de contrôles qu'elle traverse (le hook du `405` et le gestionnaire de route inconnue appellent chacun la limite) ; aucune décision ne le dit mot pour mot, et le `feat` devra l'éviter ; (3) « le `429` passe avant tout » est étendu au jugement du corps (`400 INVALID_JSON`, `415`), que les décisions #90 et #92 écartent déjà pour une méthode non supportée mais pas pour une méthode supportée ; (4) la mention de la règle de `/token` dans US-003 CA-13 est une clarification, pas un changement : le plafond de `/token` reste 100 par adresse ; (5) le test du point 1 est dit indépendant du `feat`, parce qu'il ne dépend que du compteur de la route inconnue.
- Points muets relevés en passant, non décidés : US-009 (CA-26) fixe pour les connexions WebSocket une limite propre de 15 tentatives par minute et par adresse IP, destruction de la socket sans `429` ; elle n'est pas un compteur de la limite commune et ne dit pas si une tentative `/ws` y compte aussi (point (a) ci-dessus).

---

## #97 — La limite de débit compte l'adresse de la connexion (`trustProxy` désactivé) ; sa fenêtre d'une minute est fixe, ouverte à la première requête, et un refus ne la prolonge pas

*`docs(specs): specify the trusted proxy and the window of the rate limit` — annexe `CA-RateLimit` de `SECURITE-TRANSVERSALE.md`, US-003 (CA-13), US-009 (note sur le reverse proxy). Lève les points (b) et (c) que la décision #96 laissait ouverts ; le point (a) (`/health` et `/ws`) reste ouvert. Les décisions #1 à #96 ne sont pas modifiées.*

**Contexte.** La décision #96 laisse ouvert : « (b) fenêtre d'une minute fixe ou glissante ; (c) `trustProxy` (adresse IP vue par le hub derrière un proxy) ». L'annexe disait que les proxys « doivent transmettre `X-Forwarded-For` » sans dire si le hub s'y fie, et US-009 recommandait un reverse proxy en production, alors que `VISION.md` écrit que le dispositif fonctionne « exclusivement sur un réseau WiFi local ». Le code ne fait pas confiance au proxy (`Fastify({ logger: true, exposeHeadRoutes: false })`) et applique la fenêtre de `@fastify/rate-limit` 10.3.0 (`LocalStore`) : fixe, ouverte à la première requête de l'adresse, sans prolongation par les refus (`continueExceeding` absent).

**Décision.** Sur choix d'Olivier (2026-11-25), chaque fois l'option recommandée :
1. **L'adresse comptée est celle de la connexion au hub.** `trustProxy` est désactivé : `X-Forwarded-For` et les en-têtes de proxy sont ignorés, un client ne change pas d'adresse comptée en les falsifiant. Le hub n'est pas prévu derrière un proxy (`VISION.md`, réseau local uniquement) ; derrière un proxy, toutes les requêtes seraient vues sous une seule adresse. Écartées : l'adresse de `X-Forwarded-For` (falsifiable par n'importe quel client du réseau) et une variable d'environnement (une variable, un CA de démarrage et un défaut de plus pour un hub local).
2. **La fenêtre d'une minute est fixe, ouverte à la première requête comptée de l'adresse.** Le compteur repart de zéro une minute après cette requête, pas à la minute de l'horloge. Un client peut envoyer jusqu'à deux fois la limite autour d'un changement de fenêtre : écart assumé. Écartées : une fenêtre glissante (un `feat` avec un store personnalisé, pour un risque borné sur un réseau local) et une fenêtre alignée sur l'horloge (un `feat` pour le même effet de frontière).
3. **Une requête refusée en `429` compte mais ne prolonge pas la fenêtre.** Le client retrouve l'accès une minute après le début de la fenêtre, quel que soit le nombre de refus ; `Retry-After: 60` (#36) est donc toujours suffisant. Écartée : un refus qui rouvre une minute (`Retry-After: 60` faux pour un client qui réessaie trop tôt, et un `feat` de plus).

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** dans cette session : documentation seule. Les trois règles décrivent le code actuel ; aucun écart de code n'est créé.
- **Non prouvé par un test** (consigné dans `DEBTS.md`) : `X-Forwarded-For` ignoré, fenêtre fixe, refus sans prolongation. Un `test(errors)` sur le serveur assemblé les prouverait, nés verts.
- **Annexe et specs** : `SECURITE-TRANSVERSALE.md` (trois lignes du tableau `CA-RateLimit`, paragraphe « Non décidé » réduit à `/health` et `/ws`), US-003 CA-13 (une phrase), US-009 (la note sur le reverse proxy est réécrite : il n'est pas prévu).
- Choix de Claude, à challenger en revue : (1) **une seule décision** pour les trois points, parce que la fenêtre et le refus se décident ensemble (le refus n'a de sens que dans la fenêtre fixe) et que l'adresse comptée en est l'entrée ; (2) le troisième point est une décision du CDC et non un détail du code : il est observable (la date à laquelle un client bloqué retrouve l'accès) ; (3) la note d'US-009 est réécrite, pas supprimée : elle disait le contraire de #97 ; (4) l'écart « jusqu'à deux fois la limite » est écrit dans l'annexe, pour qu'un futur test ne le prenne pas pour un bug.

---

## #98 — Les routes de thèmes contrôlent la forme de l'id, pas sa version ; `PUT` et `DELETE` répondent `400 INVALID_UUID` à un `:id` mal formé

*`docs(specs): settle the UUID version of theme ids` — US-004 (CA-5, CA-10, CA-11, CA-25a, CA-29a). Tranche la question laissée ouverte par la décision #1 (le `POST` exigeait v7 ; il a depuis été aligné pour les questions, décision #25). Les décisions #1 à #97 ne sont pas modifiées.*

**Contexte.** Le smoke test de la PR #246 (2026-11-25, PRE-3) a constaté que `GET /api/v1/themes/018e4f5a-0000-0000-0000-000000000000`, l'id de l'exemple de CA-10 (version `0`), répond `400 INVALID_UUID` au lieu du `404` écrit : `index.ts` donne `Uuidv7Validator` à `theme-route`, alors que les questions utilisent `UuidFormatValidator` (#1). Le CDC se contredisait : l'exemple de CA-10 n'est pas un UUIDv7 (CA-5, `CONVENTIONS-TECHNIQUES.md`) et CA-11 demande `400` pour un id « pas un UUID valide ». Par ailleurs `PUT` et `DELETE` n'appellent pas le validateur (`not-a-uuid` répond `404`), alors que `error-codes.md` et le diagramme d'US-004 (« UUID valide ? ») disent `400 INVALID_UUID`.

**Décision.** Sur choix d'Olivier (2026-11-25) :
1. **Forme seule en lecture.** `GET /themes/:id` contrôle la forme `8-4-4-4-12` hexadécimale, toute version (recommandé, accepté). Le producteur garantit la version 7 (CA-5) ; la contrainte ne fuit pas dans le contrat public. Écartée : exiger la version 7 en lecture.
2. **`PUT` et `DELETE` : `:id` mal formé → `400 INVALID_UUID`** (recommandé, accepté), comme le `GET` et comme les questions (#30). Deux CA nouveaux, `CA-25a` et `CA-29a`, numérotés ainsi pour ne pas renuméroter. Écartée : conserver le `404` actuel.
3. **L'id d'exemple d'US-004 devient un UUIDv7 valide** (`018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a`) (choix d'Olivier, contre ma recommandation de le garder avec une note). Les autres US et les tests gardent l'ancien id : écart connu, en dette.
4. **`Uuidv7Validator` : sort décidé au `fix(themes)`** (recommandé, accepté), dette avec condition de réouverture.

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** : documentation seule. Le code actuel diverge du CDC sur les points 1 et 2 ; un `fix(themes)` les alignera (comportement observable modifié : deux agents et un smoke test).
- **Spec** : US-004, lignes CA-10 et CA-11 précisées, CA-25a et CA-29a ajoutés (tableau et exemples `curl`), id d'exemple remplacé aux quatre endroits.
- **Hors périmètre, en dette** : l'ordre complet des contrôles du `PUT` des thèmes (`INVALID_UUID`, `ID_MISMATCH`, `Content-Type`, corps, décision #30 pour les questions) ; `ETAT-DES-LIEUX-socle-hub.md` (lignes ~815, 961 à 966, 1061 à 1065) décrit l'état actuel du code, à réaligner par une session `docs(specs)` après le `fix(themes)`.
- Choix de Claude, à challenger en revue : (1) **une seule décision** pour quatre points liés, parce qu'ils partagent le même fait déclencheur ; (2) suffixes `a` (`CA-25a`, `CA-29a`) plutôt qu'une renumérotation, sur le précédent de `CA-19a` ; (3) le diagramme d'US-004 n'est pas modifié : « UUID valide ? » reste exact avec la forme seule.


---

## #99 — `PUT /api/v1/themes/:id` juge une requête dans un ordre fixe : `415`, JSON, `:id` du chemin, corps non objet, `id` du corps, `name` mal typé, manquant, champ inconnu, forme du `name`, `404`, nom identique, `409`

*`docs(specs): settle the order of the checks of the theme update` — US-004 (CA-21 à CA-27, CA-25a), diagrammes de flux et de séquence d'US-004. Solde le point laissé ouvert par #98 (ordre complet des contrôles du `PUT` des thèmes) ; applique à ce `PUT` les décisions #9, #10, #23, #30 et #84. Les décisions #1 à #98 ne sont pas modifiées.*

**Contexte.** Une requête peut cumuler plusieurs erreurs, une réponse ne porte qu'un code. Le CDC d'US-004 ne fixait aucun ordre pour le `PUT`, et son diagramme de flux le contredisait : « UUID valide ? », puis `404`, puis `Content-Type`, JSON, champs inconnus, `ID_MISMATCH`, forme du nom. Le code (`theme-route.ts`, `default-theme-service.ts`, lus dans cette session, non rejoués) fait aujourd'hui : champs inconnus (à la route, avant le `try`), puis `ID_MISMATCH` (à la route), puis, au service, `404`, forme du nom, nom identique, `409`. Il n'appelle pas le validateur d'UUID au `PUT` : le `:id` mal formé et l'`id` du corps mal formé n'y sont pas contrôlés (un `id` du corps non chaîne et différent répond `ID_MISMATCH`). Un `name` absent ou mal typé fait lever `name.trim()` au service, après le `404` : `500` sur un thème existant, `404` sur un id inconnu (dette de `DEBTS.md`, sondée le 2026-11-25) ; un corps `null` lève avant le `try` (`500` au corps natif). Pour les questions, #30 (forme des ID), #10 (type avant manquant avant inconnu) et #23 (forme avant `404`, `404` avant `409`) fixent déjà l'ordre ; #84 le fixe pour le token et note que « les thèmes ont un ordre propre qui n'a pas été relu ».

**Décision.** Toutes sur choix d'Olivier (2026-11-25), chaque fois l'option recommandée :
1. **Forme avant `404`.** Un `name` de forme invalide (vide, trop long, caractères interdits) répond `400 VALIDATION_ERROR` même sur un id inconnu, comme les questions (#23) : un corps invalide ne révèle pas si le thème existe. Écartée : `404` avant la forme (code et diagramme actuels).
2. **`:id` du chemin mal formé (CA-25a)** : après le `415` et le JSON invalide, avant les contrôles du corps. Suit #84 (`415` et JSON d'abord, natifs de Fastify) et #30. Écartées : avant le `415` (demande un hook) ; après les contrôles du corps.
3. **Ordre des contrôles du corps** : type, puis manquant, puis inconnu (`400 VALIDATION_ERROR` mal typé, `400 VALIDATION_ERROR` manquant, `400 UNKNOWN_FIELDS`), comme #84, #9, #10. Écartée : champ inconnu d'abord (ordre actuel du code).
4. **`id` du corps** : juste après le `:id` du chemin, avant le reste du corps. `id` mal formé ou non chaîne → `400 INVALID_UUID` (même s'il diffère de l'URL) ; bien formé mais différent → `400 ID_MISMATCH`, comme #30. Un corps qui n'est pas un objet répond avant (on ne peut pas lire son `id`). Écartée : `id` du corps après type, manquant et inconnu.
5. **`404` avant `409`.** Après la forme du nom : `404`, puis nom identique à l'existant (`200` inchangé, CA-22), puis `409 THEME_ALREADY_EXISTS`. Écartée : `409` avant `404`.

**Ordre complet** (tableau « Ordre des contrôles du `PUT` » d'US-004, diagrammes alignés) : 1 limite de débit, authentification et rôle ; 2 `Content-Type` (`415`) ; 3 JSON invalide (`400`) ; 4 `:id` du chemin (`INVALID_UUID`) ; 5 corps non objet (`INVALID_BODY`) ; 6 `id` du corps (`INVALID_UUID`, puis `ID_MISMATCH`) ; 7 `name` mal typé ; 8 `name` manquant ; 9 champ inconnu ; 10 forme du `name` après normalisation (CA-21 : trim, collapse, regex) ; 11 `404` ; 12 nom identique (CA-22) ; 13 `409`. Le rang 1 n'est pas redécidé : le `429` passe avant l'authentification (#96), `401` puis `403` avant tout jugement du corps (#31, #92, annexe `SECURITE-TRANSVERSALE.md`). Le rang 5 est le code que `error-codes.md` donne à un JSON valide qui n'est pas un objet (`INVALID_BODY`, message du catalogue « Request body must be a JSON object. ») ; l'exception de ce catalogue ne vise que `POST /api/v1/token` (#85, #86).

**Alternatives écartées.**
- **`404` avant la forme du nom** (code et diagramme actuels) : écartée, révèle l'existence d'un thème à un corps invalide ; diverge de #23 sans raison métier.
- **`:id` du chemin avant le `415`** : écartée, demande un hook avant le parseur de Fastify ; diverge de #84 et du `415` natif (#11).
- **`:id` du chemin après les contrôles du corps** : écartée, un `:id` mal formé ne révélerait sa faute qu'une fois le corps corrigé ; diverge de #30.
- **Champ inconnu avant le manquant et le mal typé** (ordre actuel du code) : écartée, diverge de #9, #10 et #84 sans raison métier consignée.
- **`id` du corps après type, manquant et inconnu** : écartée, diverge de #30 (la forme des ID précède tout contrôle du corps).
- **`409` avant `404`** : écartée, un nom déjà pris sur un id inconnu dirait « existe déjà » d'un thème qui n'existe pas ; diverge de #23.

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** : documentation seule. Le code diverge sur quatre points : champs inconnus avant tout, `:id` du chemin et `id` du corps non contrôlés, `name` absent ou mal typé en `500`, `404` avant la forme du nom (le service lit le thème avant `formatName`). Un `fix(themes)` aligné sur #98 et #99 suit : comportement observable modifié, donc deux agents et un smoke test.
- **Spec** : US-004, tableau « Ordre des contrôles du `PUT` » ; CA-21 à CA-27 et CA-25a précisés ; deux exemples `curl` (CA-23 avec un `id` du corps mal formé, CA-25 avec un nom invalide sur un id inconnu) ; **aucun CA n'est ajouté, retiré ni renuméroté** ; les deux diagrammes (`.mmd` et `.png` régénérés) suivent l'ordre. `ETAT-DES-LIEUX-socle-hub.md` n'est pas touché (audit daté, déjà en dette).
- **`DEBTS.md`** : les lignes « `:id` mal formé au `PUT` et au `DELETE` des thèmes » et « Thèmes : corps non objet, `name` absent ou mal typé répondent `500` » disent que le rang est tranché, pas le code ni le message ; quatre dettes nouvelles : `name: null`, texte des messages de `VALIDATION_ERROR` du `PUT`, ordre des contrôles du `POST` des thèmes, diagramme d'US-004 (en-tête de flux) encore dans l'ordre `401`, `403`, `429`.
- **Non décidé ici** : `name: null` (mal typé ou manquant ; même code, seul le message change, cf. #86 pour le token) ; le texte des messages de `VALIDATION_ERROR` du `PUT` ; l'ordre des contrôles du `POST` des thèmes (probablement le même rang, non tranché) ; le code de l'erreur du JSON invalide sur `themes/` (`INVALID_JSON` du catalogue ou corps natif de Fastify : dette « `INVALID_JSON` propre au plugin des tokens ») ; `GET` et `DELETE`.
- Condition de réouverture : un client qui voudrait `404` d'abord, ou la migration du `POST` des thèmes et des questions vers un ordre commun.
- Choix de Claude, à challenger en revue : (1) **le rang 1** : #84 ne porte que sur le token (route publique) et #31 sur la méthode non supportée ; que `401` et `403` passent avant le `415` et le JSON invalide d'une méthode supportée est écrit mot à mot nulle part, seulement impliqué par la note de CA-35 (« jugé après le `401` et le `403` »), #92 et le code (hooks `onRequest`) ; je l'ai renvoyé à ces textes sans le redécider ; (2) **le rang 3 en `400` sans code** : le brief le dit natif, le catalogue et l'ancien diagramme disent `INVALID_JSON` ; je n'ai pas tranché le code (dette existante) et laissé le nœud du diagramme à `400 INVALID_JSON` ; (3) **`id` du corps à `null`** : `INVALID_UUID`, lecture littérale de « non chaîne » et de #30, alors que #86 fait de `null` un champ manquant pour le token ; (4) **les rangs 7 et 8 ne se distinguent que par le message** (un seul champ, `name`) : l'ordre est celui demandé, non observable sauf pour `null` ; (5) **rang 12 dans le tableau** : un nom identique n'est pas un échec mais une réponse `200` ; je l'y ai laissé, pour que l'ordre complet 1 à 13 soit lisible ; (6) **rangs 3 et 5 sans numéro de CA** : aucun CA d'US-004 ne couvre un JSON invalide ni un corps non objet au `PUT`, et la règle interdit d'en ajouter ; (7) **un `:id` vide** est rangé au rang 4 (#93) ; (8) les PNG sont régénérés avec `mmdc` 11.16.0, largeur 784 comme les précédents.


---

## #100 — Sur `PUT /api/v1/themes/:id`, un `name` à `null` compte comme manquant ; les messages des `400 VALIDATION_ERROR` sont normatifs mot à mot

*`docs(specs): settle the messages and the null name of the theme update` — US-004 (CA-21, CA-27, tableau « Ordre des contrôles du `PUT` », section « Messages de `VALIDATION_ERROR` du `PUT` »), diagrammes de flux et de séquence d'US-004. Précise #99 sur les rangs 7, 8 et 10 ; #99 n'est pas modifiée, ni #1 à #98.*

**Contexte.** #99 fixe l'ordre et le code (`400 VALIDATION_ERROR`) des rangs 7 (`name` mal typé), 8 (`name` manquant) et 10 (forme du `name`), mais laisse deux points ouverts, consignés en dette : dans lequel des rangs 7 et 8 tombe `{"name":null}` (seul le message change, cf. #86 pour le token et #22 pour les questions), et le texte des messages. Le code répond aujourd'hui `500` pour `name` absent, `null` ou mal typé (`name.trim()` lève au service) ; pour la forme du nom, `default-theme-service.ts` (`formatName`, lu dans cette session, non rejoué) lève `Theme name must be 3 to 40 characters, start with an uppercase letter, end with a letter or digit, and contain only letters, digits, spaces, apostrophes and hyphens.`, message écrit par le code et jamais décidé.

**Décision.** Toutes sur choix d'Olivier (2026-11-25), chaque fois l'option recommandée :
1. **`{"name": null}` au `PUT` compte comme manquant** (rang 8 de #99), comme #22 (questions) et #86 (token). Le rang 7 ne vise donc qu'un `name` présent, non `null`, qui n'est pas une chaîne. Écartée : `null` mal typé (rang 7).
2. **Messages normatifs mot à mot**, `400 VALIDATION_ERROR`, corps standard à trois champs : rang 7 → `Theme name must be a string.` ; rang 8 (manquant ou `null`) → `Theme name is required.`. Écartées : « Name … » calqué sur les questions ; seul le code normatif.
3. **Le message du rang 10 devient normatif, tel que le code le dit** : `Theme name must be 3 to 40 characters, start with an uppercase letter, end with a letter or digit, and contain only letters, digits, spaces, apostrophes and hyphens.` Aucun changement de code pour ce message. Écartées : le reformuler ; le laisser libre.

**Alternatives écartées.**
- **`null` mal typé (rang 7)** : écartée, diverge de #22 et #86, et `Theme name is required.` est le message le plus utile à un client qui envoie un champ vide.
- **Un libellé « Name … » calqué sur les questions** (`Question title must be a string.`) : écartée, le message du rang 10 dit déjà `Theme name` ; un seul préfixe pour les trois messages du `PUT`.
- **Seul le code normatif** : écartée, un test ne pourrait pas asserter le message (comme #85).
- **Reformuler ou laisser libre le message du rang 10** : écartées, le texte actuel est clair et le reformuler ajouterait un changement de code sans bénéfice.

**Conséquences.**
- **Le code n'est pas conforme pour les rangs 7 et 8** (il répond `500`) ; il l'est pour le rang 10 (message identique, mais il n'est atteint qu'après le `404` aujourd'hui, ordre tranché par #99). Un `fix(themes)` aligné sur #98, #99 et cette décision suit : comportement observable modifié, donc deux agents et un smoke test. Il ne reste plus de trou de CDC sur le `PUT` des thèmes (hors code de l'erreur du JSON invalide, dette existante).
- **Le `POST` des thèmes n'est pas touché** : son message de forme est aujourd'hui identique à celui du rang 10, mais son ordre des contrôles n'est pas tranché (dette conservée) ; aucun message du `POST` n'est donc rendu normatif ici.
- **Spec** : US-004, cellules de CA-21 et CA-27, lignes 7, 8 et 10 du tableau « Ordre des contrôles du `PUT` », notes sous le tableau, section « Messages de `VALIDATION_ERROR` du `PUT` » (comme US-003). Les libellés des nœuds « name présent… » et « name manquant… » des deux diagrammes sont alignés sur `null` (PNG régénérés avec `mmdc`, largeur 784). **Aucun CA n'est ajouté, retiré ni renuméroté.**
- **`DEBTS.md`** : les lignes « `name: null` au `PUT` » et « Messages de `VALIDATION_ERROR` du `PUT` » sont soldées côté spec (supprimées) ; la ligne « Thèmes : corps non objet, `name` absent ou mal typé répondent `500` » ne garde que l'écart de code.
- Condition de réouverture : un client qui voudrait `null` distingué de l'absence, ou des messages localisés.
- À challenger : (a) `Theme name must be a string.` et `Theme name is required.` sont mes libellés, validés par Olivier sans variante proposée ; (b) `null` = manquant s'écarte de la lecture littérale de « présent » (rang 7), comme #86 ; (c) le rang 10 reste un message unique pour tous ses cas (vide, longueur, majuscule, caractères), sans message par cause ; (d) l'état du code est lu dans `default-theme-service.ts`, non rejoué (Node 22, tests non exécutés) ; (e) les libellés des nœuds de diagramme sont modifiés (le code des réponses ne change pas), les PNG relus à l'œil seulement.


---

## #101 — `POST /api/v1/themes` juge une requête dans l'ordre du `PUT` sans les rangs du chemin : `415`, JSON, corps non objet, `name` mal typé, manquant, champ inconnu, forme du `name`, `409` ; `null` compte comme manquant ; messages normatifs

*`docs(specs): settle the order of the checks of the theme creation` — US-004 (CA-3, CA-7, CA-8, tableau « Ordre des contrôles du `POST` », section « Messages de `VALIDATION_ERROR` du `POST` »), diagrammes de flux et de séquence d'US-004. Solde le point laissé ouvert par #99 et #100 (ordre des contrôles du `POST` des thèmes) ; applique au `POST` les décisions #99, #100, #9, #10, #84 et #86. Les décisions #1 à #100 ne sont pas modifiées.*

**Contexte.** #99 a fixé l'ordre du `PUT` des thèmes et #100 ses messages, en laissant le `POST` hors périmètre (dette « ordre des contrôles du `POST` des thèmes : non décidé »). Le diagramme d'US-004 disait `Content-Type`, JSON, champs inconnus, forme du nom, `409`, sans rang pour un `name` mal typé ou manquant. Le code (`theme-route.ts` et `default-theme-service.ts`, lus dans cette session, non rejoués) fait aujourd'hui : champs inconnus à la route (la route lit `Object.keys` du corps avant tout), puis au service la forme du nom (`formatName`), puis le `409` (`ensureNameIsFree`). `name` absent, `null` ou non chaîne fait lever `name.trim()` au service : `500` au corps standard ; un corps JSON non objet (`[]`, `42`) passe les champs inconnus puis lève de même (`500`), `"x"` répond `400 UNKNOWN_FIELDS` (clé `0`) et `null` lève avant le `try` (`500` au corps natif). `error-codes.md` dit pourtant `INVALID_BODY` (JSON valide qui n'est pas un objet) et `VALIDATION_ERROR` (champ manquant).

**Décision.** Toutes sur choix d'Olivier (2026-11-26), chaque fois l'option recommandée, sauf le point 4 :
1. **Ordre du `POST` = celui du `PUT` (#99) sans les rangs propres au chemin** (`:id` du chemin, `id` du corps, `404`, nom identique). Ordre : 1 limite de débit, puis authentification et rôle (non redécidé : #96, #31, #92) ; 2 `Content-Type` autre que `application/json` → `415 FST_ERR_CTP_INVALID_MEDIA_TYPE` (CA-8) ; 3 corps non JSON → `400` (code non décidé, dette existante) ; 4 corps JSON non objet → `400 INVALID_BODY` ; 5 `name` présent, non `null`, non chaîne → `400 VALIDATION_ERROR` `Theme name must be a string.` ; 6 `name` manquant ou `null` → `400 VALIDATION_ERROR` `Theme name is required.` ; 7 champ inconnu → `400 UNKNOWN_FIELDS` (CA-7) ; 8 forme du `name` après normalisation (trim, collapse, regex de CA-3) → `400 VALIDATION_ERROR` avec le message de forme du `PUT` (rang 10 du `PUT`) ; 9 nom déjà pris (insensible à la casse, CA-4) → `409 THEME_ALREADY_EXISTS`. Raison : cohérence avec #99, #9, #10 et #84.
2. **`{"name": null}` au `POST` compte comme manquant** (rang 6), comme #100, #22 et #86.
3. **Messages des `400 VALIDATION_ERROR` du `POST` normatifs mot à mot, identiques à ceux du `PUT`.**
4. **Corps non objet : `400 INVALID_BODY`**, par le catalogue `error-codes.md` (message « Request body must be a JSON object. »), dont la seule exception est `POST /api/v1/token` (#85, #86). Consigné sans question posée à Olivier : le catalogue tranche.

**Alternatives écartées.**
- **L'ordre du diagramme actuel** : écartée, il n'a pas de rang pour un `name` mal typé ou manquant.
- **L'ordre du code actuel** (champs inconnus d'abord) : écartée, diverge de #9, #10 et #84 sans raison métier.
- **`null` mal typé** : écartée, diverge de #100, #22 et #86.
- **Libellés propres au `POST`** : écartée, un seul jeu de messages pour les deux écritures de thèmes.
- **Seul le code normatif** : écartée, un test ne pourrait pas asserter le message (comme #85 et #100).

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** : documentation seule. Le code diverge sur trois points : champs inconnus avant tout (et `500` au corps natif pour `null`), `name` absent, `null` ou mal typé en `500`, corps non objet en `500` (`400 UNKNOWN_FIELDS` pour une chaîne). Le rang 8 et le rang 9 sont déjà dans l'ordre et au message du code (`formatName`, puis `ensureNameIsFree`). Un `fix(themes)` aligné sur cette décision suit : comportement observable modifié, donc deux agents et un smoke test. L'état du code est lu, non rejoué.
- **Spec** : US-004, tableau « Ordre des contrôles du `POST` », section « Messages de `VALIDATION_ERROR` du `POST` », cellules de CA-3, CA-7 et CA-8 précisées (jugements d'ordre), renvoi de la section du `PUT` vers celle du `POST`, deux exemples `curl` (CA-3 avec `name` manquant, CA-7 avec un champ inconnu et un nom invalide) ; **aucun CA n'est ajouté, retiré ni renuméroté**. Les deux diagrammes (`.mmd` et `.png` régénérés avec `mmdc` 11.16.0, largeur 784 comme les précédents) suivent l'ordre ; l'en-tête du diagramme de flux passe dans l'ordre `429`, `401`, `403` (#96), ce qui solde la dette correspondante.
- **`DEBTS.md`** : la ligne « Ordre des contrôles du `POST` des thèmes : non décidé » et la ligne « Diagramme de flux d'US-004 : en-tête dans l'ordre `401`, `403`, `429` » sont soldées (supprimées) ; la ligne « `POST` des thèmes : corps non objet, `name` absent ou mal typé répondent `500` » ne garde que l'écart de code.
- **Non décidé ici** : le code de l'erreur du JSON invalide sur `themes/` (`INVALID_JSON` du catalogue ou corps natif de Fastify ; dette « `INVALID_JSON` propre au plugin des tokens », inchangée).
- Condition de réouverture : un client qui voudrait `409` avant la forme du nom, `null` distingué de l'absence, ou la migration des thèmes et des questions vers un ordre commun.
- À challenger : (a) le rang 4 en `INVALID_BODY` n'a pas été soumis à Olivier : je me suis appuyé sur le catalogue, comme #99 pour le `PUT` ; (b) le rang 3 reste un `400` sans code (le nœud du diagramme dit `400 INVALID_JSON`, comme celui du `PUT`) ; (c) le `409` (rang 9) passe après la forme du nom, comme #23 pour les questions : un nom de forme invalide n'avertit pas qu'un thème de ce nom existe (il ne peut pas exister, la forme est la même à la création) ; (d) l'en-tête du diagramme de flux est réordonné (`429` d'abord) : c'est le seul changement de diagramme hors du `POST`, aligné sur #96, sans changement de réponse ; (e) les PNG sont relus à l'œil seulement ; (f) l'état du code est lu, non rejoué (Node 22, tests non exécutés).

---

## #102 — Les écritures de questions jugent une requête dans un ordre fixe : `415`, JSON, `:id` du chemin (`PUT`), corps non objet, `id` du corps (`PUT`), puis les contrôles du corps déjà décidés

*`docs(specs): specify the order of checks for question writes` — US-005 (CA-20, CA-38, CA-41, tableaux « Ordre des contrôles » du `POST` et du `PUT`). Solde le rang du `415`, du JSON invalide et du corps non objet sur `POST /api/v1/questions` et `PUT /api/v1/questions/:id`, que #18, #30 et #82 laissaient ouvert ; applique #84, #99 et #101 aux questions. Les décisions #1 à #101 ne sont pas modifiées.*

**Contexte.** CA-20 et CA-41 disent « Content-Type `application/json`, sinon `415` » sans rang. #30 place la forme des ID « avant tout autre contrôle du `PUT` » sans dire si le `415` natif de Fastify passe avant. Aucun texte ne fixait le rang du corps non objet (`INVALID_BODY`, `error-codes.md`) sur les questions. Pour les thèmes, #99 et #101 ont fixé cet ordre.

**Décision.** Toutes sur choix d'Olivier (2026-11-26), chaque fois l'option recommandée :
1. **Le `:id` du chemin passe après le `415` et le JSON invalide** (`PUT`). « Avant tout autre contrôle du `PUT` » (#30) se lit « avant les contrôles du corps » : le `415` et le JSON sont natifs de Fastify (#11, #84). Écartées : `:id` avant le `415` (demande un hook) ; `:id` entre le `415` et le JSON.
2. **Le corps non objet** (`400 INVALID_BODY`) **passe après le `:id` du chemin et avant l'`id` du corps** (`PUT`), car l'`id` d'un corps qui n'est pas un objet ne se lit pas. Écartée : avant le `:id` du chemin.
3. **`POST` : `415`, JSON invalide, corps non objet**, puis les contrôles du corps déjà décidés. Même rang que #101.

**Ordre complet.**
- `POST /api/v1/questions` : 1 limite de débit, authentification et rôle (#96, #92, CA-35 de US-004 ; non redécidé) ; 2 `Content-Type` (`415`) ; 3 JSON invalide (`400`) ; 4 corps non objet (`400 INVALID_BODY`) ; 5 et suivants : contrôles du corps dans l'ordre déjà décidé (#8, #9, #10, #25), non redécidés.
- `PUT /api/v1/questions/:id` : 1 comme ci-dessus ; 2 `415` ; 3 JSON invalide ; 4 `:id` du chemin (`400 INVALID_UUID`) ; 5 corps non objet (`400 INVALID_BODY`) ; 6 `id` du corps (`400 INVALID_UUID`, puis `400 ID_MISMATCH`, #30) ; 7 et suivants : contrôles du corps dans l'ordre déjà décidé (#19 à #29), non redécidés.

**Conséquences.**
- **Rien n'est codé, aucun test n'est écrit** : documentation seule. Le code lu (non rejoué, Node 22, `better-sqlite3` non installable) diverge au moins sur un point : au `PUT`, un corps `null` lève une `TypeError` à la lecture de `id` (réponse `500` attendue), au lieu de `400 INVALID_BODY`.
- **Spec** : US-005, deux tableaux « Ordre des contrôles » ; **aucun CA n'est ajouté, retiré ni renuméroté**. Les diagrammes `.mmd` et `.png` d'US-005 ne sont pas modifiés (dette).
- **`DEBTS.md`** : trois lignes ajoutées (code du `PUT` sur corps non objet, `INVALID_BODY` au `POST` non sondé, diagrammes d'US-005).
- **Non décidé ici** : le contrôle du `charset` sur les questions (le `fix(questions)` suivant s'appuie sur ce rang 2) ; le code de l'erreur du JSON invalide ; `PATCH` (US-007) ; `GET` et `DELETE`.
- Condition de réouverture : un client qui voudrait le `:id` avant le `415`, ou la migration des écritures vers un ordre commun.
- À challenger : (a) le rang 1 est renvoyé à #96, #92 et CA-35 sans être redécidé (non écrit mot à mot pour les questions) ; (b) le code du JSON invalide reste non tranché ; (c) l'état du code est lu, non rejoué ; (d) les rangs 5 et suivants renvoient aux décisions existantes sans les relire une à une avec Olivier.

---

## #103 — Le hub a quatre couches et un jeu de règles d'imports, écrits une seule fois dans `.dependency-cruiser.cjs`

*`chore(ci): fail the build on a dependency that crosses a layer` — hors US.*

**Contexte.** Aucun CDC n'écrit les couches du hub. Elles se lisaient dans le code (`CLAUDE.md`, `common/` et `infrastructure/` pour l'environnement, la composition dans `index.ts`), et un fichier les traversait : `question-route.ts` créait lui-même un `UuidFormatValidator` d'`infrastructure/`. Mesure sur `main` avec l'outil réel : un seul constat, aucun cycle, aucune arête de production vers un test.

**Décision.** Proposée par l'agent, à valider par Olivier à la revue (pas tranchée avec lui).
- **Composition** : `src/index.ts`, `seed.ts`, `quiz-server.ts`, `quiz-server-configuration.interface.ts` ; seule à importer tout, seule importée par personne d'autre. **Fonctionnalités** : `authentication`, `questions`, `themes`, `users`, `websocket`, `routes`. **`infrastructure`** : n'importe que `common`. **`common`** : n'importe rien d'autre.
- Une fonctionnalité n'importe pas `infrastructure` (les adaptateurs se câblent en composition) ; ni route ni service n'importe un `sqlite-*` ; une route n'importe pas un service concret, un service n'importe pas une route ; une fonctionnalité n'importe jamais un fichier concret d'une autre (`sqlite-*`, `default-*`, `*-service`, `*-route`) mais peut importer ses interfaces et ses modules simples.
- Aucun cycle, aucun import non résolu, aucun import depuis ou vers un fichier de `src/` hors de ces couches, aucun import d'un test par la production. Les tests (`*.test.ts`, `src/test-support`) sont hors des règles de couches : ils câblent de vrais adaptateurs.
- Écartées : tests soumis aux mêmes règles (8 arêtes à justifier une à une) ; composition limitée à trois fichiers (l'interface de configuration n'est importée que par elle et par des tests).

**Conséquences.** `question-route.ts` reçoit son `UuidValidator` par `QuestionRouteConfiguration` ; la dette « Validateur instancié en dur dans la route » est soldée. Un dossier ajouté sous `src/` doit être nommé dans `.dependency-cruiser.cjs`. Limites de la garde : `DEBTS.md`, zone outillage.
- Condition de réouverture : une fonctionnalité qui a besoin d'un fichier concret d'une autre (la déplacer dans `common/` ou l'injecter), ou un test de couche basse qui n'a pas besoin d'un vrai adaptateur.
- À challenger : (a) la liste de composition et le classement de `routes/` comme fonctionnalité ; (b) `*-service` ajouté aux fichiers concrets pour couvrir `jwt-authentication-service` ; (c) les tests hors règles.

---

## #104 — Un mutant qui survit dans un fichier de production modifié par la PR fait échouer la CI

*`chore(ci): fail the build on a surviving mutant in the changed files` — hors US.*

**Contexte.** Aucun CDC ne dit comment prouver qu'un test mord. Les mutants survivants se relevaient à la main, session par session, et les dettes les chiffraient sans garde : un test né vert pouvait ne rien prouver sans que la CI le voie.

**Décision.** Proposée par l'agent, à valider par Olivier à la revue (pas tranchée avec lui).
- **Outil** : Stryker 10.1.1 (`stryker.config.json`, exécuteur Vitest, vérificateur TypeScript, `coverageAnalysis: perTest`, `ignoreStatic`). Seuil `break` à 100, aucun fichier exclu hors `index.ts`, `seed.ts`, tests, `*.interface.ts` et `src/test-support`.
- **Périmètre de la garde** : les fichiers de production ajoutés, copiés, modifiés ou renommés entre la base de la PR et `HEAD` (`git diff --diff-filter=ACMR <base>...HEAD`). Survivant ou sans couverture = échec ; `Timeout` compte comme tué.
- **Interdit** : tout commentaire `Stryker disable` ou `Stryker restore` dans un fichier modifié, tout `ignorers`, tout seuil abaissé. Un mutant équivalent ou mort se règle en changeant le code (`refactor`, comportement observable inchangé).
- **Sur `main`** : la base est le `before` du push ; une PR est comparée à sa base.
- **Écartées** : mutation de tout `src` à chaque PR (≈ 20 min sur 2 cœurs) ; seuil à 90 % (laisse passer un mutant) ; commentaires de désactivation tolérés avec justification.

**Conséquences.** La PR mesure tout `src` une fois et règle les 77 survivants relevés ; la garde est prouvée par `src/mutation-guard.test.ts` (dépôts jetables, Stryker simulé). Limites de la garde : `DEBTS.md`, zone outillage.
- Condition de réouverture : une durée de CI jugée trop longue (passer à un contrôle nocturne de tout `src` plus un contrôle des fichiers modifiés), ou un mutant que seul un changement de comportement peut tuer.
- À challenger : (a) Stryker comme outil ; (b) seuil 100 sans exclusion ; (c) détection par `base...HEAD` et `fetch-depth: 0` ; (d) base `before` sur `main` ; (e) durée ajoutée à la CI.

---

## #105 — « Insensible à la casse » veut dire : comparaison après `toLowerCase()`, sans autre repliement

*`docs: write the case rule, the login log messages and the delete body limit as the code applies them` — US-005 CA-9 et CA-10.*

**Contexte.** US-005 écrit « insensible à la casse » pour l'unicité des `choices` et pour la correspondance de `correct_answer` sans dire comment. Le code compare après `toLowerCase()` ; le mutant `toUpperCase` ne se distingue que pour des caractères comme `ß` (`"ß".toUpperCase()` donne `"SS"`). Constaté par la garde des mutants (#104).

**Décision.** Constat reporté d'office, comportement actuel conservé (la session n'ouvre pas de question à Olivier : aucune partie jouée n'est touchée, c'est le CRUD d'administration). La comparaison se fait après `toLowerCase()` ; `ß` et `SS` sont deux choix distincts. Écrit dans US-005 (CA-9, CA-10, section dédiée) et prouvé par un test (deux choix `ß` et `SS` acceptés).

**Conséquences.** Rien n'est changé dans le code. Condition de réouverture : un public pour qui `ß` et `SS` doivent être égaux (un repliement `localeCompare` ou `toLocaleLowerCase`).
- **Coexistence non tranchée** : l'unicité d'un nom de thème et d'un titre de question repose sur `COLLATE NOCASE` de SQLite, qui ne replie que l'ASCII (`sqlite-theme-repository.ts:44`, `sqlite-question-repository.ts:42` et `:87`, US-004 CA-4 et CA-22) ; les `choices` suivent `toLowerCase()`, qui replie davantage (`É` et `é` sont égaux ici, pas là-bas). Deux règles de casse coexistent ; dette nommée dans `DEBTS.md`, à décider.
- À challenger : (a) option A : ne rien fixer et refuser le repliement non ASCII (supprimerait le test) ; (b) `correct_answer` suit la même règle.

---

## #106 — Les messages de log d'une connexion réussie et d'une connexion échouée sont `Authentication successful` et `Authentication failed`

*`docs: write the case rule, the login log messages and the delete body limit as the code applies them` — US-003 CA-14 et CA-15.*

**Contexte.** CA-14 et CA-15 n'exigent que le contenu et le niveau de la ligne (#83, « jamais la forme »). Le code écrit le message `Authentication successful` (info) et `Authentication failed` (warn) ; un mutant qui vide le message survit sans qu'aucun CA ne l'interdise.

**Décision.** Constat reporté d'office, comportement actuel conservé : ces deux messages sont écrits dans US-003 (CA-14, CA-15) et testés. Le reste de la forme de la ligne relève d'US-022.

**Conséquences.** Rien n'est changé dans le code. Condition de réouverture : US-022 fixe un autre texte ou un `event` nommé (alors le message s'aligne).
- À challenger : option A : supprimer le message (changerait le journal, donc à décider) plutôt que le figer.

---

## #107 — Le `DELETE` ignore son body mais la limite de 1 MiB de Fastify s'applique : au-delà, `413` au corps d'erreur de Fastify

*`docs: write the case rule, the login log messages and the delete body limit as the code applies them` — US-004 CA-31 et US-005 CA-47.*

**Contexte.** CA-31 et CA-47 disent que le body d'un `DELETE` est ignoré sans parler de sa taille. Les deux routes lisent le body en chaîne (`parseAs: 'string'`), donc la limite par défaut de Fastify (1 MiB) s'applique ; sans cette option, le body ne serait pas lu et la réponse serait `204`. Sondé le 2026-11-27 sur le serveur assemblé : 1 048 576 octets → `204`/`404` selon la ressource, 1 048 577 octets → `413`.

**Décision.** Constat reporté d'office, comportement actuel conservé. Un body de plus de 1 MiB répond `413` ; le corps de la réponse est celui de Fastify (`{ statusCode, code: FST_ERR_CTP_BODY_TOO_LARGE, error: "Payload Too Large", message }`), **pas** le corps standard `{ status, error, message }` du hub. Écrit dans US-004 (CA-31), US-005 (CA-47, section dédiée) et testé (route et serveur assemblé).

**Conséquences.** Rien n'est changé dans le code. Deux écarts relevés, non décidés : (a) le corps du `413` ne suit pas le format standard des erreurs ; (b) le `DELETE` d'une question avec un `Content-Type` autre que JSON ou texte brut répond `415` (Fastify) alors que CA-47 dit que le body est ignoré. Défauts À DÉCIDER, aucun changement de comportement ici : (c) le corps du `413` de Fastify contredit `docs/shared/CONVENTIONS-TECHNIQUES.md:35` (format fixe `{ status, error, message }`) ; (d) asymétrie : le `DELETE` d'un thème accepte tout `Content-Type` (son hook retire l'en-tête) alors que celui d'une question répond `415` à un type autre que JSON ou texte brut, contre la décision #82 (dette déjà ouverte, zone questions). Dettes nommées dans `DEBTS.md`. Condition de réouverture : un client qui envoie un gros body à un `DELETE`, ou la mise en conformité du corps du `413` avec `error-codes.md`.
- À challenger : option A : retirer `parseAs: 'string'` (le body ne serait plus lu, `204` quelle que soit la taille) ; ou un `413` au corps standard.
