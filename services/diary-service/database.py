import boto3
from decimal import Decimal
from config import AWS_REGION, DYNAMODB_DIARY_TABLE, DYNAMODB_FOODS_TABLE

# AWS DynamoDB Resource Client
dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
foods_table = dynamodb.Table(DYNAMODB_FOODS_TABLE)
diary_table = dynamodb.Table(DYNAMODB_DIARY_TABLE)

# Global Secondary Index Names
FOODS_CATEGORY_GSI = "CategoryIndex"

# Optional Redis Cache Client for Sub-Millisecond Search & Recommendations
_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is None:
        try:
            import redis
            from config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS
            
            kwargs = {
                "host": REDIS_HOST,
                "port": REDIS_PORT,
                "decode_responses": True,
                "socket_timeout": 3,
                "socket_connect_timeout": 3
            }
            if REDIS_PASSWORD:
                kwargs["password"] = REDIS_PASSWORD
            if REDIS_TLS:
                kwargs["ssl"] = True
                kwargs["ssl_cert_reqs"] = None

            client = redis.Redis(**kwargs)
            client.ping()
            _redis_client = client
            print("Connected to Redis cache for food/recipe acceleration.")
        except Exception as e:
            # Fallback gracefully to direct DynamoDB querying if Redis is unavailable
            _redis_client = False
            print(f"Redis cache not available for diary-service (fallback to DynamoDB): {e}")
    return _redis_client if _redis_client else None


def decimal_to_native(obj):
    """Recursively converts DynamoDB Decimal types to native int or float for JSON serialization."""
    if isinstance(obj, list):
        return [decimal_to_native(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_native(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    return obj

def native_to_decimal(obj):
    """Recursively converts Python float to Decimal for DynamoDB storage."""
    if isinstance(obj, list):
        return [native_to_decimal(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: native_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    return obj
