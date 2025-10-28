export type PerformanceStatRow = {
  tenantId: string;
  approvedCount: string;
  pendingCount: string;
  rejectedCount: string;
};

export type PerformanceStat = {
  tenantId: string;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
};
