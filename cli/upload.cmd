@echo off
rem @group Storage
rem @help Upload a folder's contents to a library: opens access, rsyncs, always closes access
rem @args <public or private> <folder> [box folder] [-y]
rem @opt public or private          which library (required)
rem @opt a folder on your PC        what to upload (required); put quotes around it if it has spaces
rem @opt a folder on the box        optional: upload into that sub-folder, for example Holidays/2025/
rem @opt -y                         skip the question
rem @raw  .\infra\tfs apply -var="external_access=true"
rem @raw  .\infra\tfs output -raw public_password | clip
rem @raw  wsl rsync -avP -e "ssh -p 23" "/mnt/e/<folder>/" <public_user>@<public_host>:./
rem @raw  .\infra\tfs apply                                       closes external access again
setlocal
set "LIB=%~1"
set "FOLDER=%~2"
set "DEST=%~3"
if not defined DEST set "DEST=./"
call "%AETHER_LIB%\box.cmd" %1
if errorlevel 1 exit /b 1
if not defined FOLDER (
    echo Say which folder, for example:  .\aether upload public "E:\Movies"
    exit /b 1
)
if not exist "%FOLDER%\" (
    echo Folder not found: %FOLDER%
    exit /b 1
)
set "SRC="
for /f "usebackq delims=" %%p in (`wsl -e wslpath -a "%FOLDER%"`) do set "SRC=%%p"
if not defined SRC (
    echo Could not turn %FOLDER% into a WSL path. Is WSL installed?  .\aether doctor
    exit /b 1
)

echo Upload the contents of  %FOLDER%
echo                     to  %LIB% library, folder %DEST%
echo                     as  %AETHER_BOX_USER%@%AETHER_BOX_HOST%
echo External access is opened for the upload and closed again afterwards.
call "%AETHER_LIB%\confirm.cmd" "Go ahead?"
if errorlevel 1 exit /b 1

call "%AETHER_LIB%\access.cmd" open
if errorlevel 1 exit /b 1
call "%AETHER_LIB%\clipboard.cmd" %LIB%
wsl -e rsync -avP -e "ssh -p 23 -o StrictHostKeyChecking=accept-new" "%SRC%/" "%AETHER_BOX_USER%@%AETHER_BOX_HOST%:%DEST%"
set "RC=%ERRORLEVEL%"
call "%AETHER_LIB%\clipboard.cmd" clear
call "%AETHER_LIB%\access.cmd" close
if not "%RC%"=="0" (
    echo rsync failed with exit code %RC%. Running the same upload again resumes it.
    exit /b %RC%
)
echo Upload finished. The site shows new files on its next library scan, or after  .\aether restart backend
exit /b 0
