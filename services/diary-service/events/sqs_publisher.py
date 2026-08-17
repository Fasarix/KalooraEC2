import boto3
import json
from config import AWS_REGION, SQS_QUEUE_URL

_sqs_client = None

def get_sqs_client():
    global _sqs_client
    if _sqs_client is None:
        try:
            _sqs_client = boto3.client("sqs", region_name=AWS_REGION)
        except Exception as e:
            print(f"Error initializing AWS SQS client: {e}")
            _sqs_client = None
    return _sqs_client

# Persistent AWS SQS Event Publisher
def publish_event(event_type, user_id, date, data):
    try:
        if not SQS_QUEUE_URL:
            print("SQS_QUEUE_URL not configured. Skipping event publish.")
            return False

        sqs = get_sqs_client()
        if not sqs:
            print("AWS SQS client unavailable. Skipping event publish.")
            return False

        payload = {
            "type": event_type,
            "userId": str(user_id),
            "date": date,
            "data": data
        }

        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(payload)
        )
        print(f"Published SQS event: {event_type} for user {user_id} (MessageId: {response.get('MessageId')})")
        return True
    except Exception as e:
        print(f"Error publishing to AWS SQS: {str(e)}")
        return False
