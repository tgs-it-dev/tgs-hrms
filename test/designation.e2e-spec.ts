import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { makeBearerToken } from './utils/auth-helper';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

const adminToken = makeBearerToken('admin');   // Bearer <jwt…>
const userToken  = makeBearerToken('user');

describe('DesignationController (e2e)', () => {
  let app: INestApplication<App>;
  let departmentId: string;        // created once for all tests

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // ▶️  create a department under the test tenant
    const deptRes = await request(app.getHttpServer())
      .post('/departments')
      .set('Authorization', adminToken)
      .send({ name: `QA ${Date.now()}` });
    departmentId = deptRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /designations', () => {
    it('allows admin to create designation', async () => {
      const uniqueTitle = `Sr QA ${Date.now()}`;
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({ title: uniqueTitle, departmentId });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe(uniqueTitle);
    });

    it('forbids non‑admin from creating designation', async () => {
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', userToken)
        .send({ title: 'Junior QA', departmentId });
      expect(res.status).toBe(403);
    });

    it('returns 400 for missing title', async () => {
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({ departmentId });
      expect(res.status).toBe(400);
    });

    it('returns 400 if department does not belong to tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({
          title: 'Cross-Tenant',
          departmentId: '00000000-0000-0000-0000-000000000000', // fake UUID
        });
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate designation title within same dept', async () => {
      const dupTitle = `Dup QA ${Date.now()}`;
      // first insert
      await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({ title: dupTitle, departmentId });

      // duplicate insert
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({ title: dupTitle, departmentId });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /designations?department_id', () => {
    it('lists designations for department', async () => {
      const res = await request(app.getHttpServer())
        .get(`/designations?department_id=${departmentId}`)
        .set('Authorization', adminToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // should contain at least one record created earlier
      expect(res.body.some((d) => d.departmentId === departmentId)).toBe(true);
    });
  });


  describe('PUT /designations/:id and DELETE /designations/:id', () => {
    let designationId: string;

    beforeAll(async () => {
      // create a designation to update/delete
      const res = await request(app.getHttpServer())
        .post('/designations')
        .set('Authorization', adminToken)
        .send({ title: `Temp QA ${Date.now()}`, departmentId });
      designationId = res.body.id;
    });

    it('updates title (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/designations/${designationId}`)
        .set('Authorization', adminToken)
        .send({ title: 'Updated QA' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated QA');
    });

    it('deletes designation (admin only)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/designations/${designationId}`)
        .set('Authorization', adminToken);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });
});
