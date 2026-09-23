[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$officeRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$cycle = Join-Path $officeRoot 'ceo\cycle.mjs'
$user = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path -LiteralPath $cycle)) { throw "CEO cycle was not found: $cycle" }

$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

# One strategic cycle at the start of the working day. The cycle itself is date-idempotent.
$morningAction = New-ScheduledTaskAction -Execute $node -Argument "`"$cycle`"" -WorkingDirectory $officeRoot
$morningTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '08:30'
Register-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-Morning' -Action $morningAction -Trigger $morningTrigger -Settings $settings -Principal $principal -Force -Description 'Runs Reset AI CEO strategic cycle every weekday morning. It may create internal work and holds external or commercial actions for director approval.' | Out-Null

# Re-check only during business hours; the CEO deduplicates open initiatives before creating work.
$reassessAction = New-ScheduledTaskAction -Execute $node -Argument "`"$cycle`" --reassess" -WorkingDirectory $officeRoot
$reassessTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday,Tuesday,Wednesday,Thursday,Friday -At '09:30'
$reassessTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At '09:30' -RepetitionInterval (New-TimeSpan -Hours 2) -RepetitionDuration (New-TimeSpan -Hours 9)).Repetition
Register-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-Reassess' -Action $reassessAction -Trigger $reassessTrigger -Settings $settings -Principal $principal -Force -Description 'Reassesses meaningful Reset signals every two hours on weekdays; duplicates are suppressed and external commitments remain held.' | Out-Null

Get-ScheduledTask -TaskName 'ResetAgentsOffice-CEO-*' | Select-Object TaskName, State | Format-Table -AutoSize
