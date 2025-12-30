# Fresh Market Deployment Script
# This script will help you deploy your app to Netlify

Write-Host "========================================" -ForegroundColor Green
Write-Host "Fresh Market Deployment Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js is installed: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "✗ Node.js is NOT installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "Download the LTS version and run the installer." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""

# Check if Git is installed
Write-Host "Checking Git installation..." -ForegroundColor Cyan
try {
    $gitVersion = git --version
    Write-Host "✓ Git is installed: $gitVersion" -ForegroundColor Green
}
catch {
    Write-Host "✗ Git is NOT installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Download and run the installer with default options." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Installing Dependencies..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""
Write-Host "✓ Dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# Test build
Write-Host "========================================" -ForegroundColor Green
Write-Host "Testing Build..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host ""
Write-Host "✓ Build successful!" -ForegroundColor Green
Write-Host ""

# Initialize Git
Write-Host "========================================" -ForegroundColor Green
Write-Host "Initializing Git Repository..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

if (Test-Path ".git") {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
}
else {
    git init
    Write-Host "✓ Git repository initialized" -ForegroundColor Green
}

Write-Host ""

# Create initial commit
Write-Host "Creating initial commit..." -ForegroundColor Cyan
git add .
git commit -m "Initial commit - Fresh Market pre-order app"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "NEXT STEPS" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Create a GitHub repository:" -ForegroundColor Yellow
Write-Host "   - Go to: https://github.com/new" -ForegroundColor White
Write-Host "   - Name: fresh-market-preorder" -ForegroundColor White
Write-Host "   - Set to PUBLIC" -ForegroundColor White
Write-Host "   - DO NOT initialize with README" -ForegroundColor White
Write-Host ""
Write-Host "2. After creating the repo, copy the HTTPS URL (it looks like:)" -ForegroundColor Yellow
Write-Host "   https://github.com/YOUR-USERNAME/fresh-market-preorder.git" -ForegroundColor White
Write-Host ""
Write-Host "3. Then run these commands:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   git remote add origin YOUR-REPO-URL" -ForegroundColor Cyan
Write-Host "   git push -u origin master" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Go to Netlify:" -ForegroundColor Yellow
Write-Host "   - Open: https://app.netlify.com" -ForegroundColor White
Write-Host "   - Sign up with GitHub" -ForegroundColor White
Write-Host "   - Click 'New site from Git'" -ForegroundColor White
Write-Host "   - Select your repository" -ForegroundColor White
Write-Host "   - Build command: npm run build" -ForegroundColor White
Write-Host "   - Publish directory: dist" -ForegroundColor White
Write-Host ""
Write-Host "5. Add these Environment Variables in Netlify:" -ForegroundColor Yellow
Write-Host "   VITE_SUPABASE_URL = https://gkxiujmyfsdyxnwhgyzc.supabase.co" -ForegroundColor White
Write-Host "   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGl1am15ZnNkeXhud2hneXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzU3MzUsImV4cCI6MjA4MjM1MTczNX0.oNv2crqvx94abVYFrNhnlQ_ACIdBe1UxMkIDHeBeH7U" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Open GitHub in browser
Write-Host "Opening GitHub in browser..." -ForegroundColor Cyan
Start-Process "https://github.com/new"

Write-Host ""
Read-Host "Press Enter when done to exit"
