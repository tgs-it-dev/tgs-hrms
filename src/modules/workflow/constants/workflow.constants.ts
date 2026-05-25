export const WORKFLOW_EVENTS = {
  STEP_APPROVED: 'workflow.step.approved',
  REQUEST_APPROVED: 'workflow.request.approved',
  REQUEST_REJECTED: 'workflow.request.rejected',
  REQUEST_CANCELLED: 'workflow.request.cancelled',
} as const;

export const DEFAULT_WORKFLOW_CONFIGS: Record<
  string,
  Array<{ step_order: number; approver_role: string; step_label: string }>
> = {
  leave: [
    { step_order: 1, approver_role: 'manager', step_label: 'Manager Approval' },
    { step_order: 2, approver_role: 'admin', step_label: 'Admin Approval' },
  ],
  wfh: [
    { step_order: 1, approver_role: 'manager', step_label: 'Manager Approval' },
  ],
  overtime: [
    { step_order: 1, approver_role: 'manager', step_label: 'Manager Approval' },
    { step_order: 2, approver_role: 'hr-admin', step_label: 'HR Approval' },
  ],
};
