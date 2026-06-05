import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('friendship')
@Index('idx_userA', ['userIdA'])
@Index('idx_userB', ['userIdB'])
export class Friendship {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 32 })
  userIdA: string;

  @Column({ type: 'varchar', length: 32 })
  userIdB: string;

  @Column({ type: 'varchar', length: 32 })
  flightId: string;

  @Column({ type: 'int', default: 0 })
  createdAt: number;
}