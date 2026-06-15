import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { File } from './File';
import { Tag } from './Tag';

@Entity('folders')
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.folders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

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

  @OneToMany(() => File, (f) => f.folder)
  files!: File[];

  @ManyToMany(() => Tag, (t) => t.folders)
  @JoinTable({
    name: 'folder_tags',
    joinColumn: { name: 'folderId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId', referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn()
  createdAt!: Date;
}
