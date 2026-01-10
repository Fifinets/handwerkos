# Fix project query by removing non-existent priority column
$file = "C:\Users\filip\StudioProjects\handwerkos\src\components\mobile\TodayScreen.tsx"
$content = Get-Content $file -Raw
$content = $content -replace "select\('id, name, customer_id, location, status, start_date, end_date, priority, description'\)", "select('id, name, customer_id, location, status, start_date, end_date, description')"
Set-Content $file $content -NoNewline
Write-Host "Fixed TodayScreen.tsx - removed priority column"
