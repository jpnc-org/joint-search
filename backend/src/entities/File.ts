import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Folder } from './Folder';
import { Tag } from './Tag';
import { KnowledgeBase } from './KnowledgeBase';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  knowledgeBaseId!: string;

  @ManyToOne(() => KnowledgeBase, (kb) => kb.kbFiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase!: KnowledgeBase;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ type: 'varchar', length: 255 })
  mimeType!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({ type: 'varchar', length: 1024 })
  s3Key!: string;

  @Column({ type: 'uuid', nullable: true })
  folderId!: string | null;

  @ManyToOne(() => Folder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'folderId' })
  folder!: Folder | null;

  @ManyToMany(() => Tag, (t) => t.files)
  @JoinTable({
    name: 'file_tags',
    joinColumn: { name: 'fileId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn()
  createdAt!: Date;
}
