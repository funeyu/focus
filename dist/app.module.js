"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_module_1 = require("./config/config.module");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_1 = require("@nestjs/schedule");
const redis_module_1 = require("./common/redis.module");
const user_module_1 = require("./modules/user/user.module");
const flight_module_1 = require("./modules/flight/flight.module");
const token_middleware_1 = require("./common/token.middleware");
let AppModule = class AppModule {
    configure(consumer) {
        consumer.apply(token_middleware_1.TokenMiddleware).forRoutes('*');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            typeorm_1.TypeOrmModule.forRoot({
                type: 'mysql',
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT, 10) || 3307,
                username: process.env.DB_USERNAME || 'root',
                password: process.env.DB_PASSWORD || 'root',
                database: process.env.DB_DATABASE || 'focus_fly',
                autoLoadEntities: true,
                synchronize: true,
            }),
            schedule_1.ScheduleModule.forRoot(),
            redis_module_1.RedisModule,
            user_module_1.UserModule,
            flight_module_1.FlightModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map