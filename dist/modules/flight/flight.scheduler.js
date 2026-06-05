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
exports.FlightScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const ioredis_1 = require("ioredis");
const enums_1 = require("../../models/enums");
const flight_service_1 = require("./flight.service");
const flight_stats_service_1 = require("./flight-stats.service");
const flight_gateway_1 = require("./flight.gateway");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../../models/entities");
const redis_module_1 = require("../../common/redis.module");
let FlightScheduler = class FlightScheduler {
    constructor(redis, flightRepo, flightService, statsService, gateway) {
        this.redis = redis;
        this.flightRepo = flightRepo;
        this.flightService = flightService;
        this.statsService = statsService;
        this.gateway = gateway;
    }
    async checkFlights() {
        const now = Math.floor(Date.now() / 1000);
        const readyIds = await this.redis.zrangebyscore('group:flights', 0, now);
        for (const flightId of readyIds) {
            const key = `flight:${flightId}`;
            const data = await this.redis.hgetall(key);
            if (!data.status || parseInt(data.status) !== enums_1.FlightStatus.PENDING)
                continue;
            const seatVals = await this.redis.hvals(`flight:${flightId}:seats`);
            console.log('Checking flight', flightId, 'seats:', seatVals);
            const seatedSeats = seatVals.map(v => { try {
                return JSON.parse(v);
            }
            catch {
                return null;
            } }).filter(Boolean);
            if (seatedSeats.length === 0)
                continue;
            const hasFocusedSeat = seatedSeats.some(s => s.focusStatus === enums_1.SeatFocusStatus.FOCUSED);
            if (!hasFocusedSeat)
                continue;
            await this.redis.hset(key, 'status', String(enums_1.FlightStatus.FLYING));
            await this.flightRepo.update({ id: flightId }, { status: enums_1.FlightStatus.FLYING });
            const seatedUserIds = seatedSeats.map(s => s.userId);
            console.log('Flight taking off', flightId, 'seatedUserIds:', seatedUserIds);
            this.gateway.broadcastToRoom(`flight:${flightId}`, 'takingOff', { flightId, seatedUserIds });
        }
        const allFlightKeys = await this.redis.keys('flight:*');
        for (const key of allFlightKeys) {
            const data = await this.redis.hgetall(key);
            console.log('Checking flight for arrival', key, 'data:', data);
            if (!data.status || parseInt(data.status) !== enums_1.FlightStatus.FLYING)
                continue;
            if (parseInt(data.arrivalAt) <= now) {
                await this.redis.hset(key, 'status', String(enums_1.FlightStatus.ARRIVED));
                const flightId = key.replace('flight:', '');
                await this.flightRepo.update({ id: flightId }, { status: enums_1.FlightStatus.ARRIVED });
                this.gateway.broadcastToRoom(`flight:${flightId}`, 'arrived', { flightId });
                const flight = await this.flightRepo.findOne({ where: { id: flightId } });
                if (flight) {
                    await this.statsService.settleFlight(flightId, flight.arrivalAt, enums_1.FlightStatus.ARRIVED);
                    await this.redis.del(key);
                    await this.redis.del(`flight:${flightId}:seats`);
                    await this.redis.zrem('group:flights', flightId);
                }
            }
        }
    }
};
exports.FlightScheduler = FlightScheduler;
__decorate([
    (0, schedule_1.Cron)('* * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FlightScheduler.prototype, "checkFlights", null);
exports.FlightScheduler = FlightScheduler = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Flight)),
    __metadata("design:paramtypes", [ioredis_1.default,
        typeorm_2.Repository,
        flight_service_1.FlightService,
        flight_stats_service_1.FlightStatsService,
        flight_gateway_1.FlightGateway])
], FlightScheduler);
//# sourceMappingURL=flight.scheduler.js.map