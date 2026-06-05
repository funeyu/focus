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
exports.FlightPassengerStatusLog = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../enums");
let FlightPassengerStatusLog = class FlightPassengerStatusLog {
};
exports.FlightPassengerStatusLog = FlightPassengerStatusLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], FlightPassengerStatusLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightPassengerStatusLog.prototype, "flightId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32 }),
    __metadata("design:type", String)
], FlightPassengerStatusLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], FlightPassengerStatusLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], FlightPassengerStatusLog.prototype, "timestamp", void 0);
exports.FlightPassengerStatusLog = FlightPassengerStatusLog = __decorate([
    (0, typeorm_1.Entity)('flight_passenger_status_log'),
    (0, typeorm_1.Index)('idx_flight_user', ['flightId', 'userId'])
], FlightPassengerStatusLog);
//# sourceMappingURL=flight-passenger-status-log.entity.js.map