"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = exports.FlyMode = exports.FlightStatus = exports.FlightMode = exports.SeatFocusStatus = exports.UserFlyStatus = void 0;
var UserFlyStatus;
(function (UserFlyStatus) {
    UserFlyStatus[UserFlyStatus["FOCUSING"] = 0] = "FOCUSING";
    UserFlyStatus[UserFlyStatus["LEAVE"] = 1] = "LEAVE";
    UserFlyStatus[UserFlyStatus["BACK"] = 2] = "BACK";
    UserFlyStatus[UserFlyStatus["GIVEUP"] = 3] = "GIVEUP";
})(UserFlyStatus || (exports.UserFlyStatus = UserFlyStatus = {}));
var SeatFocusStatus;
(function (SeatFocusStatus) {
    SeatFocusStatus[SeatFocusStatus["FOCUSED"] = 0] = "FOCUSED";
    SeatFocusStatus[SeatFocusStatus["DISTRACTED"] = 1] = "DISTRACTED";
    SeatFocusStatus[SeatFocusStatus["NOT_STARTED"] = 2] = "NOT_STARTED";
    SeatFocusStatus[SeatFocusStatus["GIVEUP"] = 3] = "GIVEUP";
})(SeatFocusStatus || (exports.SeatFocusStatus = SeatFocusStatus = {}));
var FlightMode;
(function (FlightMode) {
    FlightMode[FlightMode["SINGLE"] = 0] = "SINGLE";
    FlightMode[FlightMode["MULTIPLE"] = 1] = "MULTIPLE";
})(FlightMode || (exports.FlightMode = FlightMode = {}));
var FlightStatus;
(function (FlightStatus) {
    FlightStatus[FlightStatus["PENDING"] = 0] = "PENDING";
    FlightStatus[FlightStatus["FLYING"] = 1] = "FLYING";
    FlightStatus[FlightStatus["ARRIVED"] = 2] = "ARRIVED";
    FlightStatus[FlightStatus["CRASH"] = 3] = "CRASH";
})(FlightStatus || (exports.FlightStatus = FlightStatus = {}));
var FlyMode;
(function (FlyMode) {
    FlyMode[FlyMode["SAFE"] = 0] = "SAFE";
    FlyMode[FlyMode["CRASH"] = 1] = "CRASH";
})(FlyMode || (exports.FlyMode = FlyMode = {}));
var Role;
(function (Role) {
    Role[Role["CAPTAIN"] = 0] = "CAPTAIN";
    Role[Role["PASSENGER"] = 1] = "PASSENGER";
})(Role || (exports.Role = Role = {}));
//# sourceMappingURL=index.js.map