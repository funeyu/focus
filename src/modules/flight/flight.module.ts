import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flight, FlightPassenger, FlightPassengerStatusLog, FlightStats } from '../../models/entities';
import { FlightController } from './flight.controller';
import { FlightService } from './flight.service';
import { FlightGateway } from './flight.gateway';
import { FlightStatsService } from './flight-stats.service';
import { FlightScheduler } from './flight.scheduler';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Flight, FlightPassenger, FlightPassengerStatusLog, FlightStats]),
    UserModule,
  ],
  controllers: [FlightController],
  providers: [FlightService, FlightGateway, FlightStatsService, FlightScheduler],
  exports: [FlightService, FlightStatsService],
})
export class FlightModule {}