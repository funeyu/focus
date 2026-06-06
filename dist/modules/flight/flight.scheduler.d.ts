import Redis from 'ioredis';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlightGateway } from './flight.gateway';
export declare class FlightScheduler {
    private readonly redis;
    private readonly flightService;
    private readonly statsService;
    private readonly gateway;
    constructor(redis: Redis, flightService: FlightService, statsService: FlightStatsService, gateway: FlightGateway);
    checkFlights(): Promise<void>;
}
