import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { UserFlyStatus } from '../enums';

@Entity('flight_passenger_status_log')
@Index('idx_flight_user', ['flightId', 'userId'])
export class FlightPassengerStatusLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  flightId: string;

  @Column({ type: 'varchar', length: 32 })
  userId: string;

  @Column({ type: 'tinyint' })
  status: UserFlyStatus;

  @Column({ type: 'int' })
  timestamp: number;
}