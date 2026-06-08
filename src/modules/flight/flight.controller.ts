import { Controller, Post, Get, Param, Body, Put, Inject } from '@nestjs/common';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { ApiUtil } from '../../common/api.util';
import { REDIS_CLIENT } from '../../common/redis.module';
import { PushService } from '../push/push.service';
import { UserService } from '../user/user.service';
import Redis from 'ioredis';

@Controller('flight')
export class FlightController {
  constructor(
    private readonly flightService: FlightService,
    private readonly statsService: FlightStatsService,
    private readonly pushService: PushService,
    private readonly userService: UserService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) { }

  @Post('create')
  async create(@Body() body: {
    captainId: string;
    mode: number;
    flyMode: number;
    from: number;
    to: number;
    takeoffAt: number;
    minutes: number;
    scheduledIds?: string;
    seatNum?: string;
    focusScene: number;
  }) {
    const flight = await this.flightService.create(body);
    const dto = await this.flightService.toFlightDto(flight);
    console.log('Created flight', body);
    // Send push notifications to invited users
    if (body.scheduledIds) {
      const userIds = body.scheduledIds.split(',').map(s => s.trim()).filter(Boolean);
      if (userIds.length > 0) {
        const users = await this.userService.findByIds(userIds);
        const captain = await this.userService.findById(body.captainId);
        const captainName = captain?.name || 'Someone';
        console.log('users', users);
        for (const user of users) {
          if (user.deviceToken) {
            this.pushService.sendInviteNotification(
              user.deviceToken,
              captainName,
              String(dto.from),
              String(dto.to),
              flight.id,
            );
          }
        }
      }
    }

    return ApiUtil.ok(dto);
  }

  @Post('join/:flightId/:userId')
  async join(
    @Param('flightId') flightId: string,
    @Param('userId') userId: string,
    @Body() body: { seatNum: string, focusScene: number },
  ) {
    const passenger = await this.flightService.join(flightId, userId, body.seatNum, body.focusScene);
    return ApiUtil.ok(passenger);
  }

  @Post('solo/begin')
  async soloBegin(@Body() body: { userId: string; minutes: number }) {
    const result = await this.flightService.soloBegin(body.userId, body.minutes);
    return ApiUtil.ok(result);
  }

  @Get('my/:userId')
  async myFlights(@Param('userId') userId: string) {
    const flights = await this.flightService.getMyFlights(userId);
    return ApiUtil.ok(flights);
  }

  @Get('invites/:userId')
  async invites(@Param('userId') userId: string) {
    const flights = await this.flightService.getInvites(userId);
    return ApiUtil.ok(flights);
  }

  @Get('stats/:userId')
  async stats(@Param('userId') userId: string) {
    const stats = await this.statsService.getUserStats(userId);
    return ApiUtil.ok(stats);
  }

  @Get(':flightId')
  async detail(@Param('flightId') flightId: string) {
    const flight = await this.flightService.getFlightDetail(flightId);
    return ApiUtil.ok(flight);
  }

  @Put('update/:flightId')
  async update(
    @Param('flightId') flightId: string,
    @Body() body: {
      takeoffAt?: number;
      scheduledIds?: string;
    },
  ) {
    const flight = await this.flightService.updateScheduled(flightId, body);
    const dto = await this.flightService.toFlightDto(flight);
    return ApiUtil.ok(dto);
  }

  @Post('delete/:flightId/:userId')
  async delete(
    @Param('flightId') flightId: string,
    @Param('userId') userId: string,
  ) {
    await this.flightService.deleteFlight(flightId, userId);
    return ApiUtil.ok();
  }

  @Post('flush-redis')
  async flushRedis() {
    await this.redis.flushall();
    return ApiUtil.ok('All Redis cache cleared');
  }
}
