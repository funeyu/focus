import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FlightService } from './flight.service';
import { Flight, FlightPassenger, FlightPassengerStatusLog } from '../../models/entities';
import { FlightMode, FlyMode, FlightStatus, Role, UserFlyStatus, SeatFocusStatus } from '../../models/enums';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
import { REDIS_CLIENT } from '../../common/redis.module';

describe('FlightService', () => {
  let service: FlightService;
  const flightRepo = { save: jest.fn(), findOne: jest.fn(), find: jest.fn(), update: jest.fn(), findByIds: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn() };
  const passengerRepo = { save: jest.fn(), findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), create: jest.fn(), delete: jest.fn() };
  const statusLogRepo = { save: jest.fn(), find: jest.fn(), create: jest.fn() };
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn(), keys: jest.fn(), mget: jest.fn() };
  const friendshipService = { createForFlight: jest.fn() };
  const userService = { findByIds: jest.fn().mockResolvedValue([]) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FlightService,
        { provide: getRepositoryToken(Flight), useValue: flightRepo },
        { provide: getRepositoryToken(FlightPassenger), useValue: passengerRepo },
        { provide: getRepositoryToken(FlightPassengerStatusLog), useValue: statusLogRepo },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: FriendshipService, useValue: friendshipService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(FlightService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create flight without writing to redis', async () => {
      flightRepo.create.mockReturnValue({ id: 'flt_1' });
      flightRepo.save.mockResolvedValue({ id: 'flt_1' });
      passengerRepo.find.mockResolvedValue([]);

      const result = await service.create({
        captainId: 'user1',
        mode: FlightMode.MULTIPLE,
        flyMode: FlyMode.CRASH,
        from: 0,
        to: 5,
        takeoffAt: 1000,
        minutes: 25,
        scheduledIds: 'user2,user3',
      });

      expect(flightRepo.save).toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('should add passenger and write FOCUSING status log', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', status: FlightStatus.PENDING, captainId: 'user1', takeoffAt: 1000, arrivalAt: 2500 });
      passengerRepo.create.mockReturnValue({ id: 'psg_2' });
      passengerRepo.save.mockResolvedValue({ id: 'psg_2' });
      statusLogRepo.create.mockReturnValue({ flightId: 'flt_1', userId: 'user2', status: UserFlyStatus.FOCUSING });
      statusLogRepo.save.mockResolvedValue({});
      passengerRepo.find.mockResolvedValue([]);
      redis.get.mockResolvedValue(null);

      await service.join('flt_1', 'user2', 'A01');

      expect(passengerRepo.save).toHaveBeenCalled();
      expect(statusLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserFlyStatus.FOCUSING }),
      );
    });

    it('should reject joining an ended flight', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', status: FlightStatus.ARRIVED });

      await expect(service.join('flt_1', 'user2', 'A01')).rejects.toThrow();
    });
  });

  describe('giveUp', () => {
    it('should update passenger status to GIVEUP', async () => {
      statusLogRepo.create.mockReturnValue({ flightId: 'flt_1', userId: 'user1', status: UserFlyStatus.GIVEUP });
      statusLogRepo.save.mockResolvedValue({});
      passengerRepo.findOne.mockResolvedValue({ flightId: 'flt_1', userId: 'user1', status: UserFlyStatus.FOCUSING, seatNum: 'A01' });
      passengerRepo.save.mockResolvedValue({});
      redis.get.mockResolvedValue(JSON.stringify({ flyMode: FlyMode.SAFE, seats: [] }));

      const result = await service.giveUp('flt_1', 'user1');

      expect(passengerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserFlyStatus.GIVEUP }),
      );
      expect(result.flyMode).toBe(FlyMode.SAFE);
    });
  });

  describe('deleteFlight', () => {
    it('should allow captain to delete', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', captainId: 'user1', status: FlightStatus.PENDING });
      flightRepo.delete.mockResolvedValue({});
      passengerRepo.delete.mockResolvedValue({});
      redis.del.mockResolvedValue(1);

      await service.deleteFlight('flt_1', 'user1');

      expect(flightRepo.delete).toHaveBeenCalledWith({ id: 'flt_1' });
      expect(redis.del).toHaveBeenCalledWith('flightDto:flt_1');
    });

    it('should reject non-captain deleting flight', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', captainId: 'user1', status: FlightStatus.PENDING });

      await expect(service.deleteFlight('flt_1', 'user2')).rejects.toThrow('only captain can delete flight');
    });
  });

  describe('soloBegin', () => {
    it('should return start and end without writing to redis', async () => {
      const result = await service.soloBegin('user1', 25);

      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
      expect(result.end - result.start).toBe(25 * 60);
    });
  });


  describe('FlightDto cache operations', () => {
    it('getCachedFlightDto should return parsed dto', async () => {
      const dto = { id: 'flt_1', seats: [] };
      redis.get.mockResolvedValue(JSON.stringify(dto));

      const result = await service.getCachedFlightDto('flt_1');
      expect(result).toEqual(dto);
    });

    it('setCachedFlightDto should set with TTL', async () => {
      redis.set.mockResolvedValue('OK');
      const dto = { id: 'flt_1', arrivalAt: Math.floor(Date.now() / 1000) + 100, seats: [] } as any;

      await service.setCachedFlightDto('flt_1', dto);
      expect(redis.set).toHaveBeenCalledWith('flightDto:flt_1', expect.any(String), 'EX', expect.any(Number));
    });

    it('ensureCached should skip non-qualifying flights', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', status: FlightStatus.PENDING, takeoffAt: Math.floor(Date.now() / 1000) + 3600 });
      redis.get.mockResolvedValue(null);

      const result = await service.ensureCached('flt_1');
      expect(result).toBeNull();
    });

    it('ensureCached should cache FLYING flights', async () => {
      const now = Math.floor(Date.now() / 1000);
      const flight = { id: 'flt_1', status: FlightStatus.FLYING, takeoffAt: now - 100, arrivalAt: now + 1000, captainId: 'u1', seats: [], scheduledIds: '' };
      flightRepo.findOne.mockResolvedValue(flight);
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      userService.findByIds.mockResolvedValue([]);

      const result = await service.ensureCached('flt_1');
      expect(result).toBeDefined();
      expect(result.status).toBe(FlightStatus.FLYING);
    });

    it('cleanupFlightCache should remove cached dto', async () => {
      redis.del.mockResolvedValue(1);

      await service.cleanupFlightCache('flt_1');
      expect(redis.del).toHaveBeenCalledWith('flightDto:flt_1');
    });
  });
});
