import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { makeBearerToken } from './utils/auth-helper';

describe('Employee Filtering (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create admin token for testing
    adminToken = makeBearerToken('admin');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /employees', () => {
    it('should return all employees when no filters are provided', () => {
      return request(app.getHttpServer())
        .get('/employees')
        .set('Authorization', adminToken)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter employees by department_id', () => {
      const departmentId = '3a275957-c811-4ebb-b9f1-481bd96e47d1';
      
      return request(app.getHttpServer())
        .get(`/employees?department_id=${departmentId}`)
        .set('Authorization', adminToken)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned employees should belong to the specified department
          res.body.forEach((employee: any) => {
            expect(employee.departmentId).toBe(departmentId);
          });
        });
    });

    it('should filter employees by designation_id', () => {
      const designationId = '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c';
      
      return request(app.getHttpServer())
        .get(`/employees?designation_id=${designationId}`)
        .set('Authorization', adminToken)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned employees should have the specified designation
          res.body.forEach((employee: any) => {
            expect(employee.designationId).toBe(designationId);
          });
        });
    });

    it('should filter employees by both department_id and designation_id', () => {
      const departmentId = '3a275957-c811-4ebb-b9f1-481bd96e47d1';
      const designationId = '6b99992a-d8ef-4c0c-91dc-2a23e391ac9c';
      
      return request(app.getHttpServer())
        .get(`/employees?department_id=${departmentId}&designation_id=${designationId}`)
        .set('Authorization', adminToken)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned employees should match both criteria
          res.body.forEach((employee: any) => {
            expect(employee.departmentId).toBe(departmentId);
            expect(employee.designationId).toBe(designationId);
          });
        });
    });

    it('should return 400 for invalid department_id', () => {
      return request(app.getHttpServer())
        .get('/employees?department_id=invalid-uuid')
        .set('Authorization', adminToken)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid department for this tenant.');
        });
    });

    it('should return 400 for invalid designation_id', () => {
      return request(app.getHttpServer())
        .get('/employees?designation_id=invalid-uuid')
        .set('Authorization', adminToken)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid designation ID');
        });
    });

    it('should return 400 for non-existent department_id', () => {
      const nonExistentDeptId = '00000000-0000-0000-0000-000000000000';
      
      return request(app.getHttpServer())
        .get(`/employees?department_id=${nonExistentDeptId}`)
        .set('Authorization', adminToken)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid department for this tenant.');
        });
    });

    it('should return 400 for non-existent designation_id', () => {
      const nonExistentDesigId = '00000000-0000-0000-0000-000000000000';
      
      return request(app.getHttpServer())
        .get(`/employees?designation_id=${nonExistentDesigId}`)
        .set('Authorization', adminToken)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Invalid designation ID');
        });
    });
  });
}); 