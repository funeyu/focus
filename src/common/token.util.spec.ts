import { TokenUtil } from './token.util';

describe('TokenUtil', () => {
  describe('validate', () => {
    it('should accept a valid token', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = TokenUtil.generate(now);
      expect(TokenUtil.validate(token, now)).toBe(true);
    });

    it('should reject token with wrong signature', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = TokenUtil.generate(now);
      const tampered = token.substring(0, 5) + 'XXXXX' + token.substring(10);
      expect(TokenUtil.validate(tampered, now)).toBe(false);
    });

    it('should reject expired token (>300s)', () => {
      const past = Math.floor(Date.now() / 1000) - 600;
      const token = TokenUtil.generate(past);
      const now = Math.floor(Date.now() / 1000);
      expect(TokenUtil.validate(token, now)).toBe(false);
    });

    it('should reject token with wrong length', () => {
      expect(TokenUtil.validate('short', Math.floor(Date.now() / 1000))).toBe(false);
    });

    it('should accept token within 300s window', () => {
      const now = Math.floor(Date.now() / 1000);
      const token = TokenUtil.generate(now - 100);
      expect(TokenUtil.validate(token, now)).toBe(true);
    });
  });
});