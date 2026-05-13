import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementService } from './announcement.service';

describe('AnnouncementService', () => {
  let service: AnnouncementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: AnnouncementService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AnnouncementService>(AnnouncementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
