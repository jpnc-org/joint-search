import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Message } from './Message';

export interface Capabilities {
  code_interpreter: boolean;
  rlm: boolean;
  rag: boolean;
  web_search: boolean;
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 500, default: 'New Conversation' })
  title!: string;

  @Column({
    type: 'jsonb',
    name: 'capabilities',
    default: () => "'{\"code_interpreter\":false,\"rlm\":false,\"rag\":false,\"web_search\":false}'",
  })
  capabilities!: Capabilities;

  @OneToMany(() => Message, (m) => m.conversation)
  messages!: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
