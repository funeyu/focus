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
exports.Flight = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../enums");
let Flight = class Flight {
};
exports.Flight = Flight;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Flight.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], Flight.prototype, "captainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: enums_1.FlightMode.MULTIPLE }),
    __metadata("design:type", Number)
], Flight.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: enums_1.FlyMode.SAFE }),
    __metadata("design:type", Number)
], Flight.prototype, "flyMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: enums_1.FlightStatus.PENDING }),
    __metadata("design:type", Number)
], Flight.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "from", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "to", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "takeoffAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "arrivalAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Flight.prototype, "scheduledIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Flight.prototype, "minutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, nullable: true }),
    __metadata("design:type", String)
], Flight.prototype, "crashByUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Flight.prototype, "seats", void 0);
exports.Flight = Flight = __decorate([
    (0, typeorm_1.Entity)('flight')
], Flight);
//# sourceMappingURL=flight.entity.js.map