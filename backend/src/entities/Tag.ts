import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { File } from './File';
import { KnowledgeBase } from './KnowledgeBase';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', name: 'knowledge_base_id' })
  knowledgeBaseId!: string;

  @ManyToOne(() => KnowledgeBase, (kb) => kb.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_base_id' })
  knowledgeBase!: KnowledgeBase;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 7, default: '#6366f1' })
  color!: string;

  @ManyToMany(() => File, (f) => f.tags)
  files!: File[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
