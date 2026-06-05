import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TokenUtil } from './token.util';

@Injectable()
export class TokenMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    next();
    return;
    const token = req.headers['x-token'] as string;
    if (!token) {
      return res.status(401).json({ code: 401, message: 'missing token' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (!TokenUtil.validate(token, now)) {
      return res.status(401).json({ code: 401, message: 'invalid token' });
    }

    next();
  }
}