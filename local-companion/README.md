# HuskyNote Local Companion

The HuskyNote Local Companion is an optional Python FastAPI service that enables advanced desktop features:
- Automated single-click Ollama service launch and model pulling
- Native desktop screen capture for operation manual recording
- Native Whisper automatic speech recognition (via faster-whisper)
- Ollama API proxy with preconfigured CORS headers

## Setup and Running

```bash
cd local-companion
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

The service runs locally at `http://127.0.0.1:8765`.
