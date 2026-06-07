export class WorkflowCompletedEvent {
  constructor(
    public readonly workflowRequestId: string,
    public readonly relatedEntityId: string,
    public readonly requestType: string,
    public readonly tenantId: string,
    public readonly requestorId: string,
    public readonly outcome:
      | 'approved'
      | 'rejected'
      | 'cancelled'
      | 'step_approved',
    public readonly finalApproverId: string | null,
    public readonly finalRemarks: string | null,
  ) {}
}
