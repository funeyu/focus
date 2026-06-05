"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlightModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const entities_1 = require("../../models/entities");
const flight_controller_1 = require("./flight.controller");
const flight_service_1 = require("./flight.service");
const flight_gateway_1 = require("./flight.gateway");
const flight_stats_service_1 = require("./flight-stats.service");
const flight_scheduler_1 = require("./flight.scheduler");
const user_module_1 = require("../user/user.module");
let FlightModule = class FlightModule {
};
exports.FlightModule = FlightModule;
exports.FlightModule = FlightModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([entities_1.Flight, entities_1.FlightPassenger, entities_1.FlightPassengerStatusLog, entities_1.FlightStats]),
            user_module_1.UserModule,
        ],
        controllers: [flight_controller_1.FlightController],
        providers: [flight_service_1.FlightService, flight_gateway_1.FlightGateway, flight_stats_service_1.FlightStatsService, flight_scheduler_1.FlightScheduler],
        exports: [flight_service_1.FlightService, flight_stats_service_1.FlightStatsService],
    })
], FlightModule);
//# sourceMappingURL=flight.module.js.map