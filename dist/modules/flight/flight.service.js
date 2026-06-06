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
exports.FlightService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ioredis_1 = require("ioredis");
const entities_1 = require("../../models/entities");
const enums_1 = require("../../models/enums");
const id_util_1 = require("../../common/id.util");
const friendship_service_1 = require("../user/friendship.service");
const user_service_1 = require("../user/user.service");
const redis_module_1 = require("../../common/redis.module");
const FLIGHT_DTO_PREFIX = 'flightDto:';
let FlightService = class FlightService {
    constructor(flightRepo, passengerRepo, statusLogRepo, redis, friendshipService, userService) {
        this.flightRepo = flightRepo;
        this.passengerRepo = passengerRepo;
        this.statusLogRepo = statusLogRepo;
        this.redis = redis;
        this.friendshipService = friendshipService;
        this.userService = userService;
    }
    cacheKey(flightId) {
        return `${FLIGHT_DTO_PREFIX}${flightId}`;
    }
    async create(data) {
        const now = Math.floor(Date.now() / 1000);
        const seat = {
            num: data.seatNum || '',
            userId: data.captainId,
            focusScene: data.focusScene,
        };
        const flight = this.flightRepo.create({
            id: id_util_1.IdUtil.next('flight'),
            captainId: data.captainId,
            mode: data.mode,
            flyMode: data.flyMode,
            status: enums_1.FlightStatus.PENDING,
            from: data.from,
            to: data.to,
            takeoffAt: data.takeoffAt,
            arrivalAt: data.takeoffAt + data.minutes * 60,
            createdAt: now,
            scheduledIds: data.scheduledIds || '',
            minutes: data.minutes,
            seats: [seat]
        });
        const saved = await this.flightRepo.save(flight);
        if (data.seatNum) {
            await this.addPassenger(saved.id, data.captainId, enums_1.Role.CAPTAIN, data.seatNum);
            await this.writeStatusLog(saved.id, data.captainId, enums_1.UserFlyStatus.FOCUSING);
        }
        return saved;
    }
    async join(flightId, userId, seatNum, focusScene = 0) {
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            throw new common_1.BadRequestException('flight not found');
        if (flight.status !== enums_1.FlightStatus.PENDING && flight.status !== enums_1.FlightStatus.FLYING)
            throw new common_1.BadRequestException('flight already ended');
        const passengers = await this.passengerRepo.find({ where: { flightId } });
        const alreadyJoined = passengers.find(p => p.userId === userId);
        if (alreadyJoined)
            throw new common_1.BadRequestException('already joined');
        if (seatNum) {
            const seatTaken = passengers.find(p => p.seatNum === seatNum);
            if (seatTaken)
                throw new common_1.BadRequestException('seat already taken');
        }
        const role = flight.captainId === userId ? enums_1.Role.CAPTAIN : enums_1.Role.PASSENGER;
        const passenger = await this.addPassenger(flightId, userId, role, seatNum);
        await this.setSeatInCache(flightId, {
            num: seatNum,
            userInfo: null,
            focusScene,
            focusStatus: enums_1.SeatFocusStatus.NOT_STARTED,
            isActive: true,
        }, userId, role);
        await this.writeStatusLog(flightId, userId, enums_1.UserFlyStatus.FOCUSING);
        const updatedPassengers = await this.passengerRepo.find({ where: { flightId } });
        const userIds = updatedPassengers.map(p => p.userId);
        await this.friendshipService.createForFlight(flightId, userIds);
        return passenger;
    }
    async giveUp(flightId, userId) {
        await this.writeStatusLog(flightId, userId, enums_1.UserFlyStatus.GIVEUP);
        const passenger = await this.passengerRepo.findOne({ where: { flightId, userId } });
        if (passenger) {
            passenger.status = enums_1.UserFlyStatus.GIVEUP;
            passenger.quitAt = Math.floor(Date.now() / 1000);
            await this.passengerRepo.save(passenger);
            await this.removeSeatFromCache(flightId, passenger.seatNum);
        }
        const dto = await this.getCachedFlightDto(flightId);
        return { flyMode: dto?.flyMode ?? enums_1.FlyMode.SAFE };
    }
    async leaveSeat(flightId, userId) {
        await this.writeStatusLog(flightId, userId, enums_1.UserFlyStatus.LEAVE);
        await this.updateSeatInCache(flightId, userId, { focusStatus: enums_1.SeatFocusStatus.DISTRACTED });
        const dto = await this.getCachedFlightDto(flightId);
        return { flyMode: dto?.flyMode ?? enums_1.FlyMode.SAFE };
    }
    async backSeat(flightId, userId) {
        await this.writeStatusLog(flightId, userId, enums_1.UserFlyStatus.BACK);
        await this.writeStatusLog(flightId, userId, enums_1.UserFlyStatus.FOCUSING);
        await this.updateSeatInCache(flightId, userId, { focusStatus: enums_1.SeatFocusStatus.FOCUSED });
    }
    async getFlightDetail(flightId) {
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            return null;
        const dto = await this.toFlightDto(flight);
        const passengers = await this.passengerRepo.find({ where: { flightId } });
        const passengerUserIds = passengers.map(p => p.userId);
        const users = await this.userService.findByIds(passengerUserIds);
        const userMap = new Map(users.map(u => [u.id, u]));
        return {
            ...dto,
            passengers: passengers.map(p => ({
                ...p,
                user: userMap.get(p.userId) || null,
            })),
        };
    }
    async getMyFlights(userId) {
        const passengers = await this.passengerRepo.find({ where: { userId } });
        const flightIds = passengers.map(p => p.flightId);
        if (flightIds.length === 0)
            return [];
        const flights = await this.flightRepo.findByIds(flightIds);
        const now = Math.floor(Date.now() / 1000);
        const oneWeekAgo = now - 7 * 24 * 3600;
        const recent = flights.filter(f => f.createdAt >= oneWeekAgo);
        const active = recent.filter(f => f.arrivalAt > now && f.status !== enums_1.FlightStatus.CRASH);
        active.sort((a, b) => {
            if (a.status === enums_1.FlightStatus.FLYING && b.status !== enums_1.FlightStatus.FLYING)
                return -1;
            if (a.status !== enums_1.FlightStatus.FLYING && b.status === enums_1.FlightStatus.FLYING)
                return 1;
            return a.takeoffAt - b.takeoffAt;
        });
        const dtos = await Promise.all(active.map(f => this.toFlightDto(f)));
        for (let i = 0; i < active.length; i++) {
            if (active[i].status === enums_1.FlightStatus.FLYING) {
                const cached = await this.getCachedFlightDto(active[i].id);
                if (cached) {
                    const seat = cached.seats.find(s => s.userInfo?.id === userId);
                    dtos[i].focusStatus = seat?.focusStatus ?? enums_1.SeatFocusStatus.FOCUSED;
                }
            }
        }
        return dtos;
    }
    async getInvites(userId) {
        const joinedFlightIds = (await this.passengerRepo.find({ where: { userId } })).map(p => p.flightId);
        const allFlights = await this.flightRepo.find();
        const now = Math.floor(Date.now() / 1000);
        const invited = allFlights.filter(f => {
            if (f.captainId === userId)
                return false;
            if (f.status === enums_1.FlightStatus.CRASH)
                return false;
            if (f.takeoffAt <= now)
                return false;
            if (joinedFlightIds.includes(f.id))
                return false;
            const scheduledList = f.scheduledIds ? f.scheduledIds.split(',').filter(Boolean) : [];
            return scheduledList.includes(userId);
        });
        invited.sort((a, b) => a.takeoffAt - b.takeoffAt);
        return Promise.all(invited.map(f => this.toFlightDto(f)));
    }
    async getFlightPassengers(flightId) {
        return this.passengerRepo.find({ where: { flightId } });
    }
    async updateFlightStatus(flightId, status, crashByUserId) {
        const updateData = { status };
        if (crashByUserId)
            updateData.crashByUserId = crashByUserId;
        await this.flightRepo.update({ id: flightId }, updateData);
    }
    async findFlightById(flightId) {
        return this.flightRepo.findOne({ where: { id: flightId } });
    }
    async updateScheduled(flightId, data) {
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            throw new common_1.BadRequestException('flight not found');
        if (flight.status !== enums_1.FlightStatus.PENDING)
            throw new common_1.BadRequestException('can only edit pending flights');
        if (data.takeoffAt != null) {
            flight.takeoffAt = data.takeoffAt;
            flight.arrivalAt = data.takeoffAt + flight.minutes * 60;
        }
        if (data.scheduledIds != null) {
            flight.scheduledIds = data.scheduledIds;
        }
        const saved = await this.flightRepo.save(flight);
        const cached = await this.getCachedFlightDto(flightId);
        if (cached) {
            cached.takeoffAt = saved.takeoffAt;
            cached.arrivalAt = saved.arrivalAt;
            await this.setCachedFlightDto(flightId, cached);
        }
        return saved;
    }
    async deleteFlight(flightId, userId) {
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            throw new common_1.BadRequestException('flight not found');
        if (flight.captainId !== userId)
            throw new common_1.BadRequestException('only captain can delete flight');
        if (flight.status === enums_1.FlightStatus.FLYING)
            throw new common_1.BadRequestException('cannot delete a flying flight');
        await this.passengerRepo.delete({ flightId });
        await this.flightRepo.delete({ id: flightId });
        await this.removeCachedFlightDto(flightId);
    }
    async soloBegin(userId, minutes) {
        const now = Math.floor(Date.now() / 1000);
        const end = now + minutes * 60;
        return { start: now, end };
    }
    async getCachedFlightDto(flightId) {
        const raw = await this.redis.get(this.cacheKey(flightId));
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async setCachedFlightDto(flightId, dto) {
        const ttl = dto.arrivalAt - Math.floor(Date.now() / 1000) + 60;
        if (ttl > 0) {
            await this.redis.set(this.cacheKey(flightId), JSON.stringify(dto), 'EX', ttl);
        }
    }
    async removeCachedFlightDto(flightId) {
        await this.redis.del(this.cacheKey(flightId));
    }
    async getAllCachedFlights() {
        const keys = await this.redis.keys(`${FLIGHT_DTO_PREFIX}*`);
        if (keys.length === 0)
            return [];
        const values = await this.redis.mget(...keys);
        const dtos = [];
        for (const raw of values) {
            if (!raw)
                continue;
            try {
                dtos.push(JSON.parse(raw));
            }
            catch { }
        }
        return dtos;
    }
    async ensureCached(flightId) {
        const existing = await this.getCachedFlightDto(flightId);
        if (existing)
            return existing;
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            return null;
        const now = Math.floor(Date.now() / 1000);
        if (flight.status === enums_1.FlightStatus.FLYING) {
        }
        else if (flight.status === enums_1.FlightStatus.PENDING && flight.takeoffAt - now <= 60) {
        }
        else {
            return null;
        }
        const dto = await this.toFlightDto(flight);
        await this.setCachedFlightDto(flightId, dto);
        return dto;
    }
    async cleanupFlightCache(flightId) {
        await this.removeCachedFlightDto(flightId);
    }
    async setSeatInCache(flightId, seat, userId, role) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return;
        const users = await this.userService.findByIds([userId]);
        const user = users[0] || null;
        seat.userInfo = user ? { id: user.id, name: user.name, avatar: user.avatar, vip: user.vip } : null;
        const idx = dto.seats.findIndex(s => s.num === seat.num);
        if (idx >= 0) {
            dto.seats[idx] = seat;
        }
        else {
            dto.seats.push(seat);
        }
        await this.setCachedFlightDto(flightId, dto);
        await this.persistSeatsToDb(flightId, { num: seat.num, userId, focusScene: seat.focusScene });
    }
    async removeSeatFromCache(flightId, seatNum) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return;
        dto.seats = dto.seats.filter(s => s.num !== seatNum);
        await this.setCachedFlightDto(flightId, dto);
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            return;
        const seats = (flight.seats || []).filter(s => s.num !== seatNum);
        await this.flightRepo.update({ id: flightId }, { seats });
    }
    async updateSeatInCache(flightId, userId, updates) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return;
        const seat = dto.seats.find(s => s.userInfo?.id === userId);
        if (seat) {
            Object.assign(seat, updates);
            await this.setCachedFlightDto(flightId, dto);
        }
    }
    async findUserSeatInCache(flightId, userId) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return null;
        return dto.seats.find(s => s.userInfo?.id === userId) ?? null;
    }
    async getActiveSeatCount(flightId) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return 0;
        return dto.seats.filter(s => s.isActive).length;
    }
    async getSeatsFromCache(flightId) {
        const dto = await this.getCachedFlightDto(flightId);
        if (!dto)
            return [];
        return dto.seats;
    }
    async addPassenger(flightId, userId, role, seatNum = '') {
        const now = Math.floor(Date.now() / 1000);
        const passenger = this.passengerRepo.create({
            id: id_util_1.IdUtil.next('passenger'),
            flightId,
            userId,
            role,
            seatNum,
            status: enums_1.UserFlyStatus.FOCUSING,
            joinAt: now,
            minutes: 0,
        });
        return this.passengerRepo.save(passenger);
    }
    async writeStatusLog(flightId, userId, status) {
        const log = this.statusLogRepo.create({
            flightId,
            userId,
            status,
            timestamp: Math.floor(Date.now() / 1000),
        });
        await this.statusLogRepo.save(log);
    }
    async getUpcomingGroupFlights() {
        const now = Math.floor(Date.now() / 1000);
        const flights = await this.flightRepo.find({ where: { mode: enums_1.FlightMode.MULTIPLE, status: enums_1.FlightStatus.PENDING } });
        const upcoming = flights.filter(f => f.takeoffAt > now);
        upcoming.sort((a, b) => a.takeoffAt - b.takeoffAt);
        return Promise.all(upcoming.map(f => this.toFlightDto(f)));
    }
    async persistSeatsToDb(flightId, seatData) {
        const flight = await this.flightRepo.findOne({ where: { id: flightId } });
        if (!flight)
            return;
        const seats = flight.seats ? [...flight.seats] : [];
        if (seatData) {
            const idx = seats.findIndex(s => s.num === seatData.num);
            if (idx >= 0) {
                seats[idx] = seatData;
            }
            else {
                seats.push(seatData);
            }
        }
        await this.flightRepo.update({ id: flightId }, { seats });
    }
    async toFlightDto(flight) {
        const scheduledIdList = flight.scheduledIds
            ? flight.scheduledIds.split(',').filter(Boolean)
            : [];
        const seatList = flight.seats || [];
        const seatUserIds = seatList.map(s => s.userId);
        const allIds = [...new Set([flight.captainId, ...scheduledIdList, ...seatUserIds])];
        const users = await this.userService.findByIds(allIds);
        const userMap = new Map(users.map(u => [u.id, u]));
        const captain = userMap.get(flight.captainId) || null;
        const scheduledUsers = [flight.captainId, ...scheduledIdList]
            .map(id => userMap.get(id))
            .filter(Boolean);
        const seats = seatList.map(seatInfo => {
            const user = userMap.get(seatInfo.userId);
            return {
                num: seatInfo.num,
                userInfo: user ? { id: user.id, name: user.name, avatar: user.avatar, vip: user.vip } : null,
                focusScene: seatInfo.focusScene,
                focusStatus: enums_1.SeatFocusStatus.FOCUSED,
                isActive: true,
            };
        });
        const { scheduledIds, seats: _seats, ...rest } = flight;
        return { ...rest, captain, scheduledUsers, seats };
    }
};
exports.FlightService = FlightService;
exports.FlightService = FlightService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Flight)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.FlightPassenger)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.FlightPassengerStatusLog)),
    __param(3, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        ioredis_1.default,
        friendship_service_1.FriendshipService,
        user_service_1.UserService])
], FlightService);
//# sourceMappingURL=flight.service.js.map