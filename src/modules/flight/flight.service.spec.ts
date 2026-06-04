import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FlightService } from './flight.service';
import { Flight, FlightPassenger, FlightPassengerStatusLog } from '../../models/entities';
import { FlightMode, FlyMode, FlightStatus, Role, UserFlyStatus } from '../../models/enums';
import { FriendshipService } from '../user/friendship.service';
import { UserService } from '../user/user.service';
import { REDIS_CLIENT } from '../../common/redis.module';

describe('FlightService', () => {
  let service: FlightService;
  const flightRepo = { save: jest.fn(), findOne: jest.fn(), find: jest.fn(), update: jest.fn(), findByIds: jest.fn(), create: jest.fn() };
  const passengerRepo = { save: jest.fn(), findOne: jest.fn(), find: jest.fn(), create: jest.fn() };
  const statusLogRepo = { save: jest.fn(), find: jest.fn(), create: jest.fn() };
  const redis = { hset: jest.fn(), hgetall: jest.fn(), hdel: jest.fn(), hvals: jest.fn(), del: jest.fn(), zadd: jest.fn(), zrem: jest.fn(), zrangebyscore: jest.fn() };
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
    it('should create flight', async () => {
      flightRepo.create.mockReturnValue({ id: 'flt_1' });
      flightRepo.save.mockResolvedValue({ id: 'flt_1' });
      redis.hset.mockResolvedValue('OK');

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
      expect(redis.hset).toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('should add passenger and write FOCUSING status log', async () => {
      flightRepo.findOne.mockResolvedValue({ id: 'flt_1', status: FlightStatus.PENDING, captainId: 'user1' });
      passengerRepo.create.mockReturnValue({ id: 'psg_2' });
      passengerRepo.save.mockResolvedValue({ id: 'psg_2' });
      statusLogRepo.create.mockReturnValue({ flightId: 'flt_1', userId: 'user2', status: UserFlyStatus.FOCUSING });
      statusLogRepo.save.mockResolvedValue({});
      passengerRepo.find
        .mockResolvedValueOnce([{ userId: 'user1' }])
        .mockResolvedValueOnce([{ userId: 'user1' }, { userId: 'user2' }]);

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
      passengerRepo.findOne.mockResolvedValue({ flightId: 'flt_1', userId: 'user1', status: UserFlyStatus.FOCUSING });
      passengerRepo.save.mockResolvedValue({});

      await service.giveUp('flt_1', 'user1');

      expect(passengerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserFlyStatus.GIVEUP }),
      );
    });
  });

  describe('soloBegin', () => {
    it('should set solo flight in redis', async () => {
      redis.hset.mockResolvedValue('OK');

      const result = await service.soloBegin('user1', 25);

      expect(result.start).toBeDefined();
      expect(result.end).toBeDefined();
      expect(redis.hset).toHaveBeenCalledWith('solo:user1', expect.any(Object));
    });
  });

  describe('soloEnd', () => {
    it('should delete solo flight from redis', async () => {
      redis.del.mockResolvedValue(1);

      await service.soloEnd('user1');

      expect(redis.del).toHaveBeenCalledWith('solo:user1');
    });
  });
});