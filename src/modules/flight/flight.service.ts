import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Flight, FlightPassenger, FlightPassengerStatusLog } from '../../models/entities';
import { FlightMode, FlyMode, FlightStatus, Role, UserFlyStatus } from '../../models/enums';
import { IdUtil } from '../../common/id.util';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
import { REDIS_CLIENT } from '../../common/redis.module';

@Injectable()
export class FlightService {
  constructor(
    @InjectRepository(Flight)
    private readonly flightRepo: Repository<Flight>,
    @InjectRepository(FlightPassenger)
    private readonly passengerRepo: Repository<FlightPassenger>,
    @InjectRepository(FlightPassengerStatusLog)
    private readonly statusLogRepo: Repository<FlightPassengerStatusLog>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly friendshipService: FriendshipService,
    private readonly userService: UserService,
  ) { }

  async create(data: {
    captainId: string;
    mode: FlightMode;
    flyMode: FlyMode;
    from: number;
    to: number;
    takeoffAt: number;
    minutes: number;
    scheduledIds?: string;
    seatNum?: string;
  }): Promise<Flight> {
    const now = Math.floor(Date.now() / 1000);
    const flight = this.flightRepo.create({
      id: IdUtil.next('flight'),
      captainId: data.captainId,
      mode: data.mode,
      flyMode: data.flyMode,
      status: FlightStatus.PENDING,
      from: data.from,
      to: data.to,
      takeoffAt: data.takeoffAt,
      arrivalAt: data.takeoffAt + data.minutes * 60,
      createdAt: now,
      scheduledIds: data.scheduledIds || '',
      minutes: data.minutes,
    });
    const saved = await this.flightRepo.save(flight);

    await this.redis.hset(`flight:${saved.id}`, {
      status: FlightStatus.PENDING,
      takeoffAt: saved.takeoffAt,
      arrivalAt: saved.arrivalAt,
      flyMode: saved.flyMode,
      mode: saved.mode,
      captainId: saved.captainId,
      minutes: saved.minutes,
      from: saved.from,
      to: saved.to,
    });

    if (data.mode === FlightMode.MULTIPLE) {
      await this.redis.zadd('group:flights', saved.takeoffAt, saved.id);
    }

    // Also create captain's passenger record with seat if seatNum provided
    if (data.seatNum) {
      await this.addPassenger(saved.id, data.captainId, Role.CAPTAIN, data.seatNum);
      await this.setSeatInRedis(saved.id, {
        userId: data.captainId,
        seatNum: data.seatNum,
        status: UserFlyStatus.FOCUSING,
        role: Role.CAPTAIN,
        isActive: true,
      });
      await this.writeStatusLog(saved.id, data.captainId, UserFlyStatus.FOCUSING);
    }

    return saved;
  }

