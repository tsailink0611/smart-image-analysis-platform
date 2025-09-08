#!/usr/bin/env node

/**
 * ================================================================
 * 🔧 SAP Strategic AI Platform - Post Install Script
 * ================================================================
 * This script runs after npm install to perform additional setup
 * npm install後に追加セットアップを実行するスクリプト
 * ================================================================
 */

import { existsSync, copyFileSync } from 'fs';
import { platform } from 'os';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
};

function main() {
    console.log(`${colors.cyan}🔧 SAP Strategic AI Platform - Post Install Setup${colors.reset}`);
    
    // Create .env from .env.example if it doesn't exist
    if (!existsSync('.env') && existsSync('.env.example')) {
        copyFileSync('.env.example', '.env');
        log.success('Created .env from .env.example');
        
        console.log('');
        log.warning('IMPORTANT: Please edit .env file with your actual values!');
        log.info('Required credentials:');
        log.info('  - Supabase URL and API Key');
        log.info('  - AWS Access Keys');
        log.info('  - Other service credentials');
        console.log('');
        log.info('After editing .env, run: npm run setup');
        console.log('');
    } else if (existsSync('.env')) {
        log.info('.env file already exists');
    } else {
        log.warning('.env.example not found - manual configuration required');
    }
    
    // Platform-specific instructions
    const currentPlatform = platform();
    console.log(`Platform detected: ${currentPlatform}`);
    
    if (currentPlatform === 'win32') {
        log.info('Windows users can run: npm run setup:windows');
    } else {
        log.info('Unix/Linux/macOS users can run: npm run setup:unix');
    }
    
    log.info('Cross-platform setup: npm run setup');
}

main();