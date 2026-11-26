#!/bin/sh
# Prépare l'espace Linux d'un agent : Node à la version de .nvmrc, dépendances du dépôt,
# puis vérification réelle. À lancer depuis la racine du dépôt, avant toute commande npm.
# Usage : sh scripts/prepare-agent-workspace.sh
set -u

fail() {
    echo "Espace non prêt : $1" >&2
    exit 1
}

version=$(cat .nvmrc) || fail ".nvmrc illisible (lancer depuis la racine du dépôt)"
case "$version" in
    '' | *[!0-9]*) fail ".nvmrc doit contenir un numéro de version majeure, lu : « $version »" ;;
esac

# Node vient du paquet npm « node », installé dans un cache hors du dépôt.
cache="$HOME/.cache/quiz-live-server/node-$version"
node_dir="$cache/node_modules/node/bin"
if [ ! -x "$node_dir/node" ]; then
    npm install --prefix "$cache" --no-audit --no-fund --loglevel=error "node@$version" \
        || fail "Node $version n'a pas pu être installé depuis npm"
fi
PATH="$node_dir:$PATH"
case "$(node --version)" in
    "v$version".*) ;;
    *) fail "Node $(node --version) ne correspond pas à .nvmrc ($version)" ;;
esac

# Sans les scripts d'installation : la compilation de better-sqlite3 ne peut pas télécharger
# les en-têtes de Node ici, et le binaire précompilé livré dans le paquet suffit.
npm ci --ignore-scripts --no-audit --no-fund --loglevel=error || fail "npm ci a échoué"
# Le script « prepare » du dépôt (hooks git), sauté par --ignore-scripts.
npm run --silent prepare || fail "le script prepare (hooks git) a échoué"

node -e "new (require('better-sqlite3'))(':memory:').prepare('SELECT 1').get()" \
    || fail "better-sqlite3 n'ouvre pas une base en mémoire sous Node $(node --version)"

echo "Espace prêt : Node $(node --version), better-sqlite3 chargé."
echo "Avant chaque commande du dépôt : export PATH=\"$node_dir:\$PATH\""
