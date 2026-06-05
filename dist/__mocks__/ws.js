"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = exports.WebSocket = void 0;
class WebSocket {
    constructor() {
        this.readyState = 1;
        this.send = jest.fn();
        this.close = jest.fn();
    }
}
exports.WebSocket = WebSocket;
class Server {
    constructor() {
        this.clients = new Set();
    }
}
exports.Server = Server;
//# sourceMappingURL=ws.js.map