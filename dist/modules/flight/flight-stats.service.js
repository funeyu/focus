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
exports.FlightStatsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../../models/entities");
const enums_1 = require("../../models/enums");
const id_util_1 = require("../../common/id.util");
let FlightStatsService = class FlightStatsService {
    constructor(statusLogRepo, passengerRepo, statsRepo) {
        this.statusLogRepo = statusLogRepo;
        this.passengerRepo = passengerRepo;
        this.statsRepo = statsRepo;
    }
    calculateFocusSeconds(logs, flightEndTime) {
        if (logs.length === 0)
            return 0;
        let totalSeconds = 0;
        for (let i = 0; i < logs.length; i++) {
            if (logs[i].status === enums_1.UserFlyStatus.FOCUSING) {
                const endTime = i + 1 < logs.length ? logs[i + 1].timestamp : flightEndTime;
                totalSeconds += endTime - logs[i].timestamp;
            }
        }
        return totalSeconds;
    }
    calculateFriendOverlapSeconds(logsA, logsB, flightEndTime) {
        const segmentsA = this.toFocusSegments(logsA, flightEndTime);
        const segmentsB = this.toFocusSegments(logsB, flightEndTime);
        let overlap = 0;
        let i = 0;
        let j = 0;
        while (i < segmentsA.length && j < segmentsB.length) {
            const start = Math.max(segmentsA[i][0], segmentsB[j][0]);
            const end = Math.min(segmentsA[i][1], segmentsB[j][1]);
            if (end > start)
                overlap += end - start;
            if (segmentsA[i][1] < segmentsB[j][1])
                i++;
            else
                j++;
        }
        return overlap;
    }
    toFocusSegments(logs, flightEndTime) {
        const segments = [];
        for (let i = 0; i < logs.length; i++) {
            if (logs[i].status === enums_1.UserFlyStatus.FOCUSING) {
                const endTime = i + 1 < logs.length ? logs[i + 1].timestamp : flightEndTime;
                segments.push([logs[i].timestamp, endTime]);
            }
        }
        return segments;
    }
    async getUserStats(userId) {
        return this.statsRepo.findOne({ where: { userId } });
    }
    async settleSoloFlight(userId, focusMinutes) {
        let stats = await this.statsRepo.findOne({ where: { userId } });
        if (!stats) {
            stats = this.statsRepo.create({
                id: id_util_1.IdUtil.next('stats'),
                userId,
                totalMinutes: 0,
                totalArrivals: 0,
                totalCrashes: 0,
                streakDays: 0,
                lastFlightDay: 0,
                distribution: '[]',
                friendRanks: '[]',
            });
        }
        stats.totalMinutes += focusMinutes;
        stats.totalArrivals++;
        const today = Math.floor(Date.now() / 86400000);
        if (stats.lastFlightDay === today - 1) {
            stats.streakDays++;
        }
        else if (stats.lastFlightDay !== today) {
            stats.streakDays = 1;
        }
        stats.lastFlightDay = today;
        await this.statsRepo.save(stats);
    }
    async settleFlight(flightId, flightEndTime, flightStatus) {
        const passengers = await this.passengerRepo.find({ where: { flightId } });
        for (const passenger of passengers) {
            const logs = await this.statusLogRepo.find({
                where: { flightId, userId: passenger.userId },
                order: { timestamp: 'ASC' },
            });
            const focusSeconds = this.calculateFocusSeconds(logs, flightEndTime);
            const focusMinutes = Math.floor(focusSeconds / 60);
            passenger.minutes = focusMinutes;
            await this.passengerRepo.save(passenger);
            await this.updateUserStats(passenger.userId, focusMinutes, flightStatus);
        }
        await this.updateFriendRanks(flightId, passengers, flightEndTime);
    }
    async updateUserStats(userId, focusMinutes, flightStatus) {
        let stats = await this.statsRepo.findOne({ where: { userId } });
        if (!stats) {
            stats = this.statsRepo.create({
                id: id_util_1.IdUtil.next('stats'),
                userId,
                totalMinutes: 0,
                totalArrivals: 0,
                totalCrashes: 0,
                streakDays: 0,
                lastFlightDay: 0,
                distribution: '[]',
                friendRanks: '[]',
            });
        }
        stats.totalMinutes += focusMinutes;
        if (flightStatus === enums_1.FlightStatus.ARRIVED)
            stats.totalArrivals++;
        if (flightStatus === enums_1.FlightStatus.CRASH)
            stats.totalCrashes++;
        const today = Math.floor(Date.now() / 86400000);
        if (stats.lastFlightDay === today - 1) {
            stats.streakDays++;
        }
        else if (stats.lastFlightDay !== today) {
            stats.streakDays = 1;
        }
        stats.lastFlightDay = today;
        await this.statsRepo.save(stats);
    }
    async updateFriendRanks(flightId, passengers, flightEndTime) {
        for (let i = 0; i < passengers.length; i++) {
            for (let j = i + 1; j < passengers.length; j++) {
                const logsA = await this.statusLogRepo.find({
                    where: { flightId, userId: passengers[i].userId },
                    order: { timestamp: 'ASC' },
                });
                const logsB = await this.statusLogRepo.find({
                    where: { flightId, userId: passengers[j].userId },
                    order: { timestamp: 'ASC' },
                });
                const overlapSeconds = this.calculateFriendOverlapSeconds(logsA, logsB, flightEndTime);
                const overlapMinutes = Math.floor(overlapSeconds / 60);
                if (overlapMinutes > 0) {
                    await this.addFriendRank(passengers[i].userId, passengers[j].userId, overlapMinutes);
                    await this.addFriendRank(passengers[j].userId, passengers[i].userId, overlapMinutes);
                }
            }
        }
    }
    async addFriendRank(userId, friendId, minutes) {
        const stats = await this.statsRepo.findOne({ where: { userId } });
        if (!stats)
            return;
        const ranks = stats.friendRanks ? JSON.parse(stats.friendRanks) : [];
        const existing = ranks.find(r => r.userId === friendId);
        if (existing) {
            existing.minutes += minutes;
        }
        else {
            ranks.push({ userId: friendId, minutes });
        }
        ranks.sort((a, b) => b.minutes - a.minutes);
        stats.friendRanks = JSON.stringify(ranks);
        await this.statsRepo.save(stats);
    }
};
exports.FlightStatsService = FlightStatsService;
exports.FlightStatsService = FlightStatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.FlightPassengerStatusLog)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.FlightPassenger)),
    __param(2, (0, typeorm_1.InjectRepository)(entities_1.FlightStats)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], FlightStatsService);
//# sourceMappingURL=flight-stats.service.js.map