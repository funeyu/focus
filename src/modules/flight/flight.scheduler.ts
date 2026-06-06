import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { FlightStatus, SeatFocusStatus } from '../../models/enums';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlightGateway } from './flight.gateway';
import { REDIS_CLIENT } from '../../common/redis.module';

@Injectable()
export class FlightScheduler {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly flightService: FlightService,
    private readonly statsService: FlightStatsService,
    private readonly gateway: FlightGateway,
  ) { }

  @Cron('* * * * * *')
  async checkFlights() {
    const now = Math.floor(Date.now() / 1000);
    const dtos = await this.flightService.getAllCachedFlights();

    for (const dto of dtos) {
      console.log('dto', dto);
      if (!dto) continue;

      const flightId = dto.id;
      // Expired PENDING: takeoff time passed but no focused seats — cancel
      if (dto.status === FlightStatus.PENDING && dto.takeoffAt <= now) {
        const hasFocusedSeat = dto.seats.some(s => s.focusStatus === SeatFocusStatus.FOCUSED);
        if (!hasFocusedSeat) {
          await this.flightService.deleteFlight(flightId, dto.captainId);
          continue;
        }
      }

      if (dto.status === FlightStatus.PENDING && dto.takeoffAt <= now) {
        dto.status = FlightStatus.FLYING;
        await this.flightService.setCachedFlightDto(flightId, dto);
        await this.flightService.updateFlightStatus(flightId, FlightStatus.FLYING);
        const seatedUserIds = dto.seats.map(s => s.userInfo?.id).filter(Boolean);
        console.log('Flight taking off', flightId, 'seatedUserIds:', seatedUserIds);
        this.gateway.broadcastToRoom(`flight:${flightId}`, 'takingOff', { flightId, seatedUserIds });
      }

      if (dto.status === FlightStatus.FLYING && dto.arrivalAt <= now) {
        dto.status = FlightStatus.ARRIVED;
        await this.flightService.updateFlightStatus(flightId, FlightStatus.ARRIVED);
        this.gateway.broadcastToRoom(`flight:${flightId}`, 'arrived', { flightId });

        await this.statsService.settleFlight(flightId, dto.arrivalAt, FlightStatus.ARRIVED);
        await this.flightService.cleanupFlightCache(flightId);
      }
    }
  }
}
