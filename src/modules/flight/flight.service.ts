import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Flight, FlightPassenger, FlightPassengerStatusLog } from '../../models/entities';
import { FlightMode, FlyMode, FlightStatus, Role, UserFlyStatus, SeatFocusStatus } from '../../models/enums';
import { FlightDto, FlightSeatDto, FlightSeatPairDto } from '../../models/dtos';
import { IdUtil } from '../../common/id.util';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
import { REDIS_CLIENT } from '../../common/redis.module';

const FLIGHT_DTO_PREFIX = 'flightDto:';

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

  cacheKey(flightId: string): string {
    return `${FLIGHT_DTO_PREFIX}${flightId}`;
  }

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
    focusScene: number;
  }): Promise<Flight> {
    const now = Math.floor(Date.now() / 1000);
    const seat: FlightSeatPairDto = {
      num: data.seatNum || '',
      userId: data.captainId,
      focusScene: data.focusScene,
    };
    const flight: Flight = this.flightRepo.create({
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
      seats: [seat]
    });
    const saved = await this.flightRepo.save(flight);

    if (data.seatNum) {
      await this.addPassenger(saved.id, data.captainId, Role.CAPTAIN, data.seatNum);
      await this.writeStatusLog(saved.id, data.captainId, UserFlyStatus.FOCUSING);
    }

    return saved;
  }

  async join(flightId: string, userId: string, seatNum: string, focusScene: number = 0): Promise<FlightPassenger> {
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

    await this.setSeatInCache(flightId, {
      num: seatNum,
      userInfo: null,
      focusScene,
      focusStatus: SeatFocusStatus.NOT_STARTED,
      isActive: true,
    }, userId, role);

    await this.writeStatusLog(flightId, userId, UserFlyStatus.FOCUSING);

    const updatedPassengers = await this.passengerRepo.find({ where: { flightId } });
    const userIds = updatedPassengers.map(p => p.userId);
    await this.friendshipService.createForFlight(flightId, userIds);

    return passenger;
  }

  async giveUp(flightId: string, userId: string): Promise<{ flyMode: FlyMode }> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.GIVEUP);
    const passenger = await this.passengerRepo.findOne({ where: { flightId, userId } });
    if (passenger) {
      passenger.status = UserFlyStatus.GIVEUP;
      passenger.quitAt = Math.floor(Date.now() / 1000);
      await this.passengerRepo.save(passenger);
      await this.removeSeatFromCache(flightId, passenger.seatNum);
    }
    const dto = await this.getCachedFlightDto(flightId);
    return { flyMode: dto?.flyMode ?? FlyMode.SAFE };
  }

  async leaveSeat(flightId: string, userId: string): Promise<{ flyMode: FlyMode }> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.LEAVE);
    await this.updateSeatInCache(flightId, userId, { focusStatus: SeatFocusStatus.DISTRACTED });
    const dto = await this.getCachedFlightDto(flightId);
    return { flyMode: dto?.flyMode ?? FlyMode.SAFE };
  }

  async backSeat(flightId: string, userId: string): Promise<void> {
    await this.writeStatusLog(flightId, userId, UserFlyStatus.BACK);
    await this.writeStatusLog(flightId, userId, UserFlyStatus.FOCUSING);
    await this.updateSeatInCache(flightId, userId, { focusStatus: SeatFocusStatus.FOCUSED });
  }

  async getFlightDetail(flightId: string): Promise<(FlightDto & { passengers: any[] }) | null> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) return null;
    const dto = await this.toFlightDto(flight);
    const passengers = await this.passengerRepo.find({ where: { flightId } });
    const passengerUserIds = passengers.map(p => p.userId);
    const users = await this.userService.findByIds(passengerUserIds);
    const userMap = new Map(users.map(u => [u.id, u]));
    return {
      ...dto,
      passengers: passengers.map(p => ({
        ...p,
        user: userMap.get(p.userId) || null,
      })),
    };
  }

  async getMyFlights(userId: string): Promise<FlightDto[]> {
    const passengers = await this.passengerRepo.find({ where: { userId } });
    const flightIds = passengers.map(p => p.flightId);
    if (flightIds.length === 0) return [];
    const flights = await this.flightRepo.findByIds(flightIds);
    const now = Math.floor(Date.now() / 1000);
    const oneWeekAgo = now - 7 * 24 * 3600;
    const recent = flights.filter(f => f.createdAt >= oneWeekAgo);
    const active = recent.filter(f => f.arrivalAt > now && f.status !== FlightStatus.CRASH);
    active.sort((a, b) => {
      if (a.status === FlightStatus.FLYING && b.status !== FlightStatus.FLYING) return -1;
      if (a.status !== FlightStatus.FLYING && b.status === FlightStatus.FLYING) return 1;
      return a.takeoffAt - b.takeoffAt;
    });
    const dtos = await Promise.all(active.map(f => this.toFlightDto(f)));
    for (let i = 0; i < active.length; i++) {
      if (active[i].status === FlightStatus.FLYING) {
        const cached = await this.getCachedFlightDto(active[i].id);
        if (cached) {
          const seat = cached.seats.find(s => s.userInfo?.id === userId);
          dtos[i].focusStatus = seat?.focusStatus ?? SeatFocusStatus.FOCUSED;
        }
      }
    }
    return dtos;
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
    }
    if (data.scheduledIds != null) {
      flight.scheduledIds = data.scheduledIds;
    }

    const saved = await this.flightRepo.save(flight);

    const cached = await this.getCachedFlightDto(flightId);
    if (cached) {
      cached.takeoffAt = saved.takeoffAt;
      cached.arrivalAt = saved.arrivalAt;
      await this.setCachedFlightDto(flightId, cached);
    }

    return saved;
  }

  async deleteFlight(flightId: string, userId: string): Promise<void> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) throw new BadRequestException('flight not found');

    if (flight.captainId !== userId) throw new BadRequestException('only captain can delete flight');
    if (flight.status === FlightStatus.FLYING) throw new BadRequestException('cannot delete a flying flight');

    await this.passengerRepo.delete({ flightId });
    await this.flightRepo.delete({ id: flightId });
    await this.removeCachedFlightDto(flightId);
  }

  async soloBegin(userId: string, minutes: number): Promise<{ start: number; end: number }> {
    const now = Math.floor(Date.now() / 1000);
    const end = now + minutes * 60;
    return { start: now, end };
  }

  // --- FlightDto cache operations ---

  async getCachedFlightDto(flightId: string): Promise<FlightDto | null> {
    const raw = await this.redis.get(this.cacheKey(flightId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async setCachedFlightDto(flightId: string, dto: FlightDto): Promise<void> {
    const ttl = dto.arrivalAt - Math.floor(Date.now() / 1000) + 60;
    if (ttl > 0) {
      await this.redis.set(this.cacheKey(flightId), JSON.stringify(dto), 'EX', ttl);
    }
  }

  async removeCachedFlightDto(flightId: string): Promise<void> {
    await this.redis.del(this.cacheKey(flightId));
  }

  async getAllCachedFlights(): Promise<FlightDto[]> {
    const keys = await this.redis.keys(`${FLIGHT_DTO_PREFIX}*`);
    if (keys.length === 0) return [];
    const values = await this.redis.mget(...keys);
    const dtos: FlightDto[] = [];
    for (const raw of values) {
      if (!raw) continue;
      try {
        dtos.push(JSON.parse(raw));
      } catch { /* skip corrupted entries */ }
    }
    return dtos;
  }

  async ensureCached(flightId: string): Promise<FlightDto | null> {
    const existing = await this.getCachedFlightDto(flightId);
    if (existing) return existing;

    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) return null;

    const now = Math.floor(Date.now() / 1000);
    if (flight.status === FlightStatus.FLYING) {
      // cache flying flights
    } else if (flight.status === FlightStatus.PENDING && flight.takeoffAt - now <= 60) {
      // cache pending flights within 1 minute of takeoff
    } else {
      return null;
    }

    const dto = await this.toFlightDto(flight);
    await this.setCachedFlightDto(flightId, dto);
    return dto;
  }

  async cleanupFlightCache(flightId: string): Promise<void> {
    await this.removeCachedFlightDto(flightId);
  }

  // --- Seat operations via FlightDto cache ---

  async setSeatInCache(flightId: string, seat: FlightSeatDto, userId: string, role: number): Promise<void> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return;

    const users = await this.userService.findByIds([userId]);
    const user = users[0] || null;
    seat.userInfo = user ? { id: user.id, name: user.name, avatar: user.avatar, vip: user.vip } : null;

    const idx = dto.seats.findIndex(s => s.num === seat.num);
    if (idx >= 0) {
      dto.seats[idx] = seat;
    } else {
      dto.seats.push(seat);
    }
    await this.setCachedFlightDto(flightId, dto);
    await this.persistSeatsToDb(flightId, { num: seat.num, userId, focusScene: seat.focusScene });
  }

  async removeSeatFromCache(flightId: string, seatNum: string): Promise<void> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return;

    dto.seats = dto.seats.filter(s => s.num !== seatNum);
    await this.setCachedFlightDto(flightId, dto);

    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) return;
    const seats = (flight.seats || []).filter(s => s.num !== seatNum);
    await this.flightRepo.update({ id: flightId }, { seats });
  }

  async updateSeatInCache(flightId: string, userId: string, updates: Partial<FlightSeatDto>): Promise<void> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return;

    const seat = dto.seats.find(s => s.userInfo?.id === userId);
    if (seat) {
      Object.assign(seat, updates);
      await this.setCachedFlightDto(flightId, dto);
    }
  }

  async findUserSeatInCache(flightId: string, userId: string): Promise<FlightSeatDto | null> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return null;
    return dto.seats.find(s => s.userInfo?.id === userId) ?? null;
  }

  async getActiveSeatCount(flightId: string): Promise<number> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return 0;
    return dto.seats.filter(s => s.isActive).length;
  }

  async getSeatsFromCache(flightId: string): Promise<FlightSeatDto[]> {
    const dto = await this.getCachedFlightDto(flightId);
    if (!dto) return [];
    return dto.seats;
  }

  // --- Private helpers ---

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
    const flights = await this.flightRepo.find({ where: { mode: FlightMode.MULTIPLE, status: FlightStatus.PENDING } });
    const upcoming = flights.filter(f => f.takeoffAt > now);
    upcoming.sort((a, b) => a.takeoffAt - b.takeoffAt);
    return Promise.all(upcoming.map(f => this.toFlightDto(f)));
  }

  private async persistSeatsToDb(flightId: string, seatData: { num: string; userId: string; focusScene: number } | null): Promise<void> {
    const flight = await this.flightRepo.findOne({ where: { id: flightId } });
    if (!flight) return;
    const seats = flight.seats ? [...flight.seats] : [];
    if (seatData) {
      const idx = seats.findIndex(s => s.num === seatData.num);
      if (idx >= 0) {
        seats[idx] = seatData;
      } else {
        seats.push(seatData);
      }
    }
    await this.flightRepo.update({ id: flightId }, { seats });
  }

  async toFlightDto(flight: Flight): Promise<FlightDto> {
    const scheduledIdList = flight.scheduledIds
      ? flight.scheduledIds.split(',').filter(Boolean)
      : [];
    const seatList = flight.seats || [];
    const seatUserIds = seatList.map(s => s.userId);
    const allIds = [...new Set([flight.captainId, ...scheduledIdList, ...seatUserIds])];
    const users = await this.userService.findByIds(allIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    const captain = userMap.get(flight.captainId) || null;
    const scheduledUsers = [flight.captainId, ...scheduledIdList]
      .map(id => userMap.get(id))
      .filter(Boolean);

    const seats: FlightSeatDto[] = seatList.map(seatInfo => {
      const user = userMap.get(seatInfo.userId);
      return {
        num: seatInfo.num,
        userInfo: user ? { id: user.id, name: user.name, avatar: user.avatar, vip: user.vip } : null,
        focusScene: seatInfo.focusScene,
        focusStatus: SeatFocusStatus.FOCUSED,
        isActive: true,
      };
    });

    const { scheduledIds, seats: _seats, ...rest } = flight;
    return { ...rest, captain, scheduledUsers, seats };
  }
}
