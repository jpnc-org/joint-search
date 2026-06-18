# DeepResearch — Chat-based Fact-Checking & Research Platform

## What It Does

A chat application where users converse with an LLM to perform deep research and fact-checking. Key capabilities:

- **RAG** — Upload files to knowledge bases, mention them in chat for context-aware answers
- **Code Interpreter** — Toggle on/off per conversation
- **Web Search** — Toggle on/off per conversation
- **File Mentions** — Reference files/folders by name or tag in chat messages

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend   │────▶│    Backend    │────▶│ PostgreSQL │
│  React/Vite  │     │  Express/TS  │     └────────────┘
│   (Nginx)    │     │              │     ┌────────────┐
└─────────────┘     │              │────▶│   MinIO    │
                    └──────────────┘     └────────────┘
```

- **Frontend**: React SPA (TypeScript, Vite), served by Nginx in production
- **Backend**: Express.js API (TypeORM for DB, MinIO client for file storage)
- **Database**: PostgreSQL 16
- **Object Storage**: MinIO (S3-compatible)

## Running Locally

```bash
# 1. Copy env files
cp .env.example .env

# 2. Start everything
docker compose up --build

# 3. Access
# Frontend: http://localhost:5173 (dev) or http://localhost:80 (production)
# Backend API: http://localhost:3001
# MinIO Console: http://localhost:9001
```

## Key Concepts

### Knowledge Bases
Group files into knowledge bases. When chatting, mention a knowledge base to include its files as RAG context.

### File & Folder Tags
Tag files and folders for organization. In chat, mention a tag (e.g., `@research-papers`) to pull context from all files with that tag.

### Capabilities
Per-conversation toggles:
- **Code Interpreter** — LLM executes code in a sandboxed environment
- **RAG** — Retrieve context from knowledge bases / tagged files
- **Web Search** — LLM can search the web for current information
- **RLM** — Retrieval-augmented language model (advanced RAG pipeline)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | DB username | `app` |
| `POSTGRES_PASSWORD` | DB password | `changeme` |
| `POSTGRES_DB` | DB name | `deepresearch` |
| `MINIO_ROOT_USER` | MinIO access key | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | MinIO secret key | `minioadmin` |
| `MINIO_BUCKET` | S3 bucket name | `uploads` |
| `JWT_SECRET` | JWT signing key | `changeme-jwt-secret` |
| `JWT_REFRESH_SECRET` | Refresh token key | `changeme-refresh-secret` |
| `VITE_API_URL` | Backend API URL (frontend) | `http://localhost:3001` |

## Project Structure

```
frontend/   — React SPA (TypeScript, Vite)
backend/    — Express API (TypeORM, JWT auth, MinIO)
docker-compose.yml
.env.example
```

## API Overview

| Route Group | Purpose |
|-------------|---------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Login, get tokens |
| `GET /api/auth/me` | Get current user |
| `GET/POST /api/conversations` | List / create conversations |
| `POST /api/conversations/:id/messages` | Send message, SSE stream response |
| `POST /api/files/upload` | Upload file (multipart) |
| `GET/POST /api/folders` | Folder management |
| `GET/POST /api/tags` | Tag management |
| `GET/POST /api/knowledge-bases` | Knowledge base management |

Full API docs in `plans/implementation-notes.md`.
