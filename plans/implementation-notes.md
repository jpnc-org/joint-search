# Implementation Notes

Internal reference for building the deep-research/fact-checking chat app.

## Directory Structure

```
website/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── api/                 # API client, auth interceptors
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Route-level components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── contexts/            # Auth context, etc.
│   │   ├── types/               # Shared TypeScript types
│   │   ├── utils/               # Helpers
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/                     # Express API
│   ├── src/
│   │   ├── entities/            # TypeORM entities
│   │   ├── routes/              # Route definitions
│   │   ├── middleware/           # Auth, error handling, upload
│   │   ├── services/            # Business logic (S3, auth, etc.)
│   │   ├── utils/               # Helpers
│   │   ├── migrations/          # TypeORM migrations (generated)
│   │   ├── types/               # TS types, enums
│   │   └── index.ts             # Entry point
│   ├── package.json
│   ├── tsconfig.json
│   ├── ormconfig.ts
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── documentation.md
└── plans/
    └── implementation-notes.md
```

## Database Schema (TypeORM Entities)

### User
```
id: uuid (PK, generated)
email: varchar(255), unique, not null
passwordHash: varchar(255), not null
name: varchar(255), not null
createdAt: timestamp, default now()
updatedAt: timestamp, auto-update
```

### Conversation
```
id: uuid (PK, generated)
userId: uuid (FK -> User.id), not null
title: varchar(500), default 'New Conversation'
createdAt: timestamp
updatedAt: timestamp
Relations: user (ManyToOne), messages (OneToMany), capabilities (OneToMany)
```

### Message
```
id: uuid (PK, generated)
conversationId: uuid (FK -> Conversation.id), not null
role: enum('user', 'assistant', 'system'), not null
content: text, not null
metadata: jsonb, nullable (stores file mentions: [{fileId, fileName, tagName}])
createdAt: timestamp
Relations: conversation (ManyToOne)
```

### Folder
```
id: uuid (PK, generated)
userId: uuid (FK -> User.id), not null
name: varchar(255), not null
parentId: uuid (FK -> Folder.id), nullable, self-referential
createdAt: timestamp
Relations: user (ManyToOne), parent (self ManyToOne), children (self OneToMany), files (OneToMany), tags (ManyToMany via folder_tags)
```

### File
```
id: uuid (PK, generated)
userId: uuid (FK -> User.id), not null
name: varchar(255), not null (display name)
originalName: varchar(255), not null
mimeType: varchar(255), not null
size: integer, not null (bytes)
s3Key: varchar(1024), not null (object key in MinIO)
folderId: uuid (FK -> Folder.id), nullable
createdAt: timestamp
Relations: user (ManyToOne), folder (ManyToOne), tags (ManyToMany via file_tags), knowledgeBases (ManyToMany via knowledge_base_files)
```

### Tag
```
id: uuid (PK, generated)
userId: uuid (FK -> User.id), not null
name: varchar(255), not null
color: varchar(7), default '#6366f1' (hex color)
createdAt: timestamp
Relations: user (ManyToOne), files (ManyToMany via file_tags), folders (ManyToMany via folder_tags)
```

### file_tags (junction)
```
fileId: uuid (FK -> File.id), PK
tagId: uuid (FK -> Tag.id), PK
```

### folder_tags (junction)
```
folderId: uuid (FK -> Folder.id), PK
tagId: uuid (FK -> Tag.id), PK
```

### KnowledgeBase
```
id: uuid (PK, generated)
userId: uuid (FK -> User.id), not null
name: varchar(255), not null
description: text, nullable
createdAt: timestamp
Relations: user (ManyToOne), files (ManyToMany via knowledge_base_files)
```

### knowledge_base_files (junction)
```
knowledgeBaseId: uuid (FK -> KnowledgeBase.id), PK
fileId: uuid (FK -> File.id), PK
```

### ConversationCapability (embedded in Conversation as jsonb or separate table)
Decision: use a jsonb column on Conversation for simplicity.
```
conversation.capabilities: jsonb, default {
  code_interpreter: false,
  rlm: false,
  rag: false,
  web_search: false
}
```
This avoids an extra table for something that's just a set of toggles per conversation.

