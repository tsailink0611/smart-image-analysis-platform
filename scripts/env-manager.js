#!/usr/bin/env node

/**
 * ================================================================
 * 🔐 SAP Strategic AI Platform - Environment Manager
 * ================================================================
 * 環境変数の自動管理・同期システム
 * Automated environment variable management and sync system
 * ================================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

const log = {
    header: (msg) => {
        console.log(`${colors.magenta}================================================================${colors.reset}`);
        console.log(`${colors.magenta}🔐 ${msg}${colors.reset}`);
        console.log(`${colors.magenta}================================================================${colors.reset}`);
    },
    step: (msg) => console.log(`${colors.blue}[STEP] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`)
};

/**
 * 現在の .env ファイルを分析
 */
function analyzeCurrentEnv() {
    log.step('現在の環境変数を分析中...');
    
    if (!existsSync('.env')) {
        log.warning('.env ファイルが見つかりません');
        return {};
    }
    
    const envContent = readFileSync('.env', 'utf-8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                envVars[key] = valueParts.join('=').replace(/^["']|["']$/g, '');
            }
        }
    });
    
    log.success(`${Object.keys(envVars).length} 個の環境変数を検出`);
    return envVars;
}

/**
 * .env.example を現在の .env に基づいて自動更新
 */
function updateEnvExample() {
    log.step('.env.example を自動更新中...');
    
    const currentEnv = analyzeCurrentEnv();
    
    if (Object.keys(currentEnv).length === 0) {
        log.warning('環境変数が見つからないため、スキップします');
        return;
    }
    
    // 既存の .env.example の構造を保持
    let exampleContent = '';
    if (existsSync('.env.example')) {
        exampleContent = readFileSync('.env.example', 'utf-8');
    }
    
    // 新しい環境変数を自動追加
    const existingKeys = new Set();
    const lines = exampleContent.split('\n');
    
    lines.forEach(line => {
        if (line.includes('=') && !line.trim().startsWith('#')) {
            const key = line.split('=')[0];
            existingKeys.add(key);
        }
    });
    
    let newVarsAdded = 0;
    Object.keys(currentEnv).forEach(key => {
        if (!existingKeys.has(key)) {
            // 機密情報をマスク
            const maskedValue = maskSensitiveValue(key, currentEnv[key]);
            exampleContent += `\n# Auto-added: ${new Date().toISOString().split('T')[0]}\n`;
            exampleContent += `${key}="${maskedValue}"\n`;
            newVarsAdded++;
        }
    });
    
    if (newVarsAdded > 0) {
        writeFileSync('.env.example', exampleContent);
        log.success(`${newVarsAdded} 個の新しい環境変数を .env.example に追加`);
    } else {
        log.info('.env.example は既に最新です');
    }
}

/**
 * 機密情報をマスク
 */
function maskSensitiveValue(key, value) {
    const sensitiveKeys = [
        'KEY', 'SECRET', 'PASSWORD', 'TOKEN', 'PRIVATE', 'CREDENTIAL'
    ];
    
    const isSensitive = sensitiveKeys.some(keyword => 
        key.toUpperCase().includes(keyword)
    );
    
    if (isSensitive) {
        if (value.length <= 8) {
            return 'your-' + key.toLowerCase().replace(/_/g, '-') + '-here';
        } else {
            return value.substring(0, 8) + '...';
        }
    }
    
    // URLや設定値はそのまま（機密ではない場合）
    if (key.includes('URL') || key.includes('REGION') || key.includes('VERSION')) {
        return value;
    }
    
    return 'your-' + key.toLowerCase().replace(/_/g, '-') + '-here';
}

/**
 * 環境変数の整合性チェック
 */
function validateEnvironment() {
    log.step('環境変数の整合性をチェック中...');
    
    const currentEnv = analyzeCurrentEnv();
    const requiredVars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY'
    ];
    
    const missing = [];
    const warnings = [];
    
    requiredVars.forEach(varName => {
        if (!currentEnv[varName]) {
            missing.push(varName);
        } else if (currentEnv[varName].includes('your-') || currentEnv[varName].includes('here')) {
            warnings.push(varName);
        }
    });
    
    if (missing.length > 0) {
        log.error(`必須環境変数が不足: ${missing.join(', ')}`);
    } else {
        log.success('必須環境変数は全て設定済み');
    }
    
    if (warnings.length > 0) {
        log.warning(`要更新環境変数: ${warnings.join(', ')}`);
    }
    
    return missing.length === 0;
}

/**
 * 環境変数の暗号化バックアップ作成（オプション）
 */
function createEncryptedBackup() {
    log.step('暗号化バックアップを作成中...');
    
    if (!existsSync('.env')) {
        log.warning('.env ファイルが存在しないため、バックアップをスキップ');
        return;
    }
    
    const envContent = readFileSync('.env', 'utf-8');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 簡易暗号化（Node.js 18+対応）
    const key = crypto.scryptSync('env-backup-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(envContent, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const backupData = {
        iv: iv.toString('hex'),
        encrypted: encrypted,
        timestamp: timestamp
    };
    
    writeFileSync(`backups/.env-backup-${timestamp}.json`, JSON.stringify(backupData, null, 2));
    log.success(`暗号化バックアップを作成: backups/.env-backup-${timestamp}.json`);
}

/**
 * チーム共有用の環境変数設定ガイド生成
 */
function generateTeamGuide() {
    log.step('チーム共有ガイドを生成中...');
    
    const currentEnv = analyzeCurrentEnv();
    const teamGuide = `# 🔐 Team Environment Setup Guide
# Generated: ${new Date().toISOString()}

## Required Environment Variables for Team Members

\`\`\`bash
# Copy these values from team lead or documentation:
${Object.keys(currentEnv).map(key => {
    const maskedValue = maskSensitiveValue(key, currentEnv[key]);
    return `${key}="${maskedValue}"`;
}).join('\n')}
\`\`\`

## Setup Instructions for New Team Members

1. Clone the repository
2. Run setup: \`npm install && npm run setup\`
3. Get actual values from team lead
4. Update your .env file with real values
5. Verify: \`npm run env:check\`

## Environment Validation

Run \`npm run env:check\` to verify your environment is properly configured.
`;
    
    writeFileSync('TEAM_ENV_GUIDE.md', teamGuide);
    log.success('チーム共有ガイドを生成: TEAM_ENV_GUIDE.md');
}

/**
 * メイン実行関数
 */
async function main() {
    const command = process.argv[2] || 'check';
    
    log.header(`Environment Manager - ${command}`);
    
    // バックアップディレクトリ作成
    if (!existsSync('backups')) {
        execSync('mkdir -p backups');
    }
    
    switch (command) {
        case 'sync':
            updateEnvExample();
            generateTeamGuide();
            break;
        case 'check':
        case 'validate':
            validateEnvironment();
            break;
        case 'backup':
            createEncryptedBackup();
            break;
        case 'update':
            updateEnvExample();
            break;
        case 'team':
            generateTeamGuide();
            break;
        case 'all':
            updateEnvExample();
            validateEnvironment();
            createEncryptedBackup();
            generateTeamGuide();
            break;
        default:
            console.log('使用可能なコマンド:');
            console.log('  npm run env:sync   - .env.example を自動更新');
            console.log('  npm run env:check  - 環境変数を検証');
            console.log('  npm run env:backup - 暗号化バックアップ作成');
            console.log('  npm run env:team   - チーム共有ガイド生成');
            console.log('  npm run env:all    - 全機能実行');
    }
}

main().catch(console.error);