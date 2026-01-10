# Fix QuickProjectSwitch query by removing non-existent priority column
$file = "C:\Users\filip\StudioProjects\handwerkos\src\components\mobile\QuickProjectSwitch.tsx"
$content = Get-Content $file -Raw
$content = $content -replace "select\('id, name, customer_id, location, status, start_date, end_date, priority, description'\)", "select('id, name, customer_id, location, status, start_date, end_date, description')"
Set-Content $file $content -NoNewline
Write-Host "Fixed QuickProjectSwitch.tsx - removed priority column"
