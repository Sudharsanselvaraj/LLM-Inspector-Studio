"""FastAPI application for NeuroScope.

Phase 1 exposes:
  * GET  /health      — liveness + whether the model is loaded
  * GET  /model-info  — model metadata (layers, heads, hidden size, device)
  * POST /analyze     — real attention data for a sentence

The model is loaded ONCE at startup via the lifespan handler, never per request.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .model import ModelEngine, TokenizedTooLong
from .schemas import AnalyzeRequest, AnalyzeResponse, ModelInfo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neuroscope")

# Single process-wide engine handle, populated in the lifespan handler.
engine: ModelEngine | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    logger.info("Loading model (first run downloads ~1GB from Hugging Face)...")
    engine = ModelEngine()
    logger.info(
        "Model ready: %s on %s (%d layers, %d heads, hidden %d)",
        engine.model_id,
        engine.device,
        engine.num_layers,
        engine.num_heads,
        engine.hidden_size,
    )
    yield
    engine = None


app = FastAPI(title="NeuroScope", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_engine() -> ModelEngine:
    if engine is None:
        raise HTTPException(status_code=503, detail="Model is still loading.")
    return engine


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "model_loaded": engine is not None}


@app.get("/model-info", response_model=ModelInfo)
async def model_info() -> ModelInfo:
    return ModelInfo(**_require_engine().info())


@app.get("/architecture")
async def architecture() -> dict:
    """Real architecture metadata + tensor list (Explorer data source)."""
    return _require_engine().architecture()


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    eng = _require_engine()
    try:
        # The forward pass is CPU/GPU-bound and holds an internal lock; run it off
        # the event loop so the server stays responsive.
        import anyio

        data = await anyio.to_thread.run_sync(eng.analyze, req.sentence)
    except TokenizedTooLong as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AnalyzeResponse(**data)


@app.websocket("/ws/generate")
async def ws_generate(ws: WebSocket) -> None:
    """Stream a real greedy generation, one message per generated token.

    The blocking decode loop runs in a worker thread; frames cross to the event
    loop through a *bounded* queue, which gives automatic backpressure — if the
    browser can't keep up, the queue fills and the generating thread blocks,
    so memory never balloons.
    """
    await ws.accept()
    if engine is None:
        await ws.send_json({"type": "error", "message": "Model is still loading."})
        await ws.close()
        return

    try:
        req = await ws.receive_json()
    except (WebSocketDisconnect, ValueError):
        return

    prompt = str(req.get("prompt", "")).strip()
    if not prompt:
        await ws.send_json({"type": "error", "message": "Empty prompt."})
        await ws.close()
        return

    max_new_tokens = req.get("max_new_tokens", 40)
    top_k = req.get("top_k", 10)
    use_chat_template = bool(req.get("use_chat_template", True))
    include_catalog = bool(req.get("trace", False))

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue(maxsize=32)
    SENTINEL = object()

    def worker() -> None:
        try:
            for frame in engine.generate_steps(
                prompt, max_new_tokens, top_k, use_chat_template, include_catalog
            ):
                # .result() blocks this thread until the queue has room -> backpressure.
                asyncio.run_coroutine_threadsafe(queue.put(frame), loop).result()
        except Exception as exc:  # surface generation errors to the client
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "error", "message": str(exc)}), loop
            ).result()
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(SENTINEL), loop)

    worker_future = loop.run_in_executor(None, worker)
    try:
        while True:
            frame = await queue.get()
            if frame is SENTINEL:
                break
            await ws.send_json(frame)
    except WebSocketDisconnect:
        pass
    finally:
        await worker_future
        try:
            await ws.close()  # graceful close frame after the stream ends
        except RuntimeError:
            pass  # already closed / client gone
