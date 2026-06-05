import { Role, UserFlyStatus } from '../enums';
export declare class FlightPassenger {
    id: string;
    flightId: string;
    userId: string;
    seatNum: string;
    role: Role;
    status: UserFlyStatus;
    joinAt: number;
    quitAt: number;
    minutes: number;
}
