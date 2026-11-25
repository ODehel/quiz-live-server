# État des lieux — Traçabilité du socle hub (US-001 → US-009)

> **Datation : relevé du HEAD hub `5407e38`, réaligné en partie.** Sont réalignés sur le
> réel au HEAD `ef7a221` (2026-11-20) : le **§0**, la partie **US-002** (§1, ligne US-002 ;
> §2, section US-002), la ligne **Total** du §1, les **dettes A à E, G et H** (§3 ; la
> dette F l'était déjà, avec une mention d'US-002 de plus) et le **§4**. La partie **US-001**
> (§1 ligne US-001, §2 section US-001) est celle du réalignement du HEAD `319d443`
> (2026-11-23, voir plus bas).
> **Réalignement du 2026-11-21 (`docs(specs)`, HEAD `33823bf`)** : dans la partie US-002, CA-3 et
> CA-7 repassent de partiels à solides. La décision #77 avait fait passer les deux CA en partiels
> (la spec écrivait le tout ou rien et la perdante d'une course, le code ne les tenait pas) ; le
> `fix(seed)` (#174, décision #78) les tient, et le `test(seed)` (#175) les prouve sur processus
> réels ; la décision #79 (#176) a tranché les deux trous de CDC qui restaient (T1, T10). La ligne
> US-002 du §1, la ligne Total, la section US-002 du §2, la note d'en-tête, les dettes H et la note
> du §3 et le §4 sont alignés en conséquence. Aucun code ni test n'a changé.
> **Réalignement du 2026-11-21 (`refactor(users)`, HEAD `76c7eed`)** : CA-5 d'US-002 est retiré du décompte (US-002 : 8 CA, 8 solides ; Total : 104 CA, ~81 solides), voir §1 et §2. Aucun autre CA n'est touché.
> **Réalignement du 2026-11-22 (`docs(specs)`, HEAD `ed6bd31`)** : la partie **US-003** (§1, ligne
> US-003 ; §2, section US-003) est réalignée sur le réel avec la méthode du fichier, avec la ligne
> **Total**, les cellules d'US-003 des dettes C à H (§3), le §0 et le §4. US-003 : 19 CA (CA-18 est
> retiré, décision #54, numérotation conservée), **17 solides et 2 partiels** (CA-1 : `token_type`
> non asserté en production ; CA-2 : câblage du secret non prouvé par un test d'US-003) ; Total :
> 105 CA, ~89 solides. Les mutants cités dans la section ont été rejoués par cette session puis
> annulés ; aucun code ni test n'a changé.
> **Réalignement du 2026-11-23 (`docs(specs)`, HEAD `319d443`)** : la partie **US-001** (§1, ligne
> US-001 ; §2, section US-001) est réalignée sur le réel avec la méthode du fichier, avec la ligne
> **Total**, le §0 et le §4. US-001 : 9 CA (CA-6 est retiré, décision #54, numérotation conservée),
> **9 solides** : CA-4 (repli `localhost:<PORT>`) passe de partiel à solide, prouvé sur processus
> réel depuis le `test(startup)` du 2026-11-23 (#211) ; Total : 105 CA, ~90 solides. Les six mutants
> cités dans la section ont été rejoués par cette session puis annulés ; aucun code ni test n'a changé.
> **Réalignement du 2026-11-23 (`docs(specs)`, HEAD `833c78b`)** : périmètre réduit à **une limite
> dite de la section US-001 du §2 (CA-4)** : le repli avec `PORT` absente est désormais prouvé sur
> processus réel par le `test(startup)` du 2026-11-23 (#213) ; la limite est réécrite (saut nommé
> quand 3000 est tenu, course entre la sonde et le lancement), avec le bloc « Mise à jour » de
> la section, la note de la ligne US-001 du §1 et le §0. **Non réalignés** : toutes les autres
> limites dites (dont celle de `dotenv` et des guillemets, toujours vraie), les autres US, les
> dettes du §3 et le §4 (le décompte des CA ne change pas). Sept des huit mutants cités par #213
> ont été rejoués par cette session sur le test seul puis annulés, tous tués ; aucun code ni test
> n'a changé.
> **Réalignement du 2026-11-25 (`docs(specs)`, HEAD `418aa13`)** : la partie **US-003** (§1, ligne
> US-003 ; §2, section US-003) est réalignée sur le réel avec la méthode du fichier, avec la ligne
> **Total**, les cellules d'US-003 des dettes C à H (§3), le §0 et le §4. US-003 : **20 CA** (CA-21,
> `MAX_REQUESTS_PER_MINUTE` invalide, s'est ajouté le 2026-11-24, décision #94 ; CA-18 reste retiré,
> décision #54), **20 solides, aucun partiel** : CA-1 (`token_type`) et CA-2 (câblage de `JWT_SECRET`)
> passent de partiels à solides, prouvés sur processus réel par le `test(authentication)` #210
> (2026-11-23) ; le constat du réalignement du HEAD `ed6bd31`, qui les disait non prouvés, est périmé.
> D'autres cellules étaient périmées depuis `ed6bd31` et sont corrigées : l'ordre des contrôles, le
> `null`, le champ mal typé et le corps non objet (CA-6, CA-9, CA-10, `fix(authentication)` #206 et
> #208), le temps de réponse constant du login (`fix(authentication)` #209), le `charset` (CA-7), le
> `405` quel que soit le corps, `OPTIONS` et `HEAD` compris (CA-16), le `Content-Type` du `500`
> (CA-17) et le compteur de CA-13, devenu commun à toute l'API (décisions #96 et #97). Total :
> 106 CA, ~93 solides. Six mutants (CA-1, CA-2, comparaison factice, `null`, `charset`, `OPTIONS`) ont été
> rejoués par cette session puis annulés, tous tués ; aucun code ni test n'a changé.
> Les parties **US-004 et US-009** (leurs lignes du §1 et leurs sections du §2)
> **restent celles du relevé daté (HEAD `5407e38`) et ne sont pas réalignées par cette
> session** : plusieurs de leurs cellules sont connues périmées (US-004 CA-19, CA-30 et CA-35 :
> voir les dettes A, C et H, soldées). La ligne Total additionne les lignes telles qu'elles sont
> écrites ; elle n'est donc pas un état du réel pour ces deux US. Réalignement des autres US :
> une session par US.

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

- **HEAD hub audité** : `ef7a221` — `test(seed): prove BCRYPT_COST written in a .env file is read and checked on the real process (#166)` (`main`, 2026-11-20). Il vaut pour le §0, la partie US-002, les dettes A à E, G et H et le §4. **La partie US-003 et les cellules d'US-003 des dettes C à H sont au HEAD `418aa13`** — `test(errors): prove a delayed 429 still answers Retry-After 60 on the assembled server (#243)` (`main`, 2026-11-25). **La partie US-001 est au HEAD `319d443`** — `test(startup): prove the localhost fallback of the startup message on the real hub (#211)` (`main`, 2026-11-23) ; **seule sa limite dite du repli avec `PORT` absente (CA-4) est au HEAD `833c78b`** — `test(startup): prove the localhost fallback announces port 3000 when PORT is absent on the real process (#213)` (`main`, 2026-11-23). Les autres parties gardent leur date : US-004 et US-009 au HEAD `5407e38`.
- **Tests au vert** : à `ef7a221`, sous Node 26.13.1 et sous root, `npx vitest run` donne 40 fichiers, **1201 verts et 22 sautés** (les tests de permissions : 12 de `seed.test.ts` et 10 de `index.test.ts`, sautés en root et sous Windows) ; `npx tsc --noEmit` et `npm run lint` sans erreur (code 0) ; seuils de couverture respectés (94,68 % d'instructions, 97,52 % de branches). Le run de la CI sur ce HEAD (`ubuntu-latest`, hors root, run 44785880839) donne **1223 verts, aucun sauté**. Le relevé daté (184 tests, 24 fichiers) et le réalignement US-001 du 2026-11-18 (1026 tests, 39 fichiers) sont périmés.
  **À `ed6bd31`** (réalignement d'US-003, 2026-11-22), sous Node 22.23.5 (le projet exige Node >=26 <27) et sous root : `npx vitest run` donne 42 fichiers, **1278 verts et 22 sautés** ; `npx tsc --noEmit` et `npm run lint` sortent en code 0 ; le run de la CI sur ce HEAD (run 45032891184, `push`) est au vert (`verify` : success) ; seuils de couverture : non exécutés par cette session.
  **À `319d443`** (réalignement d'US-001, 2026-11-23), sous Node 22.23.5 (le projet exige Node >=26 <27) et sous root : `npx vitest run` donne 42 fichiers, **1320 verts et 22 sautés** ; `npx tsc --noEmit` et `npx eslint src` sortent en code 0 ; le run de la CI sur ce HEAD (run 45141148244, `push`) est au vert ; seuils de couverture : non exécutés par cette session.
  **À `833c78b`** (réalignement de la limite du repli avec `PORT` absente, 2026-11-23), sous Node 22.23.5 (le projet exige Node >=26 <27) et sous root : `npm ci` échoue ici à la compilation de better-sqlite3, installé par `npm ci --ignore-scripts` ; `npx vitest run` donne 42 fichiers, **1321 verts et 22 sautés** (3000 libre ici : le test de #213 s'est exécuté) ; `npx tsc --noEmit` et `npx eslint src` sortent en code 0 ; le run de la CI sur ce HEAD (run 45147313264, `push`) est au vert ; seuils de couverture : non exécutés par cette session.
  **À `418aa13`** (réalignement d'US-003, 2026-11-25), sous Node 22.23.5 (le projet exige Node >=26 <27) et sous root : better-sqlite3 installé par `npm ci --ignore-scripts` (pas de compilation ; le binaire prébuilt du paquet se charge, les tests qui lancent le hub réel s'exécutent) ; `npx vitest run` donne 43 fichiers, **1620 verts et 22 sautés** (10 dans `index.test.ts` et 12 dans `seed.test.ts`, les tests de permissions) ; `npx tsc --noEmit` et `npx eslint src` sortent en code 0 ; le run de la CI sur ce HEAD (run 45679666346, `push`, `main`) est au vert ; seuils de couverture : non exécutés par cette session.
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
| US-001 — server startup | 9  | 9   | —                                   | —                          | —      |
| US-002 — seed users     | 8  | 8   | —                                   | —                          | —      |
| US-003 — auth token     | 20 | 20  | —                                   | —                          | —      |
| US-004 — themes CRUD    | 40 | ~31 | CA-12 / 12a / 19 / 34               | **CA-35 (405)**            | **CA-30** |
| US-009 — websocket      | 29 | ~25 | CA-12, 22, 26                       | —                          | —      |
| **Total** | **106** | **~93** | **~7** | **1** | **1** |

Ligne US-001 réalignée sur le réel au HEAD `25d2388` (2026-11-18), puis mise à jour après le
`test(startup)` des permissions et de `EACCES`, puis après le `test(startup)` de `JWT_SECRET`
et du `.env`, puis après celui de la création des tables du fichier de zéro octet (2026-11-18),
puis réalignée au HEAD `319d443` (2026-11-23) : CA-4 solide depuis le `test(startup)` du repli sur
le hub réel (#211), puis au HEAD `833c78b` (2026-11-23) : la limite du repli avec `PORT` absente
est levée par le `test(startup)` #213 (décompte inchangé : 9 CA, 9 solides).
Ligne US-002 réalignée sur le réel au HEAD `ef7a221` (2026-11-20) : la spec comptait neuf CA (le
relevé daté en comptait cinq), dont CA-5, CA de couverture alors compté solide au sens du seuil
global ; CA-5 est retiré de la spec le 2026-11-21 (décision #54, #183) : **huit CA** depuis,
CA-1 à CA-4 et CA-6 à CA-9, numérotation conservée, et la ligne passe à 8 CA, 8 solides ;
CA-3 et CA-7, partiels depuis la décision #77, sont solides depuis le `fix(seed)` et le
`test(seed)` du 2026-11-21 (HEAD `33823bf`). Ligne US-003 réalignée sur le réel au HEAD `ed6bd31` (2026-11-22) : la spec compte 19 CA (CA-1 à
CA-17, CA-19 et CA-20 ; CA-18 est retiré par la décision #54, le relevé daté en comptait 18) ;
17 sont solides, CA-1 (le `token_type` du hub réel n'est asserté par aucun test) et CA-2 (le
câblage de `JWT_SECRET` au générateur n'est prouvé par aucun test d'US-003) sont partiels ; les
deux trous du relevé daté (CA-16, CA-17) sont corrigés dans le code et prouvés. **Puis réalignée
au HEAD `418aa13` (2026-11-25)** : la spec compte 20 CA (CA-21, `MAX_REQUESTS_PER_MINUTE`
invalide, s'est ajouté le 2026-11-24, décision #94) ; les 20 sont solides : CA-1 et CA-2 le
deviennent, le `test(authentication)` #210 (2026-11-23) prouvant sur le processus réel le
`token_type` `Bearer` et un token signé avec le `JWT_SECRET` de l'environnement du hub, et CA-21
est solide d'emblée (fonction, processus réel, `.env`). **Les lignes
US-004 et US-009 sont celles du relevé daté (HEAD `5407e38`), non réalignées.** La ligne
**Total** est recalculée à partir des lignes telles qu'elles sont écrites (106 CA ; solides
9 + 8 + 20 + ~31 + ~25 ; partiels 0 + 0 + 0 + 4 + 3 ; trou réel 1 ; faux vert 1) : elle compte
donc encore un trou réel (US-004 CA-35) et un faux vert (US-004 CA-30), alors que ce trou et ce
faux vert sont corrigés dans le code (dettes C et A, §3).

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
>
> **Mise à jour après le `test(startup)` du repli de CA-4 sur le hub réel (2026-11-23, HEAD `319d443`,
> #211)** : un test de plus dans `index.test.ts`, qui ne se saute pas (1320 verts et 22 sautés, 42
> fichiers, sous Node 22.23.5 et sous root ; la CI du HEAD est au vert). CA-4 passe en solide : plus
> aucun CA partiel dans US-001. Aucun code de production n'a changé.
>
> **Mise à jour après le `test(startup)` du repli de CA-4 avec `PORT` absente (2026-11-23, HEAD
> `833c78b`, #213)** : un test de plus dans `index.test.ts` (1321 verts et 22 sautés, 42 fichiers,
> sous Node 22.23.5 et sous root). La limite dite de CA-4 (repli avec `PORT` absente non prouvé
> sur processus réel) est levée ; restent le saut nommé quand 3000 est tenu et la course entre la
> sonde et le lancement. Le décompte des CA ne change pas (9 solides).

- **Solides (9)** :
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
    reporté ; ces constats dépendent de `dotenv` 17.4.0). **Limite dite** : sur le hub, seuls
    les guillemets doubles sont prouvés sur processus réel (`index.test.ts`) ; les
    guillemets simples et les accents graves ne le sont que sur le seed (`seed.test.ts`),
    autour de blancs seuls, et sur aucun des deux autour d'une valeur qui n'est pas faite
    de blancs (dette `DEBTS.md`).
  - **CA-4** (repli `localhost:<PORT>`, sortie standard) : `server.test.ts` (`describe('CA-4`)
    prouve le repli au niveau `QuizServer` (sans interface, avec seulement loopback et IPv6,
    avec le port configuré, pas toujours 3000). `index.test.ts` le prouve sur processus réel
    depuis le `test(startup)` du 2026-11-23 : un module préchargé (`NODE_OPTIONS=--import`,
    `src/test-support/loopback-only-network.mjs`, inerte sans `LOOPBACK_ONLY_NETWORK=1`) fait
    voir au hub une machine sans IPv4 non-loopback (une IPv4 loopback et une IPv6 non-loopback),
    sur n'importe quelle machine ; le repli `localhost:<PORT>` est écrit une seule fois sur la
    sortie standard, aucune ligne ne porte 3000, la sortie d'erreur ne contient pas `localhost`.
    Le test ne se saute pas. **Mutants rejoués par cette session** sur `quiz-server.ts`, tous
    tués : port figé à `3000`, port retiré, repli sur `console.error`, filtre IPv4 retiré (l'IPv6
    serait choisie), filtre `internal` retiré (`127.0.0.1` choisi), repli sur `127.0.0.1` ; tous
    restaurés. **Limite dite** : le repli avec `PORT` absente (exemple du CDC, non normatif,
    `http://localhost:3000`) est prouvé sur processus réel depuis le `test(startup)` du 2026-11-23
    (#213, CA-4 combiné à CA-5, `index.test.ts`) : même module préchargé, `PORT` retirée de
    l'environnement, le hub écoute sur 3000 et écrit une seule fois `localhost:3000` sur la
    sortie standard, rien de `localhost` sur la sortie d'erreur. Ce qui reste vrai : le test
    **se saute avec un nom explicite** quand une sonde préalable (`defaultPortSkipReason`) trouve
    3000 tenu ou impossible à ouvrir sur la machine, il ne s'exécute alors pas ; et une **course**
    reste possible entre la sonde et le lancement du hub (un autre processus qui prendrait 3000
    entre les deux ferait échouer le test, le code n'a pas de garde contre cela). Le mutant « port
    du repli figé à `3000` » survit à ce test seul (équivalent pour `PORT` absente) ; il est tué
    par le test du CA-4 à port libre autre que 3000 (dette `DEBTS.md`).
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
  - **Test fragile constaté, périmé** : au relevé du 2026-11-18, `US-001/CA-5 listens on the
    port written in PORT` assertait que la console contenait le port dès que le port acceptait
    des connexions, avant que l'annonce soit forcément écrite (échec une fois sur trois suites
    complètes). Au HEAD `319d443`, ce test attend l'annonce (`waitForStartupAnnouncement`) avant
    d'asserter ; une suite complète au vert (2026-11-23), non rejouée en série.

### US-002 — Seed des utilisateurs (8 CA : CA-1 à CA-4 et CA-6 à CA-9)

> **Réalignement du 2026-11-21 (`refactor(users)`, HEAD `76c7eed`)** : CA-5 (couverture ≥ 90 %) est
> retiré de la spec d'US-002 par le `docs(specs)` #183 (décision #54, numérotation conservée) ; la
> section et le décompte suivent : **8 CA, 8 solides**, plus de ligne CA-5 ci-dessous. Le seuil
> global de 90 % reste appliqué par la CI (décision #67) ; `seed.ts` reste à 0 % parce que le
> processus enfant n'est pas instrumenté (comme `index.ts`), non parce qu'il n'est pas testé.
> Aucun autre CA n'est touché.

> **Réalignement du 2026-11-21 (`docs(specs)`, HEAD `33823bf`)** : la spec d'US-002 écrit, à CA-3
> et CA-7, le tout ou rien (onze comptes ou aucun, arrêt brutal compris) et le comportement de
> l'instance perdante d'une course (rien modifié, ligne du CA-7, code `0`, sortie d'erreur vide) :
> décision #77, puis #79 pour le sens seul de la ligne de la perdante et la table laissée par un
> arrêt avant tout compte. **Le code les tient** depuis le `fix(seed)` (#174, décision #78) :
> `SqliteUserRepository.insertAllIfEmpty` recompte puis écrit les onze comptes dans une seule
> transaction immédiate, et `SeedUsers` n'annonce le succès que si elle a écrit. Les deux CA
> reviennent donc dans les solides (« Solides (8) »), prouvés sur processus réels par le
> `test(seed)` (#175) et rejoués ici (mutants du CA-7) ; le reste de la section date du HEAD
> `ef7a221`. Aucun code ni test n'a changé.

> **Section réalignée sur le réel au HEAD `ef7a221` (2026-11-20)**, avec la méthode du
> fichier (spec, code de production, corps des tests). La spec comptait alors neuf CA (CA-5 est retiré depuis, voir la note ci-dessus ; le relevé
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
  - **CA-4** (politique de mot de passe) : bien prouvé sur processus réel : chacun des onze
    comptes dont le mot de passe n'est pas défini, `admin` et `quiz_buzzer_10` avec huit
    valeurs refusées (chaîne vide, 11 et 73 caractères, tabulation, saut de ligne, caractère
    hors ASCII, 12 et 72 espaces) et quatre acceptées (12 et 72 caractères, onze espaces puis
    un caractère, un caractère puis 71 espaces) : code `1`, sortie standard vide, une seule
    ligne à préfixe, un seul compte nommé, pas de pile, mot de passe jamais repris, aucun
    compte, base conservée ; une copie non éditée de `.env.example` est refusée (décision #75)
    et acceptée une fois les placeholders remplacés ; règles unitaires dans
    `owasp-password-validator.test.ts`. **Bornes du jeu de caractères** (session `test(users)` du 2026-11-20, après le HEAD `ef7a221`, départ `9bb9a4e`) : `owasp-password-validator.test.ts` refuse U+007F (juste au-dessus de U+007E) et U+001F (juste sous U+0020), en tête, à l'intérieur et en fin d'un mot de passe de 12 caractères, après onze espaces, et seuls sur 12 caractères ; U+007E et U+0020 sont acceptés (`~` et espaces aux unités). Mutants rejoués le 2026-11-20 sur `PRINTABLE_ASCII` de `owasp-password-validator.ts` (`\x20-\x7E` devenu `\x20-\x7F`, puis `\x1F-\x7E`) : **tués tous les deux**, chacun par ses tests de borne (cinq échecs chacun). Niveau du test : validateur seul, le plus petit qui tue les mutants ; ni le service ni le processus réel ne refont ce contrôle.
  - **CA-3** (idempotence, tout ou rien) : un second lancement avec d'autres mots de passe
    valides et un autre `BCRYPT_COST` laisse les onze comptes identiques, hashs compris (coût
    `04` de la première passe) ; les tests du CA-7 comparent en plus le fichier (sha256) avant et
    après. Un seul compte déjà présent suffit à empêcher toute insertion (CA-7). **Tout ou rien
    (décisions #77 et #78)** : sur processus réel (`src/seed-all-or-none.test.ts`, module
    préchargé `src/test-support/seed-probe.mjs`), un seed tué par `SIGKILL` juste après le 1er,
    le 2e, le 5e, le 10e et le 11e `INSERT`, puis juste après le `COMMIT` (six cas ; le marqueur
    écrit avant l'arrêt prouve que le point est atteint) laisse zéro ou onze comptes, sortie
    standard vide, et le lancement suivant sort en code `0` et finit avec onze comptes. Le mutant
    « pas de transaction » est tué par ces cas selon le handoff du `test(seed)` du 2026-11-21 ;
    **non rejoué ici**. **Limites dites** : la table peut être absente ou présente et vide après un
    arrêt avant tout compte, la spec ne l'impose pas (décision #79, constat reporté) et aucun test
    ne l'asserte (le module préchargé ne sait arrêter qu'après un `INSERT` ou le `COMMIT`) ;
    sondé sous Linux, Node 22, root, disque local, ni Windows ni disque réseau.
  - **CA-7** (table non vide) : sur processus réel, un second lancement sort avec le code
    `0`, une ligne sur la sortie standard, la sortie d'erreur vide, le fichier et les comptes
    inchangés ; même ligne, même issue avec un mot de passe trop court, vide ou absent, un
    `BCRYPT_COST` invalide ou les deux (le CA-7 passe avant les CA-4 et CA-6) ; une table qui
    ne porte qu'un compte est ignorée aussi, avec ou sans fautes (cas constaté : depuis le tout ou
    rien, il ne survient plus que pour une base laissée partielle par un seed antérieur à la
    décision #78 ; l'assertion reste vraie). Sur base en lecture seule qui a ses comptes : même
    ligne, fichier et dossier intacts (décision #72, tests sautés en root). **Course (décisions
    #77 et #78)** : deux seeds réels, avec des mots de passe différents, qui se retrouvent après
    avoir lu la table vide puis dans leur transaction (rendez-vous par fichiers : les quatre
    marqueurs sont assertés, la course est donc réelle) : les deux sortent en code `0`, sortie
    d'erreur vide, une ligne chacun ; onze comptes exactement, tous du même lancement (les hashs
    le disent) ; la ligne de la perdante diffère de celle du gagnant. Seul le sens de la ligne est
    normatif (décision #79) : il n'est pas asserté mot à mot, comme celui du CA-7 (dette de la
    décision #66). **Mutants rejoués le 2026-11-21 sur `insertAllIfEmpty`** (code restauré, arbre
    propre) : transaction différée (`.deferred` au lieu de `.immediate`) et recomptage supprimé
    (`count !== 0` ignoré) : **tués tous les deux** par le test de la course (un échec chacun,
    `src/seed-all-or-none.test.ts`, 7 tests au vert sur le code réel). Les deux autres mutants du
    handoff du `test(seed)` (écriture hors transaction ; `written` ignoré) : non rejoués ici.
    **Verrou tenu par un autre processus** (décision #80, constat reporté, pas une règle) : le
    seed dont l'écriture n'obtient pas le verrou dans le délai de la base (5 s) sort en code `1`,
    `User seeding failed: database is locked`, rien d'écrit ; verrou relâché avant la fin du
    délai : il réussit (sondé le 2026-11-21, Linux, Node 22, root). Aucun test ne l'asserte ;
    dette de `DEBTS.md`.
- **Hors CA** :
  - **Atomicité de l'idempotence (« Points de vigilance »)** : tranchée par la décision #77
    (2026-11-21), déplacée dans CA-3 et CA-7 (« Solides » ci-dessus), codée par le `fix(seed)`
    (décision #78) et prouvée sur processus réels. Plus d'écart ; la spec n'a plus de paragraphe
    « Écart connu ». Restent dans `DEBTS.md` (`infrastructure/ & composition`) : le constat du
    verrou d'écriture tenu par un autre processus (décision #80), et les deux issues de la table
    après un arrêt avant tout compte (décision #79), non assertés.
  - **UUIDv7** (périmètre de la spec) : onze identifiants de version 7 sondés, puis prouvés par
    `seed-users.test.ts` (bloc « identifiants stockés » : onze `USR_ID` relus en base, version 7
    et distincts ; mutation `uuidv7()` remplacé par `randomUUID()` tuée). Plus d'écart inscrit
    sur ce point.
  - **`.env` non versionné** (CA-2, « Format du fichier `.env` ») : `.gitignore` porte `.env` et
    seul `.env.example` est suivi par git (constaté à la main ; aucun test). Même ligne de
    `DEBTS.md` (`infrastructure/ & composition`, « Seed (US-002) : `.env` non versionné, non
    testé »).

### US-003 — Token d'authentification (20 CA : CA-1 à CA-17 et CA-19 à CA-21)

> **Section réalignée sur le réel au HEAD `418aa13` (2026-11-25)**, avec la méthode du fichier
> (spec, code de production, corps des tests), à partir du réalignement du HEAD `ed6bd31`
> (2026-11-22). Le relevé daté comptait 18 CA (CA-1 à CA-18) ; la spec en compte 20 : CA-18
> (couverture) est retiré par la décision #54 (numérotation conservée, il n'y a pas de CA-18),
> CA-19 et CA-20 (démarrage : `JWT_SECRET`, `JWT_EXPIRATION`) se sont ajoutés (décisions #40 et
> #42), puis CA-21 (`MAX_REQUESTS_PER_MINUTE` invalide, décision #94, 2026-11-24). Suite concernée :
> `authentication/token-route.test.ts` (plugin des tokens seul, `inject`, services simulés : 86
> tests), `jwt-generator.test.ts` (6), `jwt-settings.test.ts` (23), `authentication-service.test.ts`
> (6, sans étiquette d'US), `users/sqlite-user-repository.test.ts` (sans étiquette d'US),
> `common/read-max-requests-per-minute.test.ts` (23), `server.test.ts` (serveur assemblé),
> `index.test.ts` (processus réel : `tsx src/index.ts` lancé en `spawn`, environnement explicite,
> base jetable), `env-example.test.ts` et `common/process-environment.test.ts`. Run du 2026-11-25
> (Node 22.23.5, root) : 43 fichiers, 1620 verts, 22 sautés (10 dans `index.test.ts` et 12 dans
> `seed.test.ts`, les tests de permissions). Un CA n'est *solide* que si chacun de ses
> comportements est prouvé par une assertion qui mord. Les « mutants » sont des modifications de
> production rejouées sous les tests puis annulées. **Rejoués par cette session (2026-11-25), tous
> tués et annulés (`git status` propre)** : ceux du CA-1, du CA-2, de la comparaison factice
> (« Hors CA »), du `null` (CA-9 et CA-10), du `charset` (CA-7) et d'`OPTIONS` (CA-16), chacun sous
> le ou les fichiers de test qui le visent. **Toute autre mention « mutants rejoués et tués » est
> celle du réalignement du 2026-11-22 (HEAD `ed6bd31`) ; celles qui viennent des PR ou de
> `DEBTS.md` sont dites telles : non rejouées ici.** Les constats « sondé à la main » et les smoke
> tests d'Olivier viennent des décisions et des handoffs, non rejoués ici. Un CA dont la cellule dit
> « périmé » contredit le relevé daté ou le réalignement précédent.

- **Solides (20)** :
  - **CA-1** (`200`, token, durée, type) : `token-route.test.ts` (`CA-01`) asserte le corps exact
    `{ token, expires_in, token_type }` en snake_case (décision #15), générateur simulé ;
    `authentication-service.test.ts` rend l'utilisateur pour de bons identifiants et `undefined`
    sinon ; `sqlite-user-repository.test.ts` retrouve l'utilisateur par login. **Sur processus réel**
    (`index.test.ts`, `describe('hub token (token_type and JWT_SECRET)')`, test `US-003/CA-1`), un
    `POST /api/v1/token` du compte `admin` seedé répond `200` et `token_type` vaut `Bearer`
    (`test(authentication)` #210, 2026-11-23) ; la durée l'est par `expires_in` et `exp - iat`
    (voir CA-4). `JwtGenerator` écrit `tokenType: "Bearer"` en dur ; `jwt-generator.test.ts` ne lit
    toujours pas le champ. **Périmé : « le `token_type` du hub réel n'est asserté par aucun test »**
    (constat du HEAD `ed6bd31`, où le mutant `"Bearer"` → `"Basic"` survivait : 1278 verts, 22
    sautés). Mutant rejoué par cette session (`"Bearer"` → `"Basic"` dans `jwt-generator.ts`, test
    de processus seul) : **tué** (`expected 'Basic' to be 'Bearer'`). Le smoke test d'Olivier du
    2026-11-21 l'assertait déjà (NR-3, `docs/sessions/2026-11-21-1537.md`), hors dépôt, non rejoué.
  - **CA-2** (HS256, vérifiable avec `JWT_SECRET`) : `jwt-generator.test.ts` : l'en-tête décodé
    porte `alg: HS256` et `jwt.verify(token, secret)` accepte le token ; mutant `HS512` tué
    (2026-11-22) ; `jwt-settings.test.ts` : l'ancien nom `JWT_SECRET_KEY` est ignoré. **Sur
    processus réel** (`index.test.ts`, même `describe`, test `US-003/CA-2`, #210) : le token d'un
    vrai `POST /api/v1/token`, avec un `JWT_SECRET` propre au test (différent du secret par défaut
    de `startHub`), a `alg: HS256`, se vérifie avec ce secret (`algorithms: ['HS256']`) et
    **seulement** avec lui : la vérification avec le secret par défaut lève `invalid signature`. Le
    câblage d'`index.ts` (`new JwtGenerator(jwtSettings.secret, …)`) est donc prouvé par un test
    d'US-003. **Périmé : « aucun test d'US-003 ne prouve que le hub réel signe avec `JWT_SECRET` »**
    (HEAD `ed6bd31` : le mutant survivait sous root, et n'était tué sous non-root que par hasard,
    par un test d'US-001/CA-9). Mutant rejoué par cette session (le générateur d'`index.ts` reçoit
    `jwtSettings.secret + "x"`, test de processus seul) : **tué** (`invalid signature`).
  - **CA-3** (`sub`, `role` en libellé, `iat`, `exp`) : `jwt-generator.test.ts` (`describe CA-003`,
    trois tests) : les quatre claims sont présents ; `role` vaut `"buzzer"` pour un joueur et
    `"admin"` pour un administrateur ; `sub` est l'identifiant de l'utilisateur. Mutants rejoués
    et tués : rôle numérique (`user.role` à la place de `toRoleLabel`), `sub` = login.
    **Périmé : « `role` à la valeur enum numérique »** : corrigé par le `fix(authentication)` #70
    (2026-11-10, décision #28). `sub` est un UUIDv7 en production parce que le seed l'écrit
    (`seed-users.test.ts`, « version-7 UUID » pour les onze comptes) ; le générateur est testé avec
    l'identifiant `"123"`. `iat` et `exp` : présence seule ici, `exp - iat` est prouvé au CA-4. Le
    rôle d'un token émis par le hub réel n'est lu par aucun test de processus (sondé à la main le
    2026-11-10, décision #28).
  - **CA-4** (3600 s par défaut, `JWT_EXPIRATION` en secondes) : sur processus réel
    (`index.test.ts`, `describe('hub token lifetime (JWT_EXPIRATION)')`, six tests), le token d'un
    vrai `POST /api/v1/token` vit `exp - iat` secondes et `expires_in` les redit : 3600 sans
    variable, 7200 avec `JWT_EXPIRATION=7200`, 5400 lu du `.env` du dossier de travail ;
    l'environnement réel l'emporte sur le `.env` ; une variable vide, dans l'environnement ou sur
    une ligne de `.env`, donne 3600 (CA-20). La règle de la valeur est prouvée par
    `jwt-settings.test.ts` (défaut, lecture, ancien nom `JWT_EXPIRATION_TIME` ignoré) ;
    `.env.example` écrit `# JWT_EXPIRATION=3600` (`env-example.test.ts`). Mutants rejoués et tués :
    `exp` à durée + 1 (processus), `expires_in` à durée + 1 (processus), câblage d'`index.ts` figé
    à 3600 (processus), défaut à 3601 (`jwt-settings.test.ts`). **Périmé : « le générateur ne
    prouve pas que `exp - iat` égale la durée »** : vrai du seul test du générateur (le mutant
    `durée + 1` y survit, 6 verts), mais le processus réel le prouve depuis les
    `test(authentication)` #192, #196 et #199 (2026-11-21 et 2026-11-22).
  - **CA-5** (endpoint non protégé) : `token-route.test.ts` (`CA-05`) : `200` sans
    `Authorization`, mais le plugin est monté seul (sans middleware), ce qui ne prouve pas
    l'absence de protection sur le serveur assemblé ; sur processus réel, tous les `POST` de
    `index.test.ts` vers `/api/v1/token` partent sans `Authorization` et répondent `200`.
  - **CA-6 et CA-12** (champs inconnus → `400 UNKNOWN_FIELDS`) : `token-route.test.ts`
    (`describe CA-06 (CA-12)`, trois tests) : un champ en trop → `400`, `UNKNOWN_FIELDS`, message
    `Unknown field(s): extra.` (forme de `error-codes.md`), tous les champs inconnus nommés
    (`first, second`), `authenticate` jamais appelé. Mutants rejoués et tués : code changé,
    `additionalProperties` retiré. **Périmé : « code `UNKNOWN_FIELDS` non asserté »** : il l'est, dans
    le corps complet. Il n'existe pas d'étiquette `US-003/CA-12` : la spec écrit deux fois la même
    règle (CA-6 et CA-12) et les tests portent « (CA-12) » dans le `describe` du CA-6. Le cumul
    avec un champ manquant, vide ou `null` est fixé par la décision #84 (`VALIDATION_ERROR`
    d'abord, un champ mal typé avant les deux) : codé par le `fix(authentication)` #206
    (2026-11-22, manquant, vide et mal typé) et #208 (`null`), prouvé par le `describe` « decision
    #84, rank 5 before rank 6 » (six tests : `username` et `password` manquant, vide ou `null`,
    avec un champ en trop, `authenticate` jamais appelé) et par le test « the type of a field before
    an unknown field » ; l'écart du code au CDC relevé le 2026-11-22 est soldé. La branche des
    champs inconnus est la dernière de la garde, sans test de la liste vide (`DEBTS.md`).
  - **CA-7** (`Content-Type` autre que JSON → `415`) : `token-route.test.ts`
    (`describe CA-07`,
    dix-neuf tests) : `application/xml` et `text/plain` → `415`, corps natif de Fastify
    `{ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error, message, statusCode: 415 }` (décision #11) ;
    `Content-Type` absent, avec ou sans corps, et présent mais vide, avec ou sans corps → même
    `415`, `authenticate` jamais appelé (décision #82). Mutants rejoués et tués : garde de l'absence
    retirée (`onRequest: rejectUnsupportedContentType`, ex-`rejectMissingContentType`), parseur `text/plain` conservé. Codé par
    `fix(authentication)` #193 (`text/plain`) et #195 (absence), 2026-11-21 et 2026-11-22.
    `charset` autre qu'`utf-8` → même `415` (décision #89, `fix(authentication)` #217, 2026-11-23) :
    trois refus (`iso-8859-1`, `utf-16`, et `Application/JSON; CHARSET=ISO-8859-1`) et neuf
    `Content-Type` acceptés en `200` (`charset=utf-8` en toutes casses, avec ou sans espace, entre
    guillemets, un paramètre inconnu avant ou après, `Application/JSON` seul et
    `application/json; foo=bar` seul, `test(authentication)` #218, décision #89 points 2 et 4).
    Sur le serveur assemblé, un `POST` au `Content-Type` non conforme garde son `415`
    (`server.test.ts`, test témoin du `describe` du `405`). Mutant rejoué par cette session
    (contrôle du `charset` retiré) : **tué** (3 rouges sur 86).
  - **CA-8** (`401 INVALID_CREDENTIALS`) : `token-route.test.ts` (`CA-08`) : `401`, corps
    `{ status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' }`. Le même corps
    répond au login inconnu et au mauvais mot de passe parce que le service rend `undefined` dans les
    deux cas (`authentication-service.test.ts`, deux tests sans étiquette) et que la route n'a
    qu'une branche. Mutant rejoué et tué : message changé. Le point de vigilance du CDC sur le
    temps de réponse n'est pas un CA : voir « Hors CA » plus bas.
  - **CA-9 et CA-10** (`username` / `password` manquant, `null` ou vide → `400 VALIDATION_ERROR`) :
    `token-route.test.ts`, sept `describe` (quarante-quatre tests) : `CA-09` et `CA-10` (quatre
    tests chacun) : champ manquant → `400 VALIDATION_ERROR` (`Username is required.` / `Password
    is required.`), champ vide → même réponse, `authenticate` jamais appelé ; « decision #86, rank
    5 » (huit tests) : un champ `null` compte comme manquant, même message ; « decision #85, rank
    5 » (deux tests) : seul `Username` est nommé quand les deux champs manquent (`{}`) ou sont
    vides ; « decision #85, rank 4 » : un champ qui n'est ni une chaîne ni `null` (nombre,
    booléen, tableau, objet) → `Username must be a string.` / `Password must be a string.`, avant
    un champ manquant, vide ou inconnu et, quand les deux sont mal typés, `username` seul
    (quatorze tests) ; un corps JSON qui n'est pas un objet (`null`, `[]`, tableau non vide,
    chaîne, nombre, booléen) → `Request body must be a JSON object.` (six tests). Les libellés
    sont normatifs (décision #85, 2026-11-22). Codé par le `fix(authentication)` #206 (ordre, type
    et corps non objet) et #208 (`null` lu comme manquant, décisions #86 et #87). Mutants rejoués et
    tués (2026-11-22) : `minLength` retiré (un par champ), `required` retiré. Mutant rejoué par
    cette session (le `null` n'est plus lu comme manquant) : **tué** (6 rouges sur 86).
    **Périmé : « le champ de mauvais type et un corps qui n'est pas un objet répondent le corps
    natif de Fastify »** : corrigé par #206 ; l'écart consigné dans `DEBTS.md` est soldé. Le test
    de #215 (`test(authentication)`) prouve la réponse quand les deux champs manquent.
  - **CA-11** (JSON invalide → `400 INVALID_JSON`) : `token-route.test.ts` (deux `describe` d'un
    test) : un JSON tronqué (`{"username":`) → `400`, `INVALID_JSON`, `Request body must be valid
    JSON.` ; un corps vide avec `Content-Type: application/json` → même réponse. Mutants rejoués
    et tués : code du corps vide retiré de la liste, message changé. **Périmé : « teste body absent,
    pas JSON malformé »** : le JSON malformé l'est (traduction des deux codes Fastify par le
    gestionnaire d'erreurs du plugin, `fix(authentication)` du 2026-11-07 selon `DEBTS.md`) ; dette H.
  - **CA-13** (100 requêtes par minute et par IP, `429 RATE_LIMIT_EXCEEDED`, `Retry-After: 60`) :
    **le compteur n'est plus celui du plugin des tokens.** Depuis le `feat(errors)` #240
    (2026-11-25, décision #96), un seul `@fastify/rate-limit` compte toute l'API par adresse,
    les tokens comprises (une requête n'use qu'une unité, quelle que soit sa réponse) ; les sept
    tests de `token-route.test.ts` (`CA-13`, limite injectée) sont retirés avec lui et le plugin
    des tokens monté seul ne porte plus de limite. Preuves au réel :
    - **règle de la valeur** (`read-max-requests-per-minute.test.ts`, deux tests `CA-13`) : `100`
      quand `MAX_REQUESTS_PER_MINUTE` est absente, la valeur écrite sinon ;
    - **serveur assemblé** (`server.test.ts`, limite 3) : `describe` « decision #96 » (seize
      tests) : un seul compteur pour tokens, thèmes et route inconnue (la 4ᵉ requête, d'une famille
      ou d'une autre, est refusée), `401`, `400`, `403`, `404` et `405` comptés une unité chacun,
      `429` au corps standard `Too many requests. Please retry in 60 seconds.` avec `Retry-After:
      60`, **par adresse** (`remoteAddress` : une adresse refusée, une autre servie), `/health` et
      `/ws` ni comptés ni refusés (comportement actuel figé, CDC muet) ; `describe` « decision #97 »
      (six tests, `test(errors)` #242) : l'adresse comptée est celle de la connexion
      (`X-Forwarded-For` ignoré), la fenêtre est fixe, rouverte à +60 s, un refus ne la prolonge pas ;
      `describe` « decision #36 » (trois tests, `test(errors)` #243, `Date` simulée seule) :
      `Retry-After: 60` d'un `429` obtenu à +3 s de la première requête, sur `POST /api/v1/token`,
      thèmes et questions ;
    - **processus réel** (`index.test.ts`, `describe('hub token rate limit
      (MAX_REQUESTS_PER_MINUTE)')`, cinq tests) : sans variable, la 101ᵉ requête d'une même adresse
      reçoit `429`, `Retry-After: 60` et le corps standard (`test(authentication)` #197 : le défaut
      100 est câblé) ; avec `MAX_REQUESTS_PER_MINUTE=3` dans l'environnement du processus, la 4ᵉ
      (#229) ; `3` dans un `.env` du dossier de travail et absente de l'environnement réel, la 4ᵉ ;
      `.env` à 5 et environnement réel à 3 : la limite est celle de l'environnement réel ; `.env`
      vide et environnement réel à 3 : 3 (CA-21) (#235).
    Mutants : ceux du plugin (`Retry-After` à 59, limite retirée du plugin, limite câblée à 99) sont
    ceux du 2026-11-22 et visaient un compteur qui n'existe plus ; ceux de #229, #235, #240, #242 et
    #243 sont cités par `DEBTS.md` et les PR, non rejoués ici. **Périmé : « une valeur explicite de
    `MAX_REQUESTS_PER_MINUTE` sur le hub réel et l'IP vue derrière un proxy non prouvées »** : la
    valeur est prouvée par #229 et #235 ; l'adresse est tranchée par la décision #97 (adresse de la
    connexion) et prouvée sur le serveur assemblé (#242). Reste non prouvé (`DEBTS.md`) : le
    `Retry-After: 60` d'un `429` retardé **sur le hub réel** (l'horloge d'un processus enfant n'est
    pas simulable ; prouvé sur le serveur assemblé), les guillemets, blancs et ` #` d'un `.env` pour
    cette variable (CDC muet), `/health` et `/ws` dans ou hors compteur (non décidé).
  - **CA-14 et CA-15** (logs de connexion : contenu et niveau) : `token-route.test.ts` (`describe
    CA-14, CA-15 et CA-17`, logger Pino capturé) : une connexion réussie écrit une ligne de niveau
    INFO (30) qui porte le `username` et l'IP ; un mauvais mot de passe et un login inconnu écrivent
    une ligne de niveau WARN (40) qui porte le `username` tenté et l'IP ; pas de ligne WARN sur un
    succès, pas de ligne INFO sur un échec. Les lignes sont retrouvées par les valeurs qu'elles
    portent (le `username` et l'IP comme valeurs de champs), jamais par le nom des champs ni par la
    forme (US-022, décision #81). Mutants rejoués et tués : log de succès retiré, `warn` → `info`,
    `username` retiré du log d'échec, IP retirée. **Périmé : « aucun test ne les capture »** :
    `test(authentication)` #187 (2026-11-21). La forme de la ligne (`event`, `timestamp`) n'est pas
    exigée (décision #81) : elle n'est pas testée.
  - **CA-16** (`405 METHOD_NOT_ALLOWED`, `Allow: POST`, corps jamais jugé) : `server.test.ts`
    (serveur assemblé), trois `describe` : route publique (trois tests) : `PUT`, `GET` et `DELETE`
    sans token → `405`, `Allow: POST`, corps standard `HTTP method <M> is not allowed on this
    resource.` (`feat(errors)` #89, 2026-11-11, décisions #31 à #33 et #38,
    `routes/not-found-route.ts` ; `GET` et `DELETE` ajoutés par #210) ; « decisions #90 and #93 » :
    pour `PUT`, `DELETE`, `PATCH` et `OPTIONS`, sept tests chacun : le même `405` avec un corps
    JSON invalide, vide ou valide, avec un `Content-Type` `text/plain`, `application/xml` ou
    `application/json; charset=latin1` (jamais `415`) et avec une chaîne de requête, plus cinq tests
    du bloc (un `PUT` et un `OPTIONS` à corps invalide comptent dans la limite, `429` au-delà ; trois
    contrôles : un `POST` à JSON invalide garde `400 INVALID_JSON`, un `POST` au `Content-Type` non
    conforme garde `415`, un `PUT` à corps invalide sur une route inconnue garde le `400` natif) ;
    « decision #93 » : `HEAD`, huit tests : `405` et `Allow: POST` avec un corps JSON invalide, vide
    ou valide, sans corps ni `Content-Type`, avec un `Content-Type` non conforme, avec une chaîne de
    requête (statut et `Allow` seulement : une réponse `HEAD` n'a pas de corps). Codé par le
    `fix(authentication)` #220 (méthode autre que `POST`, corps jamais lu, 2026-11-23, décision
    #90), le `fix(errors)` #227 (`OPTIONS`, 2026-11-24) et le `test(errors)` #228 (`HEAD`, déjà
    conforme, décision #93). Mutant rejoué par cette session (`OPTIONS` retiré des méthodes
    traitées avant le corps, `not-found-route.ts`, `server.test.ts` seul) : **tué** (53 rouges sur
    225 : les tests d'`OPTIONS` du token, des thèmes et des questions) ; ceux du 2026-11-22 (en-tête
    `Allow` retiré : 7 tests rouges ; route des tokens non publique : le test du token passe à
    `401`) ne sont pas rejoués. **Périmé : « absent (ni code ni test) »** et **« écart décidé le
    2026-11-23 (décision #90), non codé, non testé »** : codé et testé. Non testés sur le token :
    `TRACE`, `CONNECT` et les méthodes inconnues (`DEBTS.md`, ligne « `405` : segment vide non
    testé »).
  - **CA-17** (`500 INTERNAL_SERVER_ERROR` sans détail technique, erreur journalisée au niveau
    `ERROR`) : `token-route.test.ts` (`describe CA-17`, cinq tests ; quatre autres dans le
    `describe` du log) : une erreur du service d'authentification, une erreur du générateur, une
    erreur portant le code 503 et une erreur portant le code 302 → `500`, corps `{ status: 500,
    error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred. Please try again
    later.' }` ; ni le message ni la pile dans la réponse ; la ligne `ERROR` (50) porte le message et
    la pile de l'erreur, une seule fois ; aucune ligne `ERROR` quand le client est en tort (`415`) ; le `Content-Type` de la réponse est de type `application/json`, `charset` non imposé (cinquième test, `test(authentication)` #222, décision #91 ; le corps exact et l'absence de détail technique sont ceux de la décision #91).
    Mutants rejoués et tués : `request.log.error` retiré, un statut 5xx traité en erreur client,
    statut du corps changé. **Périmé : « aucun `try/catch` dans `token-route` »** : le
    `setErrorHandler` du plugin répond le `500` standard (`fix(authentication)` #185, 2026-11-21) et
    journalise (`fix(authentication)` #201, 2026-11-22, décision #83). Smoke tests d'Olivier : 17
    PASS (`docs/sessions/2026-11-21-1537.md`), puis 15 PASS et 1 FAIL imputé au script
    (`docs/sessions/2026-11-22-1500.md`) ; rapportés par les handoffs, non rejoués. Le champ et le
    format de la ligne ne sont pas fixés : `DEBTS.md`.
  - **CA-19** (`JWT_SECRET` absent, vide ou de moins de 32 caractères : le hub refuse de
    démarrer) : `jwt-settings.test.ts` (six tests `CA-19`) : absent, vide et 31 caractères refusés,
    32 acceptés, valeur jamais reprise dans le message, secret rapporté avant l'expiration. Sur
    processus réel (`index.test.ts`, `describe('hub startup: JWT_SECRET')`, sept tests étiquetés
    `US-001/CA-1`, plus deux dans `describe('hub startup: an unedited copy of .env.example')`) :
    secret absent, vide ou de 31 caractères → code `1`, `Server starting failed: JWT_SECRET …` avec
    `32` sur la sortie d'erreur, sans pile ni valeur, sortie standard vide, rien n'écoute, aucune base
    créée ; secret lu du `.env`, l'environnement réel l'emporte ; copie non éditée de `.env.example`
    refusée (`JWT_SECRET` sans valeur, décision #76 ; `env-example.test.ts`). Mutants rejoués et
    tués : minimum à 31 (`jwt-settings.test.ts`), `readJwtSettings` contourné dans `index.ts` (12
    tests rouges des `describe` JWT du processus). Le texte après le préfixe n'est pas normatif
    (exemple du CA-19) : le préfixe, `JWT_SECRET` et `32` sont assertés.
  - **CA-20** (`JWT_EXPIRATION` invalide : même refus) : `jwt-settings.test.ts` (douze tests
    `CA-20`) : valeurs non numériques, `3600s`, `1.5`, `1e3`, `0`, `-5`, ` 3600`, `3600 `, `+3600`,
    `1,5`, `3600\n` refusées, valeur jamais reprise dans le message. Sur processus réel
    (`index.test.ts`, `describe('hub startup: JWT_EXPIRATION')`, dix tests) : les sept valeurs du CA
    refusées (code `1`, `JWT_EXPIRATION`, « integer », « positive » et « seconds » sur la sortie
    d'erreur, rien n'écoute) ; absente, vide et un entier de vingt chiffres démarrent (aucune borne
    haute, décision #42) ; vide donne 3600 (deux tests de durée, voir CA-4). Mutants rejoués et
    tués : `0` accepté, `readJwtSettings` contourné. Prouvé par `test(startup)` #189 (2026-11-21) et
    `test(authentication)` #199 (2026-11-22). Un `exp` absurde pour vingt chiffres est une dette
    assumée (`DEBTS.md`).
  - **CA-21** (`MAX_REQUESTS_PER_MINUTE` définie mais invalide : le hub refuse de démarrer) :
    `read-max-requests-per-minute.test.ts` (vingt et un tests `CA-21`, sur vingt-trois) : refusées,
    les valeurs de la décision #94 (chaîne vide, `abc`, nombre suivi de lettres, décimal, notation
    exponentielle, `0`, `00`, négatif, `+5`, espace en tête ou en fin, blancs seuls, `2147483648`)
    et, en plus, hexadécimal, chiffres non ASCII, séparateur de chiffres, très longue suite de
    chiffres ; acceptées, `1`, `2147483647` et `0100` (qui vaut 100) ; la valeur n'est jamais
    reprise dans le message. Sur processus réel (`index.test.ts`,
    `describe('hub startup: MAX_REQUESTS_PER_MINUTE')`, trente et un tests) : les douze valeurs de
    la décision refusées (code `1`, `Server starting failed: MAX_REQUESTS_PER_MINUTE must be an
    integer between 1 and 2147483647, written with digits only.` sur la sortie d'erreur, une seule
    ligne d'échec, ni pile ni valeur, sortie standard sans la variable, rien n'écoute, aucune base
    créée) ; sept valeurs non reprises dans la console ; absente, `1`, `0100` et `2147483647` : le hub
    écoute ; l'ordre des refus (`JWT_SECRET`, `JWT_EXPIRATION` et `PORT` avant, `SQLITE_DB_PATH`
    vide ou dans un dossier inexistant après) ; `MAX_REQUESTS_PER_MINUTE=` vide dans un `.env` et
    absente de l'environnement réel : refusé comme toute chaîne vide ; vide dans le `.env` et `3`
    dans l'environnement réel : le hub écoute et applique 3 (voir CA-13). Le seed ignore la variable
    (US-002/CA-10, `seed.test.ts`, décision #95). Codé par le `fix(environment)` #231 (2026-11-24),
    puis le `fix(seed)` #233, prouvé par #231 et le `test(authentication)` #235. **Non prouvé** :
    que `0100` vaille 100 **sur le processus réel** (le test du processus prouve que le hub
    démarre ; la valeur est prouvée à la fonction) ; les guillemets, blancs et ` #` d'un `.env` pour
    cette variable (CDC muet). Mutants : vingt cités par `DEBTS.md` (#231), non rejoués ici.
- **Partiels : aucun.** CA-1 et CA-2, partiels au HEAD `ed6bd31`, sont solides (plus haut).
- **Trous réels : aucun.** Les deux trous du relevé daté, CA-16 (405) et CA-17 (500), sont corrigés
  dans le code et prouvés (voir plus haut).
- **Hors CA (relevé par cette session)** :
  - **Temps de réponse constant** (CDC, « Points de vigilance », pas un CA) : le CDC veut une
    comparaison bcrypt factice pour un login inconnu, afin que le temps de réponse ne dise pas si
    le login existe. **Codé** par le `fix(authentication)` #209 (2026-11-23, décision #88) :
    `JwtAuthenticationService.authenticate` compare le mot de passe fourni à `DUMMY_PASSWORD_HASH`
    (hash bcrypt valide de coût 12) quand le login est inconnu (`jwt-authentication-service.ts`).
    `authentication-service.test.ts` le prouve par l'appel du `hasher` : une seule comparaison, avec
    le mot de passe fourni et un hash `$2[aby]$12$…` ; le résultat reste `undefined` même si la
    comparaison factice réussit ; un login connu ne déclenche qu'une comparaison, contre son hash.
    Mutant rejoué par cette session (comparaison factice retirée) : **tué** (1 rouge sur 6).
    **Non prouvé** : le temps de réponse lui-même, qu'aucun test ne mesure (le CDC ne donne aucune
    valeur, une mesure serait instable), et le coût figé à 12, qui ne suit pas `BCRYPT_COST` :
    inscrits dans `DEBTS.md` (« Login inconnu : le coût du hash bidon est figé à 12… »). **Périmé :
    « le code ne tient pas ce point »**.
  - **Recherche du login sensible à la casse** (CDC, flux d'émission, étape 2) : le code lit
    `WHERE USR_LOGIN = ?` sur une colonne `UNIQUE` sans `COLLATE NOCASE` (lecture du code,
    `sqlite-user-repository.ts`) ; aucun test ne le vise : non vérifié par test.
  - **Ordre des contrôles** : fixé par la décision #84 (tableau « Ordre des contrôles » d'US-003,
    diagrammes alignés). **Le code y est conforme** depuis le `fix(authentication)` #206 (un champ
    manquant ou vide avant un champ inconnu, un champ mal typé avant les deux), #208 (le `null`) et
    #220 (le `405` avant le corps) ; l'écart relevé le 2026-11-22 est soldé. Les rangs 1 et 2 (limite
    de débit, puis `405` ou `415`) sont prouvés sur le serveur assemblé (CA-13 et CA-16), les rangs
    3 à 7 par les `describe` « decision #84 », « #85 » et « #86 » de `token-route.test.ts` (CA-6,
    CA-9 et CA-10). Les messages de `VALIDATION_ERROR` et le champ nommé quand plusieurs sont en
    échec sont fixés par la décision #85.
  - Le sous-système d'admission WebSocket (`AdmissionPolicy`, `JwtValidator`, résolveur,
    extracteurs) a ses propres fichiers de test dans `authentication/` ; il relève d'US-009 et n'a
    pas été relu par cette session.

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
> code, avec la preuve), **toujours vraie** ou **périmée**. Ce qui reste des dettes A, B,
> C, D et G est inscrit dans `DEBTS.md` (depuis le `docs(debts)` du 2026-11-20, #168), la
> ligne y renvoie ; E et H sont soldées, sans reste dans leur ligne (le tout ou rien du seed et
> la perdante d'une course, relevés « hors CA » d'US-002, tranchés par la décision #77, sont
> tenus par le code depuis le `fix(seed)` du 2026-11-21 : plus de dette sur ce point). La dette F l'était
> déjà (réalignée avec US-001) ; une mention d'US-002 y est ajoutée.
>
> **Cellules d'US-003 des dettes C à H réalignées au HEAD `418aa13` (2026-11-25)** (réalignement
> précédent : HEAD `ed6bd31`, 2026-11-22), avec la section US-003 du §2 : D est soldée (`500` standard et log, #185 et #201), F l'est (variables
> d'environnement d'US-003 prouvées sur processus réel), G l'est pour US-003 (logs, `Retry-After`,
> « par IP ») et reste, pour les thèmes, dans `DEBTS.md` (US-004 CA-34) ; C, E et H ne changent de
> statut pour aucune US, seules leurs phrases sur les cellules d'US-003 « restent datées » sont
> corrigées. Le réalignement du 2026-11-25 met à jour les phrases d'US-003 de C, D, F et G (preuves
> ajoutées depuis, statuts inchangés). Ce qui reste des dettes A, B, C, D, F et G est inscrit dans `DEBTS.md`, la ligne y
> renvoie ; E et H sont soldées, sans reste.

**Motif transversal** : le cœur fonctionnel (auth, JWT, CRUD, WebSocket temps réel)
est solide et bien testé. Les faiblesses qui restent se concentrent sur le plafond des connexions WebSocket et sur des
vérifications (le `Retry-After` des thèmes), plus, pour US-003, la durée de réponse du login
inconnu, qu'aucun test ne mesure (la comparaison factice est codée et prouvée par l'appel du
hasher). Les exigences transversales `405`, `500` de `/token`, `role` du JWT, `token_type` et
câblage du secret, logs de connexion et `Retry-After` des tokens, elles, sont corrigées et
prouvées.

| # | Dette | Gravité | Déclencheur de résorption |
|---|-------|---------|---------------------------|
| **A** | **Soldée dans le code, résidu de vérification.** Faux vert CA-30 / US-004 : `isUsedInQuestions()` renvoyait `false` en dur. Aujourd'hui `SqliteThemeRepository.isUsedInQuestions` interroge `T_QUESTION_QST` (`QST_THEME_ID = ?`) ; `sqlite-theme-repository.test.ts` le prouve avec le vrai repository de questions (vrai quand une question référence le thème, faux sinon). Sondé sur hub réel : `DELETE` d'un thème qui porte une question répond `409 THEME_HAS_QUESTIONS`, puis `204` une fois la question supprimée. **Résidu** : aucun test ne traverse route, service et repository réels (`server.test.ts` n'a pas de cas `409`), et le test du service simule `isUsedInQuestions` à `true` sans vérifier l'argument : un mutant qui lui passe `theme.name` au lieu de l'identifiant survit (155 verts sur `src/themes` et `server.test.ts`, 2026-11-20). La ligne et la section CA-30 d'US-004 restent datées (« faux vert ») : à réaligner avec la session US-004. Le résidu est inscrit dans `DEBTS.md` (`themes/`, « Suppression d'un thème utilisé (US-004 CA-30) : aucun test ne traverse route, service et repository réels »). | ~~🔴~~ 🟢 Vérification (résidu) | Résidu : `test(themes)` d'un `409` sur le serveur assemblé, vrai service et vrai repository. |
| **B** | **Toujours vraie (fait constaté).** CA-12 / US-009 : le plafond mélange admin et buzzers. `ws-route.ts` refuse (`4005`, `Server is full.`) toute nouvelle entrée quand `registry.size >= config.maxConnections`, le registre contenant buzzers **et** admin ; `index.ts` donne `maxConnections: 10`. Sondé sur hub réel : dix buzzers s'authentifient, puis l'admin, onzième connexion, est refusé en `4005` : avec dix buzzers connectés, l'admin ne peut plus se connecter. Les tests ne forcent que `maxConnections = 1` avec un buzzer : la combinaison n'est exercée par aucun test. **Point que le CDC ne tranche pas** : US-009 CA-12 dit « maximum 10 buzzers simultanés », CA-16 « maximum 1 connexion admin », le tableau des codes dit `4005` quand « le registre a atteint sa capacité maximale (10 buzzers) », et le registre décrit contient aussi l'admin (rôle `buzzer` ou `admin`) : il ne dit pas si l'admin compte dans le plafond. La lecture « dix buzzers et un admin » est celle de l'audit initial, pas celle du CDC ; elle n'est pas tranchée ici. Inscrite dans `DEBTS.md` (`websocket/`, « Plafond de connexions WebSocket : l'admin compte parmi les 10, et le CDC ne dit pas si c'est voulu »). | 🟠 Comportemental | Une décision du CDC (l'admin compte-t-il dans le plafond ?), avant le premier jeu à 10 buzzers physiques. |
| **C** | **Soldée.** 405 Method Not Allowed absent partout (CA-16/US-003, CA-35/US-004) : `feat(errors)` du 2026-11-11, décision #38 (`routes/not-found-route.ts`, `RouteCatalog`). Sondé sur hub réel : `GET /api/v1/token` répond `405` avec `Allow: POST` (route publique, corps standard `METHOD_NOT_ALLOWED`), `DELETE /api/v1/themes` avec un token admin répond `405` avec `Allow: GET, POST`. Testé sur le serveur assemblé (`server.test.ts`, deux `describe` portant `US-003/CA-16` et `US-004/CA-35` : route protégée, route publique ; le token répond aussi `405` à `PUT`, `DELETE`, `PATCH`, `OPTIONS` et `HEAD` quel que soit le corps, #220, #227 et #228) ; retirer la ligne qui pose `Allow` fait rougir 7 tests (2026-11-20). **Reste, dans `DEBTS.md`** : la couverture se limite aux ressources `/api/v1/` des tokens, thèmes et questions (dette « `405` : seules les ressources… »). La cellule CA-16 d'US-003 est réalignée (§2) ; la cellule CA-35 d'US-004 reste datée. | ~~🟡~~ soldée | Sans objet (voir `DEBTS.md` pour le périmètre). |
| **D** | **Soldée.** Gestion 500 fragile (CA-17/US-003) : depuis le `fix(authentication)` #185 (2026-11-21), le `setErrorHandler` de `token-route.ts` répond `500` au corps standard à trois champs (`INTERNAL_SERVER_ERROR`, « An unexpected error occurred. Please try again later. ») sans le détail technique, que l'erreur vienne du service d'authentification ou du générateur de token ; depuis le `fix(authentication)` #201 (2026-11-22, décision #83), il journalise l'erreur au niveau `ERROR` avec son message et sa pile. `token-route.test.ts` le prouve (cinq tests du `500`, dont le `Content-Type`, #222 ; quatre du log ; mutants du 2026-11-22, voir §2). Le constat de l'audit initial (`500` au corps natif de Fastify, `message: "no such table: T_USER_USR"`) est périmé. Soldée aussi sur les thèmes (`US-004/CA-36`) et les questions (`US-005/CA-54`). **Reste, dans `DEBTS.md`** (`authentication/`) : le contenu exact de la ligne de log (CA17-8 du smoke test) ; le corps, le `Content-Type` et l'absence de détail technique du `500` du token sont fixés par la décision #91 et assertés. | ~~🟡~~ soldée | Sans objet (voir `DEBTS.md` pour les points non fixés). |
| **E** | **Soldée.** `role` string vs enum dans le JWT REST (CA-3/US-003) : le `fix(authentication)` du 2026-11-10 écrit `toRoleLabel(user.role)` dans le token (`jwt-generator.ts`) ; `jwt-generator.test.ts` asserte `role: "buzzer"` pour un joueur et `role: "admin"` pour un administrateur. Sondé sur hub réel : le token de `/api/v1/token` porte `"admin"` pour `admin` et `"buzzer"` pour `quiz_buzzer_01`. Côté WebSocket, `auth_success` utilise aussi `toRoleLabel` : les deux canaux concordent. La cellule CA-3 d'US-003 est réalignée (§2). | ~~🟡~~ soldée | Sans objet. |
| **F** | **Soldée.** Lecture d'environnement non testée de bout en bout (CA-2/US-002, CA-4/US-003, CA-13/US-003). US-001 n'est plus concernée : sa lecture d'environnement est réalignée au §2. US-002 non plus : le `.env` du seed (mots de passe, `BCRYPT_COST`, `SQLITE_DB_PATH`) est prouvé sur processus réel (§2). US-003 non plus : `JWT_SECRET` et `JWT_EXPIRATION` (CA-2, CA-4, CA-19, CA-20) sont prouvés sur processus réel, environnement réel et `.env` (`index.test.ts`), ainsi que `MAX_REQUESTS_PER_MINUTE` (CA-13 : le défaut de 100, une valeur explicite dans l'environnement ou dans un `.env`, l'environnement réel l'emportant ; CA-21 : une valeur invalide refusée au démarrage) ; ce que `ProcessEnvironment` ne prouve pas seul est tenu par ces tests (§2). **Reste, dans `DEBTS.md`** : les guillemets, blancs et ` #` d'un `.env` pour `MAX_REQUESTS_PER_MINUTE`, non prouvés, le CDC étant muet (ligne « Limite du `429` des tokens »). | ~~🟢~~ soldée | Sans objet. |
| **G** | **Soldée pour US-003 ; toujours vraie pour les thèmes (US-004 CA-34), inscrite dans `DEBTS.md`.** Logs et headers non assertés. (1) **Logs CA-14 / CA-15 d'US-003** : soldés par le `test(authentication)` #187 (2026-11-21) : `token-route.test.ts` capture le logger et asserte, par le contenu et le niveau, une ligne INFO (30) avec le `username` et l'IP pour un succès, une ligne WARN (40) avec le `username` tenté et l'IP pour un échec (§2). (2) **`Retry-After`, CA-13 / US-003** : soldé (#188, #197, #243) : `Retry-After: 60` au premier `429` sur processus réel et sur le serveur assemblé, à +3 s dans la fenêtre sur le serveur assemblé (le plugin des tokens n'a plus de compteur propre depuis #240) ; le `429` retardé sur le hub réel n'est pas prouvé (`DEBTS.md`). **CA-34 / US-004** : `theme-route.test.ts` n'asserte que le statut `429` ; le header est posé par un hook du middleware de limitation, testé au middleware ; renvoi à `DEBTS.md` : « `429` des thèmes non re-testé » et « `Retry-After` constant testé au middleware seul, pas par plugin ». (3) **« Par IP » (CA-13 / US-003)** : soldé (#188, #240) : deux adresses (`remoteAddress`), l'une refusée, l'autre servie, chacune comptée pour elle, sur le serveur assemblé ; l'adresse comptée est celle de la connexion (#97, #242). | 🟢 Vérification | Resserrage de tests (thèmes). |
| **H** | **Soldée.** (a) Noms de comptes CA-1/US-002 : prouvés (§2 : l'ensemble des onze logins est comparé sur processus réel). (b) JSON malformé CA-11/US-003 : `token-route.test.ts` asserte `400 INVALID_JSON` pour un JSON tronqué et pour un corps vide. (c) État vide CA-19/US-004 : prouvé à la route (`200` et enveloppe vide, service simulé), au service (`total: 0`, `total_pages: 0`) et au repository (liste vide). La cellule CA-11 d'US-003 est réalignée (§2) ; la cellule CA-19 d'US-004 reste datée. (d) Bornes du jeu de caractères du mot de passe, CA-4/US-002 : U+007F et U+001F refusés, prouvés par `owasp-password-validator.test.ts`, les deux mutants tués (§2). Ce qui reste d'US-002 (`.env` non versionné et non testé ; constat du verrou d'écriture tenu par un autre processus, non asserté, décision #80) n'est pas de cette dette : renvoi à `DEBTS.md`. | ~~🟢~~ soldée | Sans objet. |

---

## 4. Ce que ça signifie pour la suite

Le socle hub est **substantiel mais pas « fini »** au sens strict des specs :
~93/106 CA solides (US-001 réalignée au HEAD `319d443` le 2026-11-23,
US-002 au HEAD `ef7a221` le 2026-11-20, puis CA-3 et CA-7 au HEAD `33823bf` le 2026-11-21,
US-003 au HEAD `418aa13` le 2026-11-25, US-004 et US-009 au relevé daté ; décompte du §1), avec
un angle mort sur le plafond des connexions WebSocket, sur le `Retry-After` des thèmes et, pour
US-003, sur la durée de réponse du login inconnu (la comparaison factice est codée, aucun test ne
mesure la durée). **Aucun de ces trous n'empêche d'avancer vers le jeu** — à condition de les connaître pour ne pas s'appuyer
dessus (notamment la dette B).

Deux caps possibles pour la suite, à trancher :

1. **Consolider le socle** — résorber ce qui reste des dettes (B, le `Retry-After` des thèmes (G),
   le résidu de A et le coût figé du hash bidon du login d'US-003 ; D, E, F et H sont soldées, C
   n'a qu'un reste de périmètre) pour un hub conforme avant d'ajouter des
   fonctionnalités. Petites sessions TDD ciblées, très « un commit par session ». La dette B
   demande d'abord une décision du CDC (l'admin compte-t-il dans le plafond ?).
2. **Avancer vers le jeu** — attaquer US-008 (quiz) → US-010 → US-011, US-005 (questions)
   étant en place, en actant les dettes du socle comme connues et datées. C'est le chemin qui
   « réveille la dalle » plus vite (le firmware attend un hub capable d'émettre
   les messages de déroulé de partie).

La dette B est **notée formellement** (ligne de `DEBTS.md`, `websocket/`, depuis le #168) et peut
attendre son déclencheur naturel. La dette D est soldée ; ce qui reste du temps de réponse du login (coût figé, durée non mesurée) est inscrit dans `DEBTS.md`.
Rien n'est bloquant : si le plaisir est le moteur, **US-008 → jeu** reste le cap qui sort de
« Connecté » affiché à l'écran.

---

*Audit réalisé par confrontation spec ↔ code ↔ tests, US par US. Document daté à
re-confronter au réel avant toute décision : le git log et les tests priment sur
ce récap.*
