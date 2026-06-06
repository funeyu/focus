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
exports.FlightController = void 0;
const common_1 = require("@nestjs/common");
const flight_service_1 = require("./flight.service");
const flight_stats_service_1 = require("./flight-stats.service");
const api_util_1 = require("../../common/api.util");
const redis_module_1 = require("../../common/redis.module");
const ioredis_1 = require("ioredis");
let FlightController = class FlightController {
    constructor(flightService, statsService, redis) {
        this.flightService = flightService;
        this.statsService = statsService;
        this.redis = redis;
    }
    async create(body) {
        const flight = await this.flightService.create(body);
        const dto = await this.flightService.toFlightDto(flight);
        return api_util_1.ApiUtil.ok(dto);
    }
    async join(flightId, userId, body) {
        const passenger = await this.flightService.join(flightId, userId, body.seatNum, body.focusScene);
        return api_util_1.ApiUtil.ok(passenger);
    }
    async soloBegin(body) {
        const result = await this.flightService.soloBegin(body.userId, body.minutes);
        return api_util_1.ApiUtil.ok(result);
    }
    async myFlights(userId) {
        const flights = await this.flightService.getMyFlights(userId);
        return api_util_1.ApiUtil.ok(flights);
    }
    async invites(userId) {
        const flights = await this.flightService.getInvites(userId);
        return api_util_1.ApiUtil.ok(flights);
    }
    async stats(userId) {
        const stats = await this.statsService.getUserStats(userId);
        return api_util_1.ApiUtil.ok(stats);
    }
    async detail(flightId) {
        const flight = await this.flightService.getFlightDetail(flightId);
        return api_util_1.ApiUtil.ok(flight);
    }
    async update(flightId, body) {
        const flight = await this.flightService.updateScheduled(flightId, body);
        const dto = await this.flightService.toFlightDto(flight);
        return api_util_1.ApiUtil.ok(dto);
    }
    async delete(flightId, userId) {
        await this.flightService.deleteFlight(flightId, userId);
        return api_util_1.ApiUtil.ok();
    }
    async flushRedis() {
        await this.redis.flushall();
        return api_util_1.ApiUtil.ok('All Redis cache cleared');
    }
};
exports.FlightController = FlightController;
__decorate([
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('join/:flightId/:userId'),
    __param(0, (0, common_1.Param)('flightId')),
    __param(1, (0, common_1.Param)('userId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "join", null);
__decorate([
    (0, common_1.Post)('solo/begin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "soloBegin", null);
__decorate([
    (0, common_1.Get)('my/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "myFlights", null);
__decorate([
    (0, common_1.Get)('invites/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "invites", null);
__decorate([
    (0, common_1.Get)('stats/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':flightId'),
    __param(0, (0, common_1.Param)('flightId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "detail", null);
__decorate([
    (0, common_1.Put)('update/:flightId'),
    __param(0, (0, common_1.Param)('flightId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "update", null);
__decorate([
    (0, common_1.Post)('delete/:flightId/:userId'),
    __param(0, (0, common_1.Param)('flightId')),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)('flush-redis'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "flushRedis", null);
exports.FlightController = FlightController = __decorate([
    (0, common_1.Controller)('flight'),
    __param(2, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [flight_service_1.FlightService,
        flight_stats_service_1.FlightStatsService,
        ioredis_1.default])
], FlightController);
//# sourceMappingURL=flight.controller.js.map