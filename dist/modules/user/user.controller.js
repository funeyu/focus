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
exports.UserController = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("./user.service");
const friendship_service_1 = require("./friendship.service");
const api_util_1 = require("../../common/api.util");
let UserController = class UserController {
    constructor(userService, friendshipService) {
        this.userService = userService;
        this.friendshipService = friendshipService;
    }
    async create(body) {
        const user = await this.userService.create(body);
        return api_util_1.ApiUtil.ok(user);
    }
    async registerDeviceToken(body) {
        await this.userService.updateDeviceToken(body.userId, body.token);
        return api_util_1.ApiUtil.ok(null);
    }
    async getFriends(userId) {
        const friendships = await this.friendshipService.getFriends(userId);
        return api_util_1.ApiUtil.ok(friendships);
    }
};
exports.UserController = UserController;
__decorate([
    (0, common_1.Post)('create'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('device-token'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "registerDeviceToken", null);
__decorate([
    (0, common_1.Get)('friends/:userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getFriends", null);
exports.UserController = UserController = __decorate([
    (0, common_1.Controller)('user'),
    __metadata("design:paramtypes", [user_service_1.UserService,
        friendship_service_1.FriendshipService])
], UserController);
//# sourceMappingURL=user.controller.js.map