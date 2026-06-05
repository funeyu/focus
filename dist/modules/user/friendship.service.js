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
exports.FriendshipService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const entities_1 = require("../../models/entities");
const id_util_1 = require("../../common/id.util");
let FriendshipService = class FriendshipService {
    constructor(friendshipRepo, userRepo) {
        this.friendshipRepo = friendshipRepo;
        this.userRepo = userRepo;
    }
    async createForFlight(flightId, userIds) {
        for (let i = 0; i < userIds.length; i++) {
            for (let j = i + 1; j < userIds.length; j++) {
                await this.createIfNotExists(userIds[i], userIds[j], flightId);
            }
        }
    }
    async createIfNotExists(userA, userB, flightId) {
        const existing = await this.friendshipRepo.findOne({
            where: [
                { userIdA: userA, userIdB: userB },
                { userIdA: userB, userIdB: userA },
            ],
        });
        if (existing)
            return;
        const now = Math.floor(Date.now() / 1000);
        await this.friendshipRepo.save({
            id: id_util_1.IdUtil.next('friendship'),
            userIdA: userA,
            userIdB: userB,
            flightId,
            createdAt: now,
        });
    }
    async getFriends(userId) {
        const friendships = await this.getRawFriendships(userId);
        const friendIds = friendships.map(f => f.userIdA === userId ? f.userIdB : f.userIdA);
        if (friendIds.length === 0)
            return [];
        const users = await this.userRepo.findByIds(friendIds);
        const userMap = new Map(users.map(u => [u.id, u]));
        return friendIds
            .map(id => {
            const user = userMap.get(id);
            if (!user)
                return null;
            return {
                id: user.id,
                name: user.name,
                avatar: user.avatar,
                status: 'offline',
            };
        })
            .filter(Boolean);
    }
    async getRawFriendships(userId) {
        return this.friendshipRepo.find({
            where: [{ userIdA: userId }, { userIdB: userId }],
        });
    }
};
exports.FriendshipService = FriendshipService;
exports.FriendshipService = FriendshipService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.Friendship)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], FriendshipService);
//# sourceMappingURL=friendship.service.js.map