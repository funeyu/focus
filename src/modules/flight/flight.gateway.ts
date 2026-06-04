import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { FlightService } from './flight.service';
import { FlightStatsService } from './flight-stats.service';
import { FlyMode, FlightStatus, UserFlyStatus } from '../../models/enums';
import { TokenUtil } from '../../common/token.util';
import { REDIS_CLIENT } from '../../common/redis.module';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';

interface FlightSeat {
  flightId: string;
  userId: string;
  status: number;
  seatNum: string;
  role: number;
  isActive: boolean;
}

@WebSocketGateway({ path: '/api/ws' })
export class FlightGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userRooms: Map<string, Set<string>> = new Map();
  private clientUserMap: Map<WebSocket, string> = new Map();

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly flightService: FlightService,
    private readonly statsService: FlightStatsService,
    private readonly friendshipService: FriendshipService,
    private readonly userService: UserService,
  ) { }

  shouldCrash(flyMode: FlyMode, action: 'leave' | 'giveup', randomValue: number): boolean {
    if (flyMode === FlyMode.SAFE) return false;
    if (action === 'leave') return randomValue < 0.1;
    if (action === 'giveup') return randomValue < 0.5;
    return false;
  }

  async handleConnection(client: WebSocket, ...args: any[]) {
    const req = args[0];
    try {
      const token = req.headers['x-snake'] as string;
      if (!token || !TokenUtil.validate(token, Math.floor(Date.now() / 1000))) {
        client.close(4001, 'invalid token');
      }
    } catch {
      client.close(4001, 'invalid token');
    }
  }

  handleDisconnect(client: WebSocket) {
    const userId = this.clientUserMap.get(client);
    this.clientUserMap.delete(client);
    if (userId) {
      this.userRooms.delete(userId);
      this.broadcastFriendStatus(userId, 'offline');
    }
  }

  @SubscribeMessage('joinFlight')
  async onJoinFlight(client: WebSocket, data: { flightId: string; userId: string }) {
    const room = `flight:${data.flightId}`;
    (client as any).room = room;
    this.clientUserMap.set(client, data.userId);
    if (!this.userRooms.has(data.userId)) {
      this.userRooms.set(data.userId, new Set());
    }
    this.userRooms.get(data.userId).add(room);
    this.broadcastFriendStatus(data.userId, 'flying');
  }

  @SubscribeMessage('enterCabin')
  async onEnterCabin(client: WebSocket, data: { flightId: string; userId: string }) {
    const seat = await this.flightService.findUserSeatInRedis(data.flightId, data.userId);
    if (!seat) return;
    seat.isActive = true;
    await this.flightService.setSeatInRedis(data.flightId, seat);
    this.broadcastSeatUpdate(data.flightId);
  }

  @SubscribeMessage('leaveCabin')
  async onLeaveCabin(client: WebSocket, data: { flightId: string; userId: string }) {
    const seat = await this.flightService.findUserSeatInRedis(data.flightId, data.userId);
    if (!seat) return;
    seat.isActive = false;
    await this.flightService.setSeatInRedis(data.flightId, seat);
    this.broadcastSeatUpdate(data.flightId);
  }

  @SubscribeMessage('pick.seat')
  async onPickSeat(client: WebSocket, data: { flightId: string; userId: string; seatNum: string; userStatus: number }) {
    try {
      await this.flightService.join(data.flightId, data.userId, data.seatNum);
      this.broadcastSeatUpdate(data.flightId);
      this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'ok');
    } catch (err) {
      this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'error');
    }
  }

  @SubscribeMessage('leaveSeat')
  async onLeaveSeat(client: WebSocket, data: { flightId: string; userId: string }) {
    await this.flightService.leaveSeat(data.flightId, data.userId);

    const flightData = await this.redis.hgetall(`flight:${data.flightId}`);
    const flyMode = parseInt(flightData.flyMode, 10);

    if (this.shouldCrash(flyMode, 'leave', Math.random())) {
      await this.handleCrash(data.flightId, data.userId);
    } else {
      this.broadcastSeatUpdate(data.flightId);
      this.broadcastFriendStatus(data.userId, 'afk');
    }
  }

  @SubscribeMessage('backSeat')
  async onBackSeat(client: WebSocket, data: { flightId: string; userId: string }) {
    await this.flightService.backSeat(data.flightId, data.userId);
    this.broadcastSeatUpdate(data.flightId);
    this.broadcastFriendStatus(data.userId, 'flying');
  }

  @SubscribeMessage('giveUpFlight')
  async onGiveUpFlight(client: WebSocket, data: { flightId: string; userId: string }) {
    await this.flightService.giveUp(data.flightId, data.userId);

    const flightData = await this.redis.hgetall(`flight:${data.flightId}`);
    const flyMode = parseInt(flightData.flyMode, 10);

    if (this.shouldCrash(flyMode, 'giveup', Math.random())) {
      await this.handleCrash(data.flightId, data.userId);
    } else {
      this.broadcastSeatUpdate(data.flightId);
      this.broadcastFriendStatus(data.userId, 'offline');
    }
  }

  private async handleCrash(flightId: string, crashByUserId: string) {
    await this.redis.hset(`flight:${flightId}`, 'status', String(FlightStatus.CRASH));
    await this.flightService.updateFlightStatus(flightId, FlightStatus.CRASH, crashByUserId);

    const flight = await this.flightService.findFlightById(flightId);
    if (flight) {
      await this.statsService.settleFlight(flightId, flight.arrivalAt, FlightStatus.CRASH);
    }

    this.broadcastToRoom(`flight:${flightId}`, 'crashAlert', { crashByUserId });

    const passengers = await this.flightService.getFlightPassengers(flightId);
    for (const p of passengers) {
      if (p.status !== UserFlyStatus.GIVEUP) {
        this.broadcastFriendStatus(p.userId, 'offline');
      }
    }
  }

  async broadcastSeatUpdate(flightId: string) {
    try {
      const vals = await this.redis.hvals(`flight:${flightId}:seats`);
      const userIds = vals.map(v => JSON.parse(v).userId);
      const users = await this.userService.findByIds(userIds);
      const userMap = new Map(users.map(u => [u.id, u]));

      const seats = [];
      for (const v of vals) {
        const seat = JSON.parse(v);
        const user = userMap.get(seat.userId);
        seats.push({
          num: seat.seatNum,
          userInfo: user ? { id: user.id, avatar: user.avatar, name: user.name, vip: user.vip } : null,
          userStatus: seat.status,
          isActive: seat.isActive,
        });
      }
      this.broadcastToRoom(`flight:${flightId}`, 'all.seats', seats);
    } catch (err) {
      console.error(`broadcastSeatUpdate failed for flight ${flightId}:`, err);
    }
  }

  broadcastToRoom(room: string, event: string, data: any) {
    const message = JSON.stringify({ event, data });
    this.server.clients.forEach(client => {
      if ((client as any).room === room && client.readyState === 1) {
        client.send(message);
      }
    });
  }

  private async broadcastFriendStatus(userId: string, status: string) {
    const friendships = await this.friendshipService.getRawFriendships(userId);
    const friendIds = friendships.map(f =>
      f.userIdA === userId ? f.userIdB : f.userIdA,
    );
    if (friendIds.length === 0) return;

    const message = JSON.stringify({
      event: 'friendStatus',
      data: JSON.stringify({ userId, status }),
    });

    for (const friendId of friendIds) {
      for (const client of this.server.clients) {
        if (this.clientUserMap.get(client) === friendId && client.readyState === 1) {
          client.send(message);
        }
      }
    }
  }
}
