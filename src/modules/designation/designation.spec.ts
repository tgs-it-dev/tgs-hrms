import { Test, TestingModule } from "@nestjs/testing";
import { DesignationService } from "./designation.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Designation } from "../../entities/designation.entity";
import { Department } from "../../entities/department.entity";
import { Tenant } from "../../entities/tenant.entity";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { TenantDatabaseService } from "../../common/services/tenant-database.service";

describe("DesignationService", () => {
  let service: DesignationService;
  let designationRepo: Repository<Designation>;
  let departmentRepo: Repository<Department>;

  // Use proper UUID format
  const tenantId = "550e8400-e29b-41d4-a716-446655440000";
  const departmentId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const designationId = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

  const mockDepartment: Department = {
    id: departmentId,
    name: "Engineering",
    description: "Engineering department",
    tenant_id: tenantId,
    created_at: new Date(),
    tenant: {} as any,
    designations: [],
  };

  const mockDesignation: Designation = {
    id: designationId,
    department_id: departmentId,
    tenant_id: tenantId,
    title: "Manager",
    created_at: new Date(),
    department: mockDepartment,
    tenant: {} as Designation["tenant"],
    employees: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignationService,
        {
          provide: getRepositoryToken(Designation),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Department),
          useValue: {
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: { findOne: jest.fn(), findOneBy: jest.fn() },
        },
        {
          provide: TenantDatabaseService,
          useValue: { getSchemaName: jest.fn(), runInTenantSchema: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DesignationService>(DesignationService);
    designationRepo = module.get(getRepositoryToken(Designation));
    departmentRepo = module.get(getRepositoryToken(Department));
  });

  it("should create designation if title is unique", async () => {
    jest.spyOn(departmentRepo, "findOne").mockResolvedValue(mockDepartment);
    jest.spyOn(designationRepo, "findOne").mockResolvedValue(null);
    jest.spyOn(designationRepo, "create").mockReturnValue(mockDesignation);
    jest.spyOn(designationRepo, "save").mockResolvedValue(mockDesignation);

    const result = await service.create(tenantId, {
      title: "Manager",
      department_id: departmentId,
    });

    expect(result).toEqual(mockDesignation);
  });

  it("should throw ConflictException if duplicate title exists in same department", async () => {
    jest.spyOn(departmentRepo, "findOne").mockResolvedValue(mockDepartment);
    jest.spyOn(designationRepo, "findOne").mockResolvedValue(mockDesignation);

    await expect(
      service.create(tenantId, {
        title: "Manager",
        department_id: departmentId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("should update designation if title is unique", async () => {
    // First findOne: fetch by id (where.id present)
    // Second findOne: duplicate title check (where.title present) — returns null (no conflict)
    jest
      .spyOn(designationRepo, "findOne")
      .mockImplementation(async (options: any) => {
        if (options?.where?.id) return { ...mockDesignation } as any; // copy prevents mutation
        return null; // no duplicate
      });
    jest
      .spyOn(designationRepo, "save")
      .mockResolvedValue({ ...mockDesignation, title: "Lead" });

    const result = await service.update(tenantId, designationId, {
      title: "Lead",
    });
    expect(result.title).toBe("Lead");
  });

  it("should throw ConflictException when updating to duplicate title", async () => {
    const anotherDesignation = {
      ...mockDesignation,
      id: "6ba7b812-9dad-11d1-80b4-00c04fd430c8",
    };
    // Return a COPY to prevent service's Object.assign from mutating the shared constant
    jest
      .spyOn(designationRepo, "findOne")
      .mockImplementation(async (options: any) => {
        if (options?.where?.id) return { ...mockDesignation } as any; // fetch by id — copy!
        return anotherDesignation as any; // duplicate found
      });

    await expect(
      service.update(tenantId, designationId, { title: "Lead" }),
    ).rejects.toThrow(ConflictException);
  });

  it("should delete designation", async () => {
    const designationWithRelations = { ...mockDesignation, employees: [] };
    jest
      .spyOn(designationRepo, "findOne")
      .mockResolvedValue(designationWithRelations as any);
    jest
      .spyOn(designationRepo, "delete")
      .mockResolvedValue({ affected: 1 } as any);

    const result = await service.remove(tenantId, designationId);
    expect(result).toEqual({ deleted: true, id: designationId });
  });

  it("should throw 404 if deleting non-existent designation", async () => {
    jest.spyOn(designationRepo, "findOne").mockResolvedValue(null);

    await expect(
      service.remove(tenantId, "6ba7b813-9dad-11d1-80b4-00c04fd430c8"),
    ).rejects.toThrow(NotFoundException);
  });
});
