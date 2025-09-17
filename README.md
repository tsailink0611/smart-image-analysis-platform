# Smart Image Analysis Platform

An AI-powered platform for analyzing images and documents using Claude Vision API with advanced OCR and business intelligence capabilities.

## Features

- **AI Image Analysis**: Upload images/documents for detailed Claude Vision analysis
- **OCR & Text Extraction**: Automatically extract text from images and PDFs
- **Business Intelligence**: Get actionable insights from charts, graphs, and documents
- **Multi-format Support**: Supports PNG, JPG, PDF, WebP, BMP, TIFF formats
- **Real-time Processing**: Instant analysis with Claude 3 Sonnet
- **Detailed Reports**: Comprehensive analysis with business recommendations

## Technology Stack

- **Frontend**: React + TypeScript + Vite
- **AI Processing**: Claude 3 Sonnet via AWS Bedrock
- **Backend**: AWS Lambda Function URL
- **Image Processing**: Claude Vision API
- **Deployment**: Local development + AWS Lambda

## Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured with Bedrock access

### Development Setup

1. **Clone and install dependencies**
```bash
npm install
```

2. **Start development server**
```bash
npm run dev
```

3. **Access the application**
```
http://localhost:5173
```

## Usage

1. **Upload Image**: Drag & drop or click to select an image file
2. **Choose Analysis Type**: Select from predefined analysis options
3. **Add Custom Instructions**: Provide specific analysis requirements
4. **Start Analysis**: Click "AI分析を開始" to process the image
5. **Review Results**: Get detailed analysis with business insights

## API Configuration

The platform uses AWS Lambda for backend processing:

**Lambda Function**: `smart-image-analyzer`
**Function URL**: `https://rzddt4m5k6mllt2kkl7xa7rokm0urcjs.lambda-url.us-east-1.on.aws/`

## Environment Setup

Required environment variables for Lambda function:
```bash
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
BEDROCK_REGION=us-east-1
MAX_TOKENS=1500
TEMPERATURE=0.2
```

## Project Structure

```
smart-image-analysis-platform/
├── src/
│   ├── components/
│   │   ├── ImageUpload.tsx       # File upload component
│   │   ├── DocumentAnalysis.tsx  # Analysis configuration
│   │   └── ResultDisplay.tsx     # Results visualization
│   ├── types/                    # TypeScript definitions
│   └── App.tsx                   # Main application
├── image_analyzer.py             # Lambda function code
└── vite.config.ts               # Build configuration
```

## Lambda Function

The `smart-image-analyzer` Lambda function:
- Receives base64-encoded images
- Processes them with Claude Vision API
- Returns detailed analysis results
- Handles CORS for web integration

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Lambda Deployment
aws lambda update-function-code --function-name smart-image-analyzer --zip-file fileb://smart-image-analyzer.zip
```

## Supported Image Formats

- PNG, JPG, JPEG
- PDF documents
- WebP, BMP, TIFF
- Maximum file size: 10MB

## Analysis Capabilities

- **Text Extraction**: OCR from images and documents
- **Data Analysis**: Charts, graphs, and numerical data interpretation
- **Business Intelligence**: Strategic insights and recommendations
- **Document Processing**: Receipts, invoices, reports analysis
- **Visual Content**: Image content description and analysis

## License

This project is for demonstration purposes.

---

**Powered by Claude 3 Sonnet - Advanced AI Image Analysis**