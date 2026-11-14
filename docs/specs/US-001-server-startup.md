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

> 🧪 **Exigence de couverture** — Voir [Conventions techniques — Couverture des tests](../shared/CONVENTIONS-TECHNIQUES.md#-exigence-de-couverture-des-tests). Chaque CA doit être couvert par au moins un test automatisé. Couverture globale ≥ 90 %.

| # | Critère | Résultat attendu |
|---|---|---|
| CA-1 | Le serveur démarre sans erreur avec `npm start` | Le serveur démarre et reste en écoute sans erreur |
| CA-2 | La console affiche l'heure de lancement au format `HH:mm:ss` | Ex : `🚀 Server started at 14:32:07` |
| CA-3 | La console affiche la première adresse IPv4 locale non-loopback trouvée et le port d'écoute | Ex : `📡 Listening on http://192.168.1.42:3000` |
| CA-4 | Si aucune interface réseau IPv4 non-loopback n'est trouvée, un message de fallback est affiché | Ex : `⚠️ No network interface found, listening on http://localhost:3000` |
| CA-5 | Le port d'écoute est configurable via la variable d'environnement `PORT` (défaut : `3000`) | `PORT=8080 npm start` → écoute sur le port 8080. Absente, la variable vaut `3000`. Définie mais invalide : voir CA-7 |
| CA-6 | Les tests couvrent les cas : démarrage normal, absence d'interface réseau, port personnalisé | Couverture de tests ≥ 90% |
| CA-7 | `PORT` est définie mais n'est pas un entier de 1 à 65535 écrit en chiffres seulement, c'est-à-dire en chiffres ASCII de `0` à `9`, sans signe, sans espace ni tabulation, sans préfixe ni séparateur (chaîne vide, `abc`, `8080abc`, `80.5`, `1e3`, `0`, `-1`, `65536`, ` 8080` (espace en tête), `8080 ` (espace en fin), `+8080`, `8080` précédé d'une espace et d'une tabulation, `0x1F90`, `٨٠٨٠` (chiffres arabo-indiens), `８０８０` (chiffres pleine chasse), `8_080`) | `npm start` refuse de démarrer : le serveur n'écoute sur aucun port, le processus se termine avec le code de sortie `1`, et la console affiche un message qui nomme `PORT` et la règle (entier de 1 à 65535) sans reprendre la valeur. Ex : `Server starting failed: PORT must be an integer between 1 and 65535.` Absente, la variable vaut `3000` (CA-5). À la différence de `JWT_EXPIRATION` (US-003 CA-20) et de `BCRYPT_COST` (US-002 CA-6), une chaîne vide est refusée et ne vaut pas absente (décision #45). Les zéros en tête sont acceptés : `08080` vaut 8080 et le serveur écoute sur le port 8080 ; `00`, qui vaut 0, est refusé (décision #46) |

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
| Base de données | Non utilisée dans cette US |

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
| Configuration du port via variable d'environnement | Interface Angular |
| Tests unitaires avec couverture ≥ 90% | Intégration avec les buzzers |
| | Déploiement / CI-CD |

---

## 🔍 Points de vigilance

### Interfaces réseau multiples

Si la machine possède plusieurs interfaces IPv4 non-loopback (ex : Ethernet + WiFi), le serveur affiche la **première trouvée**. Si un besoin de sélection d'interface se présente ultérieurement, une variable d'environnement `HOST` pourra être ajoutée (YAGNI pour l'instant).