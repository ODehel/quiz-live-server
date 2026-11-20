# État des lieux — Traçabilité du socle hub (US-001 → US-009)

> **Datation : relevé du HEAD hub `5407e38`, réaligné en partie.** Sont réalignés sur le
> réel au HEAD `ef7a221` (2026-11-20) : le **§0**, la partie **US-002** (§1, ligne US-002 ;
> §2, section US-002), la ligne **Total** du §1, les **dettes A à E, G et H** (§3 ; la
> dette F l'était déjà, avec une mention d'US-002 de plus) et le **§4**. La partie **US-001**
> (§1 ligne US-001, §2 section US-001) reste celle du réalignement du HEAD `25d2388`,
> tenue à jour jusqu'au 2026-11-18.
> Les parties **US-003, US-004 et US-009** (leurs lignes du §1 et leurs sections du §2)
> **restent celles du relevé daté (HEAD `5407e38`) et ne sont pas réalignées par cette
> session** : plusieurs de leurs cellules sont connues périmées (US-003 CA-3, CA-11 et CA-16,
> US-004 CA-19, CA-30 et CA-35 : voir les dettes A, C, E et H, soldées). La ligne Total
> additionne les lignes telles qu'elles sont écrites ; elle n'est donc pas un état du réel
> pour ces trois US. Réalignement des autres US : une session par US.

> **Méthode : audit par implémentation réelle, pas par étiquette de test.**
> Chaque CA a été confronté à trois sources : la **spec** (`docs/specs`),
> le **code de production** (`quiz-live-server/src`), et le **corps des tests**.
> Un CA n'est déclaré solide que si le comportement attendu est réellement
> exercé par une assertion qui mord — la seule présence d'un test étiqueté
> `US-00X/CA-Y` ne suffit pas.
>
> **Le réel fait foi.** Ce document est daté ; chaque partie reflète l'état du dépôt à
> la date de son audit ou de son réalignement (voir la datation ci-dessus). Toute
> évolution du code prime sur ce récap : re-confronter avant de s'y fier.

---

## 0. Portée et faits de départ

