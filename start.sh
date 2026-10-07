#!/usr/bin/env bash
# ====================================================================
# Acadéon - Script de démarrage simultané Backend + Frontend en Bash
# ====================================================================

echo ""
echo -e "\033[1;34m====================================================================\033[0m"
echo -e "\033[1;36m  🎓 Démarrage d'Acadéon (API Server + Frontend)\033[0m"
echo -e "\033[1;34m====================================================================\033[0m"
echo ""

# Aller au répertoire racine du script
cd "$(dirname "$0")"

# 1. Démarrage de l'API Backend
echo -e "\033[1;33m[1/2]\033[0m Lancement de l'API Server sur le port 8080..."
node --env-file=api-server/.env api-server/dist/index.mjs &
API_PID=$!

# Petit délai pour laisser l'API initialiser le port
sleep 1.5

# 2. Démarrage du Frontend
echo -e "\033[1;33m[2/2]\033[0m Lancement du Frontend Acadéon sur le port 5173..."
node acadeon/serve.mjs &
FRONT_PID=$!

# Fonction de nettoyage sur interruption (Ctrl+C)
cleanup() {
  echo ""
  echo -e "\033[1;31mArrêt des services Acadéon...\033[0m"
  kill $API_PID 2>/dev/null
  kill $FRONT_PID 2>/dev/null
  wait $API_PID 2>/dev/null
  wait $FRONT_PID 2>/dev/null
  echo -e "\033[1;32mServices arrêtés avec succès.\033[0m"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Attente des processus
wait $API_PID $FRONT_PID
