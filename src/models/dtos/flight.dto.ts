import { FlightMode, FlightStatus, FlyMode, SeatFocusStatus } from '../enums';

export class FlightSeatPairDto {
  num: string;
  userId: string;
  userStatus: number;
}

export class FlightSeatDto {
  num: string;
  userInfo: { id: string; name: string; avatar: string; vip: boolean } | null;
  userStatus: number;
  focusStatus: number;
  isActive: boolean;
}

export class FlightDto {
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
  captain: { id: string; name: string; avatar: string; vip: boolean } | null;
  scheduledUsers: { id: string; name: string; avatar: string; vip: boolean }[];
  seats: FlightSeatDto[];
  focusStatus?: SeatFocusStatus;
}
