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

