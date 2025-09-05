# Teams Functionality Implementation

## Overview
This document describes the implementation of the teams functionality in your HRMS project. The teams system allows departments to have multiple teams, each managed by a manager (who is also an employee with a manager role).

## Architecture Design

### Efficient Design Principles
- **No redundant fields**: We don't store `tenant_id` or `dep_id` in the teams table
- **Leverage existing relationships**: Get tenant and department info through manager → employee → designation → department chain
- **Clean separation**: Teams are independent entities that can be assigned to employees

### Database Schema

#### Teams Table
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    manager_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Updated Employees Table
```sql
ALTER TABLE employees ADD COLUMN team_id UUID;
```

### Relationships
- **Team → Manager**: Many-to-One (a team has one manager)
- **Team → Employees**: One-to-Many (a team can have multiple employees)
- **Employee → Team**: Many-to-One (an employee belongs to one team, optional)

## Setup Instructions

### 1. Database Setup
Run the SQL script `teams-setup.sql` directly in your PostgreSQL database:

```bash
# Connect to your database and run:
psql -U your_username -d your_database -f teams-setup.sql
```

### 2. Application Setup
The application is already configured with:
- Team entity and relationships
- Team service with full CRUD operations
- Team controller with REST endpoints
- Integration with existing employee and user systems

## API Endpoints

### Teams Management (Admin/System-Admin only)
- `POST /teams` - Create a new team
- `GET /teams` - List all teams with pagination
- `GET /teams/:id` - Get team details
- `PATCH /teams/:id` - Update team
- `DELETE /teams/:id` - Delete team

### Team Members Management
- `GET /teams/:id/members` - Get team members with pagination
- `POST /teams/:id/members/:employeeId` - Add employee to team
- `DELETE /teams/:id/members/:employeeId` - Remove employee from team

### Manager-Specific Endpoints
- `GET /teams/my-teams` - Get teams managed by current user

## Usage Examples

### 1. Create a Team
```json
POST /teams
{
  "name": "Development Team A",
  "description": "Frontend development team",
  "manager_id": "manager-user-uuid"
}
```

### 2. Add Employee to Team
```bash
POST /teams/team-uuid/members/employee-uuid
```

### 3. Get Team Members
```bash
GET /teams/team-uuid/members?page=1
```

## Business Rules

### Team Creation
- Only users with 'manager' role can be assigned as team managers
- A manager can only manage one team at a time
- Teams are tenant-scoped (managers must belong to the tenant)

### Employee Assignment
- Employees can belong to only one team at a time
- Removing a team sets all member team_id to NULL
- Team assignment is optional (employees can exist without teams)

### Access Control
- **Admin/System-Admin**: Full access to all teams
- **Managers**: Can view their own teams and members
- **Regular Employees**: Can view team information through employee endpoints

## Data Flow Examples

### Getting Department Info for a Team
```typescript
// Through relationships:
team.manager.employees[0].designation.department
```

### Getting Tenant Info for a Team
```typescript
// Through relationships:
team.manager.tenant_id
```

## Integration Points

### Employee Module
- Employee listing now includes team information
- Team filtering capabilities
- Team assignment through team endpoints

### User Module
- Users with manager role can manage teams
- Manager-specific team views

### Department Module
- Teams are logically grouped by department through manager relationships
- Department reports can include team information

## Testing the Implementation

### 1. Verify Database Setup
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables WHERE table_name IN ('teams', 'employees');

-- Check if team_id column exists in employees
SELECT column_name FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'team_id';
```

### 2. Test API Endpoints
- Create a team with a manager user
- Add employees to the team
- Verify team member listing
- Test manager-specific endpoints

### 3. Verify Relationships
- Check that team members show correct team information
- Verify that removing a team clears employee team assignments
- Confirm that manager changes work correctly

## Troubleshooting

### Common Issues
1. **Entity not found errors**: Ensure Team entity is properly imported in modules
2. **Foreign key constraint errors**: Verify manager_id exists in users table
3. **Role validation errors**: Ensure manager has 'manager' role in roles table

### Debug Steps
1. Check database schema matches entity definitions
2. Verify all required roles exist
3. Check tenant isolation is working correctly
4. Validate foreign key relationships

## Future Enhancements

### Potential Improvements
- Team hierarchy (sub-teams)
- Team performance metrics
- Team-based reporting
- Team communication features
- Team scheduling and availability

### Scalability Considerations
- Index optimization for large teams
- Pagination for team member lists
- Caching for frequently accessed team data
- Bulk operations for team management

## Security Considerations

### Data Isolation
- Teams are tenant-scoped through manager relationships
- Users can only access teams in their tenant
- Manager access is restricted to their own teams

### Role-Based Access
- Admin/System-Admin: Full access
- Managers: Limited to their teams
- Regular employees: Read-only access to team info

## Conclusion

The teams functionality provides a flexible and efficient way to organize employees within departments. The design avoids redundancy while maintaining clear relationships and proper access control. The implementation follows existing patterns in your HRMS system and integrates seamlessly with current functionality.



