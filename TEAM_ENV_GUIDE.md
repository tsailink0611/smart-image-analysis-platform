# 🔐 Team Environment Setup Guide
# Generated: 2025-09-08T16:57:34.688Z

## Required Environment Variables for Team Members

```bash
# Copy these values from team lead or documentation:
VITE_APP_TITLE="your-vite-app-title-here"
VITE_APP_VERSION="2.0.0-PRODUCTION"
VITE_APP_ENVIRONMENT="your-vite-app-environment-here"
NEW_TEST_VARIABLE="your-new-test-variable-here"
VITE_SUPABASE_URL="https://test-project.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGci..."
AWS_ACCESS_KEY_ID="AKIAIOSF..."
AWS_SECRET_ACCESS_KEY="wJalrXUt..."
AWS_DEFAULT_REGION="us-east-1"
AWS_BEDROCK_REGION="us-east-1"
CLAUDE_MODEL_ID="your-claude-model-id-here"
CDK_DEFAULT_ACCOUNT="your-cdk-default-account-here"
CDK_DEFAULT_REGION="us-east-1"
VITE_ENABLE_ANALYTICS="your-vite-enable-analytics-here"
VITE_ENABLE_ERROR_TRACKING="your-vite-enable-error-tracking-here"
VITE_API_BASE_URL="http://localhost:3000"
VITE_DEBUG_MODE="your-vite-debug-mode-here"
VITE_MOCK_AI_RESPONSES="your-vite-mock-ai-responses-here"
```

## Setup Instructions for New Team Members

1. Clone the repository
2. Run setup: `npm install && npm run setup`
3. Get actual values from team lead
4. Update your .env file with real values
5. Verify: `npm run env:check`

## Environment Validation

Run `npm run env:check` to verify your environment is properly configured.
