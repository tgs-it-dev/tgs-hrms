import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthHelper } from './utils/auth-helper';

describe('HolidayController (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let adminToken: string;
  let userToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    authHelper = new AuthHelper(app);
    
    // Create test tenant and users
    const { adminToken: admin, userToken: user, tenantId: tenant } = await authHelper.setupTestData();
    adminToken = admin;
    userToken = user;
    tenantId = tenant;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /holidays', () => {
    it('should create a holiday successfully (admin only)', () => {
      const holidayData = {
        name: 'New Year Day',
        date: '2025-01-01',
        description: 'Public holiday celebrating the new year',
        is_active: true,
      };

      return request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(holidayData)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Holiday created successfully');
          expect(res.body.data.name).toBe(holidayData.name);
          expect(res.body.data.date).toBe(holidayData.date);
          expect(res.body.data.description).toBe(holidayData.description);
          expect(res.body.data.is_active).toBe(holidayData.is_active);
          expect(res.body.data.tenant_id).toBe(tenantId);
        });
    });

    it('should reject non-admin users', () => {
      const holidayData = {
        name: 'Test Holiday',
        date: '2025-01-02',
        description: 'Test holiday',
      };

      return request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${userToken}`)
        .send(holidayData)
        .expect(403);
    });

    it('should validate required fields', () => {
      const invalidData = {
        description: 'Missing name and date',
      };

      return request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('name');
          expect(res.body.message).toContain('date');
        });
    });

    it('should reject past dates', () => {
      const pastDateData = {
        name: 'Past Holiday',
        date: '2020-01-01',
        description: 'Holiday in the past',
      };

      return request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(pastDateData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('Cannot create holidays for past dates');
        });
    });

    it('should reject duplicate holidays on the same date', async () => {
      const holidayData = {
        name: 'Duplicate Holiday',
        date: '2025-01-03',
        description: 'First holiday',
      };

      // Create first holiday
      await request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(holidayData)
        .expect(201);

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(holidayData)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });
  });

  describe('GET /holidays', () => {
    beforeEach(async () => {
      // Create some test holidays
      const holidays = [
        { name: 'Holiday 1', date: '2025-02-01', description: 'February holiday' },
        { name: 'Holiday 2', date: '2025-03-01', description: 'March holiday' },
        { name: 'Holiday 3', date: '2025-04-01', description: 'April holiday' },
      ];

      for (const holiday of holidays) {
        await request(app.getHttpServer())
          .post('/holidays')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(holiday)
          .expect(201);
      }
    });

    it('should fetch all holidays for tenant', () => {
      return request(app.getHttpServer())
        .get('/holidays')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Holidays retrieved successfully');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThan(0);
        });
    });

    it('should filter holidays by year', () => {
      return request(app.getHttpServer())
        .get('/holidays?year=2025')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          // All holidays should be from 2025
          res.body.data.forEach((holiday: any) => {
            expect(new Date(holiday.date).getFullYear()).toBe(2025);
          });
        });
    });

    it('should filter holidays by month', () => {
      return request(app.getHttpServer())
        .get('/holidays?month=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(Array.isArray(res.body.data)).toBe(true);
          // All holidays should be from February (month 2)
          res.body.data.forEach((holiday: any) => {
            expect(new Date(holiday.date).getMonth() + 1).toBe(2);
          });
        });
    });

    it('should reject invalid month parameter', () => {
      return request(app.getHttpServer())
        .get('/holidays?month=13')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toBe('Month must be between 1 and 12');
        });
    });
  });

  describe('GET /holidays/upcoming', () => {
    it('should fetch upcoming holidays', () => {
      return request(app.getHttpServer())
        .get('/holidays/upcoming')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Upcoming holidays retrieved successfully');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should respect limit parameter', () => {
      return request(app.getHttpServer())
        .get('/holidays/upcoming?limit=2')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.length).toBeLessThanOrEqual(2);
        });
    });
  });

  describe('GET /holidays/check', () => {
    it('should check if a date is a holiday', () => {
      return request(app.getHttpServer())
        .get('/holidays/check?date=2025-01-01')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Holiday check completed');
          expect(typeof res.body.data.isHoliday).toBe('boolean');
        });
    });

    it('should return holiday details if date is a holiday', async () => {
      // First create a holiday
      const holidayData = {
        name: 'Test Check Holiday',
        date: '2025-05-01',
        description: 'Holiday for testing check endpoint',
      };

      await request(app.getHttpServer())
        .post('/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(holidayData)
        .expect(201);

      // Then check if it's a holiday
      return request(app.getHttpServer())
        .get('/holidays/check?date=2025-05-01')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.isHoliday).toBe(true);
          expect(res.body.data.holiday.name).toBe(holidayData.name);
        });
    });
  });

  describe('GET /holidays/stats', () => {
    it('should get holiday statistics for a year', () => {
      return request(app.getHttpServer())
        .get('/holidays/stats?year=2025')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.message).toBe('Holiday statistics retrieved successfully');
          expect(typeof res.body.data.totalHolidays).toBe('number');
          expect(typeof res.body.data.activeHolidays).toBe('number');
          expect(typeof res.body.data.inactiveHolidays).toBe('number');
        });
    });
  });
});
