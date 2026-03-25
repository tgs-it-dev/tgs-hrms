-- Teams Setup SQL Script
-- Run this script directly in your PostgreSQL database

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    manager_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add team_id column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS team_id UUID;

-- 3. Add foreign key constraints
ALTER TABLE teams 
ADD CONSTRAINT fk_teams_manager 
FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE employees 
ADD CONSTRAINT fk_employees_team 
FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_teams_manager_id ON teams(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_team_id ON employees(team_id);

-- 5. Insert a default 'manager' role if it doesn't exist
INSERT INTO roles (id, name, description) 
VALUES (
    uuid_generate_v4(), 
    'manager', 
    'Team manager role with access to team members'
) ON CONFLICT (name) DO NOTHING;

-- 6. Optional: Create a sample team (uncomment and modify as needed)
-- INSERT INTO teams (id, name, description, manager_id) 
-- VALUES (
--     uuid_generate_v4(),
--     'Development Team',
--     'Software development team',
--     'YOUR_MANAGER_USER_ID_HERE'
-- );



