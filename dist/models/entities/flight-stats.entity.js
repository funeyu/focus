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
exports.FlightStats = void 0;
const typeorm_1 = require("typeorm");
let FlightStats = class FlightStats {
};
exports.FlightStats = FlightStats;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightStats.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, unique: true }),
    __metadata("design:type", String)
], FlightStats.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightStats.prototype, "totalMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightStats.prototype, "totalArrivals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightStats.prototype, "totalCrashes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightStats.prototype, "streakDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightStats.prototype, "lastFlightDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], FlightStats.prototype, "distribution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], FlightStats.prototype, "friendRanks", void 0);
exports.FlightStats = FlightStats = __decorate([
    (0, typeorm_1.Entity)('flight_stats')
], FlightStats);
//# sourceMappingURL=flight-stats.entity.js.map