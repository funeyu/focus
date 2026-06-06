import { FlightMode, FlightStatus, FlyMode, SeatFocusStatus } from '../enums';
export declare class FlightSeatPairDto {
    num: string;
    userId: string;
    focusScene: number;
}
export declare class FlightSeatDto {
    num: string;
    userInfo: {
        id: string;
        name: string;
        avatar: string;
        vip: boolean;
    } | null;
    focusScene: number;
    focusStatus: number;
    isActive: boolean;
}
export declare class FlightDto {
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
    minutes: number;
    crashByUserId: string | null;
    captain: {
        id: string;
        name: string;
        avatar: string;
        vip: boolean;
    } | null;
    scheduledUsers: {
        id: string;
        name: string;
        avatar: string;
        vip: boolean;
    }[];
    seats: FlightSeatDto[];
    focusStatus?: SeatFocusStatus;
}
