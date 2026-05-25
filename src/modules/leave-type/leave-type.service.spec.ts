import { Test, TestingModule } from '@nestjs/testing';
import { LeaveTypeService } from './leave-type.service';

describe('LeaveTypeService', () => {
  let service: LeaveTypeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: LeaveTypeService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LeaveTypeService>(LeaveTypeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
