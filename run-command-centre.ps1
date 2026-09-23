$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\Navka\Documents\agents-office'
while ($true) {
  & 'C:\Program Files\nodejs\node.exe' 'serve.mjs'
  Start-Sleep -Seconds 3
}
