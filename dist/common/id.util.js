"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdUtil = void 0;
let counter = 0;
class IdUtil {
    static next(type) {
        const prefix = this.prefixMap[type] || type;
        const time = Date.now().toString(36);
        const seq = (counter++).toString(36);
        const rand = Math.random().toString(36).substring(2, 6);
        return `${prefix}_${time}${seq}${rand}`;
    }
}
exports.IdUtil = IdUtil;
IdUtil.prefixMap = {
    user: 'usr',
    flight: 'flt',
    passenger: 'psg',
    stats: 'sts',
    friendship: 'frd',
};
//# sourceMappingURL=id.util.js.map