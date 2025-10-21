# Queue API

This API route demonstrates how to send messages to Cloudflare Queues.

## Usage Examples

### Send Email

```bash
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "email",
    "to": "user@example.com",
    "subject": "Hello from Queue",
    "body": "This email was sent via Cloudflare Queue!"
  }'
```

### Scrape Article

```bash
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "scrape-article",
    "url": "https://example.com/article",
    "userId": "user123"
  }'
```

### Generate Questions

```bash
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate-questions",
    "articleId": "article-123",
    "content": "Article content here..."
  }'
```

### Call Webhook

```bash
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "webhook",
    "url": "https://example.com/webhook",
    "method": "POST",
    "webhookBody": {
      "event": "user.created",
      "data": { "id": "123" }
    }
  }'
```

### Batch Processing

```bash
curl -X POST http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "type": "batch-process",
    "operation": "process-users",
    "items": [1, 2, 3, 4, 5]
  }'
```

### Send Multiple Messages (Batch)

```bash
curl -X PUT http://localhost:4444/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "type": "email",
        "payload": { "to": "user1@example.com", "subject": "Test", "body": "Test" },
        "timestamp": 1234567890,
        "retryCount": 0
      },
      {
        "type": "email",
        "payload": { "to": "user2@example.com", "subject": "Test", "body": "Test" },
        "timestamp": 1234567890,
        "retryCount": 0
      }
    ]
  }'
```

## Response

Success:
```json
{
  "success": true,
  "message": "Job queued successfully",
  "jobId": "uuid-here"
}
```

Error:
```json
{
  "error": "Failed to queue job",
  "details": "Error message here"
}
```
