#!/bin/bash

# ================================================================
# 🚀 SAP Strategic AI Platform - Automated Setup Script
# ================================================================
# このスクリプトは新しい環境での完全自動セットアップを実行します
# This script performs complete automated setup for new environments
# ================================================================

set -e  # Exit on any error

# Color definitions for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ================================================================
# Helper Functions
# ================================================================

print_header() {
    echo -e "${PURPLE}"
    echo "================================================================"
    echo "🚀 SAP Strategic AI Platform - Automated Setup"
    echo "================================================================"
    echo -e "${NC}"
}

print_step() {
    echo -e "${BLUE}[STEP] $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# ================================================================
# System Requirements Check
# ================================================================

check_requirements() {
    print_step "Checking system requirements..."
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node -v)
        print_success "Node.js found: $NODE_VERSION"
        
        # Check if version is >= 18
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 18 ]; then
            print_warning "Node.js version should be >= 18. Current: $NODE_VERSION"
        fi
    else
        print_error "Node.js not found! Please install Node.js 18+ from: https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm -v)
        print_success "npm found: $NPM_VERSION"
    else
        print_error "npm not found! Please install npm"
        exit 1
    fi
    
    # Check Git
    if command -v git >/dev/null 2>&1; then
        GIT_VERSION=$(git --version)
        print_success "Git found: $GIT_VERSION"
    else
        print_error "Git not found! Please install Git"
        exit 1
    fi
    
    # Check AWS CLI (optional)
    if command -v aws >/dev/null 2>&1; then
        AWS_VERSION=$(aws --version | cut -d' ' -f1)
        print_success "AWS CLI found: $AWS_VERSION"
    else
        print_warning "AWS CLI not found. CDK features will be limited."
        print_info "Install from: https://aws.amazon.com/cli/"
    fi
}

# ================================================================
# Environment Setup
# ================================================================

setup_environment() {
    print_step "Setting up environment configuration..."
    
    # Copy .env.example to .env if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_success "Created .env from .env.example"
            print_warning "⚠️  IMPORTANT: Please edit .env file with your actual values!"
            print_info "Required: Supabase URL, Supabase Key, AWS credentials"
        else
            print_error ".env.example not found!"
            exit 1
        fi
    else
        print_info ".env file already exists"
    fi
}

# ================================================================
# Dependencies Installation
# ================================================================

install_dependencies() {
    print_step "Installing project dependencies..."
    
    # Install main dependencies
    print_info "Installing frontend dependencies..."
    npm ci || npm install
    print_success "Frontend dependencies installed"
    
    # Install CDK dependencies if CDK exists
    if [ -d "cdk" ]; then
        print_info "Installing CDK dependencies..."
        cd cdk
        npm ci || npm install
        cd ..
        print_success "CDK dependencies installed"
    fi
    
    # Install global tools if needed
    print_info "Checking global tools..."
    
    # Check CDK CLI
    if ! command -v cdk >/dev/null 2>&1; then
        print_warning "CDK CLI not found. Installing globally..."
        npm install -g aws-cdk
        print_success "AWS CDK CLI installed globally"
    else
        print_success "AWS CDK CLI already installed"
    fi
}

# ================================================================
# Project Verification
# ================================================================

verify_setup() {
    print_step "Verifying setup..."
    
    # Check if we can build the project
    print_info "Testing frontend build..."
    if npm run build >/dev/null 2>&1; then
        print_success "Frontend build successful"
    else
        print_warning "Frontend build failed. Check your .env configuration"
    fi
    
    # Check CDK if available
    if [ -d "cdk" ] && command -v cdk >/dev/null 2>&1; then
        print_info "Testing CDK synthesis..."
        cd cdk
        if npx cdk synth >/dev/null 2>&1; then
            print_success "CDK synthesis successful"
        else
            print_warning "CDK synthesis failed. Check AWS credentials"
        fi
        cd ..
    fi
}

# ================================================================
# Setup Summary
# ================================================================

print_summary() {
    print_step "Setup Summary"
    
    echo -e "${GREEN}"
    echo "================================================================"
    echo "🎉 Setup Complete! "
    echo "================================================================"
    echo -e "${NC}"
    
    echo "📋 Next Steps:"
    echo "1. Edit .env file with your actual credentials:"
    echo "   - Supabase URL and API Key"
    echo "   - AWS Access Keys"
    echo "   - Other service credentials"
    echo ""
    echo "2. Start development server:"
    echo "   npm run dev"
    echo ""
    echo "3. Build for production:"
    echo "   npm run build"
    echo ""
    echo "4. Deploy infrastructure (optional):"
    echo "   cd cdk && npx cdk deploy"
    echo ""
    echo "📚 Documentation:"
    echo "- README.md - Project overview"
    echo "- DEPLOY_SETUP.md - Deployment guide"
    echo "- GITHUB_SECRETS_SETUP.md - CI/CD setup"
    echo ""
    echo "🌍 Production URL:"
    echo "https://main.d2eou43hdrzhv1.amplifyapp.com"
    echo ""
    print_success "SAP Strategic AI Platform setup completed successfully!"
}

# ================================================================
# Main Execution
# ================================================================

main() {
    print_header
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found! Please run this script from the project root directory."
        exit 1
    fi
    
    check_requirements
    setup_environment
    install_dependencies
    verify_setup
    print_summary
}

# Run main function
main "$@"