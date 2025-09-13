// API Format Fix Script
// This script provides the corrected API format transformations

// 🔄 Transform frontend request to match API expectations
function transformRequestForApi(frontendRequest) {
  const {
    image,
    analysisType,
    customInstructions,
    filename,
    fileSize,
    fileType
  } = frontendRequest;

  // Create prompt based on analysis type and instructions
  let prompt = customInstructions || 'Please analyze this image.';
  
  if (analysisType === 'custom' && customInstructions) {
    prompt = `Custom Analysis Request: ${customInstructions}`;
  }

  // API-compatible format
  return {
    prompt,
    image,
    analysisType,
    filename,
    fileSize,
    fileType,
    metadata: {
      originalFormat: 'frontend-v1',
      transformedAt: new Date().toISOString()
    }
  };
}

// 🧪 Test the transformation
function testTransformation() {
  console.group('🔄 API Format Transformation Test');
  
  const frontendRequest = {
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    analysisType: 'custom',
    customInstructions: 'Extract text and provide detailed analysis',
    filename: 'test-document.png',
    fileSize: 1024,
    fileType: 'image/png'
  };
  
  console.log('📥 Frontend Request:', frontendRequest);
  
  const apiRequest = transformRequestForApi(frontendRequest);
  console.log('📤 Transformed API Request:', apiRequest);
  
  console.log('✅ Transformation completed successfully');
  console.groupEnd();
  
  return apiRequest;
}

// 🔧 Enhanced error handling wrapper
async function makeApiRequestWithErrorHandling(requestData) {
  console.group('🔧 Enhanced API Request');
  
  try {
    // Transform the request
    const transformedRequest = transformRequestForApi(requestData);
    console.log('🔄 Using transformed request format');
    
    // Make the request
    const response = await fetch('/api/analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transformedRequest),
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response OK:', response.ok);
    
    // Enhanced error handling
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Parsed Error:', errorJson);
        throw new Error(`API Error (${response.status}): ${errorJson.error || errorJson.message || 'Unknown error'}`);
      } catch (parseError) {
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }
    }
    
    const result = await response.json();
    console.log('✅ Success Response:', result);
    console.groupEnd();
    
    return {
      success: true,
      data: result,
      status: response.status
    };
    
  } catch (error) {
    console.error('❌ Request Failed:', error);
    console.groupEnd();
    
    return {
      success: false,
      error: error.message,
      originalError: error
    };
  }
}

// Export for use in console
window.transformRequestForApi = transformRequestForApi;
window.testTransformation = testTransformation;
window.makeApiRequestWithErrorHandling = makeApiRequestWithErrorHandling;

console.log(`
🔄 API Format Fix Tools Loaded!

Available functions:
- transformRequestForApi(request)    - Transform frontend format to API format
- testTransformation()               - Test the transformation logic
- makeApiRequestWithErrorHandling(request) - Make API request with proper error handling

Example usage:
const result = await makeApiRequestWithErrorHandling({
  image: 'data:image/png;base64,...',
  analysisType: 'custom',
  customInstructions: 'Analyze this document',
  filename: 'document.png',
  fileSize: 1024,
  fileType: 'image/png'
});
`);

// Auto-run test
testTransformation();