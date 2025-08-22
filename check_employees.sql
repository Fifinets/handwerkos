-- Check if there are any employees in the database
SELECT 
    COUNT(*) as total_employees,
    COUNT(CASE WHEN status = 'active' OR status = 'Active' THEN 1 END) as active_employees,
    COUNT(CASE WHEN status IS NULL THEN 1 END) as null_status_employees
FROM employees;

-- Show all employees with their status
SELECT 
    id,
    first_name,
    last_name,
    email,
    status,
    company_id,
    created_at
FROM employees
ORDER BY created_at DESC
LIMIT 20;

-- Check if project_team_members table exists and has data
SELECT COUNT(*) as assigned_members
FROM project_team_members;

-- Show which employees are assigned to which projects
SELECT 
    p.name as project_name,
    e.first_name,
    e.last_name,
    e.status as employee_status,
    ptm.assigned_at
FROM project_team_members ptm
LEFT JOIN projects p ON p.id = ptm.project_id
LEFT JOIN employees e ON e.id = ptm.employee_id
ORDER BY ptm.assigned_at DESC;