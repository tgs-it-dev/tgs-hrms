export type DesignationAdminListItem = {
  id: string;
  title: string;
  created_at: Date;
};

export type DepartmentDesignationsGroup = {
  department_id: string;
  department_name: string;
  designations: DesignationAdminListItem[];
};

export type TenantDesignationsGroup = {
  tenant_id: string;
  tenant_name: string;
  tenant_status: string;
  departments: DepartmentDesignationsGroup[];
};

export type AllDesignationsAcrossTenantsResult = {
  tenants: TenantDesignationsGroup[];
};

export type DesignationRemoveResult = { deleted: true; id: string };
