#!/usr/bin/env node

/**
 * ================================================================
 * 🚀 SAP Strategic AI Platform - Cross-Platform Setup Script
 * ================================================================
 * This script provides automated setup for any platform
 * クロスプラットフォーム対応の自動セットアップスクリプト
 * ================================================================
 */

import { execSync, spawn } from 'child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs';
import { platform } from 'os';
import path from 'path';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Helper functions
const log = {
    header: (msg) => console.log(`${colors.magenta}================================================================${colors.reset}`),
    step: (msg) => console.log(`${colors.blue}[STEP] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
};

/**
 * Check if we're in the correct project directory
 */
function checkProjectDirectory() {
    if (!existsSync('package.json')) {
        log.error('package.json not found! Please run this script from the project root directory.');
        process.exit(1);
    }
    
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    if (packageJson.name !== 'sap-project-frontend') {
        log.warning('Project name mismatch. Make sure you\'re in the SAP Strategic AI Platform directory.');
    }
}

/**
 * Check system requirements
 */
function checkRequirements() {
    log.step('Checking system requirements...');
    
    // Check Node.js version
    try {
        const nodeVersion = process.version;
        log.success(`Node.js found: ${nodeVersion}`);
        
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        if (majorVersion < 18) {
            log.warning(`Node.js version should be >= 18. Current: ${nodeVersion}`);
        }
    } catch (error) {
        log.error('Node.js version check failed');
        process.exit(1);
    }
    
    // Check npm
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
        log.success(`npm found: ${npmVersion}`);
    } catch (error) {
        log.error('npm not found! Please install npm');
        process.exit(1);
    }
    
    // Check Git
    try {
        const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
        log.success(`Git found: ${gitVersion}`);
    } catch (error) {
        log.error('Git not found! Please install Git');
        process.exit(1);
    }
    
    // Check AWS CLI (optional)
    try {
        const awsVersion = execSync('aws --version', { encoding: 'utf-8' }).trim().split(' ')[0];
        log.success(`AWS CLI found: ${awsVersion}`);
    } catch (error) {
        log.warning('AWS CLI not found. CDK features will be limited.');
        log.info('Install from: https://aws.amazon.com/cli/');
    }
}

/**
 * Setup environment variables
 */
function setupEnvironment() {
    log.step('Setting up environment configuration...');
    
    if (!existsSync('.env')) {
        if (existsSync('.env.example')) {
            copyFileSync('.env.example', '.env');
            log.success('Created .env from .env.example');
            log.warning('⚠️  IMPORTANT: Please edit .env file with your actual values!');
            log.info('Required: Supabase URL, Supabase Key, AWS credentials');
        } else {
            log.error('.env.example not found!');
            process.exit(1);
        }
    } else {
        log.info('.env file already exists');
    }
}

/**
 * Install dependencies
 */
function installDependencies() {
    log.step('Installing project dependencies...');
    
    // Install main dependencies
    log.info('Installing frontend dependencies...');
    try {
        execSync('npm ci', { stdio: 'inherit' });
        log.success('Frontend dependencies installed');
    } catch (error) {
        log.info('npm ci failed, trying npm install...');
        execSync('npm install', { stdio: 'inherit' });
        log.success('Frontend dependencies installed');
    }
    
    // Install CDK dependencies if CDK exists
    if (existsSync('cdk')) {
        log.info('Installing CDK dependencies...');
        process.chdir('cdk');
        try {
            execSync('npm ci', { stdio: 'inherit' });
            log.success('CDK dependencies installed');
        } catch (error) {
            execSync('npm install', { stdio: 'inherit' });
            log.success('CDK dependencies installed');
        }
        process.chdir('..');
    }
    
    // Check CDK CLI
    try {
        const cdkVersion = execSync('cdk --version', { encoding: 'utf-8' }).trim();
        log.success(`AWS CDK CLI found: ${cdkVersion}`);
    } catch (error) {
        log.warning('CDK CLI not found. Installing globally...');
        execSync('npm install -g aws-cdk', { stdio: 'inherit' });
        log.success('AWS CDK CLI installed globally');
    }
}

/**
 * Verify setup
 */
function verifySetup() {
    log.step('Verifying setup...');
    
    // Test frontend build
    log.info('Testing frontend build...');
    try {
        execSync('npm run build', { stdio: 'pipe' });
        log.success('Frontend build successful');
    } catch (error) {
        log.warning('Frontend build failed. Check your .env configuration');
    }
    
    // Test CDK if available
    if (existsSync('cdk')) {
        log.info('Testing CDK synthesis...');
        process.chdir('cdk');
        try {
            execSync('npx cdk synth', { stdio: 'pipe' });
            log.success('CDK synthesis successful');
        } catch (error) {
            log.warning('CDK synthesis failed. Check AWS credentials');
        }
        process.chdir('..');
    }
}

/**
 * Print setup summary
 */
function printSummary() {
    log.step('Setup Summary');
    
    console.log(`${colors.green}`);
    console.log('================================================================');
    console.log('🎉 Setup Complete!');
    console.log('================================================================');
    console.log(`${colors.reset}`);
    
    console.log('📋 Next Steps:');
    console.log('1. Edit .env file with your actual credentials:');
    console.log('   - Supabase URL and API Key');
    console.log('   - AWS Access Keys');
    console.log('   - Other service credentials');
    console.log('');
    console.log('2. Start development server:');
    console.log('   npm run dev');
    console.log('');
    console.log('3. Build for production:');
    console.log('   npm run build');
    console.log('');
    console.log('4. Deploy infrastructure (optional):');
    console.log('   cd cdk && npx cdk deploy');
    console.log('');
    console.log('📚 Documentation:');
    console.log('- README.md - Project overview');
    console.log('- DEPLOY_SETUP.md - Deployment guide');
    console.log('- GITHUB_SECRETS_SETUP.md - CI/CD setup');
    console.log('');
    console.log('🌍 Production URL:');
    console.log('https://main.d2eou43hdrzhv1.amplifyapp.com');
    console.log('');
    log.success('SAP Strategic AI Platform setup completed successfully!');
}

/**
 * Main execution function
 */
async function main() {
    console.log(`${colors.magenta}`);
    console.log('================================================================');
    console.log('🚀 SAP Strategic AI Platform - Automated Setup');
    console.log(`Platform: ${platform()}`);
    console.log('================================================================');
    console.log(`${colors.reset}`);
    
    try {
        checkProjectDirectory();
        checkRequirements();
        setupEnvironment();
        installDependencies();
        verifySetup();
        printSummary();
    } catch (error) {
        log.error(`Setup failed: ${error.message}`);
        process.exit(1);
    }
}

// Run main function
main().catch(console.error);