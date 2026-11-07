@echo off
rem @group Setup
rem @help Any Terraform command for the server stack, for example  .\aether tf output
rem @args <terraform arguments>
rem @eg output
rem @opt terraform arguments      for example: plan   or   output   or   state list
rem @raw  .\infra\tf ARGS          =  terraform -chdir=infra\server ARGS, with the secrets loaded
call "%AETHER_INFRA%\tf.cmd" %*
exit /b %ERRORLEVEL%
