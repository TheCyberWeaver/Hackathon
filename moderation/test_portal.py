"""Temporary loopback-only test UI, separate from the deployed API."""

import argparse
import secrets
from pathlib import Path

import uvicorn
from fastapi import BackgroundTasks, HTTPException, Request
from fastapi.responses import HTMLResponse

from app import create_app


def create_portal(factory=None, on_shutdown=None):
    app = create_app(factory)
    token = secrets.token_urlsafe(32)
    app.state.shutdown = on_shutdown

    @app.get("/", response_class=HTMLResponse)
    def portal():
        html = Path(__file__).with_name("test_portal.html").read_text(encoding="utf-8")
        return HTMLResponse(html.replace("__STOP_TOKEN__", token), headers={"Cache-Control": "no-store"})

    @app.post("/shutdown")
    def shutdown(request: Request, tasks: BackgroundTasks):
        if not secrets.compare_digest(request.headers.get("X-Test-Token", ""), token):
            raise HTTPException(403, "Invalid portal token")
        if app.state.shutdown is None:
            raise HTTPException(503, "Stop the portal from its terminal")
        tasks.add_task(app.state.shutdown)
        return {"status": "stopping"}

    return app


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8091)
    args = parser.parse_args()
    app = create_portal()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=args.port, workers=1, access_log=False))
    app.state.shutdown = lambda: setattr(server, "should_exit", True)
    server.run()
