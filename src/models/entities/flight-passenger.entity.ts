import { Entity, PrimaryColumn, Column } from 'typeorm';
import { Role, UserFlyStatus } from '../enums';

@Entity('flight_passenger')
export class FlightPassenger {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'varchar', length: 32 })
  flightId: string;

  @Column({ type: 'varchar', length: 32 })
  userId: string;

  @Column({ type: 'varchar', length: 4, default: '' })
  seatNum: string;

  @Column({ type: 'tinyint', default: Role.PASSENGER })
  role: Role;

  @Column({ type: 'tinyint', default: UserFlyStatus.FOCUSING })
  status: UserFlyStatus;

  @Column({ type: 'int', default: 0 })
  joinAt: number;

  @Column({ type: 'int', nullable: true })
  quitAt: number;

  @Column({ type: 'int', default: 0 })
  minutes: number;
}