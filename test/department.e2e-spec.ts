import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Mock JWT tokens (in a real test, generate or mock JWT verification)
// const adminToken = 'Bearer admin.jwt.token';
// const userToken = 'Bearer user.jwt.token';

import * as jwt from 'jsonwebtoken';

const adminPayload = {
  sub: 'test-user',
  tenantId: 'f7056477-f4f3-4dc9-987e-73d52e6d3541',
  role: 'admin',
};

const userPayload = {
  sub: 'test-user-id',
  tenantId: 'f7056477-f4f3-4dc9-987e-73d52e6d3541',
  role: 'user',
};

const secret = 'hrm123';

const adminToken = 'Bearer ' + jwt.sign(adminPayload, secret, { expiresIn: '1h' });
const userToken = 'Bearer ' + jwt.sign(userPayload, secret, { expiresIn: '1h' });

describe('DepartmentController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  describe('Department Creation', () => {
    it('should allow admin to create department', async () => {
      const uniqueName = `Test Depart ${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', adminToken)
        .send({ name: uniqueName, description: 'Testing' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(uniqueName);
    });

    it('should forbid non-admin from creating department', async () => {
      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', userToken)
        .send({ name: 'HR' });
      expect(res.status).toBe(403);
    });

    it('should return validation error for missing name', async () => {
      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', adminToken)
        .send({});
      expect(res.status).toBe(400);
    });

    it('should return error for duplicate department name', async () => {
      await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', adminToken)
        .send({ name: 'Finance' });
      const res = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', adminToken)
        .send({ name: 'Finance' });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('unique');
    });
  });
});
