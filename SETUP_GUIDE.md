# 🚀 SAP Strategic AI Platform - Complete Setup Guide

## 📋 Table of Contents

1. [Quick Start (1-Command Setup)](#quick-start)
2. [System Requirements](#system-requirements)
3. [Environment Configuration](#environment-configuration)
4. [Manual Setup Steps](#manual-setup-steps)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Professional Development Workflow](#professional-development-workflow)

---

## 🎯 Quick Start (1-Command Setup)

### **For Any Platform (Recommended)**
```bash
# Clone the repository
git clone https://github.com/your-username/sap-project-frontend.git
cd sap-project-frontend

# One-command setup
npm install && npm run setup
```

### **Platform-Specific Setup**

**Windows (PowerShell)**
```powershell
npm run setup:windows
```

**macOS/Linux**
```bash
npm run setup:unix
```

---

## 💻 System Requirements

### **Minimum Requirements**
- **Node.js**: >= 18.0.0 (LTS recommended)
- **npm**: >= 8.0.0 (comes with Node.js)
- **Git**: Latest version
- **OS**: Windows 10+, macOS 10.15+, or Linux

### **Recommended Tools**
- **AWS CLI**: For CDK deployment
- **Docker**: For containerized development (optional)
- **VS Code**: With recommended extensions

### **Browser Support**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 🔐 Environment Configuration

### **Required Services**

#### **1. Supabase Setup**
1. Create account at [supabase.com](https://app.supabase.com/)
2. Create new project
3. Get credentials from: Settings → API
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

#### **2. AWS Setup**
1. Create AWS account at [aws.amazon.com](https://aws.amazon.com/)
2. Create IAM user with programmatic access
3. Required permissions:
   - Lambda Full Access
   - API Gateway Full Access
   - S3 Full Access
   - CloudFormation Full Access
   - Bedrock Access (for AI features)
4. Get credentials:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`

### **Environment Variables**

Copy `.env.example` to `.env` and fill in your values:

```bash
# Essential Configuration
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_DEFAULT_REGION="us-east-1"

# Optional Configuration
VITE_ENABLE_ANALYTICS="false"
VITE_DEBUG_MODE="true"
```

---

## 🛠️ Manual Setup Steps

### **Step 1: Clone Repository**
```bash
git clone https://github.com/your-username/sap-project-frontend.git
cd sap-project-frontend
```

### **Step 2: Install Dependencies**
```bash
# Frontend dependencies
npm install

# CDK dependencies (if using infrastructure)
cd cdk && npm install && cd ..

# Global tools
npm install -g aws-cdk
```

### **Step 3: Environment Setup**
```bash
# Copy environment template
cp .env.example .env

# Edit with your actual values
# Windows: notepad .env
# macOS/Linux: nano .env
```

### **Step 4: Verify Setup**
```bash
# Test build
npm run build

# Test CDK (optional)
cd cdk && npx cdk synth && cd ..
```

### **Step 5: Start Development**
```bash
npm run dev
```

---

## ✅ Verification

### **Frontend Verification**
- [ ] `npm run dev` starts successfully
- [ ] Application opens at `http://localhost:5173`
- [ ] No console errors in browser
- [ ] Supabase connection works

### **Backend Verification**
- [ ] CDK synthesis works: `cd cdk && npx cdk synth`
- [ ] AWS credentials are valid
- [ ] Lambda functions can be invoked

### **Full Stack Verification**
- [ ] File upload works
- [ ] AI analysis returns results
- [ ] Data persists in database
- [ ] Real-time updates work

---

## 🔧 Troubleshooting

### **Common Issues**

#### **Environment Variables Not Found**
```bash
# Check .env file exists
ls -la .env

# Verify contents
cat .env | grep -v "^#"
```

#### **Supabase Connection Failed**
- Verify URL format: `https://project-id.supabase.co`
- Check API key is `anon` key, not `service_role`
- Ensure RLS policies allow access

#### **AWS CDK Issues**
```bash
# Check AWS credentials
aws configure list

# Bootstrap CDK (one-time setup)
cd cdk && npx cdk bootstrap

# Verify CDK version
cdk --version
```

#### **Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### **Platform-Specific Issues**

#### **Windows**
- Use PowerShell as Administrator
- Enable execution policy: `Set-ExecutionPolicy RemoteSigned`
- Use Git Bash for Unix commands

#### **macOS**
- Install Xcode Command Line Tools: `xcode-select --install`
- Use Homebrew for missing tools: `brew install aws-cli`

#### **Linux**
- Install build essentials: `sudo apt-get install build-essential`
- Check Node.js installation source

---

## 👨‍💼 Professional Development Workflow

### **Daily Development**
```bash
# Start development
npm run dev

# Make changes
# Test changes
npm run build

# Commit changes
git add .
git commit -m "feat: description"
git push
```

### **Environment Management**
```bash
# Development
npm run dev

# Production build
npm run build

# Deploy to staging
git push origin develop

# Deploy to production
git push origin main
```

### **Team Collaboration**
```bash
# New team member setup
git clone <repository>
cd <project>
npm install
npm run setup
# Edit .env with team credentials

# Ready to develop!
npm run dev
```

### **Backup & Recovery**
```bash
# Backup current environment
cp .env .env.backup

# Restore from backup
cp .env.backup .env

# Full project restore (if local files lost)
git clone <repository>
npm install
# Restore .env from secure storage
npm run setup
```

---

## 🚀 Deployment Options

### **1. Development Deployment**
```bash
# Push to develop branch
git push origin develop
# Auto-deploys to development environment
```

### **2. Staging Deployment**
```bash
# Push to staging branch  
git push origin staging
# Auto-deploys to staging environment
```

### **3. Production Deployment**
```bash
# Push to main branch
git push origin main
# Auto-deploys to: https://main.d2eou43hdrzhv1.amplifyapp.com
```

### **4. Manual CDK Deployment**
```bash
cd cdk
npx cdk deploy --all
```

---

## 📚 Additional Resources

- **Project Documentation**: [README.md](README.md)
- **Deployment Guide**: [DEPLOY_SETUP.md](DEPLOY_SETUP.md)
- **GitHub Secrets**: [GITHUB_SECRETS_SETUP.md](GITHUB_SECRETS_SETUP.md)
- **Production System**: https://main.d2eou43hdrzhv1.amplifyapp.com

---

## 🏆 Success Criteria

### **Setup Completed When:**
- ✅ All dependencies installed
- ✅ Environment variables configured
- ✅ Development server starts
- ✅ Application loads in browser
- ✅ Core features functional
- ✅ No critical console errors

### **Professional Grade When:**
- ✅ CDK infrastructure deployable
- ✅ CI/CD pipeline functional
- ✅ All tests passing
- ✅ Security scanning clean
- ✅ Performance optimized

---

**🎉 Congratulations! Your SAP Strategic AI Platform is ready for development!**