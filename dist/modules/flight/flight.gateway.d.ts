import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import Redis from 'ioredis';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlyMode } from '../../models/enums';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
export declare class FlightGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly redis;
    private readonly flightService;
    private readonly statsService;
    private readonly friendshipService;
    private readonly userService;
    server: Server;
    private roomClients;
    private userClients;
    private clientUserMap;
    constructor(redis: Redis, flightService: FlightService, statsService: FlightStatsService, friendshipService: FriendshipService, userService: UserService);
    shouldCrash(flyMode: FlyMode, action: 'leave' | 'giveup', randomValue: number): boolean;
    handleConnection(client: WebSocket, ...args: any[]): Promise<void>;
    handleDisconnect(client: WebSocket): void;
    onJoinFlight(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    onEnterCabin(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    onLeaveCabin(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    onPickSeat(client: WebSocket, data: {
        flightId: string;
        userId: string;
        seatNum: string;
        userStatus: number;
    }): Promise<void>;
    onLeaveSeat(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    onBackSeat(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    onGiveUpFlight(client: WebSocket, data: {
        flightId: string;
        userId: string;
    }): Promise<void>;
    private handleCrash;
    broadcastSeatUpdate(flightId: string): Promise<void>;
    broadcastToRoom(room: string, event: string, data: any): void;
    private broadcastFriendStatus;
}
