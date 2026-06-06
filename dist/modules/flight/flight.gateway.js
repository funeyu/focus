"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlightGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const ws_1 = require("ws");
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
const flight_service_1 = require("./flight.service");
const flight_stats_service_1 = require("./flight-stats.service");
const enums_1 = require("../../models/enums");
const token_util_1 = require("../../common/token.util");
const redis_module_1 = require("../../common/redis.module");
const friendship_service_1 = require("../user/friendship.service");
const user_service_1 = require("../user/user.service");
let FlightGateway = class FlightGateway {
    constructor(redis, flightService, statsService, friendshipService, userService) {
        this.redis = redis;
        this.flightService = flightService;
        this.statsService = statsService;
        this.friendshipService = friendshipService;
        this.userService = userService;
        this.roomClients = new Map();
        this.userClients = new Map();
        this.clientUserMap = new Map();
    }
    shouldCrash(flyMode, action, randomValue) {
        if (flyMode === enums_1.FlyMode.SAFE)
            return false;
        if (action === 'leave')
            return randomValue < 0.1;
        if (action === 'giveup')
            return randomValue < 0.5;
        return false;
    }
    async handleConnection(client, ...args) {
        const req = args[0];
        try {
            const token = req.headers['x-snake'];
            if (!token || !token_util_1.TokenUtil.validate(token, Math.floor(Date.now() / 1000))) {
                client.close(4001, 'invalid token');
            }
        }
        catch (err) {
            client.close(4001, 'invalid token');
        }
    }
    handleDisconnect(client) {
        const userId = this.clientUserMap.get(client);
        this.clientUserMap.delete(client);
        if (!userId)
            return;
        const clients = this.userClients.get(userId);
        if (clients) {
            clients.delete(client);
            if (clients.size === 0) {
                this.userClients.delete(userId);
                this.broadcastFriendStatus(userId, 'offline');
            }
        }
        const room = client.room;
        if (room) {
            const roomSet = this.roomClients.get(room);
            if (roomSet) {
                roomSet.delete(client);
                if (roomSet.size === 0) {
                    this.roomClients.delete(room);
                }
            }
        }
    }
    async onEnterCabin(client, data) {
        console.log('[WS] enterCabin', data);
        const prevRoom = client.room;
        if (prevRoom) {
            const prevSet = this.roomClients.get(prevRoom);
            if (prevSet) {
                prevSet.delete(client);
                if (prevSet.size === 0) {
                    this.roomClients.delete(prevRoom);
                }
            }
        }
        const room = `flight:${data.flightId}`;
        client.room = room;
        this.clientUserMap.set(client, data.userId);
        if (!this.roomClients.has(room)) {
            this.roomClients.set(room, new Set());
        }
        this.roomClients.get(room).add(client);
        if (!this.userClients.has(data.userId)) {
            this.userClients.set(data.userId, new Set());
        }
        this.userClients.get(data.userId).add(client);
        const dto = await this.flightService.ensureCached(data.flightId);
        if (dto) {
            const seat = dto.seats.find(s => s.userInfo?.id === data.userId);
            if (seat) {
                seat.isActive = true;
                seat.focusStatus = enums_1.SeatFocusStatus.FOCUSED;
                await this.flightService.setCachedFlightDto(data.flightId, dto);
            }
        }
        await this.broadcastSeatUpdate(data.flightId);
        this.broadcastFriendStatus(data.userId, 'flying');
    }
    async onLeaveCabin(client, data) {
        console.log('[WS] leaveCabin', data);
        await this.flightService.updateSeatInCache(data.flightId, data.userId, { focusStatus: enums_1.SeatFocusStatus.DISTRACTED });
        await this.broadcastSeatUpdate(data.flightId);
    }
    async onPickSeat(client, data) {
        console.log('[WS] pick.seat', data);
        try {
            await this.flightService.join(data.flightId, data.userId, data.seatNum, data.focusScene);
            await this.broadcastSeatUpdate(data.flightId);
            this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'ok');
        }
        catch (err) {
            this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'error');
        }
    }
    async onLeaveSeat(client, data) {
        console.log('[WS] leaveSeat', data);
        const { flyMode } = await this.flightService.leaveSeat(data.flightId, data.userId);
        const dto = await this.flightService.getCachedFlightDto(data.flightId);
        if (dto?.status === enums_1.FlightStatus.FLYING && this.shouldCrash(flyMode, 'leave', Math.random())) {
            await this.handleCrash(data.flightId, data.userId);
        }
        else {
            await this.broadcastSeatUpdate(data.flightId);
            this.broadcastFriendStatus(data.userId, 'afk');
        }
    }
    async onBackSeat(client, data) {
        console.log('[WS] backSeat', data);
        await this.flightService.backSeat(data.flightId, data.userId);
        await this.broadcastSeatUpdate(data.flightId);
        this.broadcastFriendStatus(data.userId, 'flying');
    }
    async onGiveUpFlight(client, data) {
        console.log('[WS] giveUpFlight', data);
        const { flyMode } = await this.flightService.giveUp(data.flightId, data.userId);
        const dto = await this.flightService.getCachedFlightDto(data.flightId);
        console.log('giveUpFlight flyMode', flyMode, 'flightStatus', dto?.status);
        if (dto?.status !== enums_1.FlightStatus.FLYING) {
            return;
        }
        const activeSeats = await this.flightService.getActiveSeatCount(data.flightId);
        console.log('activeSeats', activeSeats);
        if (activeSeats === 0) {
            await this.handleCrash(data.flightId, data.userId);
        }
        else if (this.shouldCrash(flyMode, 'giveup', Math.random())) {
            await this.handleCrash(data.flightId, data.userId);
        }
        else {
            await this.broadcastSeatUpdate(data.flightId);
            this.broadcastFriendStatus(data.userId, 'offline');
        }
    }
    async handleCrash(flightId, crashByUserId) {
        console.log('crashByUserId', crashByUserId);
        const dto = await this.flightService.getCachedFlightDto(flightId);
        if (dto) {
            dto.status = enums_1.FlightStatus.CRASH;
            await this.flightService.setCachedFlightDto(flightId, dto);
        }
        await Promise.all([
            this.flightService.updateFlightStatus(flightId, enums_1.FlightStatus.CRASH, crashByUserId),
            this.flightService.findFlightById(flightId),
        ]).then(async ([, flight]) => {
            if (flight) {
                const [passengers, _, crashByUser] = await Promise.all([
                    this.flightService.getFlightPassengers(flightId),
                    this.statsService.settleFlight(flightId, flight.arrivalAt, enums_1.FlightStatus.CRASH),
                    this.userService.findByIds([crashByUserId]),
                ]);
                const user = crashByUser[0];
                this.broadcastToRoom(`flight:${flightId}`, 'crash', user ? { id: user.id, avatar: user.avatar, name: user.name, vip: user.vip } : null);
                for (const p of passengers) {
                    if (p.status !== enums_1.UserFlyStatus.GIVEUP) {
                        this.broadcastFriendStatus(p.userId, 'offline');
                    }
                }
            }
            await this.flightService.cleanupFlightCache(flightId);
        });
    }
    async broadcastSeatUpdate(flightId) {
        try {
            const dto = await this.flightService.getCachedFlightDto(flightId);
            if (!dto)
                return;
            this.broadcastToRoom(`flight:${flightId}`, 'all.seats', dto.seats);
        }
        catch (err) {
            console.error(`broadcastSeatUpdate failed for flight ${flightId}:`, err);
        }
    }
    broadcastToRoom(room, event, data) {
        const message = JSON.stringify({ event, data });
        const clients = this.roomClients.get(room);
        console.log(`[WS] broadcastToRoom room=${room} event=${event} clientCount=${clients?.size ?? 0}`, message);
        if (!clients)
            return;
        for (const client of clients) {
            if (client.readyState === 1) {
                client.send(message);
            }
        }
    }
    async broadcastFriendStatus(userId, status) {
        const friendships = await this.friendshipService.getRawFriendships(userId);
        const friendIds = friendships.map(f => f.userIdA === userId ? f.userIdB : f.userIdA);
        if (friendIds.length === 0)
            return;
        const message = JSON.stringify({
            event: 'friendStatus',
            data: JSON.stringify({ userId, status }),
        });
        for (const friendId of friendIds) {
            const clients = this.userClients.get(friendId);
            if (!clients)
                continue;
            for (const client of clients) {
                if (client.readyState === 1) {
                    client.send(message);
                }
            }
        }
    }
};
exports.FlightGateway = FlightGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", ws_1.Server)
], FlightGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('enterCabin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onEnterCabin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveCabin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onLeaveCabin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('pick.seat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onPickSeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveSeat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onLeaveSeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('backSeat'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onBackSeat", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('giveUpFlight'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ws_1.WebSocket, Object]),
    __metadata("design:returntype", Promise)
], FlightGateway.prototype, "onGiveUpFlight", null);
exports.FlightGateway = FlightGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ path: '/api/ws' }),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default,
        flight_service_1.FlightService,
        flight_stats_service_1.FlightStatsService,
        friendship_service_1.FriendshipService,
        user_service_1.UserService])
], FlightGateway);
//# sourceMappingURL=flight.gateway.js.map