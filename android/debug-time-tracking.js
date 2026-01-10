// Debug-Skript für Zeiterfassung
// In der Browser-Konsole ausführen

console.log('🔍 === ZEITERFASSUNG DEBUG ===\n');

// 1. Check localStorage
console.log('1. LocalStorage Status:');
console.log('activeTimeEntry:', localStorage.getItem('activeTimeEntry'));
console.log('activeBreak:', localStorage.getItem('activeBreak'));
console.log('selectedProject:', localStorage.getItem('selectedProject'));

// 2. Parse activeTimeEntry if exists
const activeEntry = localStorage.getItem('activeTimeEntry');
if (activeEntry) {
  try {
    const parsed = JSON.parse(activeEntry);
    console.log('\n2. Active Entry Details:');
    console.log('  - ID:', parsed.id);
    console.log('  - Project ID:', parsed.project_id);
    console.log('  - Start Time:', parsed.start_time);
    console.log('  - Started At:', parsed.startedAt);
    console.log('  - Breaks:', parsed.breaks);
  } catch (e) {
    console.error('❌ Fehler beim Parsen von activeTimeEntry:', e);
  }
} else {
  console.log('\n2. ✅ Keine aktive Zeiterfassung in localStorage');
}

// 3. Check Supabase connection
console.log('\n3. Checking Supabase...');
import { supabase } from '@/integrations/supabase/client';

(async () => {
  // Check user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ User Error:', userError);
    return;
  }
  console.log('✅ User:', user?.id);

  // Check employee
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, user_id')
    .eq('user_id', user.id)
    .single();

  if (empError) {
    console.error('❌ Employee Error:', empError);
  } else {
    console.log('✅ Employee ID:', employee?.id);
  }

  // Check timesheets table access
  const { data: timesheetsTest, error: timesheetsError } = await supabase
    .from('timesheets')
    .select('id')
    .limit(1);

  if (timesheetsError) {
    console.error('❌ Timesheets Table Error:', timesheetsError);
  } else {
    console.log('✅ Timesheets table accessible');
  }

  // Check attendance table
  const { data: attendanceTest, error: attendanceError } = await supabase
    .from('attendance')
    .select('id')
    .limit(1);

  if (attendanceError) {
    console.error('❌ Attendance Table Error:', attendanceError);
  } else {
    console.log('✅ Attendance table accessible');
  }

  // Check current attendance
  if (employee) {
    const { data: currentAttendance, error: currentError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open')
      .is('clock_out', null)
      .maybeSingle();

    if (currentError) {
      console.error('❌ Current Attendance Error:', currentError);
    } else if (currentAttendance) {
      console.log('✅ Current Attendance:', currentAttendance);
    } else {
      console.log('ℹ️ No open attendance found');
    }
  }
})();

console.log('\n🔍 === DEBUG COMPLETE ===');
