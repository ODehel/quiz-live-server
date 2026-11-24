# 🔧 Annexe — Conventions techniques

> **Référence unique** — Ce document centralise les conventions techniques communes à toutes les User Stories du projet **Quiz Buzzer** (hub Node.js). Chaque US **référence** ce document au lieu de dupliquer ces informations.

---

## 📋 Stack technique

| Élément | Choix |
|---|---|
| Runtime | Node.js 26 (version du `.nvmrc` et de `engines` dans `package.json`) |
| Langage | TypeScript, exécuté par `tsx` en CommonJS ; type-check par `tsc --noEmit` (versions : voir `package.json`) |
| Base de données | SQLite, via `better-sqlite3` |
| Tests | Vitest, couverture `@vitest/coverage-v8` (versions : voir `package.json`) |
| Identifiants | UUIDv7 généré côté Node.js |
| Horodatage | ISO 8601 UTC (millisecondes), généré côté Node.js |
| Principes d'architecture | YAGNI, KISS, DRY, SOLID |

> **Note :** Certaines US n'utilisent pas toutes les lignes. Chaque US précise dans sa section spécifications les éléments supplémentaires propres à son périmètre (ex. : `bcrypt`, `ws`, `multer`).

---

## ⚠️ Exigence fondamentale — KISS, DRY, YAGNI, SOLID

> ⚠️ **Exigence non négociable** — Toute implémentation d'une US doit **scrupuleusement** respecter ces quatre principes. Ils prévalent sur toute optimisation prématurée, généralisation non justifiée ou complexité inutile.

### KISS — *Keep It Simple, Stupid*

**Règle** : Choisir systématiquement la solution la plus simple qui satisfait le besoin.

| ✅ À faire | ❌ À éviter |
|---|---|
| Une fonction unique par responsabilité | Des fonctions « couteaux suisses » multi-rôles |
| Un middleware `authenticate` qui vérifie le JWT | Un middleware qui authentifie ET autorise ET rate-limite |
| Des réponses d'erreur avec un format JSON fixe `{ status, error, message }` | Des structures d'erreur variables selon le contexte |
| Un handler de route plat et lisible | Des abstractions en couches non justifiées |

### DRY — *Don't Repeat Yourself*

**Règle** : Toute logique dupliquée doit être extraite dans une fonction ou un module partagé.

| ✅ À faire | ❌ À éviter |
|---|---|
| Middlewares `authenticate` et `authorize` définis une fois dans l'US-003, réutilisés dans toutes les US suivantes | Réécrire la vérification JWT dans chaque route handler |
| Fonction utilitaire `normalizeString(str)` pour trim + collapse | Répéter `str.trim().replace(/\s+/g, ' ')` dans chaque route |
| Format d'erreur JSON centralisé dans un helper `sendError(res, status, code, message)` | Construire la réponse d'erreur manuellement dans chaque handler |
| Constante `UUID_REGEX` importée depuis un module commun | Redéfinir la regex UUID dans chaque fichier de validation |

### YAGNI — *You Ain't Gonna Need It*

**Règle** : Ne pas implémenter de fonctionnalité qui n'est pas explicitement demandée dans la US courante.

| ✅ À faire | ❌ À éviter |
|---|---|
| Implémenter uniquement les endpoints décrits dans `## 📡 Endpoints` | Ajouter un endpoint « parce que ça sera sûrement utile » |
| Pagination simple (page + limit) | Un moteur de recherche full-text non demandé |
| Stocker les tokens en mémoire pour le WebSocket | Implémenter un système de refresh token non spécifié |
| Filtres listés dans `## 📡 Endpoints — Paramètres de filtrage` | Ajouter des filtres supplémentaires « par anticipation » |

### SOLID — *Five object-oriented design principles*

| Principe | Application dans le projet |
|---|---|
| **S** — Single Responsibility | Chaque middleware, handler, helper a une responsabilité unique. `authenticate` = vérifier le JWT. `authorize(role)` = vérifier le rôle. Séparés, jamais fusionnés. |
| **O** — Open/Closed | `authorize(role)` est paramétré par rôle : ouvert à l'extension (nouveaux rôles) sans modification de son code. |
| **L** — Liskov Substitution | Les handlers de routes respectent la même signature `(req, res, next)` : interchangeables dans la chaîne Express. |
| **I** — Interface Segregation | Les dépendances sont injectées précisément (db, config, authenticate…). Un handler ne reçoit pas un objet global monolithique. |
| **D** — Dependency Inversion | Les routes dépendent d'abstractions (les middlewares injectés), pas d'implémentations concrètes importées directement. |

---

## 🧪 Exigence de couverture des tests

