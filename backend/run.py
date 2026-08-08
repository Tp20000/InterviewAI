import warnings
warnings.filterwarnings("ignore")

import os
import sys

# Load .env file (local dev only)
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(env_path):
    with open(env_path, "rb") as f:
        raw = f.read()
    content = raw.decode("ascii", errors="ignore").replace("\r", "")
    for line in content.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ[k.strip()] = v.strip()

# ── Async mode detection ─────────────────────────────────────
# Try eventlet first (best for local), fall back to gevent,
# then threading (works everywhere)
ASYNC_MODE = "threading"  # safe default

try:
    import eventlet
    eventlet.monkey_patch()
    ASYNC_MODE = "eventlet"
    print("[InterviewAI] Using eventlet async mode")
except Exception as e:
    print("[InterviewAI] eventlet not available: " + str(e))
    try:
        import gevent.monkey
        gevent.monkey.patch_all()
        ASYNC_MODE = "gevent"
        print("[InterviewAI] Using gevent async mode")
    except Exception as e2:
        print("[InterviewAI] gevent not available: " + str(e2))
        print("[InterviewAI] Using threading async mode")

os.environ["SOCKETIO_ASYNC_MODE"] = ASYNC_MODE

from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"

    print("=" * 52)
    print("  InterviewAI Backend")
    print("  URL    : http://0.0.0.0:" + str(port))
    print("  Health : http://0.0.0.0:" + str(port) + "/api/health")
    print("  Mode   : " + ("Development" if debug else "Production"))
    print("  Async  : " + ASYNC_MODE)
    print("  Press Ctrl+C to stop")
    print("=" * 52)

    try:
        socketio.run(
            app,
            host="0.0.0.0",
            port=port,
            debug=debug,
            use_reloader=False,
            log_output=False
        )
    except KeyboardInterrupt:
        print("\nBackend stopped.")
        sys.exit(0)