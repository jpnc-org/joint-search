import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Folder } from './Folder';
import { File } from './File';
import { Tag } from './Tag';

@Entity('knowledge_bases')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.knowledgeBases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @OneToMany(() => Folder, (f) => f.knowledgeBase)
  folders!: Folder[];

  @OneToMany(() => File, (f) => f.knowledgeBase)
  kbFiles!: File[];

  @OneToMany(() => Tag, (t) => t.knowledgeBase)
  tags!: Tag[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
