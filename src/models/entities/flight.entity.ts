import { Entity, PrimaryColumn, Column } from 'typeorm';
import { FlightMode, FlightStatus, FlyMode } from '../enums';

@Entity('flight')
export class Flight {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 32 })
  captainId: string;

  @Column({ type: 'tinyint', default: FlightMode.MULTIPLE })
  mode: FlightMode;

  @Column({ type: 'tinyint', default: FlyMode.SAFE })
  flyMode: FlyMode;

  @Column({ type: 'tinyint', default: FlightStatus.PENDING })
  status: FlightStatus;

  @Column({ type: 'int', default: 0 })
  from: number;

  @Column({ type: 'int', default: 0 })
  to: number;

  @Column({ type: 'int', default: 0 })
  takeoffAt: number;

  @Column({ type: 'int', default: 0 })
  arrivalAt: number;

  @Column({ type: 'int', default: 0 })
  createdAt: number;

  @Column({ type: 'text', nullable: true })
  scheduledIds: string;

  @Column({ type: 'int', default: 0 })
  minutes: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  crashByUserId: string;

  @Column({ type: 'json', nullable: true })
  seats: { num: string; userId: string; focusScene: number }[] | null;
}