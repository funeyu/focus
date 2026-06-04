import { Controller, Post, Get, Param, Body, Put, Delete } from '@nestjs/common';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
import { ApiUtil } from '../../common/api.util';
import { UserFlyStatus } from '../../models/enums';

@Controller('flight')
export class FlightController {
  constructor(
    private readonly flightService: FlightService,
    private readonly statsService: FlightStatsService,
    private readonly friendshipService: FriendshipService,
    private readonly userService: UserService,
  ) {}

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
  }) {
    const flight = await this.flightService.create(body);
    const dto = await this.flightService.toFlightDto(flight);
    return ApiUtil.ok(dto);
  }

  @Post('join/:flightId/:userId')
  async join(
    @Param('flightId') flightId: string,
    @Param('userId') userId: string,
    @Body() body: { seatNum: string },
  ) {
    const passenger = await this.flightService.join(flightId, userId, body.seatNum);
    return ApiUtil.ok(passenger);
  }

  @Post('giveUp/:flightId/:userId')
  async giveUp(@Param('flightId') flightId: string, @Param('userId') userId: string) {
    await this.flightService.giveUp(flightId, userId);
    return ApiUtil.ok();
  }

  @Post('solo/begin')
  async soloBegin(@Body() body: { userId: string; minutes: number }) {
    const result = await this.flightService.soloBegin(body.userId, body.minutes);
    return ApiUtil.ok(result);
  }

  @Post('solo/end')
  async soloEnd(@Body() body: { userId: string; focusMinutes: number }) {
    await this.flightService.soloEnd(body.userId);
    await this.statsService.settleSoloFlight(body.userId, body.focusMinutes);
    return ApiUtil.ok();
  }

  @Get('polling')
  async polling() {
    const flights = await this.flightService.getUpcomingGroupFlights();
    return ApiUtil.ok(flights);
  }

  @Get('my/:userId')
  async myFlights(@Param('userId') userId: string) {
    console.log('userId', userId);
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

  @Get('timeline/:flightId')
  async timeline(@Param('flightId') flightId: string) {
    const logs = await this.flightService.getTimeline(flightId);
    return ApiUtil.ok(logs);
  }

  @Get('friends/:userId')
  async friends(@Param('userId') userId: string) {
    const friendships = await this.friendshipService.getFriends(userId);
    return ApiUtil.ok(friendships);
  }

  @Get('seats/:flightId')
  async seats(@Param('flightId') flightId: string) {
    const passengers = await this.flightService.getFlightPassengers(flightId);
    const userIds = passengers.map(p => p.userId);
    const users = await this.userService.findByIds(userIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    const seats = passengers
      .filter(p => p.seatNum && p.status !== UserFlyStatus.GIVEUP)
      .map(p => {
        const user = userMap.get(p.userId);
        return {
          num: p.seatNum,
          userInfo: user ? { id: user.id, avatar: user.avatar, name: user.name, vip: user.vip } : null,
          userStatus: p.status,
          isActive: true,
        };
      });
    return ApiUtil.ok(seats);
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
}
