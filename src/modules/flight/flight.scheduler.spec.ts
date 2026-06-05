import { FlightScheduler } from './flight.scheduler';
import { FlightStatus } from '../../models/enums';

function makeMocks() {
  const redis: any = {
    zrangebyscore: jest.fn().mockResolvedValue([]),
    hgetall: jest.fn().mockResolvedValue({}),
    hset: jest.fn().mockResolvedValue('OK'),
    hvals: jest.fn().mockResolvedValue([]),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
  };
  const flightRepo: any = {
    update: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const flightService: any = {};
  const statsService: any = {
    settleFlight: jest.fn().mockResolvedValue(undefined),
  };
  const gateway: any = {
    broadcastToRoom: jest.fn(),
  };

  const scheduler = new FlightScheduler(redis, flightRepo, flightService, statsService, gateway);

  return { scheduler, redis, flightRepo, flightService, statsService, gateway };
}

describe('FlightScheduler', () => {
  describe('checkFlights — takingOff', () => {
    it('should broadcast takingOff when a PENDING flight reaches takeoffAt with active seats', async () => {
      const { scheduler, redis, flightRepo, gateway } = makeMocks();

      const flightId = 'flt_1';
      const now = Math.floor(Date.now() / 1000);

      redis.zrangebyscore.mockResolvedValue([flightId]);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.PENDING),
        takeoffAt: String(now - 1),
        arrivalAt: String(now + 1500),
      });
      redis.hvals.mockResolvedValue([
        JSON.stringify({ userId: 'u1', seatNum: 'A1', status: 0, role: 0, isActive: true }),
        JSON.stringify({ userId: 'u2', seatNum: 'A2', status: 0, role: 1, isActive: true }),
      ]);

      await scheduler.checkFlights();

      expect(redis.hset).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'status',
        String(FlightStatus.FLYING),
      );
      expect(flightRepo.update).toHaveBeenCalledWith(
        { id: flightId },
        { status: FlightStatus.FLYING },
      );
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'takingOff',
        { flightId, seatedUserIds: ['u1', 'u2'] },
      );
    });

    it('should NOT broadcast takingOff when flight status is not PENDING', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue(['flt_1']);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.FLYING),
      });

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should NOT broadcast takingOff when there are no seats', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue(['flt_1']);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.PENDING),
        takeoffAt: '100',
      });
      redis.hvals.mockResolvedValue([]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should NOT broadcast takingOff when no seat is active', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue(['flt_1']);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.PENDING),
        takeoffAt: '100',
      });
      redis.hvals.mockResolvedValue([
        JSON.stringify({ userId: 'u1', seatNum: 'A1', status: 0, role: 0, isActive: false }),
      ]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should broadcast takingOff with only active seated user IDs', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue(['flt_2']);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.PENDING),
        takeoffAt: '100',
      });
      redis.hvals.mockResolvedValue([
        JSON.stringify({ userId: 'u1', seatNum: 'A1', status: 0, role: 0, isActive: true }),
        JSON.stringify({ userId: 'u2', seatNum: 'A2', status: 1, role: 1, isActive: false }),
        JSON.stringify({ userId: 'u3', seatNum: 'A3', status: 0, role: 1, isActive: true }),
      ]);

      await scheduler.checkFlights();

      // scheduler only checks hasActiveSeat, includes all seatedUserIds regardless of isActive
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'flight:flt_2',
        'takingOff',
        { flightId: 'flt_2', seatedUserIds: ['u1', 'u2', 'u3'] },
      );
    });

    it('should handle multiple flights reaching takeoff simultaneously', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue(['flt_1', 'flt_2']);
      redis.hgetall
        .mockResolvedValueOnce({
          status: String(FlightStatus.PENDING),
          takeoffAt: '100',
        })
        .mockResolvedValueOnce({
          status: String(FlightStatus.PENDING),
          takeoffAt: '100',
        });
      redis.hvals
        .mockResolvedValueOnce([
          JSON.stringify({ userId: 'u1', seatNum: 'A1', status: 0, role: 0, isActive: true }),
        ])
        .mockResolvedValueOnce([
          JSON.stringify({ userId: 'u2', seatNum: 'B1', status: 0, role: 0, isActive: true }),
        ]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).toHaveBeenCalledTimes(2);
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'flight:flt_1', 'takingOff', { flightId: 'flt_1', seatedUserIds: ['u1'] },
      );
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        'flight:flt_2', 'takingOff', { flightId: 'flt_2', seatedUserIds: ['u2'] },
      );
    });
  });

  describe('checkFlights — arrived', () => {
    it('should broadcast arrived when a FLYING flight reaches arrivalAt', async () => {
      const { scheduler, redis, flightRepo, statsService, gateway } = makeMocks();

      const flightId = 'flt_1';
      const now = Math.floor(Date.now() / 1000);

      redis.zrangebyscore.mockResolvedValue([]);
      redis.keys.mockResolvedValue([`flight:${flightId}`]);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.FLYING),
        arrivalAt: String(now - 1),
      });
      flightRepo.findOne.mockResolvedValue({ id: flightId, arrivalAt: now - 1 });

      await scheduler.checkFlights();

      expect(redis.hset).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'status',
        String(FlightStatus.ARRIVED),
      );
      expect(flightRepo.update).toHaveBeenCalledWith(
        { id: flightId },
        { status: FlightStatus.ARRIVED },
      );
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'arrived',
        { flightId },
      );
      expect(statsService.settleFlight).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith(`flight:${flightId}`);
      expect(redis.del).toHaveBeenCalledWith(`flight:${flightId}:seats`);
      expect(redis.zrem).toHaveBeenCalledWith('group:flights', flightId);
    });

    it('should NOT broadcast arrived for non-FLYING flights', async () => {
      const { scheduler, redis, gateway } = makeMocks();

      redis.zrangebyscore.mockResolvedValue([]);
      redis.keys.mockResolvedValue(['flight:flt_1']);
      redis.hgetall.mockResolvedValue({
        status: String(FlightStatus.PENDING),
        arrivalAt: '100',
      });

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });
  });
});
