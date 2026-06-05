import { TokenMiddleware } from './token.middleware';
import { TokenUtil } from './token.util';

describe('TokenMiddleware', () => {
  let middleware: TokenMiddleware;

  beforeEach(() => {
    middleware = new TokenMiddleware();
  });

  it('should call next() for valid token in header', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = TokenUtil.generate(now);
    const req = { headers: { 'x-token': token } } as any;
    const res = {} as any;
    const next = jest.fn();

    jest.spyOn(Date, 'now').mockReturnValue(now * 1000);
    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 for missing token', () => {
    const req = { headers: {} } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', () => {
    const req = { headers: { 'x-token': 'invalidtoken123' } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});