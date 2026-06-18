export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  capabilities: Capabilities;
  createdAt: string;
  updatedAt: string;
}

export interface Capabilities {
  code_interpreter: boolean;
  rlm: boolean;
  rag: boolean;
  web_search: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning: string | null;
  metadata: { ragTargets?: RagTarget[] } | null;
  createdAt: string;
}

export type RagTarget =
  | { filter_type: 'knowledge_base'; filter_value: { knowledge_base_id: string } }
  | { filter_type: 'file_mention'; filter_value: { file_mention: string } }
  | { filter_type: 'tag'; filter_value: { tag_id: string } };

export interface FileItem {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  folderId: string | null;
  tags: Tag[];
  createdAt: string;
  ragStatus: string;
}

export interface Folder {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  knowledgeBaseId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface SearchResult {
  messageId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  messageCreatedAt: string;
  conversationId: string;
  conversationTitle: string;
}

export interface MentionItem {
  id: string;
  type: 'knowledge-base' | 'tag' | 'file';
  name: string;
  path: string;
  kbId: string;
  kbName: string;
}
