import { FlightStatsService } from './flight-stats.service';
import { UserFlyStatus } from '../../models/enums';

describe('FlightStatsService', () => {
  let service: FlightStatsService;

  beforeEach(() => {
    service = new FlightStatsService(null as any, null as any, null as any);
  });

  describe('calculateFocusSeconds', () => {
    it('should calculate focus time for continuous focusing', () => {
      const logs = [
        { status: UserFlyStatus.FOCUSING, timestamp: 100 },
        { status: UserFlyStatus.GIVEUP, timestamp: 400 },
      ];
      expect(service.calculateFocusSeconds(logs, 400)).toBe(300);
    });

    it('should exclude LEAVE periods from focus time', () => {
      const logs = [
        { status: UserFlyStatus.FOCUSING, timestamp: 100 },
        { status: UserFlyStatus.LEAVE, timestamp: 200 },
        { status: UserFlyStatus.BACK, timestamp: 300 },
        { status: UserFlyStatus.FOCUSING, timestamp: 300 },
        { status: UserFlyStatus.GIVEUP, timestamp: 500 },
      ];
      expect(service.calculateFocusSeconds(logs, 500)).toBe(300);
    });

    it('should use flight end time when last status is FOCUSING', () => {
      const logs = [
        { status: UserFlyStatus.FOCUSING, timestamp: 100 },
      ];
      expect(service.calculateFocusSeconds(logs, 600)).toBe(500);
    });

    it('should return 0 for no logs', () => {
      expect(service.calculateFocusSeconds([], 600)).toBe(0);
    });
  });

  describe('calculateFriendOverlapSeconds', () => {
    it('should calculate overlapping focus time between two passengers', () => {
      const logsA = [
        { status: UserFlyStatus.FOCUSING, timestamp: 100 },
        { status: UserFlyStatus.LEAVE, timestamp: 300 },
        { status: UserFlyStatus.BACK, timestamp: 400 },
        { status: UserFlyStatus.FOCUSING, timestamp: 400 },
        { status: UserFlyStatus.GIVEUP, timestamp: 600 },
      ];
      const logsB = [
        { status: UserFlyStatus.FOCUSING, timestamp: 200 },
        { status: UserFlyStatus.LEAVE, timestamp: 350 },
        { status: UserFlyStatus.BACK, timestamp: 360 },
        { status: UserFlyStatus.FOCUSING, timestamp: 360 },
        { status: UserFlyStatus.GIVEUP, timestamp: 700 },
      ];
      expect(service.calculateFriendOverlapSeconds(logsA, logsB, 700)).toBe(300);
    });

    it('should return 0 when no overlap', () => {
      const logsA = [
        { status: UserFlyStatus.FOCUSING, timestamp: 100 },
        { status: UserFlyStatus.GIVEUP, timestamp: 200 },
      ];
      const logsB = [
        { status: UserFlyStatus.FOCUSING, timestamp: 300 },
        { status: UserFlyStatus.GIVEUP, timestamp: 400 },
      ];
      expect(service.calculateFriendOverlapSeconds(logsA, logsB, 400)).toBe(0);
    });
  });
});