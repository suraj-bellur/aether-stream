@echo off
rem @group Session
rem @help Show what is running and billing: the server and the Storage Box (read-only)
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.cloud/v1/servers
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_boxes
rem @raw  or the Hetzner console: Servers page and Storage Boxes page
setlocal DisableDelayedExpansion
set "AETHER_PS=$s = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.cloud/v1/servers').servers);"
set "AETHER_PS=%AETHER_PS% $b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes);"
set "AETHER_PS=%AETHER_PS% foreach ($x in $s) { $hrs = ((Get-Date) - [datetime]$x.created).TotalHours;"
set "AETHER_PS=%AETHER_PS%   ' SERVER  {0}  {1}  {2}  running {3:N1} h  (.\aether down when done)' -f $x.name, $x.status, $x.public_net.ipv4.ip, $hrs };"
set "AETHER_PS=%AETHER_PS% if ($s.Count -eq 0) { ' SERVER  none, no hourly billing' };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $b) { $ext = if ($x.access_settings.reachable_externally) { 'OPEN, close it with .\aether access close' } else { 'closed' };"
set "AETHER_PS=%AETHER_PS%   ' BOX     {0}  {1}  {2}  external access {3}' -f $x.name, $x.storage_box_type.name, $x.status, $ext };"
set "AETHER_PS=%AETHER_PS% if ($b.Count -eq 0) { ' BOX     none' }"
call "%AETHER_LIB%\api.cmd"
exit /b %ERRORLEVEL%
