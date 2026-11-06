@echo off
rem @group Storage
rem @help Show the steps to delete the Storage Box and its media (prints only, changes nothing)
rem @raw  .\aether down                                         only if a server is running
rem @raw  infra\storage\main.tf: set delete_protection = false and remove the lifecycle block
rem @raw  .\infra\tfs apply                                     changes 1 resource, the protection
rem @raw  .\infra\tfs plan -destroy                             must list 6 to destroy
rem @raw  .\infra\tfs destroy                                   type yes
rem @raw  .\aether status                                       must say BOX none
rem @raw  del .passwords\storage.tfstate.bak                    the backup of the deleted box
rem @raw  git checkout infra/storage/main.tf                    puts both protections back
setlocal DisableDelayedExpansion
set "MAIN=%AETHER_INFRA%\storage\main.tf"

echo.
echo  This command only shows the steps. It changes nothing.
echo  Deleting the Storage Box deletes every file on it, permanently. Hetzner keeps no copy.
echo.
echo  What exists now
call "%AETHER_CLI%\status.cmd"

call "%AETHER_LIB%\box.cmd" public quiet
if errorlevel 1 goto :nobox
call "%AETHER_CLI%\storage.cmd" status
call "%AETHER_CLI%\usage.cmd"

call "%AETHER_LIB%\server.cmd" quiet
if errorlevel 1 goto :noserver
set "STEP1=Required: a server is running at %AETHER_IP% and has the box mounted."
goto :steps

:noserver
set "STEP1=Skip it: no server is running."

:steps
echo.
echo  The steps
echo.
echo  0. Make sure you do not need the files. The originals must still exist on your PC, for example on E:\.
echo.
echo  1. Stop the server.  %STEP1%
echo       .\aether down
echo.
echo  2. Remove the two protections in infra\storage\main.tf. Terraform refuses to delete the box
echo     while they are there. Open the file and make these two changes:
echo       - delete_protection = true     change it to     delete_protection = false
echo       - delete the whole lifecycle block, from the line  lifecycle {  to its closing brace
echo     The lines to look at right now, with their line numbers:
findstr /n /c:"delete_protection" /c:"lifecycle" /c:"prevent_destroy" "%MAIN%"
if errorlevel 1 echo       None found: the protections are already removed, go on to step 3.
echo.
echo  3. Apply that change. It only turns the protection off, so the plan must show 1 to change.
echo       .\infra\tfs apply
echo.
echo  4. Check what will be deleted. The plan must show 6 to destroy: the box, both sub-accounts
echo     and the three generated passwords. Stop if the number is different.
echo       .\infra\tfs plan -destroy
echo.
echo  5. Delete the box. Read the plan, then type yes.
echo       .\infra\tfs destroy
echo.
echo  6. Check that it is gone. The status must say BOX none.
echo       .\aether status
echo.
echo  7. Remove the old backup of the box's state. It describes a box that no longer exists,
echo     and its passwords are useless now.
echo       del .passwords\storage.tfstate.bak
echo.
echo  8. Put the protections back, so the next box is protected again.
echo       git checkout infra/storage/main.tf
echo     That restores the last committed file. If you had other edits in it, put the two
echo     protections back by hand instead.
echo.
echo  Afterwards, .\aether storage create  builds a new box with new passwords and empty libraries.
echo  The same steps are in section 6.5 of docs\DEPLOY-HETZNER-IAC.md. Retiring the whole project,
echo  not just the box? Section 6.6 has the full checklist.
exit /b 0

:nobox
echo.
echo  The Terraform state has no Storage Box, so there is nothing for Terraform to delete.
echo  If a BOX line above still shows one, it was created outside this setup or the state was lost.
echo  Delete it in the Hetzner console, on the Storage Boxes page, after turning off its delete protection.
exit /b 0
