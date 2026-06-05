import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenUtil } from '../src/common/token.util';

describe('Focus Fly Server (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const now = Math.floor(Date.now() / 1000);
    token = TokenUtil.generate(now);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Token middleware', () => {
    it('should reject request without token', () => {
      return request(app.getHttpServer())
        .get('/flight/my/testuser')
        .expect(401);
    });

    it('should accept request with valid token', () => {
      return request(app.getHttpServer())
        .get('/flight/my/testuser')
        .set('x-token', token)
        .expect(200);
    });
  });

  describe('User', () => {
    it('should create a user', () => {
      return request(app.getHttpServer())
        .post('/user/create')
        .set('x-token', token)
        .send({ name: 'testuser', region: 'cn' })
        .expect(201);
    });
  });
});