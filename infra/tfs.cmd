@echo off
rem Same as tf.cmd, but for the persistent Storage Box stack (infra\storage).
rem Usage:   .\infra\tfs plan     .\infra\tfs apply
set "TF_STACK=storage"
call "%~dp0tf.cmd" %*
exit /b %ERRORLEVEL%
