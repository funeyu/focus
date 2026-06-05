import { FlightGateway } from './flight.gateway';
import { FlyMode, FlightStatus, UserFlyStatus, SeatFocusStatus } from '../../models/enums';

function mockWs(overrides: Record<string, any> = {}): any {
  return {
    readyState: 1,
    send: jest.fn(),
    close: jest.fn(),
    ...overrides,
  };
}

function makeGateway() {
  const redis: any = {
    hset: jest.fn().mockResolvedValue(undefined),
    hget: jest.fn().mockResolvedValue('0'),
    hgetall: jest.fn().mockResolvedValue({ flyMode: String(FlyMode.SAFE) }),
    hvals: jest.fn().mockResolvedValue([]),
  };
  const flightService: any = {
    leaveSeat: jest.fn().mockResolvedValue(undefined),
    backSeat: jest.fn().mockResolvedValue(undefined),
    giveUp: jest.fn().mockResolvedValue(undefined),
    updateFlightStatus: jest.fn().mockResolvedValue(undefined),
    findFlightById: jest.fn().mockResolvedValue({ arrivalAt: 100 }),
    getFlightPassengers: jest.fn().mockResolvedValue([]),
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

      gateway.onJoinFlight(ws1, { flightId: '1', userId: 'u1' });
      gateway.onJoinFlight(ws2, { flightId: '2', userId: 'u2' });
      gateway.onJoinFlight(ws3, { flightId: '1', userId: 'u3' });

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
      gateway.onJoinFlight(ws, { flightId: '1', userId: 'u1' });

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

      gateway.onJoinFlight(ws1, { flightId: '1', userId: 'u1' });
      gateway.onJoinFlight(ws2, { flightId: '2', userId: 'u2' });
      gateway.onJoinFlight(ws3, { flightId: '3', userId: 'u3' });

      // Flush pending broadcasts from onJoinFlight
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

      gateway.onJoinFlight(ws1, { flightId: '1', userId: 'u1' });
      gateway.onJoinFlight(ws2, { flightId: '2', userId: 'u1' });

      gateway.handleDisconnect(ws1);

      const userClients: Map<string, Set<any>> = (gateway as any).userClients;
      expect(userClients.has('u1')).toBe(true);
    });

    it('should delete user tracking when last device disconnects', () => {
      const { gateway } = makeGateway();
      const ws1 = mockWs();

      gateway.onJoinFlight(ws1, { flightId: '1', userId: 'u1' });
      gateway.handleDisconnect(ws1);

      const userClients: Map<string, Set<any>> = (gateway as any).userClients;
      expect(userClients.has('u1')).toBe(false);
    });
  });

  describe('handleCrash parallelization', () => {
    it('should call settleFlight and getFlightPassengers', async () => {
      const { gateway, flightService, statsService } = makeGateway();
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
    it('should not call redis.hgetall when flyMode comes from service', async () => {
      const { gateway, flightService, redis } = makeGateway();
      flightService.leaveSeat.mockResolvedValue({ flyMode: FlyMode.CRASH });

      const ws = mockWs();
      gateway.onJoinFlight(ws, { flightId: '1', userId: 'u1' });

      gateway.shouldCrash = () => false;

      await gateway.onLeaveSeat(ws, { flightId: '1', userId: 'u1' });

      expect(redis.hgetall).not.toHaveBeenCalled();
    });
  });

  describe('broadcastSeatUpdate is awaitable', () => {
    it('should be awaitable and preserve order', async () => {
      const { gateway, redis, userService } = makeGateway();
      const seatData = JSON.stringify({ userId: 'u1', seatNum: 'A1', status: UserFlyStatus.FOCUSING, focusStatus: SeatFocusStatus.FOCUSED, role: 0, isActive: true });
      redis.hvals.mockResolvedValue([seatData]);
      userService.findByIds.mockResolvedValue([{ id: 'u1', avatar: 'a', name: 'n', vip: false }]);

      const ws = mockWs();
      gateway.onJoinFlight(ws, { flightId: '1', userId: 'u1' });

      await gateway.broadcastSeatUpdate('1');

      expect(ws.send).toHaveBeenCalled();
      const sent = JSON.parse((ws.send as jest.Mock).mock.calls[0][0]);
      expect(sent.event).toBe('all.seats');
    });
  });
});
