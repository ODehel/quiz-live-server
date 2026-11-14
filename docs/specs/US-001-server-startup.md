![Page de couverture — US-001](diagrams/covers/US-001-cover.png)

# US-001 — Démarrage du serveur Quiz Buzzer

## 📋 Contexte projet

Voir [VISION.md](../shared/VISION.md) pour la description complète du projet et de ses quatre applications.

---

## 🎯 User Story

> **En tant que** maître du jeu,
> **quand** je lance le serveur `quiz-buzzer-server` via la commande `npm start`,
> **alors** la console m'affiche l'heure de lancement ainsi que l'adresse IP sur laquelle le serveur est joignable.

---

## ✅ Critères d'acceptance

| # | Critère | Résultat attendu |
|---|---|---|
| CA-1 | Le serveur démarre sans erreur avec `npm start` | Le serveur démarre et reste en écoute sans erreur, sur toutes les interfaces IPv4 (`0.0.0.0`) et non sur le seul loopback (décision #51) |
| CA-2 | La console affiche l'heure de lancement au format `HH:mm:ss` | L'heure est l'heure locale de la machine, pas l'UTC (décision #47). Sortie standard (décision #50). Normatif : le format `HH:mm:ss`. Ex, non normatif : `🚀 Server started at 14:32:07` (décision #53) |
| CA-3 | La console affiche la première adresse IPv4 locale non-loopback trouvée et le port d'écoute | Sortie standard (décision #50). Normatifs : l'adresse IPv4 et le port. Ex, non normatif : `📡 Listening on http://192.168.1.42:3000` (décision #53) |
| CA-4 | Si aucune interface réseau IPv4 non-loopback n'est trouvée, un message de fallback est affiché | Le message de repli affiche `localhost:<PORT>`, le `PORT` configuré (CA-5) et pas toujours `3000`. Sortie standard (décision #50). Normatif : `localhost` et le port. Ex, non normatif, avec `PORT` absente : `⚠️ No network interface found, listening on http://localhost:3000` (décision #53) |
| CA-5 | Le port d'écoute est configurable via la variable d'environnement `PORT` (défaut : `3000`) | `PORT=8080 npm start` → écoute sur le port 8080. Absente, la variable vaut `3000`. Définie mais invalide : voir CA-7. Un fichier `.env` est lu au démarrage et la variable d'environnement réelle prime sur lui : `PORT=4888` dans l'environnement bat `PORT=4777` dans `.env` (décision #52) |
| CA-7 | `PORT` est définie mais n'est pas un entier de 1 à 65535 écrit en chiffres seulement, c'est-à-dire en chiffres ASCII de `0` à `9`, sans signe, sans espace ni tabulation, sans préfixe ni séparateur (chaîne vide, `abc`, `8080abc`, `80.5`, `1e3`, `0`, `-1`, `65536`, ` 8080` (espace en tête), `8080 ` (espace en fin), `+8080`, `8080` précédé d'une espace et d'une tabulation, `0x1F90`, `٨٠٨٠` (chiffres arabo-indiens), `８０８０` (chiffres pleine chasse), `8_080`) | `npm start` refuse de démarrer : le serveur n'écoute sur aucun port, le processus se termine avec le code de sortie `1`, et la console affiche un message qui nomme `PORT` et la règle (entier de 1 à 65535) sans reprendre la valeur. Ex : `Server starting failed: PORT must be an integer between 1 and 65535.` Absente, la variable vaut `3000` (CA-5). À la différence de `JWT_EXPIRATION` (US-003 CA-20) et de `BCRYPT_COST` (US-002 CA-6), une chaîne vide est refusée et ne vaut pas absente (décision #45). Les zéros en tête sont acceptés : `08080` vaut 8080 et le serveur écoute sur le port 8080 ; `00`, qui vaut 0, est refusé (décision #46). Le message sort sur la sortie d'erreur (décision #50). Quand `PORT` et les variables `JWT_*` ([US-003](US-003-authentication-token.md), CA-19 et CA-20) sont invalides ensemble, une seule erreur est rapportée : celle des variables `JWT_*` d'abord, et le refus vaut dans les deux cas, avec le code de sortie `1` (décision #49) ; le contrôle de `SQLITE_DB_PATH` (CA-10) et l'ouverture de la base de données (CA-9) passent après ces deux contrôles (décisions #55 et #57). Le `PORT=` vide d'un fichier `.env` est refusé comme toute chaîne vide (décision #52) |
| CA-8 | Le serveur ne peut pas se mettre en écoute (port déjà occupé, ou toute autre erreur système d'écoute) | `npm start` refuse de démarrer : le processus se termine avec le code de sortie `1`, la console affiche sur la sortie d'erreur `Server starting failed: <cause>` et rien n'écoute. La cause est celle que donne le système. Ex, non normatif : `Server starting failed: listen EADDRINUSE: address already in use 0.0.0.0:<port>` (décisions #48, #50 et #53) |
| CA-9 | La base de données ne peut pas être ouverte, ou le fichier désigné n'est pas une base SQLite (le chemin `SQLITE_DB_PATH`, `quiz.db` par défaut, désigne par exemple un dossier qui n'existe pas, ou un fichier existant qui n'est pas une base SQLite, comme un fichier texte) | `npm start` refuse de démarrer : le processus se termine avec le code de sortie `1`, la console affiche sur la sortie d'erreur `Server starting failed: <cause>` et rien n'écoute. La cause est celle que donne le système. Ex, non normatif : `Server starting failed: Cannot open database because the directory does not exist` ; pour un fichier qui n'est pas une base SQLite : `Server starting failed: file is not a database` (décisions #50, #53, #55 et #56). L'erreur d'un fichier qui n'est pas une base SQLite peut survenir après l'ouverture du fichier, à la première instruction adressée à la base : elle compte, et le refus vaut, tant qu'elle précède la mise en écoute (décision #56). Quand `JWT_*`, `PORT` et la base posent problème ensemble, une seule erreur est rapportée : celle des variables `JWT_*` d'abord, puis celle de `PORT`, puis celle de la base, c'est-à-dire d'abord le contrôle de `SQLITE_DB_PATH` (CA-10), puis l'ouverture (décisions #49, #55, #56 et #57). À l'inverse, un fichier de base absent dans un dossier qui existe n'est pas une erreur : le fichier est créé automatiquement au chemin `SQLITE_DB_PATH` et le hub démarre normalement (constat reporté au CDC, décision #56). De même, un fichier de base existant de zéro octet (fichier vide) n'est pas une erreur : il est traité comme une base neuve, les tables y sont créées dedans et le hub démarre normalement, il écoute (constat reporté au CDC, décision #58) ; il ne relève donc pas du refus « fichier qui n'est pas une base SQLite » (décision #56). Le seed refuse de la même façon une base qui ne peut pas être ouverte ou un fichier qui n'est pas une base SQLite (code de sortie `1`, `User seeding failed: <cause>` sur la sortie d'erreur, [US-002](US-002-seed-users.md) CA-9, décision #62) ; le fichier absent et le fichier de zéro octet ne sont pas spécifiés pour le seed |
| CA-10 | `SQLITE_DB_PATH` est définie mais vide (chaîne vide), ou faite uniquement de blancs (un ou plusieurs blancs, quels qu'ils soient, et rien d'autre : `" "`, `"   "`, une tabulation, un saut de ligne, un mélange ; liste des blancs plus bas) | `npm start` refuse de démarrer : le serveur n'écoute sur aucun port, le processus se termine avec le code de sortie `1`, et la console affiche sur la sortie d'erreur `Server starting failed: <message>` ; le message nomme `SQLITE_DB_PATH` et la règle (le chemin de la base ne peut être ni vide ni fait uniquement de blancs) sans reprendre la valeur. Ex, non normatif : `Server starting failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.` Absente, la variable vaut `quiz.db` (CA-9). À la différence de `JWT_EXPIRATION` (US-003 CA-20) et de `BCRYPT_COST` (US-002 CA-6), et comme `PORT` (CA-7), une chaîne vide est refusée et ne vaut pas absente (décision #57) ; une valeur faite uniquement de blancs est refusée de la même façon, sans fichier créé ni base ouverte, même refus et même place dans l'ordre des contrôles que la chaîne vide (décisions #60 et #61, la #61 précisant que les blancs ne se limitent pas à l'espace U+0020). **Règle de lecture** (décision #61, constat reporté) : la valeur est lue sans les blancs qui l'entourent, en tête et en fin ; les blancs à l'intérieur du chemin sont conservés (`qu iz.db` désigne le fichier `qu iz.db`). Si le résultat est vide, c'est-à-dire si la valeur est vide ou faite uniquement de blancs, le refus s'applique ; sinon c'est ce chemin nettoyé qui est utilisé (` quiz.db`, `quiz.db ` et `quiz.db` précédé d'une tabulation et suivi d'un retour chariot et d'un saut de ligne désignent tous `quiz.db`). Refusés : `""`, `" "`, `"   "`, une tabulation seule, un saut de ligne seul, un retour chariot seul, un mélange d'espace, de tabulation et de saut de ligne, une espace insécable seule, U+3000 seul, un BOM seul. Non refusés : une valeur d'un seul U+200B (chemin d'un caractère, le fichier créé a un nom invisible), ou U+200B suivi d'une espace (le blanc de fin est retiré, U+200B reste) : un caractère qui n'est pas un blanc reste dans le chemin. La règle porte sur la valeur telle que le processus la reçoit, qu'elle vienne de l'environnement réel ou d'un `.env` ; la façon dont un `.env` écrit des blancs (guillemets, valeur non quotée) n'est pas spécifiée (sondé, voir `DEBTS.md`). **Blancs** (liste fermée, décision #61) : les 25 caractères suivants et eux seuls : l'espace U+0020, la tabulation U+0009, le saut de ligne (LF) U+000A, la tabulation verticale U+000B, le saut de page U+000C, le retour chariot (CR) U+000D, l'espace insécable U+00A0, l'espace de l'ogham U+1680, les onze espaces typographiques U+2000 à U+200A, le séparateur de ligne U+2028, le séparateur de paragraphe U+2029, l'espace fine insécable U+202F, l'espace moyenne mathématique U+205F, l'espace pleine chasse U+3000 et la marque d'ordre des octets (BOM) U+FEFF. Tout autre caractère n'est pas un blanc, même s'il est invisible : l'espace de largeur nulle U+200B, le caractère de contrôle U+0085 (NEL) et U+180E sont des caractères ordinaires de chemin. Ce contrôle prend place dans l'étape « base de données », après ceux des variables `JWT_*` et de `PORT` et avant l'ouverture de la base (CA-9) : quand `JWT_*`, `PORT` et `SQLITE_DB_PATH` posent problème ensemble, une seule erreur est rapportée, dans cet ordre, avec le code de sortie `1` (décisions #49, #55, #57, #60 et #61). Le message sort sur la sortie d'erreur (décision #50). Le `SQLITE_DB_PATH=` vide d'un fichier `.env` est refusé comme toute chaîne vide (décisions #52 et #57). Le seed (`npm run seed`) lit la même variable et applique la même règle, chaîne vide, blancs seuls et blancs de bordure compris, avant l'ouverture de la base ([US-002](US-002-seed-users.md), CA-8, décisions #59, #60 et #61) |

> **Note du 2026-11-14 (décision #54)** — CA-6 (« Les tests couvrent les cas… Couverture ≥ 90 % ») est retiré : la couverture relève de la méthode TDD, pas d'un critère d'acceptance. La numérotation des autres CA est conservée (CA-7 est cité par les décisions #45 et #46, par les conventions techniques, par les tests et par les handoffs) : il n'y a donc pas de CA-6.

---

## 🔄 Diagramme de flux

![Diagramme de flux — US-001 — Démarrage du serveur Quiz Buzzer](diagrams/US-001-server-startup.png)

---

## 🔀 Diagramme de séquences

![Diagramme de séquences — US-001 — Démarrage du serveur Quiz Buzzer](diagrams/US-001-server-startup-sequence.png)

---

## 🔧 Spécifications techniques

Voir les [Conventions techniques](../shared/CONVENTIONS-TECHNIQUES.md) pour la stack complète, les principes d'architecture (KISS, DRY, YAGNI, SOLID) et les conventions de données.

### Spécifications propres à cette US

| Élément | Choix |
|---|---|
| Base de données | SQLite, ouverte au démarrage au chemin `SQLITE_DB_PATH` (`quiz.db` par défaut, voir le tableau des variables des [Conventions techniques](../shared/CONVENTIONS-TECHNIQUES.md)) ; si elle ne peut pas être ouverte, ou si le fichier désigné n'est pas une base SQLite, le hub refuse de démarrer ; un fichier absent dans un dossier existant est créé automatiquement ; un fichier existant de zéro octet est traité comme une base neuve (les tables y sont créées, le hub écoute) ; si `SQLITE_DB_PATH` est définie mais vide, ou faite uniquement de blancs, le hub refuse de démarrer, sans ouvrir de base ; les blancs qui entourent le chemin sont ignorés (CA-9 et CA-10, décisions #55, #56, #57, #58, #60 et #61) |

### Scripts npm

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --experimental-vm-modules ./node_modules/.bin/jest --coverage"
  }
}
```

---

## 📐 Périmètre

| Inclus | Exclu |
|---|---|
| Démarrage du serveur HTTP | Communication WebSocket (US dédiée) |
| Affichage heure + IP au démarrage | Logique métier de quiz |
| Configuration du port via variable d'environnement (et fichier `.env`) | Interface Angular |
| Refus de démarrer : `PORT` invalide (CA-7), écoute impossible (CA-8), base de données non ouvrable ou fichier qui n'est pas une base SQLite (CA-9), `SQLITE_DB_PATH` définie mais vide ou faite uniquement de blancs (CA-10) | Intégration avec les buzzers |
| | Déploiement / CI-CD |

---

## 🔍 Points de vigilance

### Interfaces réseau multiples

Si la machine possède plusieurs interfaces IPv4 non-loopback (ex : Ethernet + WiFi), le serveur affiche la **première trouvée**. Si un besoin de sélection d'interface se présente ultérieurement, une variable d'environnement `HOST` pourra être ajoutée (YAGNI pour l'instant).

### Lignes de journalisation de Fastify

Au démarrage normal, Fastify écrit aussi ses propres lignes JSON sur la sortie standard (par exemple `Server listening at http://…`). Le CDC ne les prescrit pas et ne les interdit pas : elles ne font partie d'aucun CA (décision #50).
