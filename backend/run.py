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

# Detect if running under gunicorn (production)
is_gunicorn = "gunicorn" in os.environ.get("SERVER_SOFTWARE", "") or \
              any("gunicorn" in arg for arg in sys.argv)

if not is_gunicorn:
    # Local dev - use eventlet
    try:
        import eventlet
        eventlet.monkey_patch()
        os.environ["SOCKETIO_ASYNC_MODE"] = "eventlet"
        print("[InterviewAI] Using eventlet (local dev)")
    except Exception:
        try:
            import gevent.monkey
            gevent.monkey.patch_all()
            os.environ["SOCKETIO_ASYNC_MODE"] = "gevent"
            print("[InterviewAI] Using gevent (local dev)")
        except Exception:
            os.environ["SOCKETIO_ASYNC_MODE"] = "threading"
            print("[InterviewAI] Using threading (local dev)")
else:
    # Production (Render) - use threading
    # This avoids eventlet worker conflicts with gunicorn
    os.environ["SOCKETIO_ASYNC_MODE"] = "threading"
    print("[InterviewAI] Using threading (production)")

from app import create_app, socketio

app = create_app()

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "False").lower() == "true"

    print("=" * 52)
    print("  InterviewAI Backend")
    print("  URL    : http://0.0.0.0:" + str(port))
    print("  Health : http://0.0.0.0:" + str(port) + "/api/health")
    print("  Mode   : " + ("Dev" if debug else "Production"))
    print("  Async  : " + os.environ.get("SOCKETIO_ASYNC_MODE", "threading"))
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
        print("\nStopped.")
        sys.exit(0)