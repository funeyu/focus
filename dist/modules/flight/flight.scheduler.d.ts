import Redis from 'ioredis';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlightGateway } from './flight.gateway';
import { Repository } from 'typeorm';
import { Flight } from '../../models/entities';
export declare class FlightScheduler {
    private readonly redis;
    private readonly flightRepo;
    private readonly flightService;
    private readonly statsService;
    private readonly gateway;
    constructor(redis: Redis, flightRepo: Repository<Flight>, flightService: FlightService, statsService: FlightStatsService, gateway: FlightGateway);
    checkFlights(): Promise<void>;
}
