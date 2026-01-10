$today = Get-Date -Format "yyyy-MM-dd"
Write-Host "Deleting attendance for date: $today"

$supabaseUrl = "https://jpczbwkgfcbywtnobxnk.supabase.co"
$supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwY3pid2tnZmNieXd0bm9ieG5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMjI4MjMsImV4cCI6MjA0NTY5ODgyM30.VGwRrZE5CXdRn8i4hpP8aELSMPFzOVJRY0h4-U7WmDo"

$headers = @{
    "apikey" = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/attendance?date=eq.$today" -Method Delete -Headers $headers
    Write-Host "✅ Successfully deleted attendance entries for today" -ForegroundColor Green
    Write-Host "Response: $response"
} catch {
    Write-Host "❌ Error deleting attendance: $_" -ForegroundColor Red
    Write-Host "Error Details: $($_.Exception.Message)"
}
