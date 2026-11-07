@echo off
rem Keeps the cost log that  .\aether cost  adds up. Hetzner keeps no record of a server after it is
rem destroyed, so the CLI writes one line per finished session to .passwords\aether-sessions.csv.
rem   call sessionlog.cmd snapshot   before destroying: remember the running server (name, type, prices, start)
rem   call sessionlog.cmd commit     after a successful destroy: add the finished session to the log
rem It never fails the caller. A problem here only means that session is not logged.
rem Log columns: end_utc,kind,name,detail,hours,eur   (lines can be added by hand, see docs\CLI-PLAN.md)
setlocal DisableDelayedExpansion
set "AETHER_PENDING=%TEMP%\aether-session-pending.txt"
if /i "%~1"=="snapshot" goto :snapshot
if /i "%~1"=="commit" goto :commit
exit /b 0

:snapshot
set "AETHER_PS=$inv = [Globalization.CultureInfo]::InvariantCulture; Remove-Item $env:AETHER_PENDING -ErrorAction SilentlyContinue; $lines = @();"
set "AETHER_PS=%AETHER_PS% foreach ($x in @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.cloud/v1/servers').servers)) {"
set "AETHER_PS=%AETHER_PS%   $loc = if ($x.location) { $x.location.name } else { $x.datacenter.location.name };"
set "AETHER_PS=%AETHER_PS%   $t = (Invoke-RestMethod -Headers $H -Uri ('https://api.hetzner.cloud/v1/server_types?name=' + $x.server_type.name)).server_types[0];"
set "AETHER_PS=%AETHER_PS%   $p = @($t.prices | Where-Object { $_.location -eq $loc }); if ($p.Count -eq 0) { $p = @($t.prices) };"
set "AETHER_PS=%AETHER_PS%   $c = ([datetime]$x.created).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ');"
set "AETHER_PS=%AETHER_PS%   $lines += ($x.name + ',' + $x.server_type.name + ',' + $loc + ',' + $c + ',' + ([double]$p[0].price_hourly.gross).ToString($inv) + ',' + ([double]$p[0].price_monthly.gross).ToString($inv)) };"
set "AETHER_PS=%AETHER_PS% if ($lines.Count -gt 0) { Set-Content -Path $env:AETHER_PENDING -Value $lines }"
call "%AETHER_LIB%\api.cmd" >nul 2>&1
exit /b 0

:commit
if not exist "%AETHER_PENDING%" exit /b 0
set "AETHER_PS=$inv = [Globalization.CultureInfo]::InvariantCulture; $now = (Get-Date).ToUniversalTime(); $fmt = 'yyyy-MM-ddTHH:mm:ssZ';"
set "AETHER_PS=%AETHER_PS% $alive = @(@((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.cloud/v1/servers').servers) | ForEach-Object { ([datetime]$_.created).ToUniversalTime().ToString($fmt) });"
set "AETHER_PS=%AETHER_PS% $log = Join-Path $env:AETHER_SECRETS 'aether-sessions.csv';"
set "AETHER_PS=%AETHER_PS% if (-not (Test-Path $log)) { Set-Content -Path $log -Value 'end_utc,kind,name,detail,hours,eur' };"
set "AETHER_PS=%AETHER_PS% foreach ($l in @(Get-Content $env:AETHER_PENDING)) { $c = $l.Split(',');"
set "AETHER_PS=%AETHER_PS%   if ($alive -contains $c[3]) { ' Not logged: the server ' + $c[0] + ' still exists.'; continue };"
set "AETHER_PS=%AETHER_PS%   $hrs = ($now - [datetime]::Parse($c[3], $inv).ToUniversalTime()).TotalHours;"
set "AETHER_PS=%AETHER_PS%   $m = [math]::Floor($hrs / 720); $r = $hrs - 720 * $m; $ph = [double]::Parse($c[4], $inv); $cap = [double]::Parse($c[5], $inv);"
set "AETHER_PS=%AETHER_PS%   $eur = [double]$m * $cap + [math]::Min([math]::Ceiling($r) * $ph, $cap);"
set "AETHER_PS=%AETHER_PS%   Add-Content -Path $log -Value ($now.ToString($fmt) + ',server,' + $c[0] + ',' + $c[1] + ' ' + $c[2] + ',' + $hrs.ToString('0.00', $inv) + ',' + $eur.ToString('0.0000', $inv));"
set "AETHER_PS=%AETHER_PS%   ' Logged this session: {0:N1} h, about EUR {1:N2}. Total so far: .\aether cost' -f $hrs, $eur };"
set "AETHER_PS=%AETHER_PS% Remove-Item $env:AETHER_PENDING"
call "%AETHER_LIB%\api.cmd"
exit /b 0
