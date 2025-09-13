# Professional API Debugging Guide
## Smart Image Analysis Platform

### 🎯 Executive Summary
This guide provides a systematic approach to debugging API endpoint issues in the Smart Image Analysis Platform. The current 400 error stems from request format mismatches between frontend and backend expectations.

---

## 📋 Quick Diagnosis Checklist

### ✅ Pre-Debugging Verification
- [ ] UI loads correctly with Tailwind CSS
- [ ] Components render without errors
- [ ] File upload functionality works
- [ ] Only API calls fail with 400 errors

### ⚠️ Identified Issues
- [x] **Request format mismatch**: Frontend sends `{ image, analysisType, customInstructions }` but API expects `{ prompt }`
- [x] **Development routing confusion**: Vite proxy to AWS Lambda while local API files exist
- [x] **Missing LAMBDA_URL**: Environment variable not set, causing fallback behavior
- [x] **Vercel configuration gaps**: No API function routing in vercel.json

---

## 🔧 Step-by-Step Debugging Process

### Step 1: Load Debugging Tools
```javascript
// In browser console, load the debugging utilities
const script = document.createElement('script');
script.src = '/claudedocs/debug-utils.js';
document.head.appendChild(script);

// After loading, run:
debugApiFlow(); // Complete API debugging sequence
```

### Step 2: Validate API Format
```javascript
// Check current request format
const currentRequest = {
  image: 'data:image/png;base64,...',
  analysisType: 'custom',
  customInstructions: 'Test analysis',
  filename: 'test.png',
  fileSize: 1024,
  fileType: 'image/png'
};

validateApiRequest(currentRequest); // Will show missing 'prompt' field
```

### Step 3: Test Endpoint Connectivity
```javascript
// Test basic connectivity
await testApiEndpoint('GET', '/api/ping');

// Test with current format (will fail)
await testApiEndpoint('POST', '/api/analysis', currentRequest);
```

### Step 4: Apply Format Fix
```javascript
// Load format fix utility
const fixScript = document.createElement('script');
fixScript.src = '/claudedocs/fix-api-format.js';
document.head.appendChild(fixScript);

// Test with corrected format
const result = await makeApiRequestWithErrorHandling(currentRequest);
console.log('Result:', result);
```

---

## 🛠️ Immediate Resolution Steps

### Option A: Fix Frontend (Recommended for Quick Fix)
Update the request format in `src/App.tsx` line 36:

```typescript
// Current problematic format:
body: JSON.stringify({
  image: uploadedFile.base64Data,
  analysisType: type,
  customInstructions: instructions,
  filename: uploadedFile.file.name,
  fileSize: uploadedFile.file.size,
  fileType: uploadedFile.file.type,
}),

// Fixed format:
body: JSON.stringify({
  prompt: instructions || 'Please analyze this image.',
  image: uploadedFile.base64Data,
  analysisType: type,
  customInstructions: instructions,
  filename: uploadedFile.file.name,
  fileSize: uploadedFile.file.size,
  fileType: uploadedFile.file.type,
}),
```

### Option B: Fix Backend (Comprehensive Solution)
Update `/api/analysis.mjs` to handle both formats:

```javascript
// Enhanced request handling
const { prompt, image, analysisType, customInstructions } = body;

// Support both formats
const effectivePrompt = prompt || customInstructions || 'Please analyze this image.';

if (!effectivePrompt) {
  return res.status(400).json({ 
    error: 'Either prompt or customInstructions is required' 
  });
}
```

---

## 🌐 Environment Configuration Fix

### 1. Check Current Environment
```bash
cd "C:\Users\tsail\Desktop\smart-image-analysis-platform"
grep -i "LAMBDA_URL" .env || echo "LAMBDA_URL not found"
```

### 2. Add Missing Variables
Add to `.env` file:
```env
# Lambda endpoint for API calls
LAMBDA_URL=https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com/prod/analysis

# Development API base
VITE_API_BASE_URL=http://localhost:5177
```

---

## 🔄 Development vs Production Routing

### Current Configuration Analysis

| Environment | Route Source | Target | Status |
|-------------|--------------|---------|---------|
| Development | Vite Proxy | AWS Lambda | Bypasses local API |
| Development | Local Files | `/api/*.mjs` | Not served |
| Production | Vercel | Not configured | Will fail |

### Recommended Fix: Update `vite.config.ts`
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001', // Local API server
      changeOrigin: true,
      // Remove rewrite to preserve /api prefix
    }
  }
},
```

### Update `vercel.json` for Production
```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/analysis.mjs": {
      "runtime": "nodejs18.x"
    },
    "api/ping.mjs": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

---

## 📊 Monitoring and Logging Setup

### 1. Enable Request Logging
Add to API files:
```javascript
// Enhanced logging in api/analysis.mjs
console.log('API Request received:', {
  method: req.method,
  headers: req.headers,
  bodyKeys: Object.keys(req.body || {}),
  timestamp: new Date().toISOString()
});
```

### 2. Frontend Error Tracking
Add to `src/App.tsx`:
```typescript
catch (error) {
  console.group('🚨 API Error Details');
  console.error('Error:', error);
  console.log('Request payload:', JSON.stringify({
    image: uploadedFile.base64Data?.substring(0, 100) + '...',
    analysisType: type,
    customInstructions: instructions,
    filename: uploadedFile.file.name,
  }, null, 2));
  console.groupEnd();
  
  // Rest of error handling...
}
```

---

## 🧪 Testing Protocol

### Manual Testing Sequence
1. **Load debugging tools**: Run `debugApiFlow()` in console
2. **Test ping endpoint**: Verify basic connectivity
3. **Test with current format**: Confirm 400 error
4. **Test with fixed format**: Verify success
5. **Test file upload flow**: End-to-end verification

### Automated Testing Script
```bash
# Run comprehensive API tests
cd "C:\Users\tsail\Desktop\smart-image-analysis-platform"
npm test || echo "Add API tests to package.json"
```

---

## 🔍 Common Error Patterns & Solutions

| Error | Cause | Solution |
|-------|--------|----------|
| `400 Bad Request` | Missing `prompt` field | Add prompt to request |
| `404 Not Found` | API routing issue | Fix Vite proxy or Vercel config |
| `502 Bad Gateway` | Lambda connection failed | Check LAMBDA_URL |
| `CORS Error` | Missing headers | Add CORS headers to API |
| `Failed to load resource` | Network/proxy issue | Check development proxy |

---

## 📈 Success Metrics

### Fixed When:
- ✅ API returns 200 status codes
- ✅ No "Failed to load resource" in console
- ✅ Image analysis returns actual results
- ✅ Error handling shows user-friendly messages
- ✅ Development and production environments work

### Performance Targets:
- API response time: < 5 seconds
- File upload success rate: > 95%
- Error recovery: Graceful with user feedback

---

## 🎯 Next Steps After Fix

1. **Add comprehensive API tests**
2. **Implement proper error boundaries**
3. **Add request/response validation**
4. **Set up proper logging/monitoring**
5. **Document API contract clearly**

---

*Debugging guide created: 2025-09-14*  
*Tools location: `/claudedocs/`*  
*Status: Ready for implementation*