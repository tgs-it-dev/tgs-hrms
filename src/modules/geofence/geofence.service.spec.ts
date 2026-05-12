import { Test, TestingModule } from '@nestjs/testing';
import { GeofenceService } from './geofence.service';

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: GeofenceService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GeofenceService>(GeofenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
