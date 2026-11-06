@echo off
rem @group Storage
rem @help Show Storage Box space used and free, and per library when the server runs
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_boxes     stats and storage_box_type.size
rem @raw  ssh <target> du -sh /media/videos /media/private                server running
setlocal DisableDelayedExpansion
set "AETHER_PS=function GB($v) { '{0:N1} GB' -f ([double]$v / 1GB) };"
set "AETHER_PS=%AETHER_PS% $b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes);"
set "AETHER_PS=%AETHER_PS% if ($b.Count -eq 0) { ' No Storage Box. Create one with: .\aether storage create'; exit 0 };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $b) { $total = [double]$x.storage_box_type.size;"
set "AETHER_PS=%AETHER_PS%   if ($null -eq $x.stats) { ' BOX  {0}: size {1}, usage not reported by the API' -f $x.name, (GB $total); continue };"
set "AETHER_PS=%AETHER_PS%   $used = [double]$x.stats.size;"
set "AETHER_PS=%AETHER_PS%   ' BOX  {0}: {1} used of {2}, {3} free  (files {4}, snapshots {5})' -f $x.name, (GB $used), (GB $total), (GB ($total - $used)), (GB $x.stats.size_data), (GB $x.stats.size_snapshots) }"
call "%AETHER_LIB%\api.cmd"
if errorlevel 1 exit /b 1

call "%AETHER_LIB%\server.cmd" quiet
if errorlevel 1 (
    echo  Per-library sizes need the server: .\aether up, then .\aether usage again.
    exit /b 0
)
echo  Per library, from the server's mounts:
%AETHER_SSH% %AETHER_TARGET% "du -sh /media/videos /media/private 2>/dev/null"
exit /b 0
