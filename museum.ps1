[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('help', 'sync', 'setup', 'test', 'build', 'dev', 'preview', 'check', 'login', 'import-search', 'deploy-preview', 'deploy-production')]
    [string]$Command = 'help',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs = @()
)

$ErrorActionPreference = 'Stop'
$museumWorkspace = Join-Path (Split-Path -Parent $PSScriptRoot) 'museum-workspace'
$museumNode = Join-Path $museumWorkspace 'toolchain\node.exe'
$museumHelper = Join-Path $PSScriptRoot 'tools\local-workspace.mjs'
if (-not (Test-Path -LiteralPath $museumNode -PathType Leaf)) {
    throw "The local Node runtime is missing: $museumNode. See the local workspace guide."
}
if (-not (Test-Path -LiteralPath $museumHelper -PathType Leaf)) {
    throw "The workspace helper is missing: $museumHelper"
}

# The wrapper holds this lock while waiting for Node, including dev/watch mode.
# Abandoned mutex recovery restores ownership; it does not manage child processes.
$museumMutexName = 'Global\YoungnakMuseumWorkspace-prj_r5Q33OKub3j7U0OFzTYz06K8YAkz'
$museumMutex = New-Object System.Threading.Mutex($false, $museumMutexName)
$museumOwnsMutex = $false
$museumExitCode = 1
$museumPreviousMarker = [Environment]::GetEnvironmentVariable('MUSEUM_WORKSPACE_WRAPPER', 'Process')
$museumPreviousThreadpool = [Environment]::GetEnvironmentVariable('UV_THREADPOOL_SIZE', 'Process')
try {
    try {
        $museumOwnsMutex = $museumMutex.WaitOne(0)
    }
    catch [System.Threading.AbandonedMutexException] {
        # WaitOne grants ownership when it reports an abandoned mutex.
        $museumOwnsMutex = $true
    }
    if (-not $museumOwnsMutex) {
        Write-Error 'Another museum command is already running. Stop it with Ctrl+C in its window (including dev/preview), then retry. Do not delete any lock files.' -ErrorAction Continue
        $museumExitCode = 2
    }
    else {
        [Environment]::SetEnvironmentVariable('MUSEUM_WORKSPACE_WRAPPER', $museumMutexName, 'Process')
        [Environment]::SetEnvironmentVariable('UV_THREADPOOL_SIZE', '32', 'Process')
        & $museumNode $museumHelper $Command.ToLowerInvariant() @CommandArgs
        $museumExitCode = $LASTEXITCODE
    }
}
finally {
    [Environment]::SetEnvironmentVariable('MUSEUM_WORKSPACE_WRAPPER', $museumPreviousMarker, 'Process')
    [Environment]::SetEnvironmentVariable('UV_THREADPOOL_SIZE', $museumPreviousThreadpool, 'Process')
    if ($museumOwnsMutex) { $museumMutex.ReleaseMutex() }
    $museumMutex.Dispose()
}
exit $museumExitCode