  async join(flightId: string, userId: string, seatNum: string): Promise<FlightPassenger> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) throw new BadRequestException('flight not found');
    if (flight.status !== FlightStatus.PENDING && flight.status !== FlightStatus.FLYING) throw new BadRequestException('flight already ended');

    const passengers = await this.passengerRepo.find({ where: { flightId } });

    const alreadyJoined = passengers.find(p => p.userId === userId);
    if (alreadyJoined) throw new BadRequestException('already joined');

    if (seatNum) {
      const seatTaken = passengers.find(p => p.seatNum === seatNum);
      if (seatTaken) throw new BadRequestException('seat already taken');
    }

    const role = flight.captainId === userId ? Role.CAPTAIN : Role.PASSENGER;

    const passenger = await this.addPassenger(flightId, userId, role, seatNum);

    await this.setSeatInRedis(flightId, {
      userId,
      seatNum,
      status: UserFlyStatus.FOCUSING,
      role,
      isActive: true,
    });

    await this.writeStatusLog(flightId, userId, UserFlyStatus.FOCUSING);

    const updatedPassengers = await this.passengerRepo.find({ where: { flightId } });
    const userIds = updatedPassengers.map(p => p.userId);
    await this.friendshipService.createForFlight(flightId, userIds);

    return passenger;
  }

  async giveUp(flightId: string, userId: string): Promise<void> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.GIVEUP);
    const passenger = await this.passengerRepo.findOne({ where: { flightId, userId } });
    if (passenger) {
      passenger.status = UserFlyStatus.GIVEUP;
      passenger.quitAt = Math.floor(Date.now() / 1000);
      await this.passengerRepo.save(passenger);
      if (passenger.seatNum) {
        await this.removeSeatFromRedis(flightId, passenger.seatNum);
      }
    }
  }

  async leaveSeat(flightId: string, userId: string): Promise<void> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.LEAVE);
    const seat = await this.findUserSeatInRedis(flightId, userId);
    if (seat) {
      seat.isActive = false;
      seat.status = UserFlyStatus.LEAVE;
      await this.setSeatInRedis(flightId, seat);
    }
  }

  async backSeat(flightId: string, userId: string): Promise<void> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.BACK);
    await this.writeStatusLog(flightId, userId, UserFlyStatus.FOCUSING);
    const seat = await this.findUserSeatInRedis(flightId, userId);
    if (seat) {
      seat.isActive = true;
      seat.status = UserFlyStatus.FOCUSING;
      await this.setSeatInRedis(flightId, seat);
    }
  }

  async getFlightDetail(flightId: string): Promise<any> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) return null;
    const dto = await this.toFlightDto(flight);
    const passengers = await this.passengerRepo.find({ where: { flightId } });
    const passengerUserIds = passengers.map(p => p.userId);
    const users = await this.userService.findByIds(passengerUserIds);
    const userMap = new Map(users.map(u => [u.id, u]));
    dto.passengers = passengers.map(p => ({
      ...p,
      user: userMap.get(p.userId) || null,
    }));
    return dto;
  }

  async getMyFlights(userId: string): Promise<any[]> {
    const passengers = await this.passengerRepo.find({ where: { userId } });
    const flightIds = passengers.map(p => p.flightId);
    if (flightIds.length === 0) return [];
    const flights = await this.flightRepo.findByIds(flightIds);
    const now = Math.floor(Date.now() / 1000);
    const active = flights.filter(f => f.takeoffAt > now && f.status !== FlightStatus.CRASH);
    active.sort((a, b) => {
      if (a.status === FlightStatus.FLYING && b.status !== FlightStatus.FLYING) return -1;
      if (a.status !== FlightStatus.FLYING && b.status === FlightStatus.FLYING) return 1;
      return a.takeoffAt - b.takeoffAt;
    });
    return Promise.all(active.map(f => this.toFlightDto(f)));
  }

  async getInvites(userId: string): Promise<any[]> {
    const joinedFlightIds = (await this.passengerRepo.find({ where: { userId } })).map(p => p.flightId);
    const allFlights = await this.flightRepo.find();
    const now = Math.floor(Date.now() / 1000);
    const invited = allFlights.filter(f => {
      if (f.captainId === userId) return false;
      if (f.status === FlightStatus.CRASH) return false;
      if (f.takeoffAt <= now) return false;
      if (joinedFlightIds.includes(f.id)) return false;
      const scheduledList = f.scheduledIds ? f.scheduledIds.split(',').filter(Boolean) : [];
      return scheduledList.includes(userId);
    });
    invited.sort((a, b) => a.takeoffAt - b.takeoffAt);
    return Promise.all(invited.map(f => this.toFlightDto(f)));
  }

  async getTimeline(flightId: string): Promise<FlightPassengerStatusLog[]> {
    return this.statusLogRepo.find({
      where: { flightId },
      order: { timestamp: 'ASC' },
    });
  }

  async getFlightPassengers(flightId: string): Promise<FlightPassenger[]> {
    return this.passengerRepo.find({ where: { flightId } });
  }

  async updateFlightStatus(flightId: string, status: FlightStatus, crashByUserId?: string): Promise<void> {
    const updateData: any = { status };
    if (crashByUserId) updateData.crashByUserId = crashByUserId;
    await this.flightRepo.update({ id: flightId }, updateData);
  }

  async findFlightById(flightId: string): Promise<Flight | null> {
    return this.flightRepo.findOne({ where: { id: flightId } });
  }

  async updateScheduled(flightId: string, data: { takeoffAt?: number; scheduledIds?: string }): Promise<Flight> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) throw new BadRequestException('flight not found');
    if (flight.status !== FlightStatus.PENDING) throw new BadRequestException('can only edit pending flights');

    if (data.takeoffAt != null) {
      flight.takeoffAt = data.takeoffAt;
      flight.arrivalAt = data.takeoffAt + flight.minutes * 60;
      await this.redis.hset(`flight:${flightId}`, { takeoffAt: flight.takeoffAt, arrivalAt: flight.arrivalAt });
    }
    if (data.scheduledIds != null) {
      flight.scheduledIds = data.scheduledIds;
    }

    return this.flightRepo.save(flight);
  }

  async deleteFlight(flightId: string, userId: string): Promise<void> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) throw new BadRequestException('flight not found');

    const passenger = await this.passengerRepo.findOne({ where: { flightId, userId } });
    if (!passenger) throw new BadRequestException('not a passenger of this flight');
    if (flight.status === FlightStatus.FLYING) throw new BadRequestException('cannot delete a flying flight');

    await this.passengerRepo.delete({ flightId });
    await this.flightRepo.delete({ id: flightId });
    await this.redis.del(`flight:${flightId}:seats`);
    await this.redis.del(`flight:${flightId}`);
    await this.redis.zrem('group:flights', flightId);
  }

  async soloBegin(userId: string, minutes: number): Promise<{ start: number; end: number }> {
    const key = `solo:${userId}`;
    const now = Math.floor(Date.now() / 1000);
    const end = now + minutes * 60;
    await this.redis.hset(key, {
      start: now,
      end,
      status: 'flying',
    });
    return { start: now, end };
  }

  async soloEnd(userId: string): Promise<void> {
    const key = `solo:${userId}`;
    await this.redis.del(key);
  }

  private async addPassenger(flightId: string, userId: string, role: Role, seatNum: string = ''): Promise<FlightPassenger> {
    const now = Math.floor(Date.now() / 1000);
    const passenger = this.passengerRepo.create({
      id: IdUtil.next('passenger'),
      flightId,
      userId,
      role,
      seatNum,
      status: UserFlyStatus.FOCUSING,
      joinAt: now,
      minutes: 0,
    });
    return this.passengerRepo.save(passenger);
  }

  private async writeStatusLog(flightId: string, userId: string, status: UserFlyStatus): Promise<void> {
    const log = this.statusLogRepo.create({
      flightId,
      userId,
      status,
      timestamp: Math.floor(Date.now() / 1000),
    });
    await this.statusLogRepo.save(log);
  }

  async getUpcomingGroupFlights(): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);
    const flightIds = await this.redis.zrangebyscore('group:flights', now, '+inf');
    if (flightIds.length === 0) return [];
    const flights = await this.flightRepo.findByIds(flightIds);
    const pending = flights.filter(f => f.status === FlightStatus.PENDING);
    pending.sort((a, b) => a.takeoffAt - b.takeoffAt);
    return Promise.all(pending.map(f => this.toFlightDto(f)));
  }

  async removeGroupFlightFromIndex(flightId: string): Promise<void> {
    await this.redis.zrem('group:flights', flightId);
  }

  async setSeatInRedis(flightId: string, seat: { userId: string; seatNum: string; status: number; role: number; isActive: boolean }): Promise<void> {
    await this.redis.hset(`flight:${flightId}:seats`, seat.seatNum, JSON.stringify(seat));
  }

  async removeSeatFromRedis(flightId: string, seatNum: string): Promise<void> {
    await this.redis.hdel(`flight:${flightId}:seats`, seatNum);
  }

  async findUserSeatInRedis(flightId: string, userId: string): Promise<{ userId: string; seatNum: string; status: number; role: number; isActive: boolean } | null> {
    const entries = await this.redis.hgetall(`flight:${flightId}:seats`);
    for (const val of Object.values(entries)) {
      const seat = JSON.parse(val);
      if (seat.userId === userId) return seat;
    }
    return null;
  }

  async getActiveSeatCount(flightId: string): Promise<number> {
    const vals = await this.redis.hvals(`flight:${flightId}:seats`);
    return vals.filter(v => JSON.parse(v).isActive === true).length;
  }

  async toFlightDto(flight: Flight): Promise<any> {
    const scheduledIdList = flight.scheduledIds
      ? flight.scheduledIds.split(',').filter(Boolean)
      : [];
    const allIds = [...new Set([flight.captainId, ...scheduledIdList])];
    const users = await this.userService.findByIds(allIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    const captain = userMap.get(flight.captainId) || null;
    const scheduledUsers = [flight.captainId, ...scheduledIdList]
      .map(id => userMap.get(id))
      .filter(Boolean);

    const { scheduledIds, ...rest } = flight;
    return { ...rest, captain: captain, scheduledUsers };
  }
}