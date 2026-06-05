"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiUtil = void 0;
class ApiUtil {
    static ok(data) {
        return { code: 0, data: data ?? null };
    }
    static fail(code, message) {
        return { code, data: null, message };
    }
}
exports.ApiUtil = ApiUtil;
//# sourceMappingURL=api.util.js.map