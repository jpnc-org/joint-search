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
import { Folder } from './Folder';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 7, default: '#6366f1' })
  color!: string;

  @ManyToMany(() => File, (f) => f.tags)
  files!: File[];

  @ManyToMany(() => Folder, (f) => f.tags)
  folders!: Folder[];

  @CreateDateColumn()
  createdAt!: Date;
}
