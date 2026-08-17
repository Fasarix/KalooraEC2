const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { SQS_QUEUE_URL, AWS_REGION } = require('../config/env');
const { sanitizeForLog } = require('../utils/logSanitizer');

let isRunning = false;
let currentBackoffMs = 5000;
const MAX_BACKOFF_MS = 60000;

const startConsumer = async (redisClient) => {
  if (!SQS_QUEUE_URL) {
    console.log('SQS_QUEUE_URL not configured. SQS event consumer disabled.');
    return;
  }

  const sqsClient = new SQSClient({ region: AWS_REGION });
  isRunning = true;
  console.log(`Starting AWS SQS event consumer for queue: ${SQS_QUEUE_URL}...`);

  const pollMessages = async () => {
    while (isRunning) {
      try {
        const command = new ReceiveMessageCommand({
          QueueUrl: SQS_QUEUE_URL,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          VisibilityTimeout: 30
        });

        const response = await sqsClient.send(command);

        // Reset backoff upon successful request
        currentBackoffMs = 5000;

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            try {
              const content = JSON.parse(message.Body);
              console.log('Received SQS event:', sanitizeForLog(content));

              const { type, userId, date } = content;
              if (userId) {
                const keysToDelete = [];
                if (date) {
                  keysToDelete.push(`stats:${userId}:${date}`);
                }
                keysToDelete.push(`stats:${userId}:range`);

                // Non-blocking scan for any other stats keys for this user
                try {
                  for await (const key of redisClient.scanIterator({ MATCH: `stats:${userId}:*`, COUNT: 50 })) {
                    keysToDelete.push(key);
                  }
                } catch (scanErr) {
                  console.warn('Redis scanIterator error:', scanErr.message);
                }

                if (keysToDelete.length > 0) {
                  const uniqueKeys = [...new Set(keysToDelete)];
                  await redisClient.del(uniqueKeys);
                }
                console.log(`Invalidated cache for user ${sanitizeForLog(userId)} (date: ${sanitizeForLog(date)}) due to SQS event: ${sanitizeForLog(type)}`);
              }

              // Acknowledge by deleting message from SQS
              const deleteCommand = new DeleteMessageCommand({
                QueueUrl: SQS_QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle
              });
              await sqsClient.send(deleteCommand);
            } catch (msgErr) {
              console.error('Error processing SQS message:', msgErr.message);
            }
          }
        }
      } catch (err) {
        console.error('Error in SQS poll loop (retrying in %ds): %s', currentBackoffMs / 1000, err.message);
        await new Promise((resolve) => setTimeout(resolve, currentBackoffMs));
        // Exponential backoff up to 60s
        currentBackoffMs = Math.min(currentBackoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  };

  // Launch polling loop in background
  pollMessages();
};

const stopConsumer = () => {
  isRunning = false;
};

module.exports = { startConsumer, stopConsumer };
