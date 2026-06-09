// Global System Tenant ID - Used for system-admin users across the entire HRMS
export const GLOBAL_SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

// Org membership roles — mirrored as a native PostgreSQL ENUM (see migration 1773000000003)
export enum OrgMemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// User and Role Enums
export enum UserRole {
  ADMIN = 'admin',
  SYSTEM_ADMIN = 'system-admin',
  NETWORK_ADMIN = 'network-admin',
  HR_ADMIN = 'hr-admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  USER = 'user',
}

export enum UserGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

// Employee Enums
export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  ON_LEAVE = 'on_leave',
}

export enum InviteStatus {
  INVITE_SENT = 'Invite Sent',
  INVITE_EXPIRED = 'Invite Expired',
  JOINED = 'Joined',
  DECLINED = 'Declined',
}

// Attendance Enums
export enum AttendanceType {
  CHECK_IN = 'check-in',
  CHECK_OUT = 'check-out',
  BREAK_START = 'break-start',
  BREAK_END = 'break-end',
}

export enum CheckInApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// export enum AttendanceStatus {
//   PRESENT = 'present',
//   ABSENT = 'absent',
//   LATE = 'late',
//   HALF_DAY = 'half_day',
//   HOLIDAY = 'holiday',
// }

// Leave Enums
// export enum LeaveType {
//   SICK_LEAVE = 'sick_leave',
//   ANNUAL_LEAVE = 'annual_leave',
//   PERSONAL_LEAVE = 'personal_leave',
//   MATERNITY_LEAVE = 'maternity_leave',
//   PATERNITY_LEAVE = 'paternity_leave',
//   EMERGENCY_LEAVE = 'emergency_leave',
//   UNPAID_LEAVE = 'unpaid_leave',
// }

export enum LeaveStatus {
  PENDING = 'pending',
  PROCESSING = 'processing', // Manager approved; waiting for admin/hr approval
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'withdrawn',
}

// Asset Enums
export enum AssetStatus {
  AVAILABLE = 'available',
  ASSIGNED = 'assigned',
  UNDER_MAINTENANCE = 'under_maintenance',
  RETIRED = 'retired',
  LOST = 'lost',
}

// export enum AssetCategory {
//   LAPTOP = 'laptop',
//   DESKTOP = 'desktop',
//   MOBILE = 'mobile',
//   TABLET = 'tablet',
//   MONITOR = 'monitor',
//   KEYBOARD = 'keyboard',
//   MOUSE = 'mouse',
//   CHAIR = 'chair',
//   DESK = 'desk',
//   OTHER = 'other',
// }

export enum AssetRequestStatus {
  PENDING = 'pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
  CANCELLED = 'cancelled',
}

// // Team Enums
// export enum TeamStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
//   DISBANDED = 'disbanded',
// }

// Policy Enums
export enum PolicyCategory {
  HR_POLICY = 'hr_policy',
  IT_POLICY = 'it_policy',
  SAFETY_POLICY = 'safety_policy',
  CODE_OF_CONDUCT = 'code_of_conduct',
  PRIVACY_POLICY = 'privacy_policy',
  OTHER = 'other',
}

// Payroll Enums
export enum PayrollStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  PAID = 'paid',
  REJECTED = 'rejected',
}

export enum SalaryCycle {
  MONTHLY = 'monthly',
  BI_WEEKLY = 'bi-weekly',
  WEEKLY = 'weekly',
}

export enum SalaryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// export enum PolicyStatus {
//   DRAFT = 'draft',
//   ACTIVE = 'active',
//   ARCHIVED = 'archived',
// }

// Subscription Enums
export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  GRACE_PERIOD = 'grace_period',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

export enum PaypalSubscriptionStatus {
  APPROVAL_PENDING = 'APPROVAL_PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaypalWebhookEvent {
  SUBSCRIPTION_ACTIVATED = 'BILLING.SUBSCRIPTION.ACTIVATED',
  SUBSCRIPTION_CANCELLED = 'BILLING.SUBSCRIPTION.CANCELLED',
  SUBSCRIPTION_EXPIRED = 'BILLING.SUBSCRIPTION.EXPIRED',
  SUBSCRIPTION_SUSPENDED = 'BILLING.SUBSCRIPTION.SUSPENDED',
  SUBSCRIPTION_PAYMENT_FAILED = 'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
  PAYMENT_SALE_COMPLETED = 'PAYMENT.SALE.COMPLETED',
}

// export enum PaymentStatus {
//   PENDING = 'pending',
//   COMPLETED = 'completed',
//   FAILED = 'failed',
//   REFUNDED = 'refunded',
//   CANCELLED = 'cancelled',
// }

// Timesheet Enums
// export enum TimesheetStatus {
//   DRAFT = 'draft',
//   SUBMITTED = 'submitted',
//   APPROVED = 'approved',
//   REJECTED = 'rejected',
// }

