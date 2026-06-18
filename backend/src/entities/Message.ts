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

export type RagTarget =
  | { filter_type: 'knowledge_base'; filter_value: { knowledge_base_id: string } }
  | { filter_type: 'file_mention'; filter_value: { file_mention: string } }
  | { filter_type: 'tag'; filter_value: { tag_id: string } };

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
  metadata!: { ragTargets?: RagTarget[] } | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
