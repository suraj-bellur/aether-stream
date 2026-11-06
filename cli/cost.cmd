@echo off
rem @group Session
rem @help Show what the running server has cost so far, and the Storage Box's monthly price
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.cloud/v1/servers        server_type.prices, created
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_boxes   storage_box_type.prices
rem @raw  or the Hetzner console: Usage page of the project, for this month so far
setlocal DisableDelayedExpansion
set "AETHER_PS=function Price($prices, $loc) { $p = @($prices | Where-Object { $_.location -eq $loc }); if ($p.Count -eq 0) { $p = @($prices) }; $p[0] };"
set "AETHER_PS=%AETHER_PS% $s = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.cloud/v1/servers').servers);"
set "AETHER_PS=%AETHER_PS% $b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes);"
set "AETHER_PS=%AETHER_PS% foreach ($x in $s) { $hrs = ((Get-Date) - [datetime]$x.created).TotalHours;"
set "AETHER_PS=%AETHER_PS%   $loc = if ($x.location) { $x.location.name } else { $x.datacenter.location.name };"
set "AETHER_PS=%AETHER_PS%   $p = Price $x.server_type.prices $loc; $ph = [double]$p.price_hourly.gross; $cap = [double]$p.price_monthly.gross;"
set "AETHER_PS=%AETHER_PS%   $so = [math]::Min([math]::Ceiling($hrs) * $ph, $cap);"
set "AETHER_PS=%AETHER_PS%   ' SERVER  {0} ({1}, {2}): running {3:N1} h, about EUR {4:N2} so far.  EUR {5:N4} per started hour, at most EUR {6:N2} per month' -f $x.name, $x.server_type.name, $loc, $hrs, $so, $ph, $cap };"
set "AETHER_PS=%AETHER_PS% if ($s.Count -eq 0) { ' SERVER  none running, nothing billing by the hour' };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $b) { $p = Price $x.storage_box_type.prices $x.location.name;"
set "AETHER_PS=%AETHER_PS%   ' BOX     {0} ({1}, {2}): EUR {3:N2} per month' -f $x.name, $x.storage_box_type.name, $x.location.name, [double]$p.price_monthly.gross };"
set "AETHER_PS=%AETHER_PS% if ($b.Count -eq 0) { ' BOX     none' };"
set "AETHER_PS=%AETHER_PS% ' Prices from the Hetzner API, including VAT. Earlier sessions this month: Hetzner console, Usage page.'"
call "%AETHER_LIB%\api.cmd"
exit /b %ERRORLEVEL%
