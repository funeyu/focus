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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Friendship = void 0;
const typeorm_1 = require("typeorm");
let Friendship = class Friendship {
};
exports.Friendship = Friendship;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Friendship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Friendship.prototype, "userIdA", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Friendship.prototype, "userIdB", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Friendship.prototype, "flightId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Friendship.prototype, "createdAt", void 0);
exports.Friendship = Friendship = __decorate([
    (0, typeorm_1.Entity)('friendship'),
    (0, typeorm_1.Index)('idx_userA', ['userIdA']),
    (0, typeorm_1.Index)('idx_userB', ['userIdB'])
], Friendship);
//# sourceMappingURL=friendship.entity.js.map