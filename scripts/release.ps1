param(
    [ValidateSet("status", "add", "release", "deploy", "release-and-deploy")]
    [string]$Action = "status",
    [ValidateSet("none", "patch", "minor", "major")]
    [string]$VersionBump = "none",
    [string]$Version,
    [string]$CommitMessage,
    [string]$RemoteName = "origin",
    [string]$Branch = "main",
    [string]$ServerUser = "root",
    [string]$ServerHost = "vivahome.de",
    [string]$ServerPath = "/opt/belegscanner",
    [string]$ComposeFile = "docker-compose.prod.yml",
    [ValidateSet("migrate", "push")]
    [string]$SchemaSyncMode = "push",
    [string]$AppUrl = "https://beleg.vivahome.de",
    [switch]$Push,
    [switch]$CreateTag,
    [switch]$RunSeed,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info {
    param([string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-WarnLine {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Run-Command {
    param(
        [string]$Command,
        [string]$Label = ""
    )

    if ($Label) {
        Write-Info $Label
    }

    Write-Host $Command -ForegroundColor DarkGray

    if ($DryRun) {
        return
    }

    Invoke-Expression $Command

    if ($LASTEXITCODE -ne 0) {
        throw "Befehl fehlgeschlagen: $Command"
    }
}

function Ensure-Tool {
    param([string]$Name)

    if ($null -eq (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Benoetigtes Tool nicht gefunden: $Name"
    }
}

function Ensure-Value {
    param(
        [string]$Value,
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Parameter fehlt: $Name"
    }
}

function Get-RepoRoot {
    $root = git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw "Dieses Verzeichnis ist kein Git-Repository."
    }

    return $root.Trim()
}

function Get-CurrentVersion {
    $packageJsonPath = Join-Path $script:RepoRoot "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        throw "package.json nicht gefunden: $packageJsonPath"
    }

    $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    return [string]$packageJson.version
}

function Test-HasChanges {
    $status = git status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "git status konnte nicht ausgeführt werden."
    }

    return -not [string]::IsNullOrWhiteSpace(($status | Out-String).Trim())
}

function Set-ProjectVersion {
    if (-not [string]::IsNullOrWhiteSpace($Version) -and $VersionBump -ne "none") {
        throw "Bitte entweder -Version oder -VersionBump verwenden, nicht beides."
    }

    if (-not [string]::IsNullOrWhiteSpace($Version)) {
        Run-Command -Label "Setze Version auf $Version" -Command "npm version $Version --no-git-tag-version"
        return
    }

    if ($VersionBump -ne "none") {
        Run-Command -Label "Erhoehe Version per $VersionBump" -Command "npm version $VersionBump --no-git-tag-version"
    }
}

function Show-Status {
    Write-Info "Repository-Status"
    git status --short --branch
    Write-Host ""
    Write-Info "Aktuelle Version: $(Get-CurrentVersion)"
    Write-Host ""
    Write-Info "Letzter Commit"
    git log -1 --oneline
}

function Invoke-Add {
    if (-not (Test-HasChanges)) {
        Write-WarnLine "Keine Aenderungen zum Hinzufuegen gefunden."
        return
    }

    Run-Command -Label "Stelle Aenderungen zusammen" -Command "git add -A"
    Write-Info "Alle Aenderungen wurden gestaged."
}

function Invoke-Release {
    Set-ProjectVersion

    if (-not (Test-HasChanges)) {
        Write-WarnLine "Keine Aenderungen zum Committen gefunden."
        return
    }

    Invoke-Add

    $currentVersion = Get-CurrentVersion
    $effectiveCommitMessage = $CommitMessage

    if ([string]::IsNullOrWhiteSpace($effectiveCommitMessage)) {
        if ($VersionBump -ne "none" -or -not [string]::IsNullOrWhiteSpace($Version)) {
            $effectiveCommitMessage = "chore: release v$currentVersion"
        } else {
            throw "Bitte -CommitMessage angeben."
        }
    }

    $tempCommitFile = Join-Path $env:TEMP ("belegscanner-commit-" + [guid]::NewGuid().ToString() + ".txt")
    Set-Content -Path $tempCommitFile -Value $effectiveCommitMessage -Encoding UTF8

    try {
        $commitCommand = 'git commit -F "' + $tempCommitFile + '"'
        Run-Command -Label "Erstelle Commit" -Command $commitCommand
    }
    finally {
        if (Test-Path $tempCommitFile) {
            Remove-Item $tempCommitFile -Force
        }
    }

    if ($CreateTag) {
        Run-Command -Label "Erstelle Git-Tag v$currentVersion" -Command "git tag v$currentVersion"
    }

    if ($Push) {
        Run-Command -Label "Pushe Branch $Branch" -Command "git push $RemoteName $Branch"

        if ($CreateTag) {
            Run-Command -Label "Pushe Tag v$currentVersion" -Command "git push $RemoteName v$currentVersion"
        }
    }
}

function Invoke-Deploy {
    Ensure-Tool "ssh"
    Ensure-Value $ServerUser "ServerUser"
    Ensure-Value $ServerHost "ServerHost"
    Ensure-Value $ServerPath "ServerPath"

    $sshTarget = $ServerUser + "@" + $ServerHost
    $dirtyStatusCommand = "cd '$ServerPath' && git status --short"

    if (-not $DryRun) {
        Write-Info "Pruefe Server-Repository auf lokale Aenderungen"
        $dirtyStatusOutput = (& ssh $sshTarget $dirtyStatusCommand | Out-String).Trim()

        if ($LASTEXITCODE -ne 0) {
            throw "Server-Status konnte nicht geprueft werden."
        }

        if (-not [string]::IsNullOrWhiteSpace($dirtyStatusOutput)) {
            throw "Deploy abgebrochen: Das Repo auf dem Server enthaelt lokale Aenderungen:`n$dirtyStatusOutput"
        }
    }

    $remoteSteps = @()
    $remoteSteps += "set -e"
    $remoteSteps += "cd '$ServerPath'"
    $remoteSteps += "git fetch --tags $RemoteName"
    $remoteSteps += "git checkout $Branch"
    $remoteSteps += "git pull --ff-only $RemoteName $Branch"
    $remoteSteps += "docker compose -f $ComposeFile up -d --build"

    $prismaHelperPrefix = "docker run --rm --network belegscanner_default --env-file .env -e DATABASE_URL='postgresql://belegbox:belegbox@db:5432/belegbox' -v '${ServerPath}:/app' -w /app node:20-alpine sh -lc"
    $helperInstallCommand = "npm install >/tmp/belegscanner-npm-install.log 2>&1"

    if ($SchemaSyncMode -eq "push") {
        $remoteSteps += $prismaHelperPrefix + " '" + $helperInstallCommand + " && npx prisma db push'"
    }
    else {
        $remoteSteps += $prismaHelperPrefix + " '" + $helperInstallCommand + " && npx prisma migrate deploy'"
    }

    if ($RunSeed) {
        $remoteSteps += $prismaHelperPrefix + " '" + $helperInstallCommand + " && npx prisma db seed'"
    }

    $remoteCommand = [string]::Join(" && ", $remoteSteps)
    $sshCommand = 'ssh ' + $sshTarget + ' "' + $remoteCommand + '"'
    Run-Command -Label "Deploye auf $sshTarget" -Command $sshCommand

    Write-Info "Deployment abgeschlossen. Pruefe jetzt $AppUrl"
}

Ensure-Tool "git"
Ensure-Tool "npm"
$script:RepoRoot = Get-RepoRoot
Set-Location $script:RepoRoot

switch ($Action) {
    "status" {
        Show-Status
    }
    "add" {
        Invoke-Add
        Show-Status
    }
    "release" {
        Invoke-Release
        Show-Status
    }
    "deploy" {
        Invoke-Deploy
    }
    "release-and-deploy" {
        if (-not $Push) {
            throw "Fuer 'release-and-deploy' bitte zusaetzlich -Push setzen."
        }

        Invoke-Release
        Invoke-Deploy
        Show-Status
    }
}
