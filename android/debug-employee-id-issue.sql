-- ============================================================================
-- DEBUG SCRIPT: Employee ID Issue
-- Purpose: Diagnose why employee_id is not found
-- ============================================================================

-- 1. Check current user
SELECT
  'Current User' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE id = auth.uid();

-- 2. Check if user has a profile
SELECT
  'Profile Check' as check_type,
  id as profile_id,
  company_id,
  role,
  created_at
FROM profiles
WHERE id = auth.uid();

-- 3. Check if employee record exists with user_id link
SELECT
  'Employee Record (by user_id)' as check_type,
  id as employee_id,
  user_id,
  company_id,
  first_name,
  last_name,
  email,
  created_at
FROM employees
WHERE user_id = auth.uid();

-- 4. Check if employee record exists with id = user_id (direct match)
SELECT
  'Employee Record (by id)' as check_type,
  id as employee_id,
  user_id,
  company_id,
  first_name,
  last_name,
  email,
  created_at
FROM employees
WHERE id = auth.uid();

-- 5. Show ALL employees in the same company as current user
SELECT
  'All Company Employees' as check_type,
  e.id as employee_id,
  e.user_id,
  e.first_name,
  e.last_name,
  e.email,
  e.company_id,
  CASE
    WHEN e.user_id = auth.uid() THEN 'THIS USER (by user_id)'
    WHEN e.id = auth.uid() THEN 'THIS USER (by id)'
    ELSE 'other employee'
  END as relationship
FROM employees e
INNER JOIN profiles p ON p.company_id = e.company_id
WHERE p.id = auth.uid()
ORDER BY relationship DESC, e.email;

-- 6. Check for orphaned employee records (employee exists but user_id is NULL)
SELECT
  'Orphaned Employees' as check_type,
  id as employee_id,
  user_id,
  first_name,
  last_name,
  email,
  company_id
FROM employees
WHERE user_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check if there's an employee with same email as current user
SELECT
  'Employee by Email Match' as check_type,
  e.id as employee_id,
  e.user_id,
  e.email as employee_email,
  u.email as user_email,
  e.company_id,
  CASE
    WHEN e.user_id IS NULL THEN '❌ user_id is NULL - NEEDS FIX'
    WHEN e.user_id = u.id THEN '✅ Correctly linked'
    ELSE '⚠️ Linked to different user'
  END as status
FROM employees e
CROSS JOIN auth.users u
WHERE u.id = auth.uid()
  AND LOWER(e.email) = LOWER(u.email);

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================
SELECT
  '=== SUMMARY ===' as info,
  '' as detail
UNION ALL
SELECT
  'Total employees in DB',
  COUNT(*)::text
FROM employees
UNION ALL
SELECT
  'Employees with user_id set',
  COUNT(*)::text
FROM employees
WHERE user_id IS NOT NULL
UNION ALL
SELECT
  'Employees without user_id (orphaned)',
  COUNT(*)::text
FROM employees
WHERE user_id IS NULL
UNION ALL
SELECT
  'Current user has employee (by user_id)',
  CASE WHEN EXISTS(SELECT 1 FROM employees WHERE user_id = auth.uid()) THEN '✅ YES' ELSE '❌ NO' END
UNION ALL
SELECT
  'Current user has employee (by id)',
  CASE WHEN EXISTS(SELECT 1 FROM employees WHERE id = auth.uid()) THEN '✅ YES' ELSE '❌ NO' END
UNION ALL
SELECT
  'Current user has employee (by email)',
  CASE WHEN EXISTS(
    SELECT 1 FROM employees e
    INNER JOIN auth.users u ON u.id = auth.uid()
    WHERE LOWER(e.email) = LOWER(u.email)
  ) THEN '✅ YES' ELSE '❌ NO' END;

-- ============================================================================
-- RECOMMENDED FIX (if employee exists but user_id is NULL)
-- ============================================================================
-- Run this ONLY if you found an orphaned employee with your email:
--
-- UPDATE employees
-- SET user_id = auth.uid()
-- WHERE LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
--   AND user_id IS NULL;
--
-- Then verify:
-- SELECT * FROM employees WHERE user_id = auth.uid();
-- ============================================================================
