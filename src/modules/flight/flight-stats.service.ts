import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlightPassengerStatusLog, FlightPassenger, FlightStats } from '../../models/entities';
import { UserFlyStatus, FlightStatus } from '../../models/enums';
import { IdUtil } from '../../common/id.util';

@Injectable()
export class FlightStatsService {
  constructor(
    @InjectRepository(FlightPassengerStatusLog)
    private readonly statusLogRepo: Repository<FlightPassengerStatusLog>,
    @InjectRepository(FlightPassenger)
    private readonly passengerRepo: Repository<FlightPassenger>,
    @InjectRepository(FlightStats)
    private readonly statsRepo: Repository<FlightStats>,
  ) {}

  calculateFocusSeconds(
    logs: { status: UserFlyStatus; timestamp: number }[],
    flightEndTime: number,
  ): number {
    if (logs.length === 0) return 0;

    let totalSeconds = 0;
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].status === UserFlyStatus.FOCUSING) {
        const endTime = i + 1 < logs.length ? logs[i + 1].timestamp : flightEndTime;
        totalSeconds += endTime - logs[i].timestamp;
      }
    }
    return totalSeconds;
  }

  calculateFriendOverlapSeconds(
    logsA: { status: UserFlyStatus; timestamp: number }[],
    logsB: { status: UserFlyStatus; timestamp: number }[],
    flightEndTime: number,
  ): number {
    const segmentsA = this.toFocusSegments(logsA, flightEndTime);
    const segmentsB = this.toFocusSegments(logsB, flightEndTime);
    let overlap = 0;
    let i = 0;
    let j = 0;
    while (i < segmentsA.length && j < segmentsB.length) {
      const start = Math.max(segmentsA[i][0], segmentsB[j][0]);
      const end = Math.min(segmentsA[i][1], segmentsB[j][1]);
      if (end > start) overlap += end - start;
      if (segmentsA[i][1] < segmentsB[j][1]) i++;
      else j++;
    }
    return overlap;
  }

  private toFocusSegments(
    logs: { status: UserFlyStatus; timestamp: number }[],
    flightEndTime: number,
  ): [number, number][] {
    const segments: [number, number][] = [];
    for (let i = 0; i < logs.length; i++) {
      if (logs[i].status === UserFlyStatus.FOCUSING) {
        const endTime = i + 1 < logs.length ? logs[i + 1].timestamp : flightEndTime;
        segments.push([logs[i].timestamp, endTime]);
      }
    }
    return segments;
  }

  async getUserStats(userId: string): Promise<FlightStats | null> {
    return this.statsRepo.findOne({ where: { userId } });
  }

  async settleSoloFlight(userId: string, focusMinutes: number): Promise<void> {
    let stats = await this.statsRepo.findOne({ where: { userId } });
    if (!stats) {
      stats = this.statsRepo.create({
        id: IdUtil.next('stats'),
        userId,
        totalMinutes: 0,
        totalArrivals: 0,
        totalCrashes: 0,
        streakDays: 0,
        lastFlightDay: 0,
        distribution: '[]',
        friendRanks: '[]',
      });
    }

    stats.totalMinutes += focusMinutes;
    stats.totalArrivals++;

    const today = Math.floor(Date.now() / 86400000);
    if (stats.lastFlightDay === today - 1) {
      stats.streakDays++;
    } else if (stats.lastFlightDay !== today) {
      stats.streakDays = 1;
    }
    stats.lastFlightDay = today;

    await this.statsRepo.save(stats);
  }

  async settleFlight(flightId: string, flightEndTime: number, flightStatus: FlightStatus): Promise<void> {
    const passengers = await this.passengerRepo.find({ where: { flightId } });

    for (const passenger of passengers) {
      const logs = await this.statusLogRepo.find({
        where: { flightId, userId: passenger.userId },
        order: { timestamp: 'ASC' },
      });

      const focusSeconds = this.calculateFocusSeconds(logs, flightEndTime);
      const focusMinutes = Math.floor(focusSeconds / 60);

      passenger.minutes = focusMinutes;
      await this.passengerRepo.save(passenger);

      await this.updateUserStats(passenger.userId, focusMinutes, flightStatus);
    }

    await this.updateFriendRanks(flightId, passengers, flightEndTime);
  }

  private async updateUserStats(userId: string, focusMinutes: number, flightStatus: FlightStatus): Promise<void> {
    let stats = await this.statsRepo.findOne({ where: { userId } });
    if (!stats) {
      stats = this.statsRepo.create({
        id: IdUtil.next('stats'),
        userId,
        totalMinutes: 0,
        totalArrivals: 0,
        totalCrashes: 0,
        streakDays: 0,
        lastFlightDay: 0,
        distribution: '[]',
        friendRanks: '[]',
      });
    }

    stats.totalMinutes += focusMinutes;
    if (flightStatus === FlightStatus.ARRIVED) stats.totalArrivals++;
    if (flightStatus === FlightStatus.CRASH) stats.totalCrashes++;

    const today = Math.floor(Date.now() / 86400000);
    if (stats.lastFlightDay === today - 1) {
      stats.streakDays++;
    } else if (stats.lastFlightDay !== today) {
      stats.streakDays = 1;
    }
    stats.lastFlightDay = today;

    await this.statsRepo.save(stats);
  }

  private async updateFriendRanks(
    flightId: string,
    passengers: FlightPassenger[],
    flightEndTime: number,
  ): Promise<void> {
    for (let i = 0; i < passengers.length; i++) {
      for (let j = i + 1; j < passengers.length; j++) {
        const logsA = await this.statusLogRepo.find({
          where: { flightId, userId: passengers[i].userId },
          order: { timestamp: 'ASC' },
        });
        const logsB = await this.statusLogRepo.find({
          where: { flightId, userId: passengers[j].userId },
          order: { timestamp: 'ASC' },
        });
        const overlapSeconds = this.calculateFriendOverlapSeconds(logsA, logsB, flightEndTime);
        const overlapMinutes = Math.floor(overlapSeconds / 60);
        if (overlapMinutes > 0) {
          await this.addFriendRank(passengers[i].userId, passengers[j].userId, overlapMinutes);
          await this.addFriendRank(passengers[j].userId, passengers[i].userId, overlapMinutes);
        }
      }
    }
  }

  private async addFriendRank(userId: string, friendId: string, minutes: number): Promise<void> {
    const stats = await this.statsRepo.findOne({ where: { userId } });
    if (!stats) return;
    const ranks: { userId: string; minutes: number }[] = stats.friendRanks ? JSON.parse(stats.friendRanks) : [];
    const existing = ranks.find(r => r.userId === friendId);
    if (existing) {
      existing.minutes += minutes;
    } else {
      ranks.push({ userId: friendId, minutes });
    }
    ranks.sort((a, b) => b.minutes - a.minutes);
    stats.friendRanks = JSON.stringify(ranks);
    await this.statsRepo.save(stats);
  }
}