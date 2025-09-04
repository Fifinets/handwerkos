// Edge Function: Time Tracking Cron Jobs
// Automatische Aufgaben für Zeiterfassung (täglich/wöchentlich)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
}

interface CronRequest {
  task: 'daily-check' | 'weekly-report' | 'auto-stop' | 'reminder'
  companyId?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { task, companyId } = await req.json() as CronRequest

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let result: any = {}

    switch (task) {
      // ============================================================================
      // DAILY CHECK: Auto-stop forgotten time segments
      // ============================================================================
      case 'daily-check':
        result = await performDailyCheck(supabase, companyId)
        break

      // ============================================================================
      // WEEKLY REPORT: Generate and send weekly time reports
      // ============================================================================
      case 'weekly-report':
        result = await generateWeeklyReports(supabase, companyId)
        break

      // ============================================================================
      // AUTO-STOP: Stop segments running longer than X hours
      // ============================================================================
      case 'auto-stop':
        result = await autoStopLongRunningSegments(supabase, companyId)
        break

      // ============================================================================
      // REMINDER: Send reminders for unsigned delivery notes
      // ============================================================================
      case 'reminder':
        result = await sendDeliveryNoteReminders(supabase, companyId)
        break

      default:
        throw new Error(`Unknown task: ${task}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        task,
        result,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Cron job error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// ============================================================================
// DAILY CHECK: Auto-stop forgotten time segments
// ============================================================================
async function performDailyCheck(supabase: any, companyId?: string) {
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - 12) // 12 hours ago

  // Find active segments older than 12 hours
  let query = supabase
    .from('time_segments')
    .select('*, employee:employees(first_name, last_name, email)')
    .eq('status', 'active')
    .is('ended_at', null)
    .lt('started_at', cutoffTime.toISOString())

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: segments, error } = await query

  if (error) throw error

  const stoppedSegments = []
  const notifications = []

  // Stop each forgotten segment
  for (const segment of segments || []) {
    // Calculate duration (max 8 hours for safety)
    const startTime = new Date(segment.started_at)
    const maxEndTime = new Date(startTime)
    maxEndTime.setHours(startTime.getHours() + 8) // Max 8 hours

    // Update segment
    const { error: updateError } = await supabase
      .from('time_segments')
      .update({
        ended_at: maxEndTime.toISOString(),
        status: 'completed',
        notes: 'Automatisch beendet (vergessen zu stoppen)',
        updated_at: new Date().toISOString()
      })
      .eq('id', segment.id)

    if (!updateError) {
      stoppedSegments.push({
        id: segment.id,
        employee: `${segment.employee.first_name} ${segment.employee.last_name}`,
        started_at: segment.started_at,
        auto_ended_at: maxEndTime.toISOString(),
        duration_hours: 8
      })

      // Prepare notification
      if (segment.employee.email) {
        notifications.push({
          to: segment.employee.email,
          subject: 'Zeiterfassung automatisch beendet',
          segment_id: segment.id
        })
      }
    }
  }

  // Log the action
  if (stoppedSegments.length > 0) {
    await supabase
      .from('cron_logs')
      .insert({
        task: 'daily-check',
        status: 'completed',
        details: {
          stopped_count: stoppedSegments.length,
          segments: stoppedSegments
        },
        created_at: new Date().toISOString()
      })
  }

  return {
    stopped_count: stoppedSegments.length,
    segments: stoppedSegments,
    notifications_queued: notifications.length
  }
}

// ============================================================================
// WEEKLY REPORT: Generate time summaries
// ============================================================================
async function generateWeeklyReports(supabase: any, companyId?: string) {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() - 7) // Last Monday
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6) // Last Sunday
  weekEnd.setHours(23, 59, 59, 999)

  // Get all companies or specific one
  let companiesQuery = supabase.from('companies').select('*')
  if (companyId) {
    companiesQuery = companiesQuery.eq('id', companyId)
  }
  
  const { data: companies } = await companiesQuery
  const reports = []

  for (const company of companies || []) {
    // Get time summary for the company
    const { data: summary } = await supabase
      .from('time_segments')
      .select(`
        employee_id,
        project_id,
        segment_type,
        duration_minutes_computed,
        employees!inner(first_name, last_name),
        projects!inner(name)
      `)
      .eq('company_id', company.id)
      .gte('started_at', weekStart.toISOString())
      .lte('started_at', weekEnd.toISOString())
      .not('ended_at', 'is', null)

    if (summary && summary.length > 0) {
      // Group by employee
      const employeeSummaries = summary.reduce((acc: any, seg: any) => {
        const key = seg.employee_id
        if (!acc[key]) {
          acc[key] = {
            employee_name: `${seg.employees.first_name} ${seg.employees.last_name}`,
            total_work_minutes: 0,
            total_break_minutes: 0,
            projects: new Set()
          }
        }
        
        if (seg.segment_type === 'work') {
          acc[key].total_work_minutes += seg.duration_minutes_computed || 0
        } else if (seg.segment_type === 'break') {
          acc[key].total_break_minutes += seg.duration_minutes_computed || 0
        }
        
        if (seg.projects?.name) {
          acc[key].projects.add(seg.projects.name)
        }
        
        return acc
      }, {})

      // Convert to array and format
      const formattedSummaries = Object.entries(employeeSummaries).map(([id, data]: any) => ({
        employee_id: id,
        employee_name: data.employee_name,
        work_hours: (data.total_work_minutes / 60).toFixed(2),
        break_hours: (data.total_break_minutes / 60).toFixed(2),
        projects: Array.from(data.projects).join(', ')
      }))

      reports.push({
        company_id: company.id,
        company_name: company.name,
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        employee_count: formattedSummaries.length,
        total_hours: formattedSummaries.reduce((sum: number, emp: any) => 
          sum + parseFloat(emp.work_hours), 0
        ).toFixed(2),
        summaries: formattedSummaries
      })

      // Store report
      await supabase
        .from('weekly_reports')
        .insert({
          company_id: company.id,
          week_start: weekStart.toISOString(),
          week_end: weekEnd.toISOString(),
          data: formattedSummaries,
          created_at: new Date().toISOString()
        })
    }
  }

  return {
    reports_generated: reports.length,
    week: `${weekStart.toLocaleDateString('de-DE')} - ${weekEnd.toLocaleDateString('de-DE')}`,
    reports
  }
}

// ============================================================================
// AUTO-STOP: Stop segments running too long
// ============================================================================
async function autoStopLongRunningSegments(supabase: any, companyId?: string) {
  const maxHours = 10 // Maximum allowed hours
  const cutoffTime = new Date()
  cutoffTime.setHours(cutoffTime.getHours() - maxHours)

  // Find segments running longer than max hours
  let query = supabase
    .from('time_segments')
    .select('*, employee:employees(first_name, last_name)')
    .eq('status', 'active')
    .is('ended_at', null)
    .lt('started_at', cutoffTime.toISOString())

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: segments, error } = await query
  if (error) throw error

  const stoppedSegments = []

  for (const segment of segments || []) {
    const { error: updateError } = await supabase
      .from('time_segments')
      .update({
        ended_at: new Date().toISOString(),
        status: 'completed',
        notes: `Auto-gestoppt nach ${maxHours} Stunden`,
        updated_at: new Date().toISOString()
      })
      .eq('id', segment.id)

    if (!updateError) {
      stoppedSegments.push({
        id: segment.id,
        employee: `${segment.employee.first_name} ${segment.employee.last_name}`,
        started_at: segment.started_at,
        duration_hours: maxHours
      })
    }
  }

  return {
    auto_stopped_count: stoppedSegments.length,
    max_hours: maxHours,
    segments: stoppedSegments
  }
}

// ============================================================================
// REMINDER: Send reminders for unsigned delivery notes
// ============================================================================
async function sendDeliveryNoteReminders(supabase: any, companyId?: string) {
  const reminderDays = 3 // Send reminder after 3 days
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - reminderDays)

  // Find unsigned delivery notes older than X days
  let query = supabase
    .from('delivery_notes')
    .select(`
      *,
      project:projects(
        name,
        customer:customers(name, email)
      )
    `)
    .eq('status', 'sent')
    .is('signed_at', null)
    .lt('created_at', cutoffDate.toISOString())

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data: deliveryNotes, error } = await query
  if (error) throw error

  const reminders = []

  for (const note of deliveryNotes || []) {
    if (note.project?.customer?.email) {
      // Queue reminder email
      reminders.push({
        delivery_note_id: note.id,
        delivery_note_number: note.number,
        project_name: note.project.name,
        customer_name: note.project.customer.name,
        customer_email: note.project.customer.email,
        days_outstanding: reminderDays,
        created_at: note.created_at
      })

      // Update reminder sent timestamp
      await supabase
        .from('delivery_notes')
        .update({
          last_reminder_sent: new Date().toISOString()
        })
        .eq('id', note.id)
    }
  }

  // Log reminders
  if (reminders.length > 0) {
    await supabase
      .from('reminder_logs')
      .insert(reminders.map((r: any) => ({
        type: 'delivery_note_signature',
        reference_id: r.delivery_note_id,
        recipient: r.customer_email,
        sent_at: new Date().toISOString()
      })))
  }

  return {
    reminders_sent: reminders.length,
    days_threshold: reminderDays,
    reminders
  }
}