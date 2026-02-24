/**
 * Types for employee search when user may not have an employee record
 * (e.g. HR admin without employee – we build a pseudo employee for mapping).
 */

import type { User } from '../../../entities/user.entity';
import type { Designation } from '../../../entities/designation.entity';
import type { Team } from '../../../entities/team.entity';

/** Minimal employee-like shape for search result mapping (real Employee or pseudo). */
export interface EmployeeLikeForSearch {
  id: string;
  user_id: string;
  user: User;
  designation: Designation | null;
  team: Team | null;
  cnic_number: string | null;
  status: string | null;
}
