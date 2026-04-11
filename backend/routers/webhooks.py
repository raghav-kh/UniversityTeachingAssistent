"""
Webhook handlers: respond immediately for serverless (Zoom expects < 3s).
Heavy work should be offloaded to a queue (Inngest, QStash, Trigger.dev) — see docstrings.
"""
import hashlib
import json
import hmac
import logging
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _verify_zoom_signature(body: bytes, signature_header: Optional[str], secret: str) -> bool:
    if not signature_header or not secret:
        return False
    # Zoom v2: "v0=<hex_hmac_sha256>"
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    for part in signature_header.split(","):
        part = part.strip()
        if part.startswith("v0="):
            return hmac.compare_digest(part[3:], expected)
    return False


def _process_zoom_event_async(payload: Dict[str, Any]) -> None:
    """Placeholder: persist to DB, call Zoom API, etc. Runs after response in some hosts; on Vercel prefer a queue."""
    logger.info("Zoom webhook processed (async placeholder): event=%s", payload.get("event"))


@router.post("/zoom", status_code=status.HTTP_200_OK)
async def zoom_webhook(request: Request, background_tasks: BackgroundTasks) -> Response:
    """
    Endpoint URL validation: Zoom sends challenge in plain-text; answer immediately.
    For app events: verify signature, return 200 quickly, defer work via queue when possible.
    """
    secret = os.getenv("ZOOM_WEBHOOK_SECRET", "")
    raw = await request.body()

    # URL validation (no signature on initial handshake in some flows)
    try:
        data = json.loads(raw.decode() or "{}")
    except Exception:
        data = {}

    if data.get("event") == "endpoint.url_validation" and "payload" in data:
        token = (data.get("payload") or {}).get("plainToken") or ""
        body: Dict[str, str] = {"plainToken": token}
        if secret and token:
            body["encryptedToken"] = hmac.new(secret.encode(), token.encode(), hashlib.sha256).hexdigest()
        return Response(content=json.dumps(body), media_type="application/json")

    if secret:
        sig = request.headers.get("x-zm-signature") or request.headers.get("Authorization")
        if not _verify_zoom_signature(raw, sig, secret):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    background_tasks.add_task(_process_zoom_event_async, data)
    return Response(status_code=200)