- **HEAD hub audité** : `ef7a221` — `test(seed): prove BCRYPT_COST written in a .env file is read and checked on the real process (#166)` (`main`, 2026-11-20). Il vaut pour le §0, la partie US-002, les dettes A à E, G et H et le §4. Les autres parties gardent leur date : US-001 au HEAD `25d2388` (2026-11-18, tenue à jour jusqu'au même jour), US-003, US-004 et US-009 au HEAD `5407e38`.
- **Tests au vert** : à `ef7a221`, sous Node 26.13.1 et sous root, `npx vitest run` donne 40 fichiers, **1201 verts et 22 sautés** (les tests de permissions : 12 de `seed.test.ts` et 10 de `index.test.ts`, sautés en root et sous Windows) ; `npx tsc --noEmit` et `npm run lint` sans erreur (code 0) ; seuils de couverture respectés (94,68 % d'instructions, 97,52 % de branches). Le run de la CI sur ce HEAD (`ubuntu-latest`, hors root, run 44785880839) donne **1223 verts, aucun sauté**. Le relevé daté (184 tests, 24 fichiers) et le réalignement US-001 du 2026-11-18 (1026 tests, 39 fichiers) sont périmés.
- **US auditées par ce fichier** : US-001, US-002, US-003, US-004, US-009 (les seules « prétendument faites » au relevé daté). Les US livrées depuis ne sont pas auditées ici.
- **US-005 à US-008** : le relevé daté les disait « absentes du code ET du git log » (~148 CA jamais implémentés). **C'est faux aujourd'hui pour US-005 seule.**
  - **US-005 existe** : `POST`, `GET /`, `GET /:id`, `PUT` et `DELETE` de `/api/v1/questions` (`questions/question-route.ts`), son service et son repository ; au moins 48 des 55 CA de la spec ont un test dont le titre cite `US-005/CA-n` (comptage par déclaration ; il ne voit pas un second CA cité sans préfixe d'US, comme dans `CA-20 and CA-41`). **Elle n'est pas auditée par ce fichier** : aucune confrontation CA par CA, aucun jugement sur la solidité de ses assertions.
  - **US-006, US-007 et US-008 ne sont pas implémentées** : `GET /api/v1/questions` ne lit que `page` et `limit` (pas de filtre, US-006), aucune route `PATCH` n'existe (US-007), ni route ni table de quiz (US-008) ; aucun test ne cite leurs CA. Soit 93 CA (18, 25 et 50), du travail à *faire*, pas à *auditer*. Le journal git n'a pas été relu : le clone de travail est en profondeur 1, ce que le relevé daté disait du journal (« saute d'US-004 à US-009 ») n'est ni confirmé ni infirmé.

> ⚠️ **Conséquence de dépendance** : US-010 (créer une partie) référence un
> `quiz_id` qui doit exister en base (CA-6 d'US-010 : `404 QUIZ_NOT_FOUND` sinon).
> Sans US-008 (quiz), **aucune partie n'est jouable**. US-005 (questions) est en place ;
> la chaîne qui reste vers une partie jouable est : **US-008 → US-010 → US-011**
> (le relevé daté ajoutait US-005 en tête).

---

## 1. Matrice-bilan du socle

| US | CA total | Solides | Partiels / non vérifiés | Trous réels | Faux verts |
|----|:---:|:---:|:---:|:---:|:---:|
| US-001 — server startup | 9  | 8   | CA-4                                 | —                          | —      |
| US-002 — seed users     | 9  | 8   | CA-4 (bornes U+001F / U+007F)       | —                          | —      |
| US-003 — auth token     | 18 | ~9  | CA-3, 4, 11, 12, 13, 14, 15         | **CA-16 (405)**, **CA-17 (500)** | — |
| US-004 — themes CRUD    | 40 | ~31 | CA-12 / 12a / 19 / 34               | **CA-35 (405)**            | **CA-30** |
| US-009 — websocket      | 29 | ~25 | CA-12, 22, 26                       | —                          | —      |
| **Total** | **105** | **~81** | **~16** | **3** | **1** |

Ligne US-001 réalignée sur le réel au HEAD `25d2388` (2026-11-18), puis mise à jour après le
`test(startup)` des permissions et de `EACCES`, puis après le `test(startup)` de `JWT_SECRET`
et du `.env`, puis après celui de la création des tables du fichier de zéro octet (2026-11-18).
Ligne US-002 réalignée sur le réel au HEAD `ef7a221` (2026-11-20) : la spec compte neuf CA (le
relevé daté en comptait cinq), dont CA-5, CA de couverture compté solide au sens du seuil global
(§2). **Les lignes US-003, US-004 et US-009 sont celles du relevé daté (HEAD `5407e38`), non
réalignées.** La ligne **Total** est recalculée à partir des lignes telles qu'elles sont écrites
(105 CA ; solides 8 + 8 + ~9 + ~31 + ~25 ; partiels 1 + 1 + 7 + 4 + 3 ; trous réels 2 + 1 ; faux
vert 1) : elle compte donc encore trois trous réels (US-003 CA-16 et CA-17, US-004 CA-35) et un
faux vert (US-004 CA-30), alors que deux de ces trous (CA-16 et CA-35) et le faux vert sont
corrigés dans le code (dettes C et A, §3).

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
    réel, décision #52). L'écriture des blancs, des guillemets doubles et du ` #` dans un `.env`, et `:memory:` dans
    un `.env`, sont prouvées sur processus réel depuis le 2026-11-19 (décision #71, constat
    reporté ; ces constats dépendent de `dotenv` 17.4.0). **Limite dite** : le seed n'a pas
    été sondé séparément avec un `.env`, et les guillemets simples et les accents graves ne
    sont pas prouvés sur processus réel (dette `DEBTS.md`).
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

### US-002 — Seed des utilisateurs (9 CA : CA-1 à CA-9)

> **Section réalignée sur le réel au HEAD `ef7a221` (2026-11-20)**, avec la méthode du
> fichier (spec, code de production, corps des tests). La spec compte neuf CA (le relevé
> daté en comptait cinq) : CA-6 à CA-9 se sont ajoutés depuis (décisions citées dans la spec). Suite
> concernée : `src/seed.test.ts` (processus réel : `tsx src/seed.ts` lancé en `spawnSync`,
> environnement explicite, dossier de travail et base jetables), `src/users/seed-users.test.ts`
> (service), `bcrypt-cost.test.ts`, `owasp-password-validator.test.ts`,
> `sqlite-user-repository.test.ts`, `role-label.test.ts`, `common/process-environment.test.ts`,
> `infrastructure/bcrypt-hasher.test.ts` et `env-example.test.ts` : 307 verts et 12 sautés
> sous root (2026-11-20). Les 12 sautés sont les tests de permissions de `seed.test.ts`
> (CA-9, base en lecture seule, décision #72) : root les ignore, Windows n'a pas les mêmes ;
> ils s'exécutent en CI (1223 verts, aucun sauté sur ce HEAD). Un CA n'est *solide* que si
> chacun de ses comportements est prouvé par une assertion qui mord. Les constats « sondé »
> viennent d'un hub ou d'un seed lancé à la main le 2026-11-20 sur une base jetable, sonde non
> committée ; les « mutants » sont des modifications de production rejouées sous les tests puis
> annulées (aucun test n'est ajouté ni modifié par cette session).

- **Solides (8)** :
  - **CA-1** (onze comptes, ligne de succès) : sur processus réel, un seed sur base neuve
    sort avec le code `0`, exactement une ligne non vide sur la sortie standard, la sortie
    d'erreur vide, et cette ligne n'est ni un message d'échec ni celle du CA-7 ; le sens
    (« les onze comptes ont été créés ») n'est pas assertable mot à mot : la décision #73 ne
    fixe ni langue, ni nombre, ni ponctuation. Onze comptes en base, et le lancement suivant
    d'une base laissée par un refus les crée (deux déclarations de `seed.test.ts` portent
    `US-002/CA-1` ; `expectCreatedSeed`, qui fixe ces sorties, est appelée à 21 endroits du
    même fichier). **Noms et rôles (périmé : « le test ne vérifie que le compte »)** : le test du CA-2 sur `.env` compare
    l'ensemble des logins stockés à `admin` + `quiz_buzzer_01` à `quiz_buzzer_10` ; le rôle
    (`admin` pour `admin`, `buzzer` pour les dix autres) est lu en base pour les onze comptes
    par `seed-users.test.ts` (`describe` « Seed with the SQLite repository », vrai repository,
    hasher simulé). Le processus réel n'asserte pas, lui, le rôle des comptes qu'il crée.
  - **CA-2** (mots de passe lus de l'environnement, hachés avec bcrypt) : périmé : « le test
    passe un `mockEnvironment` en dur » et « bcrypt réel non prouvé ». Sur processus réel, les
    onze `SEED_PASSWORD_*` sont retirés de l'environnement réel et écrits dans un `.env` du
    dossier de travail : chaque hash stocké n'est pas le mot de passe en clair, a la forme
    `$2a|b|x|y$`, et `bcrypt.compareSync` (bibliothèque réelle) le rapproche du mot de passe
    écrit pour son propre compte ; la variable de l'environnement réel l'emporte sur le `.env`
    (`admin` et `quiz_buzzer_10`, décision #52). Au service : chaque compte reçoit son mot
    de passe (`seed-users.test.ts`, hasher simulé) ; le coût passé au vrai `BcryptHasher` se
    lit dans le hash (CA-6).
  - **CA-3** (idempotence) : un second lancement avec d'autres mots de passe valides et un
    autre `BCRYPT_COST` laisse les onze comptes identiques, hashs compris (coût `04` de la
    première passe) ; les tests du CA-7 comparent en plus le fichier (sha256) avant et après.
    Un seul compte déjà présent suffit à empêcher toute insertion (CA-7).
  - **CA-5** (couverture ≥ 90 %) : CA de couverture. La spec du CA dit « couverture globale »
    et la décision #67 en fait un seuil global appliqué par la CI : `vitest.config.ts` fixe 90
    sur les quatre métriques, mesuré à 94,68 % d'instructions, 97,52 % de branches, 93,99 % de
    fonctions et 94,74 % de lignes (2026-11-20), et la CI de ce HEAD est verte. Compté solide
    à ce titre ; `seed.ts` reste à 0 % parce que le processus enfant n'est pas instrumenté
    (comme `index.ts`), non parce qu'il n'est pas testé. La spec garde le CA et son bandeau
    (dette de `DEBTS.md` : les CA de couverture restent à retirer, une session par lot).
  - **CA-6** (`BCRYPT_COST`) : sur processus réel, quinze valeurs refusées (`abc`, `12.5`,
    `3`, `32`, `-1`, ` 12`, `0`, `4.0`, `+5`, `004`, `04`, un chiffre arabo-indien, vingt
    chiffres, une espace seule, une tabulation seule) : code `1`, sortie standard vide, une
    seule ligne `User seeding failed: `, pas de pile, la variable et les deux bornes nommées,
    aucun compte, fichier de base conservé avec sa table vide (décision #65) ; la valeur n'est
    pas reprise dans le message ; `4` et `10` acceptés (le coût se lit dans le hash stocké) ;
    absente ou vide, le coût est `12`. Les mêmes règles sont prouvées pour un `.env` (valeurs
    acceptées et refusées, vide et blancs non quotés lus comme vide donc `12`, blancs quotés
    refusés, priorité de l'environnement réel dans les deux sens). **Limite dite** : 31 n'est
    pas prouvé sur processus (bcrypt à ce coût : des heures) ; il l'est aux unités
    (`bcrypt-cost.test.ts`, `seed-users.test.ts`) : le mutant « maximum 31 → 30 » est tué par
    deux tests (2026-11-20).
  - **CA-7** (table non vide) : sur processus réel, un second lancement sort avec le code
    `0`, une ligne sur la sortie standard, la sortie d'erreur vide, le fichier et les comptes
    inchangés ; même ligne, même issue avec un mot de passe trop court, vide ou absent, un
    `BCRYPT_COST` invalide ou les deux (le CA-7 passe avant les CA-4 et CA-6) ; une table qui
    ne porte qu'un compte est ignorée aussi, avec ou sans fautes. Sur base en lecture seule
    qui a ses comptes : même ligne, fichier et dossier intacts (décision #72, tests sautés en
    root).
  - **CA-8** (`SQLITE_DB_PATH` vide ou de blancs) : sur processus réel, la chaîne vide, chacun
    des 25 blancs de la liste fermée, trois espaces et un mélange sont refusés (code `1`,
    sortie standard vide, message du CA-8 sur la sortie d'erreur, aucun fichier créé), sans
    reprendre la valeur, et seule l'erreur de `SQLITE_DB_PATH` est rapportée quand un mot de
    passe et `BCRYPT_COST` sont faux aussi ; U+200B, U+0085 et U+180E seuls, puis U+3101,
    U+FF21 et U+1F600 (sautés si le système de fichiers ne tient pas le nom) sont acceptés et
    nomment le fichier ; ` :memory: ` réussit sans fichier ; les blancs de bordure sont
    retirés. Le `.env` est prouvé sur le seed lui-même (décision #71) : blancs non quotés lus
    comme vide donc refusés, blancs quotés refusés, sept écritures acceptées (blancs
    intérieurs, ` #`, bordures retirées, valeur quotée, `:memory:` quoté ou non, U+200B), et
    l'environnement réel l'emporte. Les règles de lecture : `process-environment.test.ts`
    (4). Le test fixe le libellé d'exemple du CA-8 (`User seeding failed: SQLITE_DB_PATH cannot
    be empty or made only of whitespace.`), que la spec dit non normatif : plus strict que
    la spec, pas un trou. **Limite dite** : la valeur par défaut `quiz.db` n'est prouvée qu'aux
    unités ; aucun test de processus ne lance le seed sans `SQLITE_DB_PATH` ; sondé à la main :
    le fichier `quiz.db` est créé dans le dossier de travail et porte onze comptes.
  - **CA-9** (base non ouvrable ou non SQLite) : sur processus réel, un dossier absent, un
    dossier, un fichier texte et 200 octets aléatoires sont refusés (code `1`, `User seeding
    failed: ` suivi d'une cause, pas de pile, sortie standard vide), seule l'erreur de la base
    est rapportée avec un mot de passe et `BCRYPT_COST` faux, les deux fichiers sont intacts
    (le second octet pour octet) ; un fichier absent dans un dossier qui existe et un fichier
    de zéro octet sont seedés ; après un refus du CA-4 ou du CA-6, le fichier absent ou de
    zéro octet reste avec sa seule table `T_USER_USR` vide, une base existante à table vide
    n'est pas touchée, et le lancement suivant crée les onze comptes (décision #65). Base en
    lecture seule (décision #72, constat reporté, pas une règle) : cas (a) à (k), refus en
    `User seeding failed: <cause>` sans compte, base intacte, ordre des contrôles ; 7
    déclarations (12 tests) **sautées en root et sous Windows**, exécutées par la CI. **Limites
    dites** : le texte de la cause n'est pas imposé ; sous Windows le seed n'est pas sondé
    (décision #72, point 6).
- **Partiels (1)** :
  - **CA-4** (politique de mot de passe) : bien prouvé sur processus réel : chacun des onze
    comptes dont le mot de passe n'est pas défini, `admin` et `quiz_buzzer_10` avec huit
    valeurs refusées (chaîne vide, 11 et 73 caractères, tabulation, saut de ligne, caractère
    hors ASCII, 12 et 72 espaces) et quatre acceptées (12 et 72 caractères, onze espaces puis
    un caractère, un caractère puis 71 espaces) : code `1`, sortie standard vide, une seule
    ligne à préfixe, un seul compte nommé, pas de pile, mot de passe jamais repris, aucun
    compte, base conservée ; une copie non éditée de `.env.example` est refusée (décision #75)
    et acceptée une fois les placeholders remplacés ; règles unitaires dans
    `owasp-password-validator.test.ts`. **Non prouvé** : les bornes du jeu de caractères :
    ni U+007F (juste au-dessus de U+007E) ni U+001F (juste sous U+0020) n'apparaissent dans un
    test ; U+007E et U+0020 sont acceptés (`~` et espaces aux unités). Mutants rejoués le
    2026-11-20 sur `PRINTABLE_ASCII` de `owasp-password-validator.ts` (`\x20-\x7E` devenu
    `\x20-\x7F`, puis `\x1F-\x7E`), sous les sept fichiers de test du seed, du service, du
    validateur et du modèle (291 verts et 12 sautés) : **les deux survivent**. Le CDC est
    clair (« tous de l'ASCII imprimable (U+0020 à U+007E) ») : c'est une vérification faible,
    non un trou de spec. → voir **dette H**.
- **Hors CA** :
  - **Atomicité de l'idempotence (« Points de vigilance »)** : la spec écrit que la
    vérification de la table « doit être atomique » pour les instances simultanées. Le code
    fait un `count()`, onze hachages, puis onze `insert` séparés sans transaction
    (`seed-users.ts`). Sondé trois fois : deux seeds lancés ensemble sur une base neuve, l'un
    réussit (code `0`, ligne de succès), l'autre sort avec le code `1` et `User seeding
    failed: UNIQUE constraint failed: T_USER_USR.USR_LOGIN` ; onze comptes à la fin, aucun
    doublon : la contrainte `USR_LOGIN … UNIQUE` tient lieu de garde (aucun test ne la cite).
    **Constat, non jugé** : le CDC ne dit pas ce que l'instance perdante doit rendre ni
    afficher ; aucun test ne couvre le cas ; l'écart n'est pas inscrit dans `DEBTS.md`.
  - **UUIDv7** (périmètre de la spec) : onze identifiants de version 7 sondés ; aucun test ne
    vérifie la forme des identifiants insérés.
  - **`.env` non versionné** (CA-2, « Format du fichier `.env` ») : `.gitignore` porte `.env` et
    seul `.env.example` est suivi par git (constaté à la main ; aucun test).
  - **Deux phrases sont périmées** et ne sont pas corrigées ici (hors périmètre de cette
    session) : celle du CA-8 de la spec d'US-002 (« sans avoir été sondé séparément » : les
    tests de `seed.test.ts` sondent le seed avec un `.env`, décision #71) et la « limite dite »
    du CA-10 de la section US-001 ci-dessus (« le seed n'a pas été sondé séparément avec un
    `.env` »).

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

> **Dettes A à E, G et H réalignées sur le réel au HEAD `ef7a221` (2026-11-20)** : chacune
> est confrontée au code, aux tests et, quand le comportement s'observe, à un hub lancé à la
> main sur une base jetable (sondes non committées). Statuts : **soldée** (corrigée dans le
> code, avec la preuve), **toujours vraie** ou **périmée**. Quand une dette vit aussi dans
> `DEBTS.md`, la ligne y renvoie ; les autres ne vivent que dans ce fichier. La dette F l'était
> déjà (réalignée avec US-001) ; une mention d'US-002 y est ajoutée.

**Motif transversal** : le cœur fonctionnel (auth, JWT, CRUD, WebSocket temps réel)
est solide et bien testé. Les faiblesses qui restent se concentrent sur la gestion du `500`
de `/token`, le plafond des connexions WebSocket et des vérifications (logs, headers, bornes).
Les exigences transversales `405` et `role` du JWT, elles, sont corrigées.

| # | Dette | Gravité | Déclencheur de résorption |
|---|-------|---------|---------------------------|
| **A** | **Soldée dans le code, résidu de vérification.** Faux vert CA-30 / US-004 : `isUsedInQuestions()` renvoyait `false` en dur. Aujourd'hui `SqliteThemeRepository.isUsedInQuestions` interroge `T_QUESTION_QST` (`QST_THEME_ID = ?`) ; `sqlite-theme-repository.test.ts` le prouve avec le vrai repository de questions (vrai quand une question référence le thème, faux sinon). Sondé sur hub réel : `DELETE` d'un thème qui porte une question répond `409 THEME_HAS_QUESTIONS`, puis `204` une fois la question supprimée. **Résidu** : aucun test ne traverse route, service et repository réels (`server.test.ts` n'a pas de cas `409`), et le test du service simule `isUsedInQuestions` à `true` sans vérifier l'argument : un mutant qui lui passe `theme.name` au lieu de l'identifiant survit (155 verts sur `src/themes` et `server.test.ts`, 2026-11-20). La ligne et la section CA-30 d'US-004 restent datées (« faux vert ») : à réaligner avec la session US-004. Le résidu ne vit pas dans `DEBTS.md`. | ~~🔴~~ 🟢 Vérification (résidu) | Résidu : `test(themes)` d'un `409` sur le serveur assemblé, vrai service et vrai repository. |
| **B** | **Toujours vraie (fait constaté).** CA-12 / US-009 : le plafond mélange admin et buzzers. `ws-route.ts` refuse (`4005`, `Server is full.`) toute nouvelle entrée quand `registry.size >= config.maxConnections`, le registre contenant buzzers **et** admin ; `index.ts` donne `maxConnections: 10`. Sondé sur hub réel : dix buzzers s'authentifient, puis l'admin, onzième connexion, est refusé en `4005` : avec dix buzzers connectés, l'admin ne peut plus se connecter. Les tests ne forcent que `maxConnections = 1` avec un buzzer : la combinaison n'est exercée par aucun test. **Point que le CDC ne tranche pas** : US-009 CA-12 dit « maximum 10 buzzers simultanés », CA-16 « maximum 1 connexion admin », le tableau des codes dit `4005` quand « le registre a atteint sa capacité maximale (10 buzzers) », et le registre décrit contient aussi l'admin (rôle `buzzer` ou `admin`) : il ne dit pas si l'admin compte dans le plafond. La lecture « dix buzzers et un admin » est celle de l'audit initial, pas celle du CDC ; elle n'est pas tranchée ici. Ne vit pas dans `DEBTS.md`. | 🟠 Comportemental | Une décision du CDC (l'admin compte-t-il dans le plafond ?), avant le premier jeu à 10 buzzers physiques. |
| **C** | **Soldée.** 405 Method Not Allowed absent partout (CA-16/US-003, CA-35/US-004) : `feat(errors)` du 2026-11-11, décision #38 (`routes/not-found-route.ts`, `RouteCatalog`). Sondé sur hub réel : `GET /api/v1/token` répond `405` avec `Allow: POST` (route publique, corps standard `METHOD_NOT_ALLOWED`), `DELETE /api/v1/themes` avec un token admin répond `405` avec `Allow: GET, POST`. Testé sur le serveur assemblé (`server.test.ts`, deux `describe` portant `US-003/CA-16` et `US-004/CA-35` : route protégée, route publique) ; retirer la ligne qui pose `Allow` fait rougir 7 tests (2026-11-20). **Reste, dans `DEBTS.md`** : la couverture se limite aux ressources `/api/v1/` des tokens, thèmes et questions (dette « `405` : seules les ressources… »). Les cellules CA-16 (US-003) et CA-35 (US-004) restent datées. | ~~🟡~~ soldée | Sans objet (voir `DEBTS.md` pour le périmètre). |
| **D** | **Toujours vraie sur `POST /api/v1/token`, soldée ailleurs.** Gestion 500 fragile (CA-17/US-003) : `token-route.ts` n'a toujours aucun `try/catch` autour de `authenticationService.authenticate`, son `setErrorHandler` ne traite que `INVALID_JSON` et délègue le reste au gestionnaire de Fastify, et `QuizServer` n'en pose pas de global. Sondé sur hub réel : la table `T_USER_USR` supprimée sous un hub en marche, `POST /api/v1/token` répond `500` avec le **corps natif de Fastify** (`statusCode`, `code: "SQLITE_ERROR"`, `error`, `message: "no such table: T_USER_USR"`) : le détail technique est exposé et le corps n'est pas le corps standard. Aucun test ne simule une erreur du service d'authentification. Soldée sur les thèmes (`US-004/CA-36`) et les questions (`US-005/CA-54`) : leurs tests assertent le `500` au corps standard sans le message technique. Ne vit pas dans `DEBTS.md`. | 🟡 Sécurité des erreurs | `fix(authentication)` : `500` au corps standard sur `/token`, avec un test qui fait lever le service ; passe de mise en conformité des erreurs. |
| **E** | **Soldée.** `role` string vs enum dans le JWT REST (CA-3/US-003) : le `fix(authentication)` du 2026-11-10 écrit `toRoleLabel(user.role)` dans le token (`jwt-generator.ts`) ; `jwt-generator.test.ts` asserte `role: "buzzer"` pour un joueur et `role: "admin"` pour un administrateur. Sondé sur hub réel : le token de `/api/v1/token` porte `"admin"` pour `admin` et `"buzzer"` pour `quiz_buzzer_01`. Côté WebSocket, `auth_success` utilise aussi `toRoleLabel` : les deux canaux concordent. La cellule CA-3 d'US-003 reste datée. | ~~🟡~~ soldée | Sans objet. |
| **F** | **Lecture d'environnement non testée de bout en bout** (CA-2/US-002, CA-4/US-003, CA-13). Tout est renvoyé à `ProcessEnvironment`, non audité. US-001 n'est plus concernée : sa lecture d'environnement est réalignée au §2. US-002 non plus : le `.env` du seed (mots de passe, `BCRYPT_COST`, `SQLITE_DB_PATH`) est prouvé sur processus réel (§2). | 🟢 Vérification | Un dump `process-environment.*` ferme deux US d'un coup. |
| **G** | **Toujours vraie, en partie dans `DEBTS.md`.** Logs et headers non assertés. (1) **Logs CA-14 / CA-15 d'US-003** : `token-route.ts` écrit `request.log.info` et `warn` avec le nom d'utilisateur et l'IP ; `token-route.test.ts` monte `Fastify()` sans logger : aucun test ne les capture. Ne vit pas dans `DEBTS.md`. (2) **`Retry-After`, CA-13 / US-003 et CA-34 / US-004** : `token-route.test.ts` et `theme-route.test.ts` n'assertent que le statut `429`. Le header est posé par un hook du middleware de limitation, testé au middleware (`rate-limit-middleware.test.ts`) et, pour la route inconnue, sur le serveur assemblé ; renvoi à `DEBTS.md` : « `429` des tokens non re-testé », « `429` des thèmes non re-testé » et « `Retry-After` constant testé au middleware seul, pas par plugin ». (3) **« Par IP » (CA-13)** : aucun test à deux adresses (la clé est celle de `@fastify/rate-limit` par défaut, l'IP de la requête) ; ne vit pas dans `DEBTS.md`. | 🟢 Vérification | Resserrage de tests. |
| **H** | **Soldée pour ses trois points ; un point nouveau reste.** (a) Noms de comptes CA-1/US-002 : prouvés (§2 : l'ensemble des onze logins est comparé sur processus réel). (b) JSON malformé CA-11/US-003 : `token-route.test.ts` asserte `400 INVALID_JSON` pour un JSON tronqué et pour un corps vide. (c) État vide CA-19/US-004 : prouvé à la route (`200` et enveloppe vide, service simulé), au service (`total: 0`, `total_pages: 0`) et au repository (liste vide). Les cellules CA-11 (US-003) et CA-19 (US-004) restent datées. **Reste, nouveau** : les bornes du jeu de caractères du mot de passe, CA-4/US-002 (U+001F et U+007F non testés, deux mutants survivants : §2). Ne vit pas dans `DEBTS.md`. | 🟢 Vérification | Resserrage de tests : `test(users)` d'U+007F et d'U+001F refusés (étape de mutation incluse). |

---

## 4. Ce que ça signifie pour la suite

Le socle hub est **substantiel mais pas « fini »** au sens strict des specs :
~81/105 CA solides (US-001 réalignée au HEAD `25d2388` puis mise à jour le 2026-11-18,
US-002 au HEAD `ef7a221` le 2026-11-20, les autres US au relevé daté ; décompte du §1), avec
un angle mort sur les exigences transversales normatives (le `500` de `/token`, les logs et
les headers non assertés) et sur le plafond des connexions WebSocket. **Aucun de ces trous
n'empêche d'avancer vers le jeu** — à condition de les connaître pour ne pas s'appuyer
dessus (notamment la dette B).

Deux caps possibles pour la suite, à trancher :

1. **Consolider le socle** — résorber ce qui reste des dettes (D, B, G, le résidu de A et la
   borne du CA-4 d'US-002 ; C, E et H sont soldées) pour un hub conforme avant d'ajouter des
   fonctionnalités. Petites sessions TDD ciblées, très « un commit par session ». La dette B
   demande d'abord une décision du CDC (l'admin compte-t-il dans le plafond ?).
2. **Avancer vers le jeu** — attaquer US-008 (quiz) → US-010 → US-011, US-005 (questions)
   étant en place, en actant les dettes du socle comme connues et datées. C'est le chemin qui
   « réveille la dalle » plus vite (le firmware attend un hub capable d'émettre
   les messages de déroulé de partie).

La dette B mérite d'être **notée formellement** (elle ne vit pas dans `DEBTS.md`) mais peut
attendre son déclencheur naturel. La dette D est rapide et rendrait le socle plus propre.
Rien n'est bloquant : si le plaisir est le moteur, **US-008 → jeu** reste le cap qui sort de
« Connecté » affiché à l'écran.

---

*Audit réalisé par confrontation spec ↔ code ↔ tests, US par US. Document daté à
re-confronter au réel avant toute décision : le git log et les tests priment sur
ce récap.*
