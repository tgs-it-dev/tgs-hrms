// Global System Tenant ID - Used for system-admin users across the entire HRMS
export const GLOBAL_SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';

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
// export enum SubscriptionStatus {
//   ACTIVE = 'active',
//   INACTIVE = 'inactive',
//   CANCELLED = 'cancelled',
//   EXPIRED = 'expired',
//   TRIAL = 'trial',
// }

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


