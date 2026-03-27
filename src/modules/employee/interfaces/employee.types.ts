import type { Employee } from '../../../entities/employee.entity';
import type { User } from '../../../entities/user.entity';
import type { Designation } from '../../../entities/designation.entity';
import type { Team } from '../../../entities/team.entity';
import type { Role } from '../../../entities/role.entity';

/** Multipart file bundles used by employee create/update endpoints. */
export type EmployeeMultipartFiles = {
  profile_picture?: Express.Multer.File[];
  cnic_picture?: Express.Multer.File[];
  cnic_back_picture?: Express.Multer.File[];
};

/** Payload used when creating an employee after Stripe/checkout payment. */
export type CreateEmployeeAfterPaymentPayload = {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  designation_id: string;
  team_id?: string | null;
  role_id?: string | null;
  role_name?: string;
  gender?: string;
  cnic_number?: string;
  password?: string;
  profile_picture_url?: string;
  cnic_picture_url?: string;
  cnic_back_picture_url?: string;
};

/** Lifecycle flags for the unified employee creation pipeline. */
export type EmployeeCreationLifecycle = {
  /** When true, run billing checkout / seat charge (standard admin create). */
  runBilling: boolean;
  /** Emit `employee.created` for audit (standard create after successful billing). */
  emitCreatedEvent: boolean;
  /** Default `roles.name` when neither `role_id` nor `role_name` is set. */
  defaultRoleName: string;
  /** Note stored on auto-created salary row. */
  salaryNote: string;
  /** Use the new hire's user id as salary `create` actor (post-payment flow). */
  useNewEmployeeAsSalaryActor?: boolean;
};

export type EmployeeListItem = Employee & {
  role_name: string | null;
  profile_picture: string | null;
};

export type PaginatedEmployees = {
  items: EmployeeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type EmployeeJoiningReportRow = {
  month: number;
  year: number;
  total: number;
};

export type GenderPercentageResult = {
  male: number;
  female: number;
  total: number;
  activeEmployees: number;
  inactiveEmployees: number;
};

/** CSV export row for tenant-scoped employee list. */
export type EmployeeCsvRow = {
  id: string;
  user_id: string;
  first_name: string | undefined;
  last_name: string | undefined;
  email: string | undefined;
  designation: string | undefined;
  department: string | undefined;
  team: string | undefined;
  status: string | undefined;
};

/** CSV export row for system-admin multi-tenant export. */
export type EmployeeSystemAdminCsvRow = {
  tenant_id: string | undefined;
  tenant_name: string | undefined;
  tenant_status: string | undefined;
  employee_id: string;
  user_id: string;
  first_name: string | undefined;
  last_name: string | undefined;
  email: string | undefined;
  phone: string | undefined;
  designation: string | undefined;
  department: string | undefined;
  team: string | undefined;
  status: string | undefined;
  invite_status: string | undefined;
  created_at: Date | undefined;
};

export type EmployeeWithRelations = Employee & {
  user: User & { role?: Role | null; tenant?: { id: string; name: string; status: string } | null };
  designation?: Designation & { department?: { name: string } | null };
  team?: Team | null;
};
