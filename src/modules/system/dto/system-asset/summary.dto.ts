export interface AssetSummaryRow {
  tenantId: string;
  tenantName: string;
  totalAssets: string;
  assignedCount: string;
  availableCount: string;
  maintenanceCount: string;
  retiredCount: string;
  lostCount: string;
}

export interface AssetSummary {
  tenantId: string;
  tenantName: string;
  totalAssets: number;
  assignedCount: number;
  availableCount: number;
  maintenanceCount: number;
  retiredCount: number;
  lostCount: number;
}
