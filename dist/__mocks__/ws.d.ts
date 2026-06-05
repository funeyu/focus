export declare class WebSocket {
    readyState: number;
    send: jest.Mock<any, any, any>;
    close: jest.Mock<any, any, any>;
}
export declare class Server {
    clients: Set<any>;
}
