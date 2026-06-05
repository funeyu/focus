import { Repository } from 'typeorm';
import { FlightPassengerStatusLog, FlightPassenger, FlightStats } from '../../models/entities';
import { UserFlyStatus, FlightStatus } from '../../models/enums';
export declare class FlightStatsService {
    private readonly statusLogRepo;
    private readonly passengerRepo;
    private readonly statsRepo;
    constructor(statusLogRepo: Repository<FlightPassengerStatusLog>, passengerRepo: Repository<FlightPassenger>, statsRepo: Repository<FlightStats>);
    calculateFocusSeconds(logs: {
        status: UserFlyStatus;
        timestamp: number;
    }[], flightEndTime: number): number;
    calculateFriendOverlapSeconds(logsA: {
        status: UserFlyStatus;
        timestamp: number;
    }[], logsB: {
        status: UserFlyStatus;
        timestamp: number;
    }[], flightEndTime: number): number;
    private toFocusSegments;
    getUserStats(userId: string): Promise<FlightStats | null>;
    settleSoloFlight(userId: string, focusMinutes: number): Promise<void>;
    settleFlight(flightId: string, flightEndTime: number, flightStatus: FlightStatus): Promise<void>;
    private updateUserStats;
    private updateFriendRanks;
    private addFriendRank;
}
