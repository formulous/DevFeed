import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';
import { TagSynonym } from './tag-synonym.entity';

@Entity('tags')
export class Tag {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 60 })
  slug: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  category: string | null;

  @OneToMany(() => TagSynonym, (synonym) => synonym.tag)
  synonyms: TagSynonym[];

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime', precision: 3, insert: false, update: false })
  updatedAt: Date;
}
