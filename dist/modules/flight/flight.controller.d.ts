import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
export declare class FlightController {
    private readonly flightService;
    private readonly statsService;
    private readonly friendshipService;
    private readonly userService;
    constructor(flightService: FlightService, statsService: FlightStatsService, friendshipService: FriendshipService, userService: UserService);
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
    }): Promise<{
        code: number;
        data: any;
    }>;
    join(flightId: string, userId: string, body: {
        seatNum: string;
    }): Promise<{
        code: number;
        data: any;
    }>;
    giveUp(flightId: string, userId: string): Promise<{
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
    soloEnd(body: {
        userId: string;
        focusMinutes: number;
    }): Promise<{
        code: number;
        data: any;
    }>;
    polling(): Promise<{
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
    timeline(flightId: string): Promise<{
        code: number;
        data: any;
    }>;
    friends(userId: string): Promise<{
        code: number;
        data: any;
    }>;
    seats(flightId: string): Promise<{
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
}