> **Exigence non négociable** — Tout développement livré dans le cadre du projet Quiz Buzzer doit être couvert par des tests automatisés. Chaque critère d'acceptance est la spécification d'un test ; s'il n'est pas couvert, la fonctionnalité n'est pas livrée. Le seuil de couverture du code est global au projet, appliqué par la CI (décision #67).

### Règle fondamentale : un CA = au moins un test

Chaque ligne du tableau `## ✅ Critères d'acceptance` doit correspondre à **au moins un cas de test automatisé** (unitaire ou d'intégration). La traçabilité est explicite : le nom du test doit référencer l'US et le numéro du CA (ex. : `US-001/CA-5 listens on the port written in PORT`).

| Type de test | Cas d'usage | Outil |
|---|---|---|
| **Unitaire** | Logique de validation, normalisation de chaînes, génération UUID, formatage de réponses | Vitest |
| **Intégration** | Cycle requête/réponse HTTP complet (middleware → route → base de données → réponse) | Vitest + `inject` de Fastify |
| **WebSocket** | Flux de connexion, authentification, timeouts, déconnexion | Vitest + client `ws` |

### Seuil de couverture : ≥ 90% (global au projet)

La couverture **globale du projet** doit être **≥ 90%**, mesurée par Vitest (`npm run test:coverage`, fournisseur v8) sur les quatre métriques suivantes, et appliquée par la CI : un seuil non atteint fait échouer la commande (décision #67). Ce n'est pas un critère d'acceptance de chaque US.

| Métrique | Seuil minimal |
|---|---|
| Lignes (*lines*) | ≥ 90% |
| Branches (*branches*) | ≥ 90% |
| Fonctions (*functions*) | ≥ 90% |
| Instructions (*statements*) | ≥ 90% |

Configuration réelle, dans `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/**/*.interface.ts'],
            thresholds: {
                statements: 90,
                branches: 90,
                functions: 90,
                lines: 90
            }
        }
    }
});
```

### Organisation des fichiers de tests

```
src/
  users/
    seed-users.ts
    seed-users.test.ts   ← test à côté du fichier testé
  index.ts
  index.test.ts
```

- Les fichiers de tests (`*.test.ts`) sont placés dans le même répertoire que le fichier testé, pas dans un répertoire `__tests__/`. Vitest ne lit que `src/**/*.test.ts`.
- Le nom du fichier de test reprend le nom du fichier source avec le suffixe `.test.ts`.
- Le nom de chaque test (`it`) commence par `US-xxx/CA-n` (ex. : `US-001/CA-5 listens on port 3000 when PORT is absent`), suivi de ce que le test établit.

### Encadré « Exigence de couverture » dans les US

L'encadré « Exigence de couverture » est conservé tel quel dans les US existantes qui le portent, jusqu'à leur alignement sur la décision #67.

---

## 🔢 Conventions de données

| Donnée | Convention |
|---|---|
| Identifiants | UUIDv7, format `018eXXXX-XXXX-7XXX-XXXX-XXXXXXXXXXXX` |
| Dates | ISO 8601 UTC avec millisecondes : `"2026-03-XXTHH:mm:ss.000Z"` |
| Noms de champs JSON | `snake_case` |
| Noms de tables SQLite | `T_NOM_ABR` (ex. `T_THEME_THM`) |
| Noms de colonnes SQLite | `ABR_NOM_COLONNE` (ex. `THM_NAME`) |
| Champs optionnels non renseignés | `null` |
| Pagination par défaut | `page=1`, `limit=20`, `limit` plafonné à `100` |
| Tri par défaut des listes | Date de création décroissante (plus récents en premier) |

---

## 📡 Versioning API

```
Base URL : /api/v1
```

Toutes les routes REST du projet utilisent le préfixe `/api/v1`.

---

## 🔑 Variables d'environnement

> **Référence unique** — Ce tableau fixe le **nom**, le rôle, le caractère obligatoire et le défaut de chaque variable d'environnement du hub (décision #39). Une US ou une annexe qui cite une de ces variables renvoie ici et doit employer le même nom.

| Variable | Rôle | Obligatoire | Défaut | US source |
|---|---|---|---|---|
| `JWT_SECRET` | Secret de signature des tokens JWT (HS256) : 32 caractères minimum ; absent, vide ou plus court, le hub refuse de démarrer | ✅ Oui, aucun défaut | — | [US-003](../specs/US-003-authentication-token.md) (CA-2, tableau des variables), [Authentification](AUTHENTIFICATION.md) |
| `JWT_EXPIRATION` | Durée de validité d'un token, en secondes : entier strictement positif ; absente ou vide, elle vaut `3600`, renseignée autrement, le hub refuse de démarrer ; aucune borne haute (décision #42) | Non | `3600` | [US-003](../specs/US-003-authentication-token.md) (CA-4), [Authentification](AUTHENTIFICATION.md) |
| `PORT` | Port d'écoute du serveur : entier de 1 à 65535, écrit en chiffres ASCII seulement (ni signe, ni espace ni tabulation, ni préfixe `0x`, ni séparateur `_`, ni chiffres d'une autre écriture) ; les zéros en tête sont acceptés (`08080` vaut 8080) ; absente, elle vaut `3000`, définie autrement (chaîne vide comprise), le hub refuse de démarrer (décisions #45 et #46) | Non | `3000` | [US-001](../specs/US-001-server-startup.md) (CA-5, CA-7) |
| `SQLITE_DB_PATH` | Chemin du fichier de la base SQLite ; un fichier absent dans un dossier existant est créé au démarrage du hub et à l'exécution du seed, un fichier existant de zéro octet est traité comme une base neuve par le hub et par le seed (décisions #58 et #64) ; une base existante en lecture seule qui contient déjà les tables du hub n'est pas refusée par le hub, qui démarre et dont les écritures échouent ensuite (décision #69, sondé sous Linux seulement) ; absente, elle vaut `quiz.db` ; lue sans les blancs qui l'entourent (décision #61), définie mais vide (chaîne vide) ou faite uniquement de blancs (espace, tabulation, saut de ligne, etc. : liste dans le CA-10 d'US-001), le hub refuse de démarrer (décisions #57, #60 et #61) et le seed refuse de s'exécuter (décisions #59, #60 et #61) ; sinon le chemin nettoyé est utilisé ; un refus du seed (CA-4, CA-6) ou un échec d'écoute du hub (CA-8) laisse en place le fichier créé par l'ouverture, tables vides, et le lancement suivant le réutilise, sans suppression (décision #65) | Non | `quiz.db` | Décision #39 ; [US-001](../specs/US-001-server-startup.md) (CA-8, CA-9 et CA-10, décisions #56, #57, #58, #60, #61, #65 et #69) ; [US-002](../specs/US-002-seed-users.md) (CA-4, CA-6, CA-8 et CA-9, décisions #59, #60, #61, #64 et #65) |
| `MAX_REQUESTS_PER_MINUTE` | Plafond de requêtes par minute et par adresse IP, au-delà duquel le serveur répond `429` : entier de 1 à 2147483647, écrit en chiffres ASCII seulement (ni signe, ni espace ni tabulation, ni préfixe, ni séparateur) ; les zéros en tête sont acceptés (`0100` vaut 100) ; absente, elle vaut `100`, définie autrement (chaîne vide et blancs seuls compris), le hub refuse de démarrer (décision #94) | Non | `100` | [Sécurité transversale](SECURITE-TRANSVERSALE.md) (`CA-RateLimit`), [US-003](../specs/US-003-authentication-token.md) (CA-13, CA-21) ; nom : décision #39 ; valeur invalide : décision #94 |
| `SEED_PASSWORD_ADMIN` | Mot de passe du compte `admin` pour le seed : de 12 à 72 caractères, ASCII imprimable (U+0020 à U+007E), pas uniquement des espaces (décision #74) | ✅ Oui, aucun défaut | — | [US-002](../specs/US-002-seed-users.md) (CA-2, CA-4) |
| `SEED_PASSWORD_BUZZER_01` à `SEED_PASSWORD_BUZZER_10` | Mot de passe du compte `quiz_buzzer_01` à `quiz_buzzer_10` pour le seed : de 12 à 72 caractères, ASCII imprimable (U+0020 à U+007E), pas uniquement des espaces (décision #74) (dix variables, une par compte) | ✅ Oui, aucun défaut | — | [US-002](../specs/US-002-seed-users.md) (CA-2, CA-4) |
| `BCRYPT_COST` | Facteur de coût bcrypt du seed : entier de 4 à 31, écrit en chiffres ASCII seulement, sans zéro en tête (`004` refusée, à la différence de `PORT`) ; absente ou vide (chaîne vide), elle vaut `12`, renseignée autrement (blancs seuls compris), le seed refuse de s'exécuter, message sur la sortie d'erreur | Non | `12` | [US-002](../specs/US-002-seed-users.md) (CA-6) ; décisions #42 et #74 |

Un fichier `.env` est lu au démarrage du hub et du seed ; quand une variable figure à la fois dans l'environnement réel et dans `.env`, l'environnement réel prime, et un `PORT=` vide dans `.env` est refusé comme toute chaîne vide (décision #52). Le `.env` est lu par la bibliothèque `dotenv` : la valeur contrôlée est celle qu'elle produit, et ses règles d'écriture (guillemets, blancs, ` #`) sont consignées au CA-10 d'US-001, sans règle ajoutée par le CDC (décision #71). Le script de seed refuse de s'exécuter si l'un des onze mots de passe manque ou ne respecte pas la politique, ou si `BCRYPT_COST` est renseignée hors de sa règle ([US-002](../specs/US-002-seed-users.md), CA-4 et CA-6) ; il refuse aussi de s'exécuter (code de sortie `1`, message sur la sortie d'erreur qui nomme `SQLITE_DB_PATH`, avant l'ouverture de la base) si `SQLITE_DB_PATH` est définie mais vide ou faite uniquement de blancs ([US-002](../specs/US-002-seed-users.md), CA-8, décisions #59, #60 et #61), ou si la base désignée par `SQLITE_DB_PATH` ne peut pas être ouverte ou n'est pas une base SQLite (code de sortie `1`, `User seeding failed: <cause>` sur la sortie d'erreur, aucun compte créé ; [US-002](../specs/US-002-seed-users.md), CA-9, décision #62). Le hub refuse de démarrer (code de sortie `1`, message qui nomme la variable) si `JWT_SECRET`, `JWT_EXPIRATION`, `PORT` ou `MAX_REQUESTS_PER_MINUTE` ne respecte pas sa règle ([US-003](../specs/US-003-authentication-token.md), CA-19, CA-20 et CA-21 ; [US-001](../specs/US-001-server-startup.md), CA-7) ; quand plusieurs refus se cumulent, une seule erreur est rapportée, dans l'ordre `JWT_*`, `PORT`, `MAX_REQUESTS_PER_MINUTE`, base de données (décision #94). Il refuse aussi de démarrer (code de sortie `1`, `Server starting failed: <cause>` sur la sortie d'erreur) si `SQLITE_DB_PATH` est définie mais vide ou faite uniquement de blancs ([US-001](../specs/US-001-server-startup.md), CA-10, décisions #57, #60 et #61), si la base désignée par `SQLITE_DB_PATH` ne peut pas être ouverte, ou si le fichier désigné n'est pas une base SQLite (CA-9, décisions #55 et #56). `PORT`, `MAX_REQUESTS_PER_MINUTE` et `SQLITE_DB_PATH` font exception à la règle « vide vaut absente » de `JWT_EXPIRATION` et de `BCRYPT_COST` : une chaîne vide est refusée (décisions #45, #57, #59 et #94), et pour `SQLITE_DB_PATH` une valeur faite uniquement de blancs l'est aussi (décisions #60 et #61), alors que les blancs qui bordent un chemin non vide sont ignorés (décision #61), à la différence de `PORT`, dont une valeur bordée d'un blanc est refusée (décision #46). `SQLITE_DB_PATH=:memory:` n'est pas refusée : le hub démarre et écoute et le seed réussit (code de sortie `0`), sur une base en mémoire, sans fichier créé et sans rien de persisté (constat reporté, [US-001](../specs/US-001-server-startup.md) CA-10 et [US-002](../specs/US-002-seed-users.md) CA-8, décision #63). « Sans défaut » veut dire qu'aucune valeur de repli n'existe dans le code.

D'autres US citent encore des variables (`NODE_ENV` dans [US-022](../specs/US-022-logging.md), `SERVER_BASE_URL` dans [US-017](../specs/US-017-jingles-management.md)) : elles ne sont pas reprises ici tant que leur US n'est pas cadrée, et le nom qu'elles portent n'est pas remis en cause.

---

## 📦 Format standard des réponses paginées

```json
{
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 42,
  "total_pages": 3
}
```

| Champ | Type | Description |
|---|---|---|
| `data` | `array` | Tableau des éléments de la page courante |
| `page` | `number` | Numéro de page courante (1-based) |
| `limit` | `number` | Nombre d'éléments par page |
| `total` | `number` | Nombre total d'éléments |
| `total_pages` | `number` | Nombre total de pages |

---

## 🔗 Principes DRY & Maintenance

### Avantages de ce document centralisé

- **Source unique de vérité** : les conventions sont définies une seule fois
- **Cohérence garantie** : toutes les US suivent les mêmes règles
- **Maintenance simplifiée** : modifier une convention ne nécessite qu'une seule édition
- **Évolutivité** : ajouter une convention est facile et centralisé

### Comment référencer ce document dans une US

```markdown
## 🔧 Spécifications techniques

Voir les [Conventions techniques](CONVENTIONS-TECHNIQUES.md) pour la stack complète, les principes d'architecture et les conventions de données.

### Spécifications propres à cette US

| Élément | Choix |
|---|---|
| Bibliothèque WebSocket | `ws` (dernière version stable disponible) |
```

---

**Dernière mise à jour** : 2026-11-18
**Statut** : Transversal à toutes les US
