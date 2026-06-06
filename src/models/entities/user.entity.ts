import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('user')
export class User {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 64, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 256, default: '' })
  avatar: string;

  @Column({ type: 'boolean', default: false })
  vip: boolean;

  @Column({ type: 'varchar', length: 8, default: '' })
  region: string;
}