import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Redis from 'ioredis';
import { FlightStatus, SeatFocusStatus } from '../../models/enums';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlightGateway } from './flight.gateway';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Flight } from '../../models/entities';
import { REDIS_CLIENT } from '../../common/redis.module';

@Injectable()
export class FlightScheduler {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectRepository(Flight)
    private readonly flightRepo: Repository<Flight>,
    private readonly flightService: FlightService,
    private readonly statsService: FlightStatsService,
    private readonly gateway: FlightGateway,
  ) { }

  @Cron('* * * * * *')
  async checkFlights() {
    const now = Math.floor(Date.now() / 1000);

    // Takeoff: find group flights with takeoffAt <= now from sorted set
    const readyIds = await this.redis.zrangebyscore('group:flights', 0, now);
    for (const flightId of readyIds) {
      const key = `flight:${flightId}`;
      const data = await this.redis.hgetall(key);
      if (!data.status || parseInt(data.status) !== FlightStatus.PENDING) continue;

      const seatVals = await this.redis.hvals(`flight:${flightId}:seats`);
      console.log('Checking flight', flightId, 'seats:', seatVals);
      const seatedSeats = seatVals.map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
      if (seatedSeats.length === 0) continue;

      const hasFocusedSeat = seatedSeats.some(s => s.focusStatus === SeatFocusStatus.FOCUSED);
      if (!hasFocusedSeat) continue;

      await this.redis.hset(key, 'status', String(FlightStatus.FLYING));
      await this.flightRepo.update({ id: flightId }, { status: FlightStatus.FLYING });

      const seatedUserIds = seatedSeats.map(s => s.userId);
      console.log('Flight taking off', flightId, 'seatedUserIds:', seatedUserIds);
      this.gateway.broadcastToRoom(`flight:${flightId}`, 'takingOff', { flightId, seatedUserIds });
    }

    // Arrival: check flying flights
    const allFlightKeys = await this.redis.keys('flight:*');
    for (const key of allFlightKeys) {
      const data = await this.redis.hgetall(key);
      console.log('Checking flight for arrival', key, 'data:', data);
      if (!data.status || parseInt(data.status) !== FlightStatus.FLYING) continue;

      if (parseInt(data.arrivalAt) <= now) {
        await this.redis.hset(key, 'status', String(FlightStatus.ARRIVED));
        const flightId = key.replace('flight:', '');
        await this.flightRepo.update({ id: flightId }, { status: FlightStatus.ARRIVED });
        this.gateway.broadcastToRoom(`flight:${flightId}`, 'arrived', { flightId });

        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (flight) {
          await this.statsService.settleFlight(flightId, flight.arrivalAt, FlightStatus.ARRIVED);
          await this.redis.del(key);
          await this.redis.del(`flight:${flightId}:seats`);
          await this.redis.zrem('group:flights', flightId);
        }
      }
    }
  }
}