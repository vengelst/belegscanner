Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseScript = Join-Path $scriptRoot "release.ps1"

if (-not (Test-Path $releaseScript)) {
    throw "release.ps1 wurde nicht gefunden: $releaseScript"
}

function Pause-Menu {
    Write-Host ""
    [void](Read-Host "Enter druecken zum Fortfahren")
}

function Ask-YesNo {
    param(
        [string]$Prompt,
        [bool]$Default = $false
    )

    $suffix = if ($Default) { "[J/n]" } else { "[j/N]" }
    $answer = Read-Host "$Prompt $suffix"

    if ([string]::IsNullOrWhiteSpace($answer)) {
        return $Default
    }

    return $answer.Trim().ToLower() -in @("j", "ja", "y", "yes")
}

function Run-ReleaseScript {
    param([string[]]$Arguments)

    & powershell -ExecutionPolicy Bypass -File $releaseScript @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "release.ps1 ist mit Exit-Code $LASTEXITCODE fehlgeschlagen."
    }
}

function Show-Header {
    Clear-Host
    Write-Host "Belegscanner Deployment-Menue" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    Write-Host "1) Status anzeigen"
    Write-Host "2) git add -A"
    Write-Host "3) Commit und Push"
    Write-Host "4) Neue Version, Commit, Tag und Push"
    Write-Host "5) Produktion deployen"
    Write-Host "6) Neue Version und Produktion deployen"
    Write-Host "0) Beenden"
    Write-Host ""
}

function Invoke-Status {
    Run-ReleaseScript @("-Action", "status")
}

function Invoke-Add {
    Run-ReleaseScript @("-Action", "add")
}

function Invoke-CommitPush {
    $commitMessage = Read-Host "Commit-Message"
    if ([string]::IsNullOrWhiteSpace($commitMessage)) {
        throw "Commit-Message darf nicht leer sein."
    }

    Run-ReleaseScript @(
        "-Action", "release",
        "-CommitMessage", $commitMessage,
        "-Push"
    )
}

function Ask-VersionMode {
    Write-Host ""
    Write-Host "Versionsmodus:"
    Write-Host "1) patch"
    Write-Host "2) minor"
    Write-Host "3) major"
    Write-Host "4) manuelle Version"

    $choice = Read-Host "Auswahl"
    switch ($choice) {
        "1" { return @{ Mode = "patch"; Version = $null } }
        "2" { return @{ Mode = "minor"; Version = $null } }
        "3" { return @{ Mode = "major"; Version = $null } }
        "4" {
            $manualVersion = Read-Host "Version (z.B. 1.3.0)"
            if ([string]::IsNullOrWhiteSpace($manualVersion)) {
                throw "Version darf nicht leer sein."
            }

            return @{ Mode = "none"; Version = $manualVersion }
        }
        default {
            throw "Ungueltige Auswahl fuer den Versionsmodus."
        }
    }
}

function Invoke-VersionRelease {
    $versionSelection = Ask-VersionMode
    $commitMessage = Read-Host "Commit-Message (leer = Standard-Release-Message)"

    $arguments = @(
        "-Action", "release",
        "-VersionBump", $versionSelection.Mode,
        "-Push",
        "-CreateTag"
    )

    if ($versionSelection.Version) {
        $arguments += @("-Version", $versionSelection.Version)
    }

    if (-not [string]::IsNullOrWhiteSpace($commitMessage)) {
        $arguments += @("-CommitMessage", $commitMessage)
    }

    Run-ReleaseScript $arguments
}

function Ask-DeployArguments {
    $runSeed = Ask-YesNo -Prompt "Seed auf dem Server ausfuehren?" -Default $false

    Write-Host ""
    Write-Host "Schema-Sync fuer Deploy:"
    Write-Host "1) migrate deploy (Standard)"
    Write-Host "2) prisma db push (nur fuer Initial-Setup / Ausnahmefaelle)"

    $schemaChoice = Read-Host "Auswahl"
    $schemaSyncMode = switch ($schemaChoice) {
        "1" { "migrate" }
        "2" { "push" }
        default { throw "Ungueltige Auswahl fuer den Schema-Sync." }
    }

    $arguments = @(
        "-Action", "deploy",
        "-ServerUser", "root",
        "-ServerHost", "vivahome.de",
        "-ServerPath", "/opt/belegscanner",
        "-ComposeFile", "docker-compose.prod.yml",
        "-SchemaSyncMode", $schemaSyncMode
    )

    if ($runSeed) {
        $arguments += "-RunSeed"
    }

    return $arguments
}

function Invoke-DeployOnly {
    $arguments = Ask-DeployArguments
    Run-ReleaseScript $arguments
}

function Invoke-ReleaseAndDeploy {
    $versionSelection = Ask-VersionMode
    $commitMessage = Read-Host "Commit-Message (leer = Standard-Release-Message)"
    $deployArguments = Ask-DeployArguments

    $arguments = @(
        "-Action", "release-and-deploy",
        "-VersionBump", $versionSelection.Mode,
        "-Push",
        "-CreateTag",
        "-ServerUser", "root",
        "-ServerHost", "vivahome.de",
        "-ServerPath", "/opt/belegscanner",
        "-ComposeFile", "docker-compose.prod.yml"
    )

    if ($versionSelection.Version) {
        $arguments += @("-Version", $versionSelection.Version)
    }

    if (-not [string]::IsNullOrWhiteSpace($commitMessage)) {
        $arguments += @("-CommitMessage", $commitMessage)
    }

    $schemaIndex = [Array]::IndexOf($deployArguments, "-SchemaSyncMode")
    if ($schemaIndex -ge 0 -and $schemaIndex + 1 -lt $deployArguments.Count) {
        $arguments += @("-SchemaSyncMode", $deployArguments[$schemaIndex + 1])
    }

    if ($deployArguments -contains "-RunSeed") {
        $arguments += "-RunSeed"
    }

    Run-ReleaseScript $arguments
}

while ($true) {
    try {
        Show-Header
        $selection = Read-Host "Bitte waehlen"

        switch ($selection) {
            "1" { Invoke-Status; Pause-Menu }
            "2" { Invoke-Add; Pause-Menu }
            "3" { Invoke-CommitPush; Pause-Menu }
            "4" { Invoke-VersionRelease; Pause-Menu }
            "5" { Invoke-DeployOnly; Pause-Menu }
            "6" { Invoke-ReleaseAndDeploy; Pause-Menu }
            "0" { break }
            default {
                Write-Host "Ungueltige Auswahl." -ForegroundColor Yellow
                Pause-Menu
            }
        }
    }
    catch {
        Write-Host ""
        Write-Host ("Fehler: " + $_.Exception.Message) -ForegroundColor Red
        Pause-Menu
    }
}
