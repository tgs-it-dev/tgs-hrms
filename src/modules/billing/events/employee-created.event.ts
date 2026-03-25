/**
 * Event emitted when an employee is successfully created
 * This event is used to trigger billing operations in a decoupled manner
 */
export class EmployeeCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly employeeId: string,
    public readonly employeeEmail: string,
    public readonly employeeName: string,
  ) {}
}

