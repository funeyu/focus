import { FlightMode, FlightStatus, FlyMode } from '../enums';
export declare class Flight {
    id: string;
    captainId: string;
    mode: FlightMode;
    flyMode: FlyMode;
    status: FlightStatus;
    from: number;
    to: number;
    takeoffAt: number;
    arrivalAt: number;
    createdAt: number;
    scheduledIds: string;
    minutes: number;
    crashByUserId: string;
    seats: {
        num: string;
        userId: string;
        userStatus: number;
    }[] | null;
}
