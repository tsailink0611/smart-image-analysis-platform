# ================================================================
# 🚀 SAP Strategic AI Platform - Windows PowerShell Setup Script
# ================================================================
# Windows環境での完全自動セットアップスクリプト
# Complete automated setup script for Windows environments
# ================================================================

# Set execution policy for current session
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process -Force

# Color functions
function Write-StepHeader {
    param([string]$Message)
    Write-Host "================================================================" -ForegroundColor Magenta
    Write-Host "🚀 $Message" -ForegroundColor Magenta
    Write-Host "================================================================" -ForegroundColor Magenta
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# ================================================================
# Main Setup Function
# ================================================================

function Main {
    Write-StepHeader "SAP Strategic AI Platform - Windows Setup"
    
    # Check if we're in the right directory
    if (-not (Test-Path "package.json")) {
        Write-Error "package.json not found! Please run this script from the project root directory."
        exit 1
    }
    
    # Check system requirements
    Write-Step "Checking system requirements..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "Node.js found: $nodeVersion"
        
        # Check version
        $majorVersion = [int]($nodeVersion -replace 'v', '' -split '\.')[0]
        if ($majorVersion -lt 18) {
            Write-Warning "Node.js version should be >= 18. Current: $nodeVersion"
        }
    } catch {
        Write-Error "Node.js not found! Please install Node.js 18+ from: https://nodejs.org/"
        exit 1
    }
    
    # Check npm
    try {
        $npmVersion = npm --version
        Write-Success "npm found: $npmVersion"
    } catch {
        Write-Error "npm not found! Please install npm"
        exit 1
    }
    
    # Check Git
    try {
        $gitVersion = git --version
        Write-Success "Git found: $gitVersion"
    } catch {
        Write-Error "Git not found! Please install Git from: https://git-scm.com/"
        exit 1
    }
    
    # Check AWS CLI (optional)
    try {
        $awsVersion = aws --version
        Write-Success "AWS CLI found: $awsVersion"
    } catch {
        Write-Warning "AWS CLI not found. CDK features will be limited."
        Write-Info "Install from: https://aws.amazon.com/cli/"
    }
    
    # Setup environment
    Write-Step "Setting up environment configuration..."
    
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Success "Created .env from .env.example"
            Write-Warning "⚠️  IMPORTANT: Please edit .env file with your actual values!"
            Write-Info "Required: Supabase URL, Supabase Key, AWS credentials"
        } else {
            Write-Error ".env.example not found!"
            exit 1
        }
    } else {
        Write-Info ".env file already exists"
    }
    
    # Install dependencies
    Write-Step "Installing project dependencies..."
    
    Write-Info "Installing frontend dependencies..."
    try {
        npm ci
        Write-Success "Frontend dependencies installed"
    } catch {
        Write-Info "npm ci failed, trying npm install..."
        npm install
        Write-Success "Frontend dependencies installed"
    }
    
    # Install CDK dependencies
    if (Test-Path "cdk") {
        Write-Info "Installing CDK dependencies..."
        Push-Location "cdk"
        try {
            npm ci
            Write-Success "CDK dependencies installed"
        } catch {
            npm install
            Write-Success "CDK dependencies installed"
        }
        Pop-Location
    }
    
    # Check CDK CLI
    try {
        $cdkVersion = cdk --version
        Write-Success "AWS CDK CLI found: $cdkVersion"
    } catch {
        Write-Warning "CDK CLI not found. Installing globally..."
        npm install -g aws-cdk
        Write-Success "AWS CDK CLI installed globally"
    }
    
    # Verify setup
    Write-Step "Verifying setup..."
    
    Write-Info "Testing frontend build..."
    try {
        npm run build | Out-Null
        Write-Success "Frontend build successful"
    } catch {
        Write-Warning "Frontend build failed. Check your .env configuration"
    }
    
    # Test CDK
    if ((Test-Path "cdk") -and (Get-Command cdk -ErrorAction SilentlyContinue)) {
        Write-Info "Testing CDK synthesis..."
        Push-Location "cdk"
        try {
            npx cdk synth | Out-Null
            Write-Success "CDK synthesis successful"
        } catch {
            Write-Warning "CDK synthesis failed. Check AWS credentials"
        }
        Pop-Location
    }
    
    # Print summary
    Write-StepHeader "Setup Complete!"
    
    Write-Host "📋 Next Steps:" -ForegroundColor Green
    Write-Host "1. Edit .env file with your actual credentials:"
    Write-Host "   - Supabase URL and API Key"
    Write-Host "   - AWS Access Keys"
    Write-Host "   - Other service credentials"
    Write-Host ""
    Write-Host "2. Start development server:"
    Write-Host "   npm run dev"
    Write-Host ""
    Write-Host "3. Build for production:"
    Write-Host "   npm run build"
    Write-Host ""
    Write-Host "4. Deploy infrastructure (optional):"
    Write-Host "   cd cdk && npx cdk deploy"
    Write-Host ""
    Write-Host "📚 Documentation:"
    Write-Host "- README.md - Project overview"
    Write-Host "- DEPLOY_SETUP.md - Deployment guide"  
    Write-Host "- GITHUB_SECRETS_SETUP.md - CI/CD setup"
    Write-Host ""
    Write-Host "🌍 Production URL:"
    Write-Host "https://main.d2eou43hdrzhv1.amplifyapp.com"
    Write-Host ""
    Write-Success "SAP Strategic AI Platform setup completed successfully!"
}

# Run main function
Main