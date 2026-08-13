param(
  [Parameter(Mandatory = $true)]
  [int]$ListenerProcessId,
  [Parameter(Mandatory = $true)]
  [string]$WorkspacePath
)

$candidateId = $ListenerProcessId
$rootId = 0
$workspaceOwned = $false

for ($depth = 0; $depth -lt 8 -and $candidateId -gt 0; $depth += 1) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $candidateId" -ErrorAction SilentlyContinue
  if (-not $process) { break }

  $commandLine = [string]$process.CommandLine
  if ($commandLine -like "*$WorkspacePath*") {
    $workspaceOwned = $true
  }
  if (
    $workspaceOwned -and
    $commandLine -match 'npm-cli\.js.+run (?:dev|start).+(?:-p|--port) 3000'
  ) {
    $rootId = $candidateId
  }
  $candidateId = [int]$process.ParentProcessId
}

if ($rootId -le 0) { exit 1 }
Write-Output $rootId
