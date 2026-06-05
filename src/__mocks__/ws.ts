export class WebSocket {
  readyState = 1;
  send = jest.fn();
  close = jest.fn();
}

export class Server {
  clients = new Set<any>();
}
