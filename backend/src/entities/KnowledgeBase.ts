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
import { File } from './File';

@Entity('knowledge_bases')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.knowledgeBases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @ManyToMany(() => File, (f) => f.knowledgeBases)
  @JoinTable({
    name: 'knowledge_base_files',
    joinColumn: {
      name: 'knowledgeBaseId',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: { name: 'fileId', referencedColumnName: 'id' },
  })
  files!: File[];

  @CreateDateColumn()
  createdAt!: Date;
}
