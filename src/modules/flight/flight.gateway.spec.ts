import { FlightGateway } from './flight.gateway';
import { FlyMode, FlightStatus, UserFlyStatus, SeatFocusStatus } from '../../models/enums';
import { FlightDto } from '../../models/dtos';

function mockWs(overrides: Record<string, any> = {}): any {
  return {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    ...overrides,
  };
}

function makeDto(overrides: Partial<FlightDto> = {}): FlightDto {
  return {
    id: '1',
    captainId: 'u1',
    mode: 1,
    flyMode: FlyMode.SAFE,
    status: FlightStatus.FLYING,
    from: 1,
    to: 2,
    takeoffAt: 100,
    arrivalAt: 1600,
    createdAt: 100,
    minutes: 25,
    crashByUserId: null,
    captain: null,
    scheduledUsers: [],
    seats: [],
    ...overrides,
  } as FlightDto;
}

function makeGateway() {
  const redis: any = {};

  const flightService: any = {
    leaveSeat: jest.fn().mockResolvedValue({ flyMode: FlyMode.SAFE }),
    backSeat: jest.fn().mockResolvedValue(undefined),
    giveUp: jest.fn().mockResolvedValue({ flyMode: FlyMode.SAFE }),
    updateFlightStatus: jest.fn().mockResolvedValue(undefined),
    findFlightById: jest.fn().mockResolvedValue({ arrivalAt: 100 }),
    getFlightPassengers: jest.fn().mockResolvedValue([]),
    getCachedFlightDto: jest.fn().mockResolvedValue(null),
    setCachedFlightDto: jest.fn().mockResolvedValue(undefined),
    ensureCached: jest.fn().mockResolvedValue(null),
    updateSeatInCache: jest.fn().mockResolvedValue(undefined),
    setActiveSeatInCache: jest.fn().mockResolvedValue(undefined),
    getActiveSeatCount: jest.fn().mockResolvedValue(0),
    cleanupFlightCache: jest.fn().mockResolvedValue(undefined),
  };

  const statsService: any = {
    settleFlight: jest.fn().mockResolvedValue(undefined),
  };

  const friendshipService: any = {
    getRawFriendships: jest.fn().mockResolvedValue([]),
  };

  const userService: any = {
    findByIds: jest.fn().mockResolvedValue([]),
  };

  const gateway = new FlightGateway(redis, flightService, statsService, friendshipService, userService);

  const clients = new Set<any>();
  (gateway as any).server = { clients };

  return { gateway, redis, flightService, statsService, friendshipService, userService, clients };
}

