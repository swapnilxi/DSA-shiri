#!/usr/bin/env bash
echo "=== Checking Ollama models ==="
if ! pgrep -x ollama >/dev/null; then
  echo "❌ Ollama is not running. Start with: ollama serve"
  exit 1
fi
echo "✅ Ollama is running"
echo ""
echo "Installed models:"
ollama list
echo ""
echo "Recommended for Voice Learning AI:"
echo "  llama3.1:8b     — fast, great quality (4.7GB)"
echo "  qwen2.5:14b     — best technical depth (8.1GB)"
echo "  deepseek-r1:8b  — strong reasoning (4.7GB)"
echo ""
echo "Pull with: ollama pull <model>"
