# État des lieux — Traçabilité du socle hub (US-001 → US-009)

> **Datation : relevé du HEAD hub `5407e38`, réaligné en partie.** Seule la partie
> **US-001** (§1, ligne US-001 et ligne Total ; §2, section US-001 ; §3, dette F ;
> §4, décompte) est réalignée sur le réel au HEAD `25d2388` (2026-11-18).
> Les parties **US-002, US-003, US-004 et US-009**, le **§0** (184 tests,
> « US-005 à US-008 jamais implémentées ») et les dettes qui les concernent
> restent celles du relevé daté et **ne sont plus à jour** (US-005 à US-008
> existent aujourd'hui). Réalignement des autres US : une session par US.

> **Méthode : audit par implémentation réelle, pas par étiquette de test.**
> Chaque CA a été confronté à trois sources : la **spec** (`docs/specs`),
> le **code de production** (`quiz-live-server/src`), et le **corps des tests**.
> Un CA n'est déclaré solide que si le comportement attendu est réellement
> exercé par une assertion qui mord — la seule présence d'un test étiqueté
> `US-00X/CA-Y` ne suffit pas.
>
> **Le réel fait foi.** Ce document est daté ; il reflète l'état du dépôt au
> moment de l'audit (HEAD hub `5407e38`). Toute évolution du code prime sur ce
> récap : re-confronter avant de s'y fier.

---

## 0. Portée et faits de départ

- **HEAD hub audité** : `5407e38` — `test(ws): reject an upgrade request on a path other than /ws`
- **Tests au vert** : 184/184 (24 fichiers), `tsc --noEmit` propre.
- **Réalignement partiel (2026-11-18)** : seule la partie US-001 est réalignée sur le réel au HEAD `25d2388` (1026 tests verts, 39 fichiers, sous Node 26). Le reste du §0 est celui du relevé daté (HEAD `5407e38`, 184 tests) et n'est plus à jour : US-005 à US-008 existent aujourd'hui.
- **US auditées** : US-001, US-002, US-003, US-004, US-009 (les seules « prétendument faites »).
- **US absentes du code ET du git log** : **US-005, US-006, US-007, US-008**
  (questions CRUD/filtrage/patch, quiz CRUD) — ~148 CA jamais implémentés.
  Le git log hub saute d'US-004 à US-009. Ce ne sont pas des défauts de
  couverture : c'est du travail **jamais fait**, à *faire*, pas à *auditer*.

> ⚠️ **Conséquence de dépendance** : US-010 (créer une partie) référence un
> `quiz_id` qui doit exister en base. Sans US-005 (questions) ni US-008 (quiz),
> **aucune partie n'est jouable**. La chaîne réelle vers une partie jouable est :
> **US-005 → US-008 → US-010 → US-011**.

---

## 1. Matrice-bilan du socle

| US | CA total | Solides | Partiels / non vérifiés | Trous réels | Faux verts |
|----|:---:|:---:|:---:|:---:|:---:|
| US-001 — server startup | 9  | 8   | CA-4                                 | —                          | —      |
| US-002 — seed users     | 5  | 2   | CA-1 (noms), CA-2 (env + bcrypt)    | —                          | —      |
| US-003 — auth token     | 18 | ~9  | CA-3, 4, 11, 12, 13, 14, 15         | **CA-16 (405)**, **CA-17 (500)** | — |
| US-004 — themes CRUD    | 40 | ~31 | CA-12 / 12a / 19 / 34               | **CA-35 (405)**            | **CA-30** |
| US-009 — websocket      | 29 | ~25 | CA-12, 22, 26                       | —                          | —      |
| **Total** | **101** | **~74** | **~18** | **4** | **1** |

Ligne US-001 réalignée sur le réel au HEAD `25d2388` (2026-11-18), puis mise à jour après le
`test(startup)` des permissions et de `EACCES`, puis après le `test(startup)` de `JWT_SECRET`
et du `.env`, puis après celui de la création des tables du fichier de zéro octet (2026-11-18) ; les autres lignes sont celles du relevé daté (HEAD `5407e38`).

Légende : *Solide* = comportement implémenté + vérifié par un test qui mord ·
*Partiel* = implémenté mais vérification faible ou absente · *Trou réel* =
comportement attendu absent du code · *Faux vert* = test au vert mais
comportement cassé en production réelle.

---

## 2. Détail par US

### US-001 — Démarrage du serveur (9 CA : CA-1 à CA-5 et CA-7 à CA-10)

> **Section réalignée sur le réel au HEAD `25d2388` (2026-11-18)**, avec la méthode du
> fichier (spec, code de production, corps des tests). CA-6 (couverture ≥ 90 %) est
> retiré par la décision #54 ; la numérotation est conservée. Suite : 1026 tests verts
> (39 fichiers) sous Node 26, `tsc --noEmit` et `eslint src` sans erreur. **Mise à jour
> après le `test(startup)` des permissions et de `EACCES` (2026-11-18)** : dix tests de
> plus dans `index.test.ts`, qui ne s'exécutent que sous POSIX non-root (1036 verts sous
> non-root ; sous root, 1026 verts et 10 sautés, avec la raison du saut ; sous Windows ils
> se sautent aussi ; comportement sondé à la main le 2026-11-18, décision #70, pas testé). Un CA n'est
> *solide* que si chacun de ses comportements est prouvé par une assertion qui mord,
> au niveau où il s'observe (`npm start`, donc le processus réel, ou `QuizServer`).
>
> **Mise à jour après le `test(startup)` de `JWT_SECRET` et du `.env` (2026-11-18)** : huit
> tests de plus dans `index.test.ts`, qui s'exécutent sous root comme sous non-root
> (1034 verts et 10 sautés sous root, 1044 verts sous non-root, Node 26). CA-1 et CA-10
> passent en solides ; restent partiels CA-4 (testé au niveau `QuizServer` seulement,
> choix assumé) et CA-9 (la création des tables dans le fichier de zéro octet n'est constatée que par le test du CA-8 ; Windows sondé à la main le 2026-11-18, décision #70, mais sans test automatique).
>
> **Mise à jour après le `test(startup)` de la création des tables du fichier de zéro octet
> (2026-11-18)** : un test de plus dans `index.test.ts` (sous root : 88 verts et 10 sautés
> pour ce fichier ; sous non-root : 98 verts). CA-9 passe en solide ; reste partiel CA-4
> seul (testé au niveau `QuizServer`, choix assumé). Limites dites de CA-9 inchangées :
> permissions sautées en root et sous Windows, Windows sondé à la main (décision #70) mais
> sans test automatique.

- **Solides (8)** :
  - **CA-1** (démarre, écoute sur `0.0.0.0`, prérequis `JWT_SECRET`) : démarrage,
    écoute sur toutes les interfaces IPv4 (connexion par `127.0.0.1` et par la première
    IPv4 non-loopback), processus vivant et sortie d'erreur sans échec, prouvés sur
    processus réel ; `server.test.ts` (`describe('CA-1`) l'est au niveau `QuizServer`.
    Le prérequis `JWT_SECRET` est prouvé sur processus réel pour un secret **absent**,
    **vide** et de **31 caractères** (depuis le 2026-11-18) : code `1`,
    `Server starting failed: JWT_SECRET …` qui donne la règle (32) sans reprendre la
    valeur, sur la sortie d'erreur, pas de pile, sortie standard vide, pas d'annonce,
    rien n'écoute, aucune base créée ; secret trop court rapporté avant `PORT` (CA-7), avant
    un chemin de base blanc (CA-10) et avant une base inutilisable (CA-9). Un secret de 32
    caractères démarre : implicite dans tous les tests de démarrage. Les deux tests d'écoute
    sur toutes les interfaces se sautent explicitement sans IPv4 non-loopback (même limite
    que CA-3).
  - **CA-2** (heure locale `HH:mm:ss`, sortie standard) : `server.test.ts`
    (`describe('CA-2`, horloge figée à 14:32:07 puis 03:04:05 : zéros de tête) ;
    `index.test.ts` sur processus réel, sous `TZ=Pacific/Kiritimati` et
    `Pacific/Pago_Pago` : l'heure affichée tombe dans la fenêtre locale et hors de la
    fenêtre UTC ; lignes de démarrage sur la sortie standard, jamais sur l'erreur.
  - **CA-3** (première IPv4 non-loopback et port) : `server.test.ts`
    (`describe('CA-3`, réseau mocké à plusieurs interfaces : IPv6 et loopback ignorées,
    port configuré) ; `index.test.ts` sur processus réel : l'adresse annoncée est la
    première IPv4 non-loopback de la machine, avec le port, ni `127.0.0.1` ni
    `localhost`. Ce test se saute explicitement sans IPv4 non-loopback.
  - **CA-5** (`PORT`, défaut 3000, `.env`) : `read-port.test.ts` (défaut 3000, valeur
    lue) ; `index.test.ts` : le hub écoute sur le `PORT` écrit, tente 3000 quand `PORT`
    est absent, lit `PORT` dans un `.env` du dossier courant, et la variable réelle
    bat le `.env`.
  - **CA-7** (`PORT` invalide) : `read-port.test.ts` (bornes 1 et 65535, zéros en tête,
    chaîne vide, signe, blancs, hexadécimal, chiffres non ASCII, séparateur, message sans
    la valeur) ; `index.test.ts` sur processus réel : `''`, `abc`, `8080abc`, `65536`,
    `0` refusés (code `1`, `Server starting failed: PORT …` sur la sortie d'erreur et
    pas sur la standard, valeur non reprise, ni annonce ni écoute) ; `PORT=` vide d'un
    `.env` refusé, ignoré si l'environnement réel en a une valide ; erreur `JWT_*`
    rapportée seule quand `PORT` est invalide aussi.
  - **CA-8** (écoute impossible) : sur processus réel, le port déjà occupé (code `1`,
    `Server starting failed:` avec `EADDRINUSE` sur la sortie d'erreur, pas de pile, pas
    d'annonce ; base laissée : fichier absent et fichier de zéro octet conservés avec leurs
    tables vides, comptes d'une base existante conservés, lancement suivant réussi) et,
    depuis le 2026-11-18, `EACCES` sur le port privilégié 80 sans en avoir le droit (code
    `1`, `Server starting failed: listen EACCES…` sur la sortie d'erreur, pas de pile,
    sortie standard vide, rien n'écoute). **Limite dite** : le test `EACCES` dépend du
    compte et de la plateforme : il se saute explicitement en root, sous Windows, ou si la
    sonde préalable voit le port 80 ouvrable, occupé ou donnant une autre erreur ; il ne
    s'exécute que sous POSIX non-root (en CI `ubuntu-latest`). Les deux erreurs d'écoute
    prouvées sortent par le même point (`exitWithStartupFailure`) ; aucun test d'un échec
    d'écoute au niveau `QuizServer` (le code de sortie ne s'y observe pas).
  - **CA-9** (base non ouvrable ou non SQLite) : dossier inexistant, chemin qui désigne
    un dossier, fichier texte, 200 octets aléatoires : code `1`, `Server starting
    failed: <cause>` sur la sortie d'erreur, pas de pile, rien n'écoute, fichier intact
    octet pour octet ; `PORT` invalide rapporté avant la base ; fichier absent créé et
    fichier de zéro octet accepté (le hub écoute). Permissions (décision #69), prouvées
    depuis le 2026-11-18 sur processus réel, sous POSIX non-root : base existante
    `chmod 000`, fichier de zéro octet en lecture seule et fichier absent dans un dossier
    en lecture seule refusés (code `1`, préfixe et cause non vide sur la sortie d'erreur,
    pas de pile, rien n'écoute, pas d'annonce ; fichier inchangé, resté vide ou non créé) ;
    base à trois tables en lecture seule, ou inscriptible dans un dossier en lecture seule :
    le hub écoute et annonce, sans échec de démarrage, et une écriture répond `500` au
    corps standard (constat de #69) ; base à la seule table `T_USER_USR` en lecture seule
    ou en dossier en lecture seule : refusée. **Fichier de zéro octet**
    (sans permissions) : prouvé sur processus réel depuis le 2026-11-18, le hub écoute et
    annonce son démarrage, puis, le hub arrêté, le fichier contient les trois tables du
    hub (`T_USER_USR`, `T_THEME_THM`, `T_QUESTION_QST`) et la sortie d'erreur n'a pas de
    ligne d'échec de démarrage ; la création des tables de ce fichier n'est donc plus
    constatée par le seul test du CA-8. **Ordre des contrôles** : `JWT_*` avant
    `PORT`, `PORT` avant la base et, depuis le 2026-11-18, `JWT_SECRET` (absent, vide, 31
    caractères) avant une base inutilisable (fichier texte : une seule erreur, celle de
    `JWT_SECRET`, code `1`, fichier intact) sont prouvés sur processus réel.
    **Limites dites** : les tests de permissions se sautent explicitement en root, sous
    Windows ou quand `chmod` est sans effet ; le comportement sous Windows est sondé à la
    main (2026-11-18, décision #70 : mêmes issues pour le fichier, attribut de dossier sans
    effet, `EACCES` non reproduit) mais n'est pas testé automatiquement (dette `DEBTS.md`) ; le texte exact de la cause SQLite n'est pas imposé.
  - **CA-10** (`SQLITE_DB_PATH` vide ou faite de blancs) : les 25 blancs seuls, trois
    espaces et un mélange refusés sur processus réel (code `1`, message sans la valeur,
    rien n'écoute, aucun fichier créé) ; `U+200B`, `U+0085` et `U+180E` seuls non refusés ;
    ` :memory: ` accepté sans fichier ; chemin bordé de blancs nettoyé ; ordre `JWT_*`
    puis `PORT` avant le chemin ; règle de lecture prouvée par
    `read-database-path.test.ts` et `process-environment.test.ts`. Le `SQLITE_DB_PATH=`
    vide d'un fichier `.env` est prouvé sur processus réel depuis le 2026-11-18 : refusé
    quand l'environnement réel n'a pas la variable (code `1`, message sur la sortie
    d'erreur sans valeur, rien n'écoute, aucun fichier de base créé) ; ignoré quand
    l'environnement réel porte un chemin valide (le hub écoute, la base est créée au chemin
    réel, décision #52). **Limite dite** : la façon dont un `.env` écrit des blancs
    (valeur non quotée, guillemets) et `:memory:` dans un `.env` ne sont pas spécifiés ni
    testés (dette `DEBTS.md`).
- **Partiels (1)** :
  - **CA-4** (repli `localhost:<PORT>`) : `server.test.ts` (`describe('CA-4`) prouve le
    repli sans interface, avec seulement loopback et IPv6, et avec le port configuré
    (pas toujours 3000). **Pas testé sur processus réel** : choix assumé
    (2026-11-18). La sortie standard du repli n'est donc prouvée que par un
    `console.log` espionné.
- **Notes d'architecture** :
  - `index.ts` est à **0 % de couverture** v8 (comme `os-network.ts` et
    `system-clock.ts`) parce que le processus enfant n'est pas instrumenté, pas parce
    qu'il n'est pas testé : `index.test.ts` lance `index.ts` comme `npm start` (`tsx`,
    environnement explicite, base jetable) et prouve le câblage de `PORT`, des
    variables `JWT_*` (secret absent, vide ou trop court, `JWT_EXPIRATION` invalide), du chemin de base,
    de l'ouverture de la base, de la sortie d'erreur, du code de sortie et de l'ordre
    des contrôles. Reste non prouvé sur processus réel : le câblage du reste de la
    composition, hors périmètre d'US-001. L'ancienne lecture (« `index.ts` non testé =
    légitime ») est périmée.
  - Les contrôles sont écrits dans `createServer()` dans l'ordre de la spec (`JWT_*`,
    `PORT`, chemin, ouverture de la base) et tous les échecs sortent par un seul point,
    `exitWithStartupFailure` (`Server starting failed: <cause>`, code `1`). Les règles
    elles-mêmes vivent hors d'`index.ts` (`readJwtSettings`, `readPort`,
    `readDatabasePath` via `ProcessEnvironment`) et sont prouvées en unitaire.
  - `QuizServer.start()` écoute sur `0.0.0.0` (décision #51) ; l'heure vient d'un
    `Clock` injecté et l'adresse d'un `Network` injecté, ce qui rend CA-2, CA-3 et CA-4
    testables sans processus.
  - Le `.env` est lu par `import 'dotenv/config'`, première ligne d'`index.ts`.
  - Le test d'écoute du CA-1 de `server.test.ts` passe par `GET /health`, route que
    le CDC d'US-001 ne cite plus (dette `DEBTS.md` : US-020 doit la déplacer).
  - **Test fragile constaté** : `US-001/CA-5 listens on the port written in PORT`
    asserte que la console contient le port dès que le port accepte des connexions,
    avant que l'annonce soit forcément écrite ; il a échoué une fois sur trois suites
    complètes lors de ce relevé (vert aux deux autres). Non corrigé : hors périmètre
    d'une session `docs(specs)`.

### US-002 — Seed des utilisateurs (5 CA)

- **Solides (2)** : CA-3 (idempotence : `count≠0` → aucun insert),
  CA-4 (politique OWASP : refuse et throw `"Invalid password"`).
- **Partiels** :
  - **CA-1** (11 comptes `quiz_buzzer_01..10` + admin) : le code génère bien les
    noms (`padStart(2,'0')`), mais le test ne vérifie **que le compte (11
    insertions)** — jamais les **noms** ni la répartition des rôles.
  - **CA-2** (mots de passe lus depuis l'environnement, hashés bcrypt) : le test
    passe un `mockEnvironment` en dur → prouve l'usage, **pas la lecture d'env** ;
    le hasher est mocké → **bcrypt réel non prouvé** ici.
- **Robustesse hors-CA** : contrainte SQL `USR_LOGIN ... UNIQUE` = ceinture-bretelles
  sur l'idempotence.

### US-003 — Token d'authentification (18 CA)

- **Solides (~9)** : CA-1 (login → token), CA-2 (HS256), CA-5 (endpoint non
  protégé), CA-6 (`additionalProperties:false`), CA-7 (415), CA-8 (401
  générique), CA-9 (username requis), CA-10 (password requis).
- **Partiels / non vérifiés** :
  - **CA-3** : claims présents, mais `role` mis à la valeur **enum numérique**
    (`0`/`1`) et non `"admin"`/`"buzzer"` comme la spec l'exige ; le test ne
    vérifie que la *présence* du claim. → voir **Dette E**.
  - **CA-4** : défaut 1h et lecture de `JWT_EXPIRATION` prouvés (`process-environment.test.ts`) ;
    le générateur ne prouve pas que `exp - iat` égale la durée injectée.
  - **CA-11** : teste body *absent*, pas JSON *malformé*.
  - **CA-12** : 400 oui, mais code `UNKNOWN_FIELDS` non asserté.
  - **CA-13** : 429 oui ; header `Retry-After:60` et « par IP » non prouvés.
  - **CA-14 / CA-15** : `log.info`/`log.warn` présents, **aucun test** ne les capture.
- **Trous réels** :
  - **CA-16 (405 + `Allow: POST`)** : absent (ni code ni test).
  - **CA-17 (500 sans détail)** : aucun `try/catch` dans `token-route`.
- **Excellent hors-CA** : sous-système d'admission WebSocket (`AdmissionPolicy`,
  `JwtValidator.inspectToken` distinguant expired/invalid, resolver, extractors)
  finement testé — prépare solidement US-009.

### US-004 — CRUD des thèmes (40 CA)

- **Solides (~31)** : création/lecture/liste/pagination/update/delete, validation
  regex, normalisation trim+collapse, unicité `COLLATE NOCASE`, tri desc, bornes
  de pagination, `ID_MISMATCH`, `UNKNOWN_FIELDS`, 415, 401 (CA-32), **403 rôle
  (CA-33 — vérifié dans `authentication-middleware.test.ts`)**, 500 (CA-36).
- **Partiels / non vérifiés** : CA-12 / 12a (body & content-type ignorés sur GET,
  reposent sur le défaut Fastify, non figés par test), CA-19 (état vide via la
  route non testé — code correct : `ceil(0/limit)=0`), CA-34 (429 oui, header
  `Retry-After` non asserté).
- **Trou réel** :
  - **CA-35 (405 + header `Allow`)** : absent.
- **Faux vert** :
  - **CA-30 (delete d'un thème avec questions → 409)** : le service throw bien
    `ThemeHasQuestionsError`, **mais** `SqliteThemeRepository.isUsedInQuestions()`
    fait `return false;` (`// TODO: quand QuestionRepository sera disponible`).
    Le test **mocke** ce retour à `true`. En production réelle, un thème lié à
    des questions **serait supprimé quand même**. Vert en test, cassé en réel.
    Cohérent avec l'ordre de dev (les questions n'existent pas encore), mais le
    CA ne peut être déclaré « fait ». → **Dette A**.

### US-009 — Connexion WebSocket (29 CA)

- **La plus complète et la mieux testée du hub.** ~25/29 solides, avec des tests
  multi-clients qui mordent réellement (remplacement de session, éviction admin,
  sync, comptage buzzers/admin).
- **Solides (~25)** : CA-1→11 (attache, `/ws`, refus autre chemin, machine d'auth,
  close codes 4001/4002/4003), CA-13 (4004 session replaced), CA-14 (libération
  de slot), CA-15→17 (admin même format, slot unique, 4004), CA-18→21 (logs
  connected/authenticated/failed/disconnected avec récap), CA-23 (msg post-auth
  ignoré), CA-24 (1011 + `internalError`, y compris sur rejet du resolver),
  CA-27 (`buzzer_connected` à l'admin), CA-28 (`buzzer_disconnected`),
  CA-29 (`request_game_state` → `game_state_sync` + `connected_buzzers`).
- **Partiels / nuances** :
  - **CA-12** (max 10 buzzers) : le registry **mélange buzzers et admin** dans une
    même Map, et le plafond teste `registry.size >= maxConnections`. Donc
    `maxConnections:10` (valeur de `index.ts`) autorise **9 buzzers + 1 admin**,
    pas 10 buzzers + admin. Le test force `maxConnections=1` et n'exerce jamais
    la combinaison admin + 10 buzzers → la divergence reste invisible.
    → **Dette B**.
  - **CA-22** : « message d'un non-authentifié ignoré » — le design consomme le
    **premier** message comme tentative d'auth (pas d'état « connecté mais
    silencieux »). Interprétation, pas bug. Volet timeout (4003) bien testé.
  - **CA-26** : rate limiting appliqué **dans** le handler `/ws`, donc **après**
    l'upgrade, alors que la spec dit « détruite sans upgrade ». Résultat visible
    correct et testé (close 4006), mais *timing* divergent. → **Dette « Window 2 »**.
- **Note close codes** : 4005 = "Server is full." (CA-12), 4006 = "Rate limit
  exceeded." (CA-26). Les deux ont désormais un CA parent — l'ancienne remarque
  « 4005 sans CA parent » est **résorbée** (le réel est en avance sur le récap).

---

## 3. Dettes de complétude, ordonnées

**Motif transversal** : le cœur fonctionnel (auth, JWT, CRUD, WebSocket temps réel)
est solide et bien testé. Les faiblesses se concentrent sur les **exigences
normatives transversales** (405, 500, headers, logs, lecture d'environnement,
valeurs sémantiques).

| # | Dette | Gravité | Déclencheur de résorption |
|---|-------|---------|---------------------------|
| **A** | **Faux vert CA-30 / US-004** — `isUsedInQuestions()` renvoie `false` en dur ; un thème lié à des questions serait supprimé en prod. | 🔴 Corruption de données possible | Dès qu'US-005 (questions) existe. |
| **B** | **CA-12 / US-009** — le plafond mélange admin + buzzers ; en réel 9 buzzers au lieu de 10. | 🟠 Comportemental | Avant le premier jeu à 10 buzzers physiques. |
| **C** | **405 Method Not Allowed absent partout** (CA-16/US-003, CA-35/US-004). | 🟡 Conformité, effort faible | Passe de mise en conformité REST. |
| **D** | **Gestion 500 fragile** (CA-17/US-003 sans `try/catch`) — risque d'exposer un détail technique. | 🟡 Sécurité des erreurs | Passe de mise en conformité REST. |
| **E** | **`role` string vs enum dans le JWT REST** (CA-3/US-003) — `/token` porte `role:1`, pas `"buzzer"`. NB : côté WebSocket, `auth_success` utilise bien `toRoleLabel`. Incohérence entre les deux canaux. | 🟡 Interop consommateurs | Avant qu'un client décode le rôle du JWT REST. |
| **F** | **Lecture d'environnement non testée de bout en bout** (CA-2/US-002, CA-4/US-003, CA-13). Tout est renvoyé à `ProcessEnvironment`, non audité. US-001 n'est plus concernée : sa lecture d'environnement est réalignée au §2. | 🟢 Vérification | Un dump `process-environment.*` ferme deux US d'un coup. |
| **G** | **Logs et headers non assertés** (CA-14/15/US-003 ; `Retry-After` CA-13/US-003, CA-34/US-004). Code souvent présent, vérification absente. | 🟢 Vérification | Resserrage de tests. |
| **H** | **Vérifications faibles** (noms de comptes CA-1/US-002 ; JSON malformé CA-11/US-003 ; état vide CA-19/US-004). | 🟢 Vérification | Resserrage de tests. |

---

## 4. Ce que ça signifie pour la suite

Le socle hub est **substantiel mais pas « fini »** au sens strict des specs :
~74/101 CA solides (US-001 réalignée au HEAD `25d2388` puis mise à jour le 2026-11-18, les autres US au relevé
daté), avec un angle mort net sur les exigences transversales normatives. **Aucun de ces trous n'empêche d'avancer vers le jeu** — à condition
de les connaître pour ne pas s'appuyer dessus (notamment les dettes A et B).

Deux caps possibles pour la suite, à trancher :

1. **Consolider le socle** — résorber les dettes A→H (surtout A, B, C, D) pour un
   hub conforme avant d'ajouter des fonctionnalités. Petites sessions TDD ciblées,
   très « un commit par session ».
2. **Avancer vers le jeu** — attaquer US-005 (questions) → US-008 → US-010 → US-011,
   en actant les dettes du socle comme connues et datées. C'est le chemin qui
   « réveille la dalle » plus vite (le firmware attend un hub capable d'émettre
   les messages de déroulé de partie).

Les dettes A et B méritent d'être **notées formellement** mais peuvent attendre
leur déclencheur naturel. Les dettes C et D sont rapides et rendraient le socle
propre. Rien n'est bloquant : si le plaisir est le moteur, **US-005 → jeu** reste
le cap qui sort de « Connecté » affiché à l'écran.

---

*Audit réalisé par confrontation spec ↔ code ↔ tests, US par US. Document daté à
re-confronter au réel avant toute décision : le git log et les tests priment sur
ce récap.*
