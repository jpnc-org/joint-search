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

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.conversations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 500, default: 'New Conversation' })
  title!: string;

  @Column({
    type: 'jsonb',
    default: () => "'{\"code_interpreter\":false,\"rlm\":false,\"rag\":false,\"web_search\":false}'",
  })
  capabilities!: Capabilities;

  @OneToMany(() => Message, (m) => m.conversation)
  messages!: Message[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
