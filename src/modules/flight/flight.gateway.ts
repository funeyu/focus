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
import { FlyMode, FlightStatus, UserFlyStatus, SeatFocusStatus } from '../../models/enums';
import { TokenUtil } from '../../common/token.util';
import { REDIS_CLIENT } from '../../common/redis.module';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';

interface FlightSeat {
  flightId: string;
  userId: string;
  status: number;
  focusStatus: number;
  seatNum: string;
  role: number;
  isActive: boolean;
}

@WebSocketGateway({ path: '/api/ws' })
export class FlightGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private roomClients: Map<string, Set<WebSocket>> = new Map();
  private userClients: Map<string, Set<WebSocket>> = new Map();
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
    } catch (err) {
      client.close(4001, 'invalid token');
    }
  }

  handleDisconnect(client: WebSocket) {
    const userId = this.clientUserMap.get(client);
    this.clientUserMap.delete(client);

    if (!userId) return;

    const clients = this.userClients.get(userId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.userClients.delete(userId);
        this.broadcastFriendStatus(userId, 'offline');
      }
    }

    const room = (client as any).room as string | undefined;
    if (room) {
      const roomSet = this.roomClients.get(room);
      if (roomSet) {
        roomSet.delete(client);
        if (roomSet.size === 0) {
          this.roomClients.delete(room);
        }
      }
    }
  }

  @SubscribeMessage('joinFlight')
  async onJoinFlight(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] joinFlight', data);
    const room = `flight:${data.flightId}`;
    (client as any).room = room;
    this.clientUserMap.set(client, data.userId);

    if (!this.roomClients.has(room)) {
      this.roomClients.set(room, new Set());
    }
    this.roomClients.get(room).add(client);

    if (!this.userClients.has(data.userId)) {
      this.userClients.set(data.userId, new Set());
    }
    this.userClients.get(data.userId).add(client);

    this.broadcastFriendStatus(data.userId, 'flying');
  }

  @SubscribeMessage('enterCabin')
  async onEnterCabin(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] enterCabin', data);

    // Leave previous room if any
    const prevRoom = (client as any).room as string | undefined;
    if (prevRoom) {
      const prevSet = this.roomClients.get(prevRoom);
      if (prevSet) {
        prevSet.delete(client);
        if (prevSet.size === 0) {
          this.roomClients.delete(prevRoom);
        }
      }
    }

    const room = `flight:${data.flightId}`;
    (client as any).room = room;
    this.clientUserMap.set(client, data.userId);

    if (!this.roomClients.has(room)) {
      this.roomClients.set(room, new Set());
    }
    this.roomClients.get(room).add(client);

    if (!this.userClients.has(data.userId)) {
      this.userClients.set(data.userId, new Set());
    }
    this.userClients.get(data.userId).add(client);

    const seat = await this.flightService.findUserSeatInRedis(data.flightId, data.userId);
    if (seat) {
      seat.isActive = true;
      seat.focusStatus = SeatFocusStatus.FOCUSED;
      await this.flightService.setSeatInRedis(data.flightId, seat);
    }
    await this.broadcastSeatUpdate(data.flightId);
    this.broadcastFriendStatus(data.userId, 'flying');
  }

  @SubscribeMessage('leaveCabin')
  async onLeaveCabin(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] leaveCabin', data);
    const seat = await this.flightService.findUserSeatInRedis(data.flightId, data.userId);
    if (!seat) return;
    seat.focusStatus = SeatFocusStatus.DISTRACTED;
    await this.flightService.setSeatInRedis(data.flightId, seat);
    await this.broadcastSeatUpdate(data.flightId);
  }

  @SubscribeMessage('pick.seat')
  async onPickSeat(client: WebSocket, data: { flightId: string; userId: string; seatNum: string; userStatus: number }) {
    console.log('[WS] pick.seat', data);
    try {
      await this.flightService.join(data.flightId, data.userId, data.seatNum);
      await this.broadcastSeatUpdate(data.flightId);
      this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'ok');
    } catch (err) {
      this.broadcastToRoom(`flight:${data.flightId}`, 'pick.seat.res', 'error');
    }
  }

  @SubscribeMessage('leaveSeat')
  async onLeaveSeat(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] leaveSeat', data);
    const { flyMode } = await this.flightService.leaveSeat(data.flightId, data.userId);
    const flightStatus = parseInt(await this.redis.hget(`flight:${data.flightId}`, 'status'));

    if (flightStatus === FlightStatus.FLYING && this.shouldCrash(flyMode, 'leave', Math.random())) {
      await this.handleCrash(data.flightId, data.userId);
    } else {
      await this.broadcastSeatUpdate(data.flightId);
      this.broadcastFriendStatus(data.userId, 'afk');
    }
  }

  @SubscribeMessage('backSeat')
  async onBackSeat(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] backSeat', data);
    await this.flightService.backSeat(data.flightId, data.userId);
    await this.broadcastSeatUpdate(data.flightId);
    this.broadcastFriendStatus(data.userId, 'flying');
  }

  @SubscribeMessage('giveUpFlight')
  async onGiveUpFlight(client: WebSocket, data: { flightId: string; userId: string }) {
    console.log('[WS] giveUpFlight', data);
    const { flyMode } = await this.flightService.giveUp(data.flightId, data.userId);
    const flightStatus = parseInt(await this.redis.hget(`flight:${data.flightId}`, 'status'));
    console.log('giveUpFlight flyMode', flyMode, 'flightStatus', flightStatus);
    if (flightStatus !== FlightStatus.FLYING) {
      return;
    }

    const activeSeats = await this.flightService.getActiveSeatCount(data.flightId);
    console.log('activeSeats', activeSeats);
    if (activeSeats === 0) {
      await this.handleCrash(data.flightId, data.userId);
    } else if (this.shouldCrash(flyMode, 'giveup', Math.random())) {
      await this.handleCrash(data.flightId, data.userId);
    } else {
      await this.broadcastSeatUpdate(data.flightId);
      this.broadcastFriendStatus(data.userId, 'offline');
    }
  }

  private async handleCrash(flightId: string, crashByUserId: string) {
    console.log('crashByUserId', crashByUserId);
    await Promise.all([
      this.redis.hset(`flight:${flightId}`, 'status', String(FlightStatus.CRASH)),
      this.flightService.updateFlightStatus(flightId, FlightStatus.CRASH, crashByUserId),
      this.flightService.findFlightById(flightId),
    ]).then(async ([, , flight]) => {
      if (flight) {
        const [passengers, _, crashByUser] = await Promise.all([
          this.flightService.getFlightPassengers(flightId),
          this.statsService.settleFlight(flightId, flight.arrivalAt, FlightStatus.CRASH),
          this.userService.findByIds([crashByUserId]),
        ]);
        const user = crashByUser[0];
        this.broadcastToRoom(`flight:${flightId}`, 'crash', user ? { id: user.id, avatar: user.avatar, name: user.name, vip: user.vip } : null);
        for (const p of passengers) {
          if (p.status !== UserFlyStatus.GIVEUP) {
            this.broadcastFriendStatus(p.userId, 'offline');
          }
        }
      }
    });
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
          focusStatus: seat.focusStatus ?? SeatFocusStatus.NOT_STARTED
          ,
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
    const clients = this.roomClients.get(room);
    console.log(`[WS] broadcastToRoom room=${room} event=${event} clientCount=${clients?.size ?? 0}`, message);
    if (!clients) return;
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
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
      const clients = this.userClients.get(friendId);
      if (!clients) continue;
      for (const client of clients) {
        if (client.readyState === 1) {
          client.send(message);
        }
      }
    }
  }
}
