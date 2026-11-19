# Apply TrackSphere SQL migrations to the running tracksphere-db container.
# Usage (from TrackSphere/):  .\database\setup-db.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Write-Host 'Waiting for tracksphere-db...'
docker exec tracksphere-db pg_isready -U tracksphere -d tracksphere | Out-Host

Write-Host 'Applying migrate_3_5.sql (safe if already applied)...'
Get-Content "$root\database\migrate_3_5.sql" -Raw | docker exec -i tracksphere-db psql -U tracksphere -d tracksphere

Write-Host 'Applying migrate_4_0.sql...'
Get-Content "$root\database\migrate_4_0.sql" -Raw | docker exec -i tracksphere-db psql -U tracksphere -d tracksphere

Write-Host 'Done. Demo users: admin@ / staff@ / approver@ tracksphere.demo  password Demo@123'