## API Endpoints

All routes prefixed with `/api`. Auth routes are public. All others require `Authorization: Bearer <jwt>`.

### Auth
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/auth/register | {email, password, name} | {user, accessToken, refreshToken} |
| POST | /api/auth/login | {email, password} | {user, accessToken, refreshToken} |
| GET | /api/auth/me | - | {user} |
| POST | /api/auth/refresh | {refreshToken} | {accessToken} |

Tokens: accessToken (15min), refreshToken (7d). Store refreshToken in httpOnly cookie.

### Conversations
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | /api/conversations | - | Conversation[] |
| POST | /api/conversations | {title?} | Conversation |
| GET | /api/conversations/:id | - | Conversation |
| PATCH | /api/conversations/:id | {title?, capabilities?} | Conversation |
| DELETE | /api/conversations/:id | - | 204 |
| GET | /api/conversations/:id/messages | - | Message[] |
| POST | /api/conversations/:id/messages | {content, fileMentions?} | SSE stream (text/event-stream) |

SSE format for streaming:
```
event: token
data: {"token": "word"}

event: done
data: {"messageId": "uuid"}

event: error
data: {"error": "message"}
```

`fileMentions` in message body: `{fileId?: string, tagName?: string, fileName?: string}[]` — used to construct RAG context.

### Files
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/files/upload | multipart: file, folderId? | File |
| GET | /api/files | query: folderId?, tagId? | File[] |
| GET | /api/files/:id | - | File |
| PATCH | /api/files/:id | {name?, folderId?} | File |
| DELETE | /api/files/:id | - | 204 |
| POST | /api/files/:id/tags | {tagId} | 200 |
| DELETE | /api/files/:id/tags/:tagId | - | 204 |

Upload uses multer → S3 (MinIO). Max file size: 50MB configurable via env.

### Folders
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/folders | {name, parentId?} | Folder |
| GET | /api/folders | query: parentId? | Folder[] |
| PATCH | /api/folders/:id | {name?, parentId?} | Folder |
| DELETE | /api/folders/:id | - | 204 (cascades children/files) |
| POST | /api/folders/:id/tags | {tagId} | 200 |
| DELETE | /api/folders/:id/tags/:tagId | - | 204 |

### Tags
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/tags | {name, color?} | Tag |
| GET | /api/tags | - | Tag[] |
| PATCH | /api/tags/:id | {name?, color?} | Tag |
| DELETE | /api/tags/:id | - | 204 |

### Knowledge Bases
| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | /api/knowledge-bases | {name, description?} | KnowledgeBase |
| GET | /api/knowledge-bases | - | KnowledgeBase[] |
| GET | /api/knowledge-bases/:id | - | KnowledgeBase (with files) |
| PATCH | /api/knowledge-bases/:id | {name?, description?} | KnowledgeBase |
| DELETE | /api/knowledge-bases/:id | - | 204 |
| POST | /api/knowledge-bases/:id/files | {fileIds: string[]} | 200 |
| DELETE | /api/knowledge-bases/:id/files/:fileId | - | 204 |

## Environment Variables

### Root .env (docker-compose)
```
# PostgreSQL
POSTGRES_USER=app
POSTGRES_PASSWORD=changeme
POSTGRES_DB=deepresearch

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=uploads

# Backend
BACKEND_PORT=3001
JWT_SECRET=changeme-jwt-secret
JWT_REFRESH_SECRET=changeme-refresh-secret
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
MAX_FILE_SIZE=52428800

# Frontend
VITE_API_URL=http://localhost:3001
```

