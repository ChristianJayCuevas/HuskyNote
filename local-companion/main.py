import os
import subprocess
import shutil
import io
import base64
import requests
from typing import Optional, List
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="HuskyNote Local Companion",
    description="Local service for desktop capture, Whisper speech processing, and Ollama automation",
    version="0.1.0"
)

# Strict CORS for local HuskyNote web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://huskynote.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

class ModelPullRequest(BaseModel):
    model: str

class ChangeDetectionRequest(BaseModel):
    previousImageBase64: str
    currentImageBase64: str

@app.get("/health")
def get_health():
    """Health status check for HuskyNote web client."""
    ollama_online = False
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        ollama_online = (r.status_code == 200)
    except Exception:
        ollama_online = False

    return {
        "status": "ok",
        "service": "huskynote-companion",
        "version": "0.1.0",
        "ollama_online": ollama_online,
        "ollama_url": OLLAMA_URL
    }

@app.get("/models")
def get_models():
    """Proxy installed models from local Ollama service."""
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=4)
        if r.status_code == 200:
            return r.json()
        raise HTTPException(status_code=r.status_code, detail="Failed to query Ollama models")
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="Ollama service is not reachable on localhost:11434")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ollama/start")
def start_ollama():
    """Automated single-click launch of Ollama service with CORS support."""
    try:
        # Check if already running
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=1)
        if r.status_code == 200:
            return {"status": "already_running", "message": "Ollama is already running"}
    except Exception:
        pass

    ollama_path = shutil.which("ollama")
    if not ollama_path:
        raise HTTPException(status_code=404, detail="Ollama binary not found in system PATH")

    env = os.environ.copy()
    env["OLLAMA_ORIGINS"] = "*"
    try:
        # Launch background process
        subprocess.Popen([ollama_path, "serve"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"status": "started", "message": "Ollama service started in background with CORS enabled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start Ollama: {str(e)}")

@app.post("/ollama/pull")
def pull_model(req: ModelPullRequest):
    """Pull a model via local Ollama API."""
    try:
        r = requests.post(f"{OLLAMA_URL}/api/pull", json={"name": req.model, "stream": False}, timeout=180)
        if r.status_code == 200:
            return {"status": "success", "model": req.model}
        raise HTTPException(status_code=r.status_code, detail="Failed to pull model")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/screen/capture")
def capture_desktop_screen():
    """Capture native desktop screenshot if Pillow ImageGrab is available."""
    try:
        from PIL import ImageGrab
        screenshot = ImageGrab.grab()
        buffered = io.BytesIO()
        screenshot.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return {
            "status": "success",
            "format": "image/png",
            "dataUrl": f"data:image/png;base64,{img_str}",
            "width": screenshot.width,
            "height": screenshot.height
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Desktop screen capture error: {str(e)}")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio file using local Faster-Whisper or report unavailable status."""
    try:
        # Check if faster-whisper is installed
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("base", device="cpu", compute_type="int8")
            audio_bytes = await file.read()
            # Save temporarily
            tmp_path = f"/tmp/huskynote_{file.filename}"
            with open(tmp_path, "wb") as f:
                f.write(audio_bytes)
            
            segments, info = model.transcribe(tmp_path, beam_size=5)
            transcript_text = " ".join([s.text for s in segments])
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

            return {
                "status": "success",
                "text": transcript_text.strip(),
                "language": info.language
            }
        except ImportError:
            return {
                "status": "unavailable",
                "message": "faster-whisper package not installed. Install with 'pip install faster-whisper' for native transcription."
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Security requirement: Listen strictly on 127.0.0.1, never 0.0.0.0
    uvicorn.run(app, host="127.0.0.1", port=8765)
