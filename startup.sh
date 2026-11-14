#!/usr/bin/env bash

# ==============================================================================
# VOICE LEARNING AI - LAUNCH SCRIPT
# ==============================================================================
# This script launches both the Backend (FastAPI) and Frontend (Next.js)
# development servers in parallel within a single terminal window.
#
# INSTRUCTIONS:
# 1. Prerequisite: Ensure Ollama is running in the background.
#    - You can run `ollama serve` in another terminal or open the Ollama app.
# 2. Prerequisite: Make sure you have run the setup script at least once:
#    ./scripts/setup.sh
# 3. Running the App:
#    From the repository root directory, run:
#    ./start.sh
# 4. Stopping the App:
#    Press Ctrl+C in this terminal window. Both servers will stop cleanly.
# ==============================================================================

# Exit on error
set -e

# Ensure common macOS binary paths are in PATH (e.g., Homebrew, node, npm)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Get the root directory of this repository
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-detect if we are running from the parent folder (which contains voice-learning-ai)
if [ -d "$ROOT_DIR/voice-learning-ai" ]; then
    PROJECT_DIR="$ROOT_DIR/voice-learning-ai"
    SETUP_PATH="./voice-learning-ai/scripts/setup.sh"
else
    PROJECT_DIR="$ROOT_DIR"
    SETUP_PATH="./scripts/setup.sh"
fi

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Define console output colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=================================================${NC}"
echo -e "${YELLOW}      Starting Voice Learning AI Dev Servers      ${NC}"
echo -e "${YELLOW}=================================================${NC}"

# Verification checks
if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo -e "${RED}Error: Backend virtual environment (.venv) not found.${NC}"
    echo -e "Please run the setup script first: ${YELLOW}$SETUP_PATH${NC}"
    exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${RED}Error: Frontend dependencies (node_modules) not found.${NC}"
    echo -e "Please run the setup script first: ${YELLOW}$SETUP_PATH${NC}"
    exit 1
fi

# Cleanup function to kill background processes on exit
cleanup() {
    # Disable the trap to prevent recursion
    trap - EXIT SIGINT SIGTERM
    
    echo -e "\n${YELLOW}Stopping development servers...${NC}"
    
    # Terminate backend process
    if [ -n "$BE_PID" ] && kill -0 "$BE_PID" 2>/dev/null; then
        echo -e "${BLUE}[Backend]${NC} Stopping server (PID: $BE_PID)..."
        kill "$BE_PID" 2>/dev/null || kill -9 "$BE_PID" 2>/dev/null
    fi
    
    # Terminate frontend process
    if [ -n "$FE_PID" ] && kill -0 "$FE_PID" 2>/dev/null; then
        echo -e "${GREEN}[Frontend]${NC} Stopping server (PID: $FE_PID)..."
        kill "$FE_PID" 2>/dev/null || kill -9 "$FE_PID" 2>/dev/null
    fi
    
    echo -e "${YELLOW}Cleanup complete. Goodbye!${NC}"
}

# Trap SIGINT (Ctrl+C) and SIGTERM (termination signal) to run cleanup
trap cleanup EXIT SIGINT SIGTERM

# Start Backend
echo -e "${BLUE}[Backend]${NC} Starting FastAPI on http://localhost:8000..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn main:app --reload --port 8000 &
BE_PID=$!

# Start Frontend
echo -e "${GREEN}[Frontend]${NC} Starting Next.js on http://localhost:3000..."
cd "$FRONTEND_DIR"
npm run dev &
FE_PID=$!

echo -e "${YELLOW}-------------------------------------------------${NC}"
echo -e "Servers started successfully! Logs will stream below."
echo -e "Press ${RED}Ctrl+C${NC} to stop both servers."
echo -e "${YELLOW}-------------------------------------------------${NC}"

# Wait for all background jobs to finish
wait
