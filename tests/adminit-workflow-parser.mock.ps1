$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$count=0
foreach($name in @('adminit-synthetic-containment.yml','q01-hosted-windows-synthetic.yml','q01-reliability.yml')){
 $lines=[IO.File]::ReadAllLines((Join-Path $root ('.github/workflows/'+$name)))
 $shell=''
 for($i=0;$i -lt $lines.Length;$i++){
  if($lines[$i] -match '^      - '){$shell=''}
  if($lines[$i] -match '^        shell: (pwsh|powershell)$'){$shell=$Matches[1]}
  if($shell -and $lines[$i] -match '^        run: \|\s*$'){
   $code=@();$i++
   while($i -lt $lines.Length -and ($lines[$i] -match '^          ' -or $lines[$i] -eq '')){if($lines[$i].Length -ge 10){$code+=$lines[$i].Substring(10)};$i++};$i--
   $text=($code -join "`n") -replace '\$\{\{[^}]+\}\}','fixture'
   $errors=$null;$tokens=$null
   [System.Management.Automation.Language.Parser]::ParseInput($text,[ref]$tokens,[ref]$errors)|Out-Null
   if($errors.Count -ne 0){throw 'Workflow PowerShell parse failure'}
   $count++
  }
 }
}
if($count -lt 10){throw 'Workflow block inventory unexpectedly incomplete'}
Write-Output ('PASS: '+$count+' workflow PowerShell blocks parsed only; no execution')
