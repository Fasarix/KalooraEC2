import os
import sys

PORT = int(os.environ.get("PORT", 5002))

# Fail-fast if JWT_SECRET is missing or insecure
_jwt_secret = os.environ.get("JWT_SECRET", "")
if not _jwt_secret or len(_jwt_secret) < 32:
    print("FATAL ERROR: JWT_SECRET environment variable is missing or insecure (must be >= 32 characters).", file=sys.stderr)
    sys.exit(1)

JWT_SECRET = _jwt_secret
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
DYNAMODB_DIARY_TABLE = os.environ.get("DYNAMODB_DIARY_TABLE", "kaloora-diary")
DYNAMODB_FOODS_TABLE = os.environ.get("DYNAMODB_FOODS_TABLE", "kaloora-foods")
SQS_QUEUE_URL = os.environ.get("SQS_QUEUE_URL", "")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*")

# Redis Cache Config (ElastiCache / Local Redis)
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD") or os.environ.get("REDIS_AUTH_TOKEN", "")
REDIS_TLS = os.environ.get("REDIS_TLS", "false").lower() in ("true", "1") or "cache.amazonaws.com" in REDIS_HOST

