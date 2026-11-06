@echo off
rem @group Storage
rem @help Create the Storage Box once, or show it and its sub-accounts
rem @args create or status
rem @raw  .\infra\tfs apply                    create: the box, both sub-accounts, generated passwords
rem @raw  copy infra\storage\terraform.tfstate .passwords\storage.tfstate.bak      right after creating it
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_boxes
rem @raw  curl -H "Authorization: Bearer <hetzner token>" https://api.hetzner.com/v1/storage_boxes/<box id>/subaccounts
rem @raw  deleting the box is manual on purpose: section 6.5 of docs\DEPLOY-HETZNER-IAC.md
setlocal DisableDelayedExpansion
if /i "%~1"=="create" goto :create
if /i "%~1"=="status" goto :status
if "%~1"=="" goto :status
echo Say create or status, for example:  .\aether storage status
exit /b 1

:create
echo This creates the Storage Box and its two sub-accounts: EUR 3.20 per month, kept until you delete it.
set "AUTO="
if defined AETHER_YES set "AUTO=-auto-approve"
call "%AETHER_INFRA%\tfs.cmd" apply %AUTO%
if errorlevel 1 exit /b 1
call "%AETHER_CLI%\backup.cmd"
exit /b %ERRORLEVEL%

:status
set "AETHER_PS=$b = @((Invoke-RestMethod -Headers $H -Uri 'https://api.hetzner.com/v1/storage_boxes').storage_boxes);"
set "AETHER_PS=%AETHER_PS% if ($b.Count -eq 0) { ' No Storage Box. Create one with: .\aether storage create'; exit 0 };"
set "AETHER_PS=%AETHER_PS% foreach ($x in $b) {"
set "AETHER_PS=%AETHER_PS%   ' BOX  {0}  {1}  {2}  {3}  host {4}' -f $x.name, $x.storage_box_type.name, $x.location.name, $x.status, $x.server;"
set "AETHER_PS=%AETHER_PS%   '      external access {0}, delete protection {1}' -f $x.access_settings.reachable_externally, $x.protection.delete;"
set "AETHER_PS=%AETHER_PS%   $subs = @((Invoke-RestMethod -Headers $H -Uri ('https://api.hetzner.com/v1/storage_boxes/' + $x.id + '/subaccounts')).subaccounts);"
set "AETHER_PS=%AETHER_PS%   foreach ($u in $subs) { '  SUB {0}  {1}  folder {2}  external access {3}  read-only {4}' -f $u.username, $u.description, $u.home_directory, $u.access_settings.reachable_externally, $u.access_settings.readonly } }"
call "%AETHER_LIB%\api.cmd"
exit /b %ERRORLEVEL%
