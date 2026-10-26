param(
  [string]$Destination = '',
  [string]$ProjectRef = 'jawcaedeynlbyntjolrg',
  [string]$R2Bucket = 'pomaaalodesk-property-images',
  [string]$R2Remote = '',
  [string]$AgencyJson = '',
  [switch]$SkipDatabase,
  [switch]$SkipR2
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not $Destination) {
  $Destination = Join-Path $projectRoot 'backups'
}
$Destination = [System.IO.Path]::GetFullPath($Destination)
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$runName = "pomaaalodesk-recovery-$stamp"
$runDirectory = Join-Path $Destination $runName
$sourceDirectory = Join-Path $runDirectory 'source'
$databaseDirectory = Join-Path $runDirectory 'supabase'
$r2Directory = Join-Path $runDirectory 'r2'

New-Item -ItemType Directory -Force -Path $sourceDirectory, $databaseDirectory, $r2Directory | Out-Null

function Invoke-Checked {
  param([string]$Program, [string[]]$Arguments)
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Program failed with exit code $LASTEXITCODE."
  }
}

function Save-CommandOutput {
  param([string]$Path, [scriptblock]$Command)
  $result = & $Command 2>&1 | Out-String
  Set-Content -LiteralPath $Path -Value $result -Encoding utf8
}

Write-Host "Creating PomaaaloDesk recovery package in $runDirectory"

# A Git bundle contains the complete commit history and can rebuild the
# repository even when GitHub is unavailable. The source ZIP is convenient for
# opening the current version without Git.
Invoke-Checked 'git' @('-C', $projectRoot, 'bundle', 'create', (Join-Path $sourceDirectory 'bookweb.bundle'), '--all')
Invoke-Checked 'git' @('-C', $projectRoot, 'archive', '--format=zip', "--output=$(Join-Path $sourceDirectory 'bookweb-source.zip')", 'HEAD')
Save-CommandOutput (Join-Path $sourceDirectory 'git-status.txt') { git -C $projectRoot status --short }
Save-CommandOutput (Join-Path $sourceDirectory 'git-remotes.txt') { git -C $projectRoot remote -v }
Save-CommandOutput (Join-Path $sourceDirectory 'git-head.txt') { git -C $projectRoot log -1 --format='%H%n%ci%n%s' }

$databaseStatus = 'skipped by command option'
if (-not $SkipDatabase) {
  Write-Host 'Supabase database password is required only for this export.'
  $securePassword = Read-Host 'Database password for Booking Manager Web 2' -AsSecureString
  $plainPassword = [System.Net.NetworkCredential]::new('', $securePassword).Password
  if (-not $plainPassword) { throw 'A database password is required for the Supabase dump.' }
  $previousPassword = $env:SUPABASE_DB_PASSWORD
  try {
    $env:SUPABASE_DB_PASSWORD = $plainPassword
    Invoke-Checked 'npx.cmd' @('supabase', 'db', 'dump', '--project-ref', $ProjectRef, '--file', (Join-Path $databaseDirectory 'schema.sql'))
    Invoke-Checked 'npx.cmd' @('supabase', 'db', 'dump', '--project-ref', $ProjectRef, '--data-only', '--use-copy', '--file', (Join-Path $databaseDirectory 'public-data.sql'))
    Invoke-Checked 'npx.cmd' @('supabase', 'db', 'dump', '--project-ref', $ProjectRef, '--role-only', '--file', (Join-Path $databaseDirectory 'roles.sql'))
    Invoke-Checked 'npx.cmd' @('supabase', 'db', 'dump', '--project-ref', $ProjectRef, '--schema', 'auth', '--data-only', '--use-copy', '--file', (Join-Path $databaseDirectory 'auth-data.sql'))
    Invoke-Checked 'npx.cmd' @('supabase', 'db', 'dump', '--project-ref', $ProjectRef, '--schema', 'storage', '--data-only', '--use-copy', '--file', (Join-Path $databaseDirectory 'storage-metadata.sql'))
    $databaseStatus = 'complete: schema, public data, roles, auth data, and storage metadata'
  }
  finally {
    $env:SUPABASE_DB_PASSWORD = $previousPassword
    $plainPassword = $null
    $securePassword = $null
  }
}
else {
  Set-Content -LiteralPath (Join-Path $databaseDirectory 'NOT-BACKED-UP.txt') -Encoding utf8 -Value 'Database export was skipped. Run again without -SkipDatabase for a complete recovery package.'
}

