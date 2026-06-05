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
exports.FlightPassenger = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../enums");
let FlightPassenger = class FlightPassenger {
};
exports.FlightPassenger = FlightPassenger;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightPassenger.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightPassenger.prototype, "flightId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightPassenger.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 4, default: '' }),
    __metadata("design:type", String)
], FlightPassenger.prototype, "seatNum", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: enums_1.Role.PASSENGER }),
    __metadata("design:type", Number)
], FlightPassenger.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: enums_1.UserFlyStatus.FOCUSING }),
    __metadata("design:type", Number)
], FlightPassenger.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightPassenger.prototype, "joinAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], FlightPassenger.prototype, "quitAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FlightPassenger.prototype, "minutes", void 0);
exports.FlightPassenger = FlightPassenger = __decorate([
    (0, typeorm_1.Entity)('flight_passenger')
], FlightPassenger);
//# sourceMappingURL=flight-passenger.entity.js.map