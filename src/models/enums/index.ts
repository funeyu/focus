export enum UserFlyStatus {
  FOCUSING = 0,
  LEAVE = 1,
  BACK = 2,
  GIVEUP = 3,
}

export enum SeatFocusStatus {
  FOCUSED = 0,
  DISTRACTED = 1,
  NOT_STARTED = 2,
  GIVEUP = 3,
}

export enum FlightMode {
  SINGLE = 0,
  MULTIPLE = 1,
}

export enum FlightStatus {
  PENDING = 0,
  FLYING = 1,
  ARRIVED = 2,
  CRASH = 3,
}

export enum FlyMode {
  SAFE = 0,
  CRASH = 1,
}

export enum Role {
  CAPTAIN = 0,
  PASSENGER = 1,
}