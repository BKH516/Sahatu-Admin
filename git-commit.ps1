$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Get the script directory (project root)
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Change to project directory
Set-Location $projectPath

# Check if .git exists, if not initialize
if (-not (Test-Path .git)) {
    Write-Host "Initializing git repository..."
    git init
}

# Check git status
Write-Host "Checking git status..."
git status --short

# Add all files
Write-Host "Adding all files..."
git add .

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    Write-Host "Committing changes..."
    git commit -m "Update project files"
    
    # Check if remote exists
    $remote = git remote -v
    if ($remote) {
        Write-Host "Remote repository found:"
        $remote
        Write-Host "`nTo push changes, run: git push"
    } else {
        Write-Host "No remote repository configured."
        Write-Host "To add a remote, run: git remote add origin <repository-url>"
    }
} else {
    Write-Host "No changes to commit."
}





