import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from './Conversation';
import { File } from './File';
import { Folder } from './Folder';
import { Tag } from './Tag';
import { KnowledgeBase } from './KnowledgeBase';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @OneToMany(() => Conversation, (c) => c.user)
  conversations!: Conversation[];

  @OneToMany(() => File, (f) => f.user)
  files!: File[];

  @OneToMany(() => Folder, (f) => f.user)
  folders!: Folder[];

  @OneToMany(() => Tag, (t) => t.user)
  tags!: Tag[];

  @OneToMany(() => KnowledgeBase, (kb) => kb.user)
  knowledgeBases!: KnowledgeBase[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
