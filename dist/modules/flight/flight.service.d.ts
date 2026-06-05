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
    }): Promise<Flight>;
    join(flightId: string, userId: string, seatNum: string): Promise<FlightPassenger>;
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
    getTimeline(flightId: string): Promise<FlightPassengerStatusLog[]>;
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
    soloEnd(userId: string): Promise<void>;
    private addPassenger;
    private writeStatusLog;
    getUpcomingGroupFlights(): Promise<any[]>;
    removeGroupFlightFromIndex(flightId: string): Promise<void>;
    setSeatInRedis(flightId: string, seat: {
        userId: string;
        seatNum: string;
        status: number;
        focusStatus: number;
        role: number;
        isActive: boolean;
    }): Promise<void>;
    removeSeatFromRedis(flightId: string, seatNum: string): Promise<void>;
    private persistSeatsToDb;
    findUserSeatInRedis(flightId: string, userId: string): Promise<{
        userId: string;
        seatNum: string;
        status: number;
        focusStatus: number;
        role: number;
        isActive: boolean;
    } | null>;
    getActiveSeatCount(flightId: string): Promise<number>;
    getSeatsFromRedis(flightId: string): Promise<FlightSeatDto[]>;
    toFlightDto(flight: Flight): Promise<FlightDto>;
}
