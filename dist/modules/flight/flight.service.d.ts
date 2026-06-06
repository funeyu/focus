import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Flight, FlightPassenger, FlightPassengerStatusLog } from '../../models/entities';
import { FlightMode, FlyMode, FlightStatus } from '../../models/enums';
import { FlightDto, FlightSeatDto } from '../../models/dtos';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
export declare class FlightService {
    private readonly flightRepo;
    private readonly passengerRepo;
    private readonly statusLogRepo;
    private readonly redis;
    private readonly friendshipService;
    private readonly userService;
    constructor(flightRepo: Repository<Flight>, passengerRepo: Repository<FlightPassenger>, statusLogRepo: Repository<FlightPassengerStatusLog>, redis: Redis, friendshipService: FriendshipService, userService: UserService);
    cacheKey(flightId: string): string;
    create(data: {
        captainId: string;
        mode: FlightMode;
        flyMode: FlyMode;
        from: number;
        to: number;
        takeoffAt: number;
        minutes: number;
        scheduledIds?: string;
        seatNum?: string;
        focusScene: number;
    }): Promise<Flight>;
    join(flightId: string, userId: string, seatNum: string, focusScene?: number): Promise<FlightPassenger>;
    giveUp(flightId: string, userId: string): Promise<{
        flyMode: FlyMode;
    }>;
    leaveSeat(flightId: string, userId: string): Promise<{
        flyMode: FlyMode;
    }>;
    backSeat(flightId: string, userId: string): Promise<void>;
    getFlightDetail(flightId: string): Promise<(FlightDto & {
        passengers: any[];
    }) | null>;
    getMyFlights(userId: string): Promise<FlightDto[]>;
    getInvites(userId: string): Promise<any[]>;
    getFlightPassengers(flightId: string): Promise<FlightPassenger[]>;
    updateFlightStatus(flightId: string, status: FlightStatus, crashByUserId?: string): Promise<void>;
    findFlightById(flightId: string): Promise<Flight | null>;
    updateScheduled(flightId: string, data: {
        takeoffAt?: number;
        scheduledIds?: string;
    }): Promise<Flight>;
    deleteFlight(flightId: string, userId: string): Promise<void>;
    soloBegin(userId: string, minutes: number): Promise<{
        start: number;
        end: number;
    }>;
    getCachedFlightDto(flightId: string): Promise<FlightDto | null>;
    setCachedFlightDto(flightId: string, dto: FlightDto): Promise<void>;
    removeCachedFlightDto(flightId: string): Promise<void>;
    getAllCachedFlights(): Promise<FlightDto[]>;
    ensureCached(flightId: string): Promise<FlightDto | null>;
    cleanupFlightCache(flightId: string): Promise<void>;
    setSeatInCache(flightId: string, seat: FlightSeatDto, userId: string, role: number): Promise<void>;
    removeSeatFromCache(flightId: string, seatNum: string): Promise<void>;
    updateSeatInCache(flightId: string, userId: string, updates: Partial<FlightSeatDto>): Promise<void>;
    findUserSeatInCache(flightId: string, userId: string): Promise<FlightSeatDto | null>;
    getActiveSeatCount(flightId: string): Promise<number>;
    getSeatsFromCache(flightId: string): Promise<FlightSeatDto[]>;
    private addPassenger;
    private writeStatusLog;
    getUpcomingGroupFlights(): Promise<any[]>;
    private persistSeatsToDb;
    toFlightDto(flight: Flight): Promise<FlightDto>;
}
