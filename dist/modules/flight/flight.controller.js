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
const friendship_service_1 = require("../user/friendship.service");
const user_service_1 = require("../user/user.service");
const api_util_1 = require("../../common/api.util");
const enums_1 = require("../../models/enums");
let FlightController = class FlightController {
    constructor(flightService, statsService, friendshipService, userService) {
        this.flightService = flightService;
        this.statsService = statsService;
        this.friendshipService = friendshipService;
        this.userService = userService;
    }
    async create(body) {
        const flight = await this.flightService.create(body);
        const dto = await this.flightService.toFlightDto(flight);
        return api_util_1.ApiUtil.ok(dto);
    }
    async join(flightId, userId, body) {
        const passenger = await this.flightService.join(flightId, userId, body.seatNum);
        return api_util_1.ApiUtil.ok(passenger);
    }
    async giveUp(flightId, userId) {
        await this.flightService.giveUp(flightId, userId);
        return api_util_1.ApiUtil.ok();
    }
    async soloBegin(body) {
        const result = await this.flightService.soloBegin(body.userId, body.minutes);
        return api_util_1.ApiUtil.ok(result);
    }
    async soloEnd(body) {
        await this.flightService.soloEnd(body.userId);
        await this.statsService.settleSoloFlight(body.userId, body.focusMinutes);
        return api_util_1.ApiUtil.ok();
    }
    async polling() {
        const flights = await this.flightService.getUpcomingGroupFlights();
        return api_util_1.ApiUtil.ok(flights);
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
    async timeline(flightId) {
        const logs = await this.flightService.getTimeline(flightId);
        return api_util_1.ApiUtil.ok(logs);
    }
    async friends(userId) {
        const friendships = await this.friendshipService.getFriends(userId);
        return api_util_1.ApiUtil.ok(friendships);
    }
    async seats(flightId) {
        const passengers = await this.flightService.getFlightPassengers(flightId);
        const userIds = passengers.map(p => p.userId);
        const users = await this.userService.findByIds(userIds);
        const userMap = new Map(users.map(u => [u.id, u]));
        const seats = passengers
            .filter(p => p.seatNum && p.status !== enums_1.UserFlyStatus.GIVEUP)
            .map(p => {
            const user = userMap.get(p.userId);
            return {
                num: p.seatNum,
                userInfo: user ? { id: user.id, avatar: user.avatar, name: user.name, vip: user.vip } : null,
                userStatus: p.status,
                isActive: true,
            };
        });
        return api_util_1.ApiUtil.ok(seats);
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
    (0, common_1.Post)('giveUp/:flightId/:userId'),
    __param(0, (0, common_1.Param)('flightId')),
    __param(1, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "giveUp", null);
__decorate([
    (0, common_1.Post)('solo/begin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "soloBegin", null);
__decorate([
    (0, common_1.Post)('solo/end'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "soloEnd", null);
__decorate([
    (0, common_1.Get)('polling'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "polling", null);
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
    (0, common_1.Get)('timeline/:flightId'),
    __param(0, (0, common_1.Param)('flightId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "timeline", null);
__decorate([
    (0, common_1.Get)('friends/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "friends", null);
__decorate([
    (0, common_1.Get)('seats/:flightId'),
    __param(0, (0, common_1.Param)('flightId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FlightController.prototype, "seats", null);
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
exports.FlightController = FlightController = __decorate([
    (0, common_1.Controller)('flight'),
    __metadata("design:paramtypes", [flight_service_1.FlightService,
        flight_stats_service_1.FlightStatsService,
        friendship_service_1.FriendshipService,
        user_service_1.UserService])
], FlightController);
//# sourceMappingURL=flight.controller.js.map