// export enum TimesheetType {
//   REGULAR = 'regular',
//   OVERTIME = 'overtime',
//   HOLIDAY = 'holiday',
//   WEEKEND = 'weekend',
// }

// Department Enums
// export enum DepartmentStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
// }

// // Designation Enums
// export enum DesignationLevel {
//   ENTRY = 'entry',
//   MID = 'mid',
//   SENIOR = 'senior',
//   LEAD = 'lead',
//   MANAGER = 'manager',
//   DIRECTOR = 'director',
//   EXECUTIVE = 'executive',
// }

// // File Upload Enums
// export enum FileType {
//   IMAGE = 'image',
//   DOCUMENT = 'document',
//   VIDEO = 'video',
//   AUDIO = 'audio',
//   OTHER = 'other',
// }

// export enum FileStatus {
//   UPLOADING = 'uploading',
//   UPLOADED = 'uploaded',
//   PROCESSING = 'processing',
//   PROCESSED = 'processed',
//   FAILED = 'failed',
// }

// Notification Enums
export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push',
  IN_APP = 'in_app',
  LEAVE = 'leave',
  WFH = 'wfh',
  OVERTIME = 'overtime',
  ALERT = 'alert',
  ATTENDANCE = 'attendance',
  TASK = 'task',
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read',
  UNREAD = 'unread',
}

/** Workflow action that triggered the notification (e.g. leave APPLIED, PROCESSING, APPROVED, REJECTED). */
export enum NotificationAction {
  APPLIED = 'applied',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// // Audit Enums
// export enum AuditAction {
//   CREATE = 'create',
//   UPDATE = 'update',
//   DELETE = 'delete',
//   LOGIN = 'login',
//   LOGOUT = 'logout',
//   VIEW = 'view',
//   EXPORT = 'export',
//   IMPORT = 'import',
// }

// export enum AuditStatus {
//   SUCCESS = 'success',
//   FAILED = 'failed',
//   PENDING = 'pending',
// }

// // API Response Enums
// export enum ApiResponseStatus {
//   SUCCESS = 'success',
//   ERROR = 'error',
//   WARNING = 'warning',
//   INFO = 'info',
// }

// export enum HttpStatusCode {
//   OK = 200,
//   CREATED = 201,
//   NO_CONTENT = 204,
//   BAD_REQUEST = 400,
//   UNAUTHORIZED = 401,
//   FORBIDDEN = 403,
//   NOT_FOUND = 404,
//   CONFLICT = 409,
//   UNPROCESSABLE_ENTITY = 422,
//   TOO_MANY_REQUESTS = 429,
//   INTERNAL_SERVER_ERROR = 500,
//   BAD_GATEWAY = 502,
//   SERVICE_UNAVAILABLE = 503,
// }

// // Database Enums
// export enum DatabaseOperation {
//   INSERT = 'insert',
//   UPDATE = 'update',
//   DELETE = 'delete',
//   SELECT = 'select',
//   TRUNCATE = 'truncate',
// }

// // Cache Enums
// export enum CacheKey {
//   USER_PERMISSIONS = 'user_permissions',
//   ROLE_PERMISSIONS = 'role_permissions',
//   COMPANY_DETAILS = 'company_details',
//   DEPARTMENT_LIST = 'department_list',
//   DESIGNATION_LIST = 'designation_list',
// }

// export enum CacheTTL {
//   SHORT = 300, // 5 minutes
//   MEDIUM = 1800, // 30 minutes
//   LONG = 3600, // 1 hour
//   VERY_LONG = 86400, // 24 hours
// }

// Task Enums
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// Benefit Reimbursement Enums
export enum BenefitReimbursementStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

// Announcement Enums
export enum AnnouncementCategory {
  GENERAL = 'general',
  HOLIDAY = 'holiday',
  POLICY = 'policy',
  EVENT = 'event',
  URGENT = 'urgent',
}

export enum AnnouncementPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AnnouncementStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  CANCELLED = 'cancelled',
}

// Notification Email Enums
export enum NotificationEmailType {
  LEAVE_REQUEST = 'leave_request',
  LEAVE_STATUS_UPDATE = 'leave_status_update',
  FLEX_REQUEST = 'flex_request',
  FLEX_STATUS_UPDATE = 'flex_status_update',
  OVERTIME_REQUEST = 'overtime_request',
  OVERTIME_STATUS_UPDATE = 'overtime_status_update',
  WORKFLOW_STEP_PROCESSING = 'workflow_step_processing',
  WORKFLOW_PENDING_APPROVAL = 'workflow_pending_approval',
}

export enum NotificationLogStatus {
  SENT = 'sent',
  FAILED = 'failed',
}

// Workflow Enums
export enum WorkflowRequestType {
  LEAVE = 'leave',
  WFH = 'wfh',
  OVERTIME = 'overtime',
}

export enum WorkflowRequestStatus {
  PENDING = 'pending',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum WorkflowStepStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// WFH Enums
export enum WfhStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

// Overtime Enums
export enum OvertimeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}
