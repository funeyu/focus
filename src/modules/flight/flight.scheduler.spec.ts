import { FlightScheduler } from './flight.scheduler';
import { FlightStatus, SeatFocusStatus } from '../../models/enums';
import { FlightDto } from '../../models/dtos';

function makeMocks() {
  const flightService: any = {
    getAllCachedFlights: jest.fn().mockResolvedValue([]),
    setCachedFlightDto: jest.fn().mockResolvedValue(undefined),
    updateFlightStatus: jest.fn().mockResolvedValue(undefined),
    cleanupFlightCache: jest.fn().mockResolvedValue(undefined),
    deleteFlight: jest.fn().mockResolvedValue(undefined),
  };
  const statsService: any = {
    settleFlight: jest.fn().mockResolvedValue(undefined),
  };
  const gateway: any = {
    broadcastToRoom: jest.fn(),
  };

  const scheduler = new FlightScheduler({} as any, flightService, statsService, gateway);

  return { scheduler, flightService, statsService, gateway };
}

function makeDto(overrides: Partial<FlightDto> = {}): FlightDto {
  return {
    id: 'flt_1',
    captainId: 'u1',
    mode: 1,
    flyMode: 0,
    status: FlightStatus.PENDING,
    from: 1,
    to: 2,
    takeoffAt: Math.floor(Date.now() / 1000) - 1,
    arrivalAt: Math.floor(Date.now() / 1000) + 1500,
    createdAt: Math.floor(Date.now() / 1000),
    minutes: 25,
    crashByUserId: null,
    captain: null,
    scheduledUsers: [],
    seats: [],
    ...overrides,
  } as FlightDto;
}

describe('FlightScheduler', () => {
  describe('checkFlights — takingOff', () => {
    it('should broadcast takingOff when a PENDING flight reaches takeoffAt with focused seats', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      const flightId = 'flt_1';
      const dto = makeDto({
        id: flightId,
        status: FlightStatus.PENDING,
        seats: [
          { num: 'A1', userInfo: { id: 'u1', name: 'a', avatar: '', vip: false }, focusScene: 0, focusStatus: SeatFocusStatus.FOCUSED, isActive: true },
          { num: 'A2', userInfo: { id: 'u2', name: 'b', avatar: '', vip: false }, focusScene: 0, focusStatus: SeatFocusStatus.FOCUSED, isActive: true },
        ],
      });

      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(flightService.updateFlightStatus).toHaveBeenCalledWith(flightId, FlightStatus.FLYING);
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'takingOff',
        { flightId, seatedUserIds: ['u1', 'u2'] },
      );
    });

    it('should NOT broadcast takingOff when flight status is not PENDING', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      const dto = makeDto({ status: FlightStatus.FLYING });
      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should NOT broadcast takingOff when there are no seats', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      const dto = makeDto({ status: FlightStatus.PENDING, seats: [] });
      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should NOT broadcast takingOff when no seat is focused', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      const dto = makeDto({
        status: FlightStatus.PENDING,
        seats: [
          { num: 'A1', userInfo: { id: 'u1', name: 'a', avatar: '', vip: false }, focusScene: 0, focusStatus: SeatFocusStatus.DISTRACTED, isActive: true },
        ],
      });
      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });

    it('should skip flight when cache is missing (TTL expired)', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      flightService.getAllCachedFlights.mockResolvedValue([]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe('checkFlights — arrived', () => {
    it('should broadcast arrived when a FLYING flight reaches arrivalAt', async () => {
      const { scheduler, flightService, statsService, gateway } = makeMocks();

      const flightId = 'flt_1';
      const now = Math.floor(Date.now() / 1000);
      const dto = makeDto({
        id: flightId,
        status: FlightStatus.FLYING,
        arrivalAt: now - 1,
      });

      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(flightService.updateFlightStatus).toHaveBeenCalledWith(flightId, FlightStatus.ARRIVED);
      expect(gateway.broadcastToRoom).toHaveBeenCalledWith(
        `flight:${flightId}`,
        'arrived',
        { flightId },
      );
      expect(statsService.settleFlight).toHaveBeenCalled();
      expect(flightService.cleanupFlightCache).toHaveBeenCalledWith(flightId);
    });

    it('should NOT broadcast arrived for non-FLYING flights', async () => {
      const { scheduler, flightService, gateway } = makeMocks();

      const dto = makeDto({ status: FlightStatus.PENDING });
      flightService.getAllCachedFlights.mockResolvedValue([dto]);

      await scheduler.checkFlights();

      expect(gateway.broadcastToRoom).not.toHaveBeenCalledWith(
        expect.any(String),
        'arrived',
        expect.anything(),
      );
    });
  });
});
