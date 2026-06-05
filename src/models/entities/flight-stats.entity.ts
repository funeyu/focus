import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('flight_stats')
export class FlightStats {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  totalMinutes: number;

  @Column({ type: 'int', default: 0 })
  totalArrivals: number;

  @Column({ type: 'int', default: 0 })
  totalCrashes: number;

  @Column({ type: 'int', default: 0 })
  streakDays: number;

  @Column({ type: 'int', default: 0 })
  lastFlightDay: number;

  @Column({ type: 'text', nullable: true })
  distribution: string;

  @Column({ type: 'text', nullable: true })
  friendRanks: string;
}