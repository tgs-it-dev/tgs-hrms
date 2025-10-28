export type KpiOverviewRow = {
  tenantId: string;
  tenantName: string;
  category: string;
  avgScore: string; // raw query returns strings
  recordCount: string;
};

export type KpiCategoryStats = {
  category: string;
  avgScore: number;
  recordCount: number;
};

export type KpiTenantOverview = {
  tenantId: string;
  tenantName: string;
  categories: KpiCategoryStats[];
};
