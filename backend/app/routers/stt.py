import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import websockets
from app.config import settings
from app.services.stt_service import create_soniox_temporary_key

logger = logging.getLogger("opic_stt_router")
router = APIRouter(prefix="/stt", tags=["Speech-to-Text"])

@router.post("/token")
async def get_stt_token():
    """Returns a short-lived temporary token so the permanent key is never exposed to the client."""
    result = await create_soniox_temporary_key()
    return result

@router.websocket("/ws")
async def websocket_stt_proxy(websocket: WebSocket):
    """
    Real-time streaming STT proxy:
    Receives raw audio chunks from client and forwards to Soniox transcribe-websocket,
    then forwards recognition results back to the client.
    Gracefully simulates recognition if Soniox key is absent.
    """
    await websocket.accept()
    
    # Check if Soniox key is configured
    if not settings.SONIOX_API_KEY or settings.SONIOX_API_KEY.startswith("your_"):
        # Simulated live STT streaming for local demo and testing
        try:
            demo_phrases = [
                {"word": "Well,", "confidence": 0.96},
                {"word": "to", "confidence": 0.98},
                {"word": "be", "confidence": 0.98},
                {"word": "honest,", "confidence": 0.95},
                {"word": "I", "confidence": 0.99},
                {"word": "really", "confidence": 0.94},
                {"word": "enjoy", "confidence": 0.97},
                {"word": "spending", "confidence": 0.96},
                {"word": "my", "confidence": 0.99},
                {"word": "free", "confidence": 0.98},
                {"word": "time", "confidence": 0.99},
                {"word": "outdoors.", "confidence": 0.93}
            ]
            while True:
                data = await websocket.receive()
                if "bytes" in data or "text" in data:
                    await asyncio.sleep(0.3)
                    await websocket.send_json({
                        "type": "tokens",
                        "tokens": demo_phrases,
                        "transcript": "Well, to be honest, I really enjoy spending my free time outdoors."
                    })
        except WebSocketDisconnect:
            pass
        return

    # Real Soniox WebSocket connection
    soniox_uri = "wss://api.soniox.com/transcribe-websocket"
    try:
        async with websockets.connect(soniox_uri) as soniox_ws:
            # Send initial config to Soniox
            init_payload = {
                "api_key": settings.SONIOX_API_KEY,
                "app_name": "OPIC_Practice_Studio",
                "audio_format": "webm_opus",
                "sample_rate_hertz": 48000,
                "num_audio_channels": 1,
                "enable_endpoint_detection": True
            }
            await soniox_ws.send(json.dumps(init_payload))

            async def client_to_soniox():
                try:
                    while True:
                        msg = await websocket.receive()
                        if "bytes" in msg and msg["bytes"]:
                            await soniox_ws.send(msg["bytes"])
                        elif "text" in msg:
                            data = json.loads(msg["text"])
                            if data.get("type") == "stop":
                                await soniox_ws.send("")
                                break
                except WebSocketDisconnect:
                    pass

            async def soniox_to_client():
                try:
                    async for response in soniox_ws:
                        resp_data = json.loads(response)
                        await websocket.send_json(resp_data)
                except Exception as e:
                    logger.warning(f"Soniox stream closed: {e}")

            await asyncio.gather(client_to_soniox(), soniox_to_client())
    except Exception as e:
        logger.error(f"WebSocket STT error: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
