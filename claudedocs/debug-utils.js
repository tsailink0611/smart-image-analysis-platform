// API Debugging Utilities
// Run in browser console for systematic debugging

// 🔍 1. API Request Format Validator
function validateApiRequest(requestData) {
  console.group('🔍 API Request Validation');
  
  const requiredFields = ['prompt'];
  const optionalFields = ['image', 'analysisType', 'customInstructions', 'filename', 'fileSize', 'fileType'];
  
  console.log('📨 Request Data:', requestData);
  
  // Check required fields
  const missingRequired = requiredFields.filter(field => !requestData[field]);
  if (missingRequired.length > 0) {
    console.error('❌ Missing required fields:', missingRequired);
    return false;
  }
  
  // Show optional fields
  const presentOptional = optionalFields.filter(field => requestData[field]);
  console.log('✅ Optional fields present:', presentOptional);
  
  console.groupEnd();
  return true;
}

// 🌐 2. Environment Configuration Checker
function checkEnvironmentConfig() {
  console.group('🌐 Environment Configuration Check');
  
  const viteDeps = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_API_BASE_URL'
  ];
  
  console.log('🔧 Current Window Location:', window.location);
  console.log('🔧 Expected API Endpoint:', '/api/analysis');
  
  // Check if running in development
  const isDev = window.location.hostname === 'localhost';
  console.log('🏗️ Development Mode:', isDev);
  
  if (isDev) {
    console.log('🔀 Vite Proxy should route /api/* to:', 'https://ylgrnwffx6.execute-api.us-east-1.amazonaws.com/prod');
  }
  
  console.groupEnd();
}

// 🧪 3. API Endpoint Tester
async function testApiEndpoint(method = 'GET', endpoint = '/api/ping', data = null) {
  console.group(`🧪 Testing ${method} ${endpoint}`);
  
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    console.log('📤 Request:', options);
    
    const response = await fetch(endpoint, options);
    
    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Headers:', [...response.headers.entries()]);
    
    const responseText = await response.text();
    console.log('📥 Response Body:', responseText);
    
    try {
      const responseJson = JSON.parse(responseText);
      console.log('📥 Parsed JSON:', responseJson);
    } catch (e) {
      console.log('⚠️ Response is not JSON');
    }
    
    console.groupEnd();
    return { status: response.status, body: responseText, ok: response.ok };
    
  } catch (error) {
    console.error('❌ Request failed:', error);
    console.groupEnd();
    return { error: error.message };
  }
}

// 🔗 4. Full API Flow Debugger
async function debugApiFlow(imageData = null) {
  console.group('🔗 Full API Flow Debug');
  
  // Step 1: Check environment
  checkEnvironmentConfig();
  
  // Step 2: Test ping endpoint
  console.log('\n--- Step 2: Testing Ping Endpoint ---');
  await testApiEndpoint('GET', '/api/ping');
  
  // Step 3: Test analysis endpoint with current format (will fail)
  console.log('\n--- Step 3: Testing Current Format (Expected to Fail) ---');
  const currentFormat = {
    image: imageData || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    analysisType: 'custom',
    customInstructions: 'Test analysis',
    filename: 'test.png',
    fileSize: 100,
    fileType: 'image/png'
  };
  await testApiEndpoint('POST', '/api/analysis', currentFormat);
  
  // Step 4: Test with corrected format
  console.log('\n--- Step 4: Testing Corrected Format ---');
  const correctedFormat = {
    prompt: `Please analyze this image: ${currentFormat.customInstructions}`,
    image: currentFormat.image,
    analysisType: currentFormat.analysisType,
    filename: currentFormat.filename
  };
  validateApiRequest(correctedFormat);
  await testApiEndpoint('POST', '/api/analysis', correctedFormat);
  
  console.groupEnd();
}

// 📊 5. Network Request Monitor
function monitorNetworkRequests() {
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const [url, options] = args;
    
    if (url.includes('/api/')) {
      console.group(`📡 Intercepted API Request: ${options?.method || 'GET'} ${url}`);
      console.log('Request Options:', options);
      
      if (options?.body) {
        try {
          console.log('Request Body:', JSON.parse(options.body));
        } catch (e) {
          console.log('Request Body (raw):', options.body);
        }
      }
    }
    
    const response = await originalFetch(...args);
    
    if (url.includes('/api/')) {
      console.log('Response Status:', response.status);
      console.log('Response OK:', response.ok);
      console.groupEnd();
    }
    
    return response;
  };
  
  console.log('📡 Network monitoring enabled for /api/* requests');
}

// 🎯 Quick Start Functions
console.log(`
🔧 API Debugging Tools Loaded!

Quick Commands:
1. checkEnvironmentConfig()         - Check config
2. testApiEndpoint('GET', '/api/ping')  - Test ping
3. debugApiFlow()                   - Full debug flow
4. monitorNetworkRequests()         - Monitor all API calls
5. validateApiRequest({prompt: 'test'}) - Validate request format

Example:
debugApiFlow(); // Run complete debugging sequence
`);

// Auto-start monitoring
monitorNetworkRequests();