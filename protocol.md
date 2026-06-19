Agent Service API

POST /v1/chat/stream

Request:
{
  "request_id": "uuid",                  // backend-generated, unique per generation
  "conversation_id": "uuid",             // for logging/tracking
  "message_id": "uuid",                  // the user message ID
  "content": "user message text",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "...", "reasoning": "..." }
  ],
  "capabilities": {
    "code_interpreter": true,
    "rlm": false,
    "rag": true,
    "web_search": false
  },
  "rag_rlm_targets": [
  {
    "filter_type": "knowledge_base" | "file_mention" | "tag",
    "filter_value":
      {
        "knowledge_base_name": "name"
      } |
      {
        "file_mention":
          {
            "file_id": "uuid",
            "original_name": "paper.pdf",
            "mime_type": "application/pdf",
            "s3_key": "uploads/user-uuid/file-uuid.pdf",
            "size": 1048576
          }
      } |
      {
        "tag": "tag-name"
      }
  }
  ]
}

Response: SSE stream

event: reasoning
data: {"token": "Let me"}
event: reasoning
data: {"token": " think"}
event: token
data: {"token": "Here"}
event: token
data: {"token": " is"}
event: done
data: {"request_id": "uuid", "title_suggestion": "Paper analysis"}
event: error
data: {"error": "Rate limit exceeded", "code": "RATE_LIMITED"}

---

POST /v1/cancel

Request:
{
  "request_id": "uuid"     // which in-flight generation to abort
}

Response: 200 { "ok": true }

---

GET /health

Response: 200 { "status": "ok" }