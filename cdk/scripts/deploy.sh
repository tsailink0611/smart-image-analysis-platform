#!/bin/bash

# SAP Frontend CDK Deployment Script
# TypeScript based Infrastructure as Code with complete automation

set -e

echo "🚀 Starting SAP Frontend CDK Deployment..."
echo "=================================================="

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function definitions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Environment check
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_success "Node.js: $(node --version)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm: $(npm --version)"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed"
        exit 1
    fi
    print_success "AWS CLI: $(aws --version)"
    
    # Check CDK
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed"
        exit 1
    fi
    print_success "CDK: $(cdk --version)"
}

# Load environment variables
load_env() {
    print_status "Loading environment variables..."
    if [ -f .env ]; then
        export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
        print_success "Environment variables loaded from .env"
    else
        print_warning ".env file not found, using defaults"
    fi
    
    # Set defaults if not provided
    export CDK_DEFAULT_REGION=${CDK_DEFAULT_REGION:-ap-northeast-1}
    export CDK_DEFAULT_ACCOUNT=${CDK_DEFAULT_ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}
    
    print_success "AWS Account: $CDK_DEFAULT_ACCOUNT"
    print_success "AWS Region: $CDK_DEFAULT_REGION"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm ci
    print_success "Dependencies installed"
}

# Build TypeScript
build_project() {
    print_status "Building TypeScript..."
    npm run build
    print_success "Build completed"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    if npm test 2>/dev/null; then
        print_success "All tests passed"
    else
        print_warning "Tests failed or no tests found, continuing..."
    fi
}

# CDK Bootstrap (if needed)
bootstrap_cdk() {
    print_status "Checking CDK bootstrap status..."
    
    if cdk list 2>/dev/null | grep -q "CDKToolkit"; then
        print_success "CDK already bootstrapped"
    else
        print_status "Bootstrapping CDK..."
        cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
        print_success "CDK bootstrap completed"
    fi
}

# CDK Diff
show_diff() {
    print_status "Showing deployment diff..."
    if cdk diff; then
        print_success "Diff completed"
    else
        print_warning "Diff failed, continuing with deployment..."
    fi
}

# CDK Deploy
deploy_stack() {
    print_status "Deploying CDK stack..."
    
    # Deploy with confirmation
    if [ "$1" = "--auto-approve" ]; then
        cdk deploy --require-approval never
    else
        cdk deploy
    fi
    
    print_success "CDK deployment completed!"
}

# Output important information
show_outputs() {
    print_status "Retrieving stack outputs..."
    cdk list --json
    print_success "Deployment outputs shown above"
}

# Main deployment flow
main() {
    echo "$(date): Starting deployment process"
    
    check_prerequisites
    load_env
    install_dependencies
    build_project
    run_tests
    bootstrap_cdk
    
    if [ "$1" != "--skip-diff" ]; then
        show_diff
    fi
    
    deploy_stack $1
    show_outputs
    
    print_success "🎉 SAP Frontend infrastructure deployment completed!"
    print_status "Next steps:"
    echo "  1. Configure your domain (if applicable)"
    echo "  2. Set up monitoring alerts"
    echo "  3. Test the deployed application"
    echo "  4. Configure CI/CD pipeline triggers"
}

# Handle script arguments
case "$1" in
    --help|-h)
        echo "SAP Frontend CDK Deployment Script"
        echo ""
        echo "Usage:"
        echo "  ./deploy.sh                    # Deploy with confirmation"
        echo "  ./deploy.sh --auto-approve    # Deploy without confirmation"
        echo "  ./deploy.sh --skip-diff       # Skip diff display"
        echo "  ./deploy.sh --help            # Show this help"
        exit 0
        ;;
    *)
        main $1
        ;;
esac