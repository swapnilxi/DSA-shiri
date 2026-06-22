#!/usr/bin/env bash
set -e

echo "=== Voice Learning AI Setup ==="
echo ""

# 1. Check Ollama
if ! command -v ollama &>/dev/null; then
  echo "Installing Ollama via Homebrew..."
  brew install ollama
fi

echo "Pulling recommended LLM (llama3.1:8b ~4.7GB)..."
ollama pull llama3.1:8b

# 2. Python backend
echo ""
echo "Setting up Python backend..."
cd "$(dirname "$0")/../backend"

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q

# Seed the database
python seed.py

# 3. Frontend
echo ""
echo "Setting up Next.js frontend..."
cd ../frontend

if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "Created .env.local"
fi

npm install --silent

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Run the app:"
echo "  Terminal 1: cd backend && source .venv/bin/activate && uvicorn main:app --reload --port 8000"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open: http://localhost:3000"
