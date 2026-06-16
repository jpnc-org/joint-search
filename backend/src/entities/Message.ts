import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './Conversation';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface FileMention {
  fileId?: string;
  fileName?: string;
  tagName?: string;
}

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 20 })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: { fileMentions?: FileMention[] } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
