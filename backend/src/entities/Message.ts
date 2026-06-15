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

  @Column({ type: 'uuid' })
  conversationId!: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: Conversation;

  @Column({ type: 'varchar', length: 20 })
  role!: MessageRole;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: { fileMentions?: FileMention[] } | null;

  @CreateDateColumn()
  createdAt!: Date;
}
