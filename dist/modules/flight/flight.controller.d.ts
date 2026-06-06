import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import Redis from 'ioredis';
export declare class FlightController {
    private readonly flightService;
    private readonly statsService;
    private readonly redis;
    constructor(flightService: FlightService, statsService: FlightStatsService, redis: Redis);
    create(body: {
        captainId: string;
        mode: number;
        flyMode: number;
        from: number;
        to: number;
        takeoffAt: number;
        minutes: number;
        scheduledIds?: string;
        seatNum?: string;
        focusScene: number;
    }): Promise<{
        code: number;
        data: any;
    }>;
    join(flightId: string, userId: string, body: {
        seatNum: string;
        focusScene: number;
    }): Promise<{
        code: number;
        data: any;
    }>;
    soloBegin(body: {
        userId: string;
        minutes: number;
    }): Promise<{
        code: number;
        data: any;
    }>;
    myFlights(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    invites(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    stats(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    detail(flightId: string): Promise<{
        code: number;
        data: any;
    }>;
    update(flightId: string, body: {
        takeoffAt?: number;
        scheduledIds?: string;
    }): Promise<{
        code: number;
        data: any;
    }>;
    delete(flightId: string, userId: string): Promise<{
        code: number;
        data: any;
    }>;
    flushRedis(): Promise<{
        code: number;
        data: any;
    }>;
}
