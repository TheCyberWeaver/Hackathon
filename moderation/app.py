import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, StringConstraints

from moderator import Moderator

Text = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=200)]
logger = logging.getLogger(__name__)


class ModerationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: Text


class ModerationResponse(BaseModel):
    decision: Literal["accept", "reject"]


def create_app(factory=None):
    @asynccontextmanager
    async def lifespan(app):
        app.state.moderator = factory() if factory else Moderator(
            cache_dir=os.getenv("MODERATION_CACHE_PATH", ".model-cache"),
            threshold=float(os.getenv("MODERATION_THRESHOLD", "0.95")),
        )
        yield

    app = FastAPI(title="AskPool moderation", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/moderate", response_model=ModerationResponse)
    def moderate(request: ModerationRequest):
        try:
            return ModerationResponse(decision=app.state.moderator.decide(request.question))
        except Exception:
            # Do not log student question text or echo it in an error response.
            logger.error("Moderation inference failed")
            raise HTTPException(status_code=503, detail="Moderation unavailable") from None

    return app


app = create_app()
