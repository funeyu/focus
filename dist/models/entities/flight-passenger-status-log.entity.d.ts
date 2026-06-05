import { UserFlyStatus } from '../enums';
export declare class FlightPassengerStatusLog {
    id: number;
    flightId: string;
    userId: string;
    status: UserFlyStatus;
    timestamp: number;
}
