import * as crypto from 'crypto';

export class TokenUtil {
  static generate(timestamp: number): string {
    const left = crypto.randomUUID().replace(/-/g, '').substring(0, 5);
    const right = crypto
      .createHash('sha256')
      .update(left + 'snake')
      .digest('hex')
      .substring(0, 5);
    const timeInfoString = (timestamp % 100000).toString().padStart(5, '0');
    return left + right + timeInfoString;
  }

  static validate(token: string, currentTimestamp: number): boolean {
    if (!token || token.length !== 15) return false;
    const left = token.substring(0, 5);
    const right = token.substring(5, 10);
    const timeInfoString = token.substring(10, 15);

    const expectedRight = crypto
      .createHash('sha256')
      .update(left + 'snake')
      .digest('hex')
      .substring(0, 5);
    if (right !== expectedRight) return false;

    const tokenTime = parseInt(timeInfoString, 10);
    const currentTime = currentTimestamp % 100000;
    let diff = Math.abs(currentTime - tokenTime);
    if (diff > 50000) diff = 100000 - diff;
    return diff <= 300;
  }
}