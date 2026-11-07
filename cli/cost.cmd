@echo off
rem @group Session
rem @help Show the total cost so far: finished sessions, the running server and the Storage Box
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.cloud/v1/servers                     the running server and its start time
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.cloud/v1/server_types?name=cpx22     hourly and monthly price of a server type
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_box_types              the same for Storage Box types
rem @raw  type .passwords\aether-sessions.csv                                                                      one line per finished session
rem @raw  Hetzner console: Usage page of the project, and the invoices
setlocal DisableDelayedExpansion
set "AETHER_PS=$inv = [Globalization.CultureInfo]::InvariantCulture; $now = Get-Date;"
set "AETHER_PS=%AETHER_PS% function Accrue($hrs, $ph, $cap) { $m = [math]::Floor($hrs / 720); $r = $hrs - 720 * $m; [double]$m * $cap + [math]::Min([math]::Ceiling($r) * $ph, $cap) };"
set "AETHER_PS=%AETHER_PS% function Pick($prices, $loc) { $p = @($prices | Where-Object { $_.location -eq $loc }); if ($p.Count -eq 0) { $p = @($prices) }; $p[0] };"
set "AETHER_PS=%AETHER_PS% $log = Join-Path $env:AETHER_SECRETS 'aether-sessions.csv'; $rows = @(); if (Test-Path $log) { $rows = @(Import-Csv $log) };"
set "AETHER_PS=%AETHER_PS% $done = 0.0; $doneH = 0.0; foreach ($r in $rows) { $done += [double]::Parse($r.eur, $inv); if ($r.kind -eq 'server') { $doneH += [double]::Parse($r.hours, $inv) } };"
set "AETHER_PS=%AETHER_PS% $s = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.cloud/v1/servers').servers);"
set "AETHER_PS=%AETHER_PS% $b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes);"
set "AETHER_PS=%AETHER_PS% $run = 0.0; $boxc = 0.0;"
set "AETHER_PS=%AETHER_PS% if ($rows.Count -gt 0) { ' FINISHED  {0} entries in the log: {1:N1} h of server time, EUR {2:N2}' -f $rows.Count, $doneH, $done } else { ' FINISHED  nothing logged yet (a session is logged when it ends with: .\aether down)' };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $s) { $loc = if ($x.location) { $x.location.name } else { $x.datacenter.location.name };"
set "AETHER_PS=%AETHER_PS%   $t = (Invoke-RestMethod -Headers $H -Uri ('https://api.hetzner.cloud/v1/server_types?name=' + $x.server_type.name)).server_types[0];"
set "AETHER_PS=%AETHER_PS%   $p = Pick $t.prices $loc; $hrs = ($now - [datetime]$x.created).TotalHours;"
set "AETHER_PS=%AETHER_PS%   $c = Accrue $hrs ([double]::Parse($p.price_hourly.gross, $inv)) ([double]::Parse($p.price_monthly.gross, $inv)); $run += $c;"
set "AETHER_PS=%AETHER_PS%   ' RUNNING   {0} ({1}, {2}): {3:N1} h so far, about EUR {4:N2}  (.\aether down when done)' -f $x.name, $x.server_type.name, $loc, $hrs, $c };"
set "AETHER_PS=%AETHER_PS% if ($s.Count -eq 0) { ' RUNNING   no server' };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $b) {"
set "AETHER_PS=%AETHER_PS%   $t = @(@((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_box_types').storage_box_types) | Where-Object { $_.name -eq $x.storage_box_type.name })[0];"
set "AETHER_PS=%AETHER_PS%   $p = Pick $t.prices $x.location.name; $hrs = ($now - [datetime]$x.created).TotalHours;"
set "AETHER_PS=%AETHER_PS%   $c = Accrue $hrs ([double]::Parse($p.price_hourly.gross, $inv)) ([double]::Parse($p.price_monthly.gross, $inv)); $boxc += $c;"
set "AETHER_PS=%AETHER_PS%   ' BOX       {0} ({1}, {2}): since {3}, about EUR {4:N2} so far, at most EUR {5:N2} per month' -f $x.name, $x.storage_box_type.name, $x.location.name, ([datetime]$x.created).ToString('yyyy-MM-dd'), $c, [double]::Parse($p.price_monthly.gross, $inv) };"
set "AETHER_PS=%AETHER_PS% if ($b.Count -eq 0) { ' BOX       none' };"
set "AETHER_PS=%AETHER_PS% ' TOTAL     about EUR {0:N2}  (finished {1:N2} + running {2:N2} + box {3:N2})' -f ($done + $run + $boxc), $done, $run, $boxc;"
set "AETHER_PS=%AETHER_PS% ' Estimates from the API prices, VAT included. The Hetzner invoice is what you actually pay.';"
set "AETHER_PS=%AETHER_PS% ' Not counted: sessions that ended before the log existed or without .\aether down. Add them by hand (see docs\CLI-PLAN.md), or check the Hetzner console, Usage page.'"
call "%AETHER_LIB%\api.cmd"
exit /b %ERRORLEVEL%