$r2Status = 'skipped by command option'
if (-not $SkipR2) {
  if (-not $R2Remote) {
    $r2Status = 'not captured: configure rclone and pass -R2Remote'
    Set-Content -LiteralPath (Join-Path $r2Directory 'NOT-BACKED-UP.txt') -Encoding utf8 -Value @"
R2 images were not downloaded because no rclone remote was supplied.
Configure an R2 remote once, then run this script with:
  -R2Remote pomaaalodesk-r2
See docs/DISASTER-RECOVERY.md.
"@
  }
  elseif (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    throw 'rclone is not installed. Install/configure it or use -SkipR2.'
  }
  else {
    Invoke-Checked 'rclone' @('copy', "${R2Remote}:$R2Bucket", (Join-Path $r2Directory $R2Bucket), '--checksum', '--metadata', '--create-empty-src-dirs')
    Save-CommandOutput (Join-Path $r2Directory 'r2-files.txt') { rclone lsl "${R2Remote}:$R2Bucket" }
    $r2Status = 'complete: all R2 objects downloaded'
  }
}
else {
  Set-Content -LiteralPath (Join-Path $r2Directory 'NOT-BACKED-UP.txt') -Encoding utf8 -Value 'R2 export was skipped. Run again with a configured -R2Remote for a complete recovery package.'
}

$agencyStatus = 'not supplied'
if ($AgencyJson) {
  $agencyPath = [System.IO.Path]::GetFullPath($AgencyJson)
  if (-not (Test-Path -LiteralPath $agencyPath -PathType Leaf)) { throw "Agency JSON backup was not found: $agencyPath" }
  Copy-Item -LiteralPath $agencyPath -Destination (Join-Path $runDirectory 'agency-backup.json')
  $agencyStatus = 'included'
}

$secretChecklist = @"
POMAAALODESK PRIVATE RECOVERY VALUES

Store the VALUES in a password manager. Do not put them in this ZIP or Git.

[ ] Supabase database password for project $ProjectRef
[ ] Supabase publishable key (frontend and Worker SUPABASE_PUBLISHABLE_KEY)
[ ] Supabase service-role key (used by the admin-user Edge Function)
[ ] Cloudflare account access / API token
[ ] R2 S3 Access Key ID and Secret Access Key for off-site image backup
[ ] GitHub account recovery codes or access token
[ ] Email provider / SMTP settings if custom email is enabled later

Public infrastructure names are recorded in recovery-manifest.json.
"@
Set-Content -LiteralPath (Join-Path $runDirectory 'PRIVATE-SECRETS-CHECKLIST.txt') -Value $secretChecklist -Encoding utf8

$manifest = [ordered]@{
  format = 'pomaaalodesk-disaster-recovery'
  version = 1
  created_at = (Get-Date).ToUniversalTime().ToString('o')
  source = [ordered]@{
    github = 'https://github.com/salemko72/bookweb.git'
    branch = 'main'
    commit = (git -C $projectRoot rev-parse HEAD).Trim()
    git_bundle = 'source/bookweb.bundle'
    source_zip = 'source/bookweb-source.zip'
  }
  supabase = [ordered]@{
    project_name = 'Booking Manager Web 2'
    project_ref = $ProjectRef
    url = "https://$ProjectRef.supabase.co"
    status = $databaseStatus
  }
  cloudflare = [ordered]@{
    account_id = '21db5c0516fc09fed9e4b49aed03f06d'
    pages_project = 'bookweb'
    production_url = 'https://bookweb.pages.dev'
    worker_name = 'pomaaalodesk-images'
    worker_url = 'https://pomaaalodesk-images.salemko.workers.dev'
    r2_bucket = $R2Bucket
    r2_status = $r2Status
  }
  agency_json = $agencyStatus
  secrets = 'values intentionally excluded; see PRIVATE-SECRETS-CHECKLIST.txt'
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runDirectory 'recovery-manifest.json') -Encoding utf8

Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\DISASTER-RECOVERY.md') -Destination (Join-Path $runDirectory 'RESTORE-INSTRUCTIONS.md')

$zipPath = Join-Path $Destination "$runName.zip"
Compress-Archive -LiteralPath $runDirectory -DestinationPath $zipPath -CompressionLevel Optimal
$hash = Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
"$($hash.Hash)  $([System.IO.Path]::GetFileName($zipPath))" | Set-Content -LiteralPath "$zipPath.sha256" -Encoding ascii

Write-Host ''
Write-Host 'Recovery package created:'
Write-Host "  $zipPath"
Write-Host "  $zipPath.sha256"
Write-Host "Database: $databaseStatus"
Write-Host "R2 images: $r2Status"
Write-Host 'Keep a second copy on a different drive or cloud provider.'
