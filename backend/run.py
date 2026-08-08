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

import eventlet
eventlet.monkey_patch()

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