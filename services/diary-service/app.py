import os
import signal
import sys
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

from config import PORT, CORS_ORIGIN
from routes.foods import food_bp
from routes.diary import diary_bp
from routes.recipes import recipe_bp

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

origins = "*" if CORS_ORIGIN == "*" else CORS_ORIGIN.split(",")
CORS(app, resources={r"/api/*": {"origins": origins}})

app.register_blueprint(food_bp)
app.register_blueprint(diary_bp)
app.register_blueprint(recipe_bp)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "UP", "service": "diary-service"})

def handle_sigterm(signum, frame):
    print("SIGTERM received. Shutting down diary-service gracefully...")
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigterm)

if __name__ == "__main__":
    # Debug mode and host controlled by env vars (prevents public binding during standalone testing)
    debug_mode = os.environ.get("FLASK_DEBUG", "False").lower() in ("true", "1")
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    # nosemgrep: python.flask.security.audit.app-run-param-config.avoid_app_run_with_bad_host
    app.run(host=host, port=PORT, debug=debug_mode)
