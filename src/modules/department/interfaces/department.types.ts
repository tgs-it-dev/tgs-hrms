/** Single department row in system-admin “all tenants” response. */
export type DepartmentAdminListItem = {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
};

/** One tenant bucket with its departments (system-admin cross-tenant listing). */
export type TenantDepartmentsGroup = {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  departments: DepartmentAdminListItem[];
};

/** Response shape for {@link DepartmentService.getAllDepartmentsAcrossTenants}. */
export type AllDepartmentsAcrossTenantsResult = {
  tenants: TenantDepartmentsGroup[];
};

/** Successful delete payload. */
export type DepartmentRemoveResult = { deleted: true; id: string };
