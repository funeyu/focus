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
const redis_module_1 = require("../../common/redis.module");
let FlightScheduler = class FlightScheduler {
    constructor(redis, flightService, statsService, gateway) {
        this.redis = redis;
        this.flightService = flightService;
        this.statsService = statsService;
        this.gateway = gateway;
    }
    async checkFlights() {
        const now = Math.floor(Date.now() / 1000);
        const dtos = await this.flightService.getAllCachedFlights();
        for (const dto of dtos) {
            console.log('dto', dto);
            if (!dto)
                continue;
            const flightId = dto.id;
            if (dto.status === enums_1.FlightStatus.PENDING && dto.takeoffAt <= now) {
                const hasFocusedSeat = dto.seats.some(s => s.focusStatus === enums_1.SeatFocusStatus.FOCUSED);
                if (!hasFocusedSeat) {
                    await this.flightService.deleteFlight(flightId, dto.captainId);
                    continue;
                }
            }
            if (dto.status === enums_1.FlightStatus.PENDING && dto.takeoffAt <= now) {
                dto.status = enums_1.FlightStatus.FLYING;
                await this.flightService.setCachedFlightDto(flightId, dto);
                await this.flightService.updateFlightStatus(flightId, enums_1.FlightStatus.FLYING);
                const seatedUserIds = dto.seats.map(s => s.userInfo?.id).filter(Boolean);
                console.log('Flight taking off', flightId, 'seatedUserIds:', seatedUserIds);
                this.gateway.broadcastToRoom(`flight:${flightId}`, 'takingOff', { flightId, seatedUserIds });
            }
            if (dto.status === enums_1.FlightStatus.FLYING && dto.arrivalAt <= now) {
                dto.status = enums_1.FlightStatus.ARRIVED;
                await this.flightService.updateFlightStatus(flightId, enums_1.FlightStatus.ARRIVED);
                this.gateway.broadcastToRoom(`flight:${flightId}`, 'arrived', { flightId });
                await this.statsService.settleFlight(flightId, dto.arrivalAt, enums_1.FlightStatus.ARRIVED);
                await this.flightService.cleanupFlightCache(flightId);
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
    __metadata("design:paramtypes", [ioredis_1.default,
        flight_service_1.FlightService,
        flight_stats_service_1.FlightStatsService,
        flight_gateway_1.FlightGateway])
], FlightScheduler);
//# sourceMappingURL=flight.scheduler.js.map