### backend/.env.example
```
DATABASE_URL=postgres://app:changeme@postgres:5432/deepresearch
JWT_SECRET=changeme-jwt-secret
JWT_REFRESH_SECRET=changeme-refresh-secret
JWT_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=uploads
S3_REGION=us-east-1
MAX_FILE_SIZE=52428800
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

### frontend/.env.example
```
VITE_API_URL=http://localhost:3001
```

## Docker

### docker-compose.yml services
1. **postgres** - image: postgres:16-alpine, volume for data persistence
2. **minio** - image: minio/minio:latest, command: server /data --console-address ":9001", volume for data
3. **backend** - build from backend/Dockerfile, depends_on postgres+minio, env_file
4. **frontend** - build from frontend/Dockerfile (multi-stage: node build → nginx serve), depends_on backend

### Backend Dockerfile
```
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile
```
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### nginx.conf
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Frontend Structure

### Pages
- `/login` — Login form, redirects to `/` if authenticated
- `/register` — Register form, redirects to `/` if authenticated
- `/` — Main chat interface
- `/knowledge-base` — File/folder/tag/knowledge-base management

### Key Components
```
App.tsx
├── AuthProvider (context)
├── Router
│   ├── LoginPage
│   ├── RegisterPage
│   ├── ChatPage
│   │   ├── Sidebar
│   │   │   ├── ConversationList
│   │   │   └── NewConversationButton
│   │   ├── ChatArea
│   │   │   ├── MessageList
│   │   │   ├── MessageBubble (with file mention badges)
│   │   │   ├── CapabilityToggles
│   │   │   ├── FileMentionInput (autocomplete for @file/@tag)
│   │   │   └── ChatInput (textarea + send)
│   │   └── ConversationHeader (title edit, settings)
│   └── KnowledgeBasePage
│       ├── FolderTree
│       ├── FileList
│       ├── FileUpload (drag & drop)
│       ├── TagManager
│       └── KnowledgeBaseList
```

### Auth Flow
1. On mount, AuthProvider checks for accessToken in memory (or cookie)
2. Calls GET /api/auth/me to validate
3. If invalid, redirect to /login
4. Login/Register → store accessToken in memory, refreshToken in httpOnly cookie
5. Axios interceptor refreshes token on 401

### SSE Streaming Implementation
```
// POST /api/conversations/:id/messages returns EventSource-like response
// Use fetch() with ReadableStream to parse SSE
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ content, fileMentions })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
// Parse SSE lines, accumulate tokens, render incrementally
```

## Implementation Order

### Phase 1: Foundation
1. Write both documentation files
2. Create all package.json files
3. Create tsconfig files
4. Create docker-compose.yml + .env.example
5. Create Dockerfiles + nginx.conf

### Phase 2: Backend
1. TypeORM config + entities
2. Auth middleware + JWT utils
3. Auth routes (register, login, me, refresh)
4. Conversation CRUD routes
5. File upload (multer + MinIO client)
6. File/Folder CRUD routes
7. Tag CRUD + assignment routes
8. Knowledge base CRUD routes
9. Message routes + SSE streaming endpoint
10. Express app setup + server start

### Phase 3: Frontend
1. Vite config + base setup
2. API client (axios instance + interceptors)
3. Auth context + hooks
4. Login/Register pages
5. Chat page layout (sidebar + chat area)
6. Conversation list + creation
7. Message display + SSE streaming
8. Capability toggles
9. File mention autocomplete
10. Knowledge base page (file management, folders, tags, KB CRUD)
11. Routing + protected routes

## Tradeoffs & Gotchas

- **JWT in memory vs localStorage**: In memory is more secure (XSS safe), but tokens lost on refresh. Acceptable tradeoff.
- **File mentions as jsonb on Message**: Avoids extra table. Querying by mentioned files is less efficient but we don't need that yet.
- **Capabilities as jsonb vs separate table**: jsonb is simpler for 4 boolean toggles. Schema change later if we add more.
- **MinIO bucket auto-creation**: Backend creates bucket on startup if it doesn't exist.
- **Multer memory storage → S3 stream**: For files under 50MB, buffering in memory is fine. For larger files, switch to streaming.
- **Cascading deletes**: Deleting a folder deletes all files in it (both from DB and S3). This needs careful implementation.
- **Refresh token rotation**: Not implementing rotation for now. Single refresh token per login. Logout invalidates all tokens for user (delete from DB).
- **No email verification yet**: Schema supports it (add `verified: boolean` column later), but not implemented now.
- **Frontend nginx proxies /api/ to backend**: In dev, Vite proxy handles this. In production, nginx does.
- **TypeORM synchronize**: Use `true` in dev, `false` in prod (use migrations). Config via env var.
