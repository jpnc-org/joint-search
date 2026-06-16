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
import { KnowledgeBase } from './KnowledgeBase';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'uuid' })
  knowledgeBaseId!: string;

  @ManyToOne(() => KnowledgeBase, (kb) => kb.folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledgeBaseId' })
  knowledgeBase!: KnowledgeBase;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => Folder, (f) => f.children, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent!: Folder | null;

  @OneToMany(() => Folder, (f) => f.parent)
  children!: Folder[];

  @CreateDateColumn()
  createdAt!: Date;
}
