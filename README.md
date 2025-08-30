# Strategic AI Platform - SAP Sales Analysis

Enterprise-grade sales data analysis platform with AI-powered insights using AWS Bedrock and Claude.

## 🏗️ Architecture Overview

- **Frontend**: React + TypeScript + Vite (deployed on AWS Amplify)
- **Backend**: AWS Lambda Function with Claude 3 Sonnet via Bedrock
- **Data Processing**: Pandas for CSV analysis with auto-detection
- **API**: Lambda Function URL with CORS support

## 📁 Project Structure (SSOT - Single Source of Truth)

```
├── src/                          # Frontend React application
├── lambda/
│   ├── sap-claude-handler/       # 🎯 SSOT: Main Lambda function
│   │   └── lambda_function.py    # Primary handler (unified)
│   ├── format-learning-handler.py # Human-in-the-loop format learning
│   ├── requirements.txt          # Python dependencies
│   └── archive/                  # Legacy handler versions
├── deployment-config.json        # Lambda deployment configuration
├── deploy.sh                     # Unix deployment script
├── deploy-windows.ps1            # Windows deployment script
└── README.md                     # This file
```

## 🚀 Quick Start

### 1. Frontend Development
```bash
npm install
npm run dev
```

### 2. Lambda Deployment (SSOT)

#### Using Unix/Linux/macOS:
```bash
./deploy.sh
```

#### Using Windows PowerShell:
```powershell
.\deploy-windows.ps1
```

#### Manual AWS CLI Deployment:
```bash
# Package and deploy the SSOT Lambda function
cd lambda
zip -r sap-claude-handler.zip sap-claude-handler/lambda_function.py requirements.txt

# Upload to existing Lambda function
aws lambda update-function-code \
  --function-name sap-claude-handler \
  --zip-file fileb://sap-claude-handler.zip

# Set environment variables
aws lambda update-function-configuration \
  --function-name sap-claude-handler \
  --environment Variables='{
    "USE_CLAUDE_API":"true",
    "BEDROCK_MODEL_ID":"anthropic.claude-3-sonnet-20240229-v1:0",
    "LAMBDA_DEBUG_ECHO":"0",
    "BUILD_ID":"ssot-v1"
  }'
```

## 🔧 Configuration

### Environment Variables (Lambda)
- `USE_CLAUDE_API`: Enable/disable real AI analysis (`true`/`false`)
- `BEDROCK_MODEL_ID`: Claude model identifier
- `LAMBDA_DEBUG_ECHO`: Debug mode for payload inspection (`0`/`1`)
- `BUILD_ID`: Build identifier for tracking

### Frontend Environment
```bash
# .env.production
VITE_API_ENDPOINT=/api/analysis
```

## 📊 Supported Data Formats

The SSOT Lambda function auto-detects various input formats:

**Array Data** (priority order):
- `rows`, `dataRows`, `records`, `table`, `data`, `salesData`

**CSV Text** (priority order):
- `csv`, `fileContent`, `input`, `text`, `content`, `csvData`

## 🐛 Debug Mode

Enable debug mode to inspect raw payloads:

**Environment Variable:**
```bash
LAMBDA_DEBUG_ECHO=1
```

**Query Parameter:**
```
POST /api/analysis?echo=1
```

## 📦 Deployment Process

1. **Source Control**: All changes made to `lambda/sap-claude-handler/lambda_function.py`
2. **Manual Upload**: Copy code to AWS Console (GitHub integration pending)
3. **Testing**: Use debug mode to verify data reception
4. **Monitoring**: Check CloudWatch logs for issues

## 🏛️ SSOT Migration

The project has been refactored to use a Single Source of Truth architecture:

- **Active**: `lambda/sap-claude-handler/lambda_function.py`
- **Archived**: All previous handler versions moved to `lambda/archive/`
- **Unified**: All features consolidated into one function

## 📈 Features

- **Flexible Input**: Auto-detects various CSV and JSON formats
- **AI Analysis**: Comprehensive sales analysis using Claude 3 Sonnet
- **Debug Tools**: Payload inspection and debugging capabilities
- **CORS Support**: Full CORS headers for frontend integration
- **Error Handling**: Comprehensive error handling and logging
- **Mock Mode**: Testing with mock data when API is disabled

## 🔗 External Dependencies

- AWS Bedrock (Claude 3 Sonnet)
- AWS Lambda Function URL: https://h6util56iwzeyadx6kbjyuakbi0zuucm.lambda-url.us-east-1.on.aws/
- AWS Amplify (Frontend hosting with API rewrites)

## 📝 Development Notes

- **Encoding**: Handles UTF-8, UTF-8-BOM, and Shift-JIS CSV files
- **Base64**: Auto-detects and decodes Base64-encoded payloads
- **Pandas**: Robust CSV parsing with error handling
- **TypeScript**: Fully typed frontend with proper error boundaries
