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

function Assert-ServerEnvValue {
    param(
        [string]$SshTarget,
        [string]$ServerPath,
        [string]$VariableName,
        [string]$ErrorMessage
    )

    $checkCommand = "cd '$ServerPath' && if [ ! -f .env ]; then echo ENV_FILE_MISSING; elif grep -Eq '^${VariableName}=.+$' .env; then echo OK; else echo MISSING; fi"
    $checkResult = (& ssh $SshTarget $checkCommand | Out-String).Trim()

    if ($LASTEXITCODE -ne 0) {
        throw "Server-Konfiguration konnte nicht geprueft werden."
    }

    if ($checkResult -eq "ENV_FILE_MISSING") {
        throw "Deploy abgebrochen: $ServerPath/.env wurde auf dem Server nicht gefunden."
    }

    if ($checkResult -ne "OK") {
        throw "Deploy abgebrochen: $ErrorMessage"
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

function ConvertTo-SemVersion {
    param(
        [string]$Value,
        [string]$Name = "Version"
    )

    try {
        return [version]$Value
    }
    catch {
        throw "$Name ist keine gueltige SemVer-Version im Format X.Y.Z: $Value"
    }
}

function Get-LatestReleaseTag {
    $tags = git tag --list "v*"
    if ($LASTEXITCODE -ne 0) {
        throw "Git-Tags konnten nicht gelesen werden."
    }

    $releaseTags = @()

    foreach ($tag in $tags) {
        $trimmedTag = [string]$tag
        if ($trimmedTag -match '^v(\d+\.\d+\.\d+)$') {
            $releaseTags += [pscustomobject]@{
                Tag = $trimmedTag
                Version = ConvertTo-SemVersion -Value $Matches[1] -Name "Git-Tag"
            }
        }
    }

    if ($releaseTags.Count -eq 0) {
        return $null
    }

    return $releaseTags | Sort-Object Version -Descending | Select-Object -First 1
}

function Get-NextVersion {
    param(
        [version]$BaseVersion,
        [ValidateSet("patch", "minor", "major")]
        [string]$Bump
    )

    switch ($Bump) {
        "patch" {
            return [version]::new($BaseVersion.Major, $BaseVersion.Minor, $BaseVersion.Build + 1)
        }
        "minor" {
            return [version]::new($BaseVersion.Major, $BaseVersion.Minor + 1, 0)
        }
        "major" {
            return [version]::new($BaseVersion.Major + 1, 0, 0)
        }
    }
}

function Assert-TagDoesNotExist {
    param([string]$TagName)

    $existingTag = (git tag --list $TagName | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "Git-Tag $TagName konnte nicht geprueft werden."
    }

    if (-not [string]::IsNullOrWhiteSpace($existingTag)) {
        throw "Release abgebrochen: Git-Tag $TagName existiert bereits."
    }
}

function Resolve-TargetVersion {
    if (-not [string]::IsNullOrWhiteSpace($Version) -and $VersionBump -ne "none") {
        throw "Bitte entweder -Version oder -VersionBump verwenden, nicht beides."
    }

    if ([string]::IsNullOrWhiteSpace($Version) -and $VersionBump -eq "none") {
        return $null
    }

    $packageVersion = ConvertTo-SemVersion -Value (Get-CurrentVersion) -Name "package.json-Version"
    $latestReleaseTag = Get-LatestReleaseTag
    $baseVersion = $packageVersion

    if ($null -ne $latestReleaseTag -and $packageVersion -lt $latestReleaseTag.Version) {
        Write-WarnLine "package.json-Version $packageVersion liegt hinter dem letzten Release-Tag $($latestReleaseTag.Tag). Nutze $($latestReleaseTag.Tag) als Basis."
        $baseVersion = $latestReleaseTag.Version
    }

    if (-not [string]::IsNullOrWhiteSpace($Version)) {
        $targetVersion = ConvertTo-SemVersion -Value $Version -Name "Version"
    }
    else {
        $targetVersion = Get-NextVersion -BaseVersion $baseVersion -Bump $VersionBump
    }

    if ($null -ne $latestReleaseTag -and $targetVersion -le $latestReleaseTag.Version) {
        throw "Release abgebrochen: Zielversion v$targetVersion ist nicht groesser als der letzte Release-Tag $($latestReleaseTag.Tag)."
    }

    $targetVersionString = $targetVersion.ToString()
    Assert-TagDoesNotExist -TagName "v$targetVersionString"

    return $targetVersionString
}

function Test-HasChanges {
    $status = git status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "git status konnte nicht ausgeführt werden."
    }

    return -not [string]::IsNullOrWhiteSpace(($status | Out-String).Trim())
}

function Set-ProjectVersion {
    $targetVersion = Resolve-TargetVersion
    if (-not [string]::IsNullOrWhiteSpace($targetVersion)) {
        Run-Command -Label "Setze Release-Version auf $targetVersion" -Command "npm version $targetVersion --no-git-tag-version"
        return $targetVersion
    }

    return $null
}

function Show-Status {
    $latestReleaseTag = Get-LatestReleaseTag
    Write-Info "Repository-Status"
    git status --short --branch
    Write-Host ""
    Write-Info "Aktuelle Version: $(Get-CurrentVersion)"
    if ($null -ne $latestReleaseTag) {
        Write-Host ""
        Write-Info "Letzter Release-Tag: $($latestReleaseTag.Tag)"
    }
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
    $targetVersion = Set-ProjectVersion

    if (-not (Test-HasChanges)) {
        Write-WarnLine "Keine Aenderungen zum Committen gefunden."
        return
    }

    Invoke-Add

    $currentVersion = if (-not [string]::IsNullOrWhiteSpace($targetVersion)) { $targetVersion } else { Get-CurrentVersion }
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
        Write-Info "Pruefe benoetigte Server-Konfiguration"
        Assert-ServerEnvValue `
            -SshTarget $sshTarget `
            -ServerPath $ServerPath `
            -VariableName "OPENAI_API_KEY" `
            -ErrorMessage "OPENAI_API_KEY fehlt oder ist leer in $ServerPath/.env. Bitte zuerst den OpenAI-Schluessel auf dem Server setzen."

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
    $remoteSteps += "docker compose -f $ComposeFile up -d --build --remove-orphans"

    # Prisma helper: copy only the needed files into a temp dir inside the container
    # so that npm ci never touches the server repo. The server path is mounted read-only.
    $prismaHelperSetup = @(
        "mkdir -p /tmp/prisma-work",
        "cp /repo/package.json /repo/package-lock.json /tmp/prisma-work/",
        "if [ -f /repo/prisma.config.ts ]; then cp /repo/prisma.config.ts /tmp/prisma-work/; fi",
        "cp -r /repo/prisma /tmp/prisma-work/prisma",
        "cd /tmp/prisma-work",
        "npm ci --ignore-scripts >/dev/null 2>&1",
        "npx prisma generate"
    ) -join " && "
    $prismaHelperPrefix = "docker run --rm --network belegscanner_default --env-file .env -e DATABASE_URL='postgresql://belegbox:belegbox@db:5432/belegbox' -v '${ServerPath}:/repo:ro' -w /tmp/prisma-work node:20-alpine sh -lc"

    if ($SchemaSyncMode -eq "push") {
        $remoteSteps += $prismaHelperPrefix + " '" + $prismaHelperSetup + " && npx prisma db push'"
    }
    else {
        $remoteSteps += $prismaHelperPrefix + " '" + $prismaHelperSetup + " && npx prisma migrate deploy'"
    }

    if ($RunSeed) {
        $remoteSteps += $prismaHelperPrefix + " '" + $prismaHelperSetup + " && npx prisma db seed'"
    }

    $remoteCommand = [string]::Join(" && ", $remoteSteps)
    $sshCommand = 'ssh ' + $sshTarget + ' "' + $remoteCommand + '"'
    Run-Command -Label "Deploye auf $sshTarget" -Command $sshCommand

    # Post-deploy: verify server repo is still clean
    Write-Info "Pruefe Server-Repository nach Deploy auf Sauberkeit"
    if (-not $DryRun) {
        $postDeployStatus = (& ssh $sshTarget $dirtyStatusCommand | Out-String).Trim()
        if (-not [string]::IsNullOrWhiteSpace($postDeployStatus)) {
            Write-WarnLine "Server-Repo ist nach Deploy dirty:`n$postDeployStatus"
        } else {
            Write-Info "Server-Repo ist sauber."
        }
    }

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
