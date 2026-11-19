import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { bigintNumber } from '../common/database/transformers';
import { Tag } from './tag.entity';

@Entity('tag_synonyms')
export class TagSynonym {
  @PrimaryColumn({ type: 'bigint', unsigned: true, generated: 'increment', transformer: bigintNumber })
  id: number;

  @Column({ name: 'tag_id', type: 'bigint', unsigned: true, transformer: bigintNumber })
  tagId: number;

  @ManyToOne(() => Tag, (tag) => tag.synonyms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;

  @Column({ type: 'varchar', length: 100 })
  synonym: string;

  @Column({ name: 'created_at', type: 'datetime', precision: 3, insert: false, update: false })
  createdAt: Date;
}