describe('FlightGateway', () => {
  describe('shouldCrash', () => {
    let gateway: FlightGateway;

    beforeEach(() => {
      gateway = new FlightGateway(null as any, null as any, null as any, null as any, null as any);
    });

    it('should crash on leave in crash mode when random < 0.1', () => {
      expect(gateway.shouldCrash(FlyMode.CRASH, 'leave', 0.05)).toBe(true);
    });

    it('should not crash on leave in crash mode when random >= 0.1', () => {
      expect(gateway.shouldCrash(FlyMode.CRASH, 'leave', 0.15)).toBe(false);
    });

    it('should crash on giveup in crash mode when random < 0.5', () => {
      expect(gateway.shouldCrash(FlyMode.CRASH, 'giveup', 0.3)).toBe(true);
    });

    it('should not crash on giveup in crash mode when random >= 0.5', () => {
      expect(gateway.shouldCrash(FlyMode.CRASH, 'giveup', 0.6)).toBe(false);
    });

    it('should never crash in safe mode', () => {
      expect(gateway.shouldCrash(FlyMode.SAFE, 'leave', 0.01)).toBe(false);
      expect(gateway.shouldCrash(FlyMode.SAFE, 'giveup', 0.01)).toBe(false);
    });
  });

  describe('broadcastToRoom (indexed)', () => {
    it('should only send to clients in the room', () => {
      const { gateway } = makeGateway();
      const ws1 = mockWs();
      const ws2 = mockWs();
      const ws3 = mockWs();

      gateway.onEnterCabin(ws1, { flightId: '1', userId: 'u1' });
      gateway.onEnterCabin(ws2, { flightId: '2', userId: 'u2' });
      gateway.onEnterCabin(ws3, { flightId: '1', userId: 'u3' });

      gateway.broadcastToRoom('flight:1', 'test', { ok: true });

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(0);
      expect(ws3.send).toHaveBeenCalledTimes(1);
    });

    it('should not iterate all server.clients', () => {
      const { gateway } = makeGateway();
      const forEachSpy = jest.fn();
      (gateway as any).server = { clients: { forEach: forEachSpy } };

      const ws = mockWs();
      gateway.onEnterCabin(ws, { flightId: '1', userId: 'u1' });

      gateway.broadcastToRoom('flight:1', 'test', {});

      expect(forEachSpy).not.toHaveBeenCalled();
    });
  });

  describe('broadcastFriendStatus (indexed)', () => {
    it('should send only to friends who are connected', async () => {
      const { gateway, friendshipService } = makeGateway();
      friendshipService.getRawFriendships.mockResolvedValue([
        { userIdA: 'u1', userIdB: 'u2' },
      ]);

      const ws1 = mockWs();
      const ws2 = mockWs();
      const ws3 = mockWs();

      gateway.onEnterCabin(ws1, { flightId: '1', userId: 'u1' });
      gateway.onEnterCabin(ws2, { flightId: '2', userId: 'u2' });
      gateway.onEnterCabin(ws3, { flightId: '3', userId: 'u3' });

      // Flush pending broadcasts from onEnterCabin
      await new Promise(r => setTimeout(r, 0));

      (ws1.send as jest.Mock).mockClear();
      (ws2.send as jest.Mock).mockClear();
      (ws3.send as jest.Mock).mockClear();

      await (gateway as any).broadcastFriendStatus('u1', 'offline');

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledTimes(1);
      expect(ws3.send).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect (multi-device)', () => {
    it('should not delete user tracking when another device is still connected', () => {
      const { gateway } = makeGateway();
      const ws1 = mockWs();
      const ws2 = mockWs();

      gateway.onEnterCabin(ws1, { flightId: '1', userId: 'u1' });
      gateway.onEnterCabin(ws2, { flightId: '2', userId: 'u1' });

      gateway.handleDisconnect(ws1);

      const userClients: Map<string, Set<any>> = (gateway as any).userClients;
      expect(userClients.has('u1')).toBe(true);
    });

    it('should delete user tracking when last device disconnects', () => {
      const { gateway } = makeGateway();
      const ws1 = mockWs();

      gateway.onEnterCabin(ws1, { flightId: '1', userId: 'u1' });
      gateway.handleDisconnect(ws1);

      const userClients: Map<string, Set<any>> = (gateway as any).userClients;
      expect(userClients.has('u1')).toBe(false);
    });
  });

  describe('handleCrash parallelization', () => {
    it('should call settleFlight and getFlightPassengers', async () => {
      const { gateway, flightService, statsService } = makeGateway();
      flightService.getCachedFlightDto.mockResolvedValue(makeDto());
      flightService.updateFlightStatus.mockImplementation(() => new Promise(r => setTimeout(r, 10)));
      statsService.settleFlight.mockImplementation(() => new Promise(r => setTimeout(r, 10)));
      flightService.getFlightPassengers.mockResolvedValue([]);

      await (gateway as any).handleCrash('f1', 'u1');

      expect(flightService.updateFlightStatus).toHaveBeenCalledWith('f1', FlightStatus.CRASH, 'u1');
      expect(statsService.settleFlight).toHaveBeenCalled();
      expect(flightService.getFlightPassengers).toHaveBeenCalledWith('f1');
    });
  });

  describe('leaveSeat flyMode from service', () => {
    it('should not call redis directly when flyMode comes from service', async () => {
      const { gateway, flightService } = makeGateway();
      flightService.leaveSeat.mockResolvedValue({ flyMode: FlyMode.CRASH });
      flightService.getCachedFlightDto.mockResolvedValue(makeDto({ flyMode: FlyMode.CRASH, status: FlightStatus.FLYING }));

      const ws = mockWs();
      gateway.onEnterCabin(ws, { flightId: '1', userId: 'u1' });

      gateway.shouldCrash = () => false;

      await gateway.onLeaveSeat(ws, { flightId: '1', userId: 'u1' });

      expect(flightService.getCachedFlightDto).toHaveBeenCalledWith('1');
    });
  });

  describe('broadcastSeatUpdate reads from FlightDto cache', () => {
    it('should send seats from cached FlightDto', async () => {
      const { gateway, flightService } = makeGateway();
      const dto = makeDto({
        seats: [
          { num: 'A1', userInfo: { id: 'u1', name: 'n', avatar: 'a', vip: false }, userStatus: UserFlyStatus.FOCUSING, focusStatus: SeatFocusStatus.FOCUSED, isActive: true },
        ],
      });
      flightService.getCachedFlightDto.mockResolvedValue(dto);

      const ws = mockWs();
      gateway.onEnterCabin(ws, { flightId: '1', userId: 'u1' });

      await gateway.broadcastSeatUpdate('1');

      expect(flightService.getCachedFlightDto).toHaveBeenCalledWith('1');
      expect(ws.send).toHaveBeenCalled();
      const sent = JSON.parse((ws.send as jest.Mock).mock.calls[0][0]);
      expect(sent.event).toBe('all.seats');
      expect(sent.data).toHaveLength(1);
      expect(sent.data[0].num).toBe('A1');
    });
  });
});
