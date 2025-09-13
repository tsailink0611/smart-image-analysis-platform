# Quick Fix Checklist - API 400 Error

## 🚨 Emergency Fix (5 minutes)

### Immediate Action: Fix Request Format
```typescript
// In src/App.tsx, line ~36, change:
body: JSON.stringify({
  prompt: instructions || 'Please analyze this image.', // ADD THIS LINE
  image: uploadedFile.base64Data,
  analysisType: type,
  customInstructions: instructions,
  filename: uploadedFile.file.name,
  fileSize: uploadedFile.file.size,
  fileType: uploadedFile.file.type,
}),
```

### Verification Steps
1. ✅ Add `prompt` field to request payload
2. ✅ Test in browser: Upload image → Start Analysis
3. ✅ Check console: No more 400 errors
4. ✅ Verify: API returns analysis results

---

## 🔧 Complete Fix (15 minutes)

### Step 1: Update Frontend Request Format
**File:** `C:\Users\tsail\Desktop\smart-image-analysis-platform\src\App.tsx`
**Lines:** 31-44

```typescript
const response = await fetch(API_ENDPOINT, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: instructions || `Please analyze this ${analysisType} image.`,
    image: uploadedFile.base64Data,
    analysisType: type,
    customInstructions: instructions,
    filename: uploadedFile.file.name,
    fileSize: uploadedFile.file.size,
    fileType: uploadedFile.file.type,
  }),
})
```

### Step 2: Improve Error Handling
**Add after line 46 in App.tsx:**

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error('API Error:', errorText);
  throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
}
```

### Step 3: Add Debug Logging
**Add after line 30 in App.tsx:**

```typescript
console.log('🔍 Making API request:', {
  endpoint: API_ENDPOINT,
  analysisType: type,
  hasImage: !!uploadedFile?.base64Data,
  instructionsLength: instructions?.length || 0
});
```

---

## 🧪 Testing Instructions

### Quick Test
1. Open browser console
2. Load debugging script:
   ```javascript
   const script = document.createElement('script');
   script.src = '/claudedocs/debug-utils.js';
   document.head.appendChild(script);
   ```
3. Upload a test image
4. Add analysis instruction: "Extract text from this image"
5. Click "分析開始" button
6. Check console for success message

### Expected Results After Fix
- ✅ No 400 errors in console
- ✅ API returns JSON response
- ✅ Analysis results display in UI
- ✅ Professional error messages if something fails

---

## 📋 Verification Checklist

- [ ] Request includes `prompt` field
- [ ] No console errors during API call
- [ ] API returns 200 status code
- [ ] Analysis results display correctly
- [ ] Error handling shows user-friendly messages
- [ ] File upload still works correctly
- [ ] UI styling remains intact

---

## 🔄 Rollback Plan

If fix causes issues:
1. Revert changes to `src/App.tsx`
2. Remove added `prompt` field
3. Restore original request format
4. Test UI functionality

---

## 📞 Support Information

**Issue:** API 400 Bad Request - Missing prompt field  
**Root Cause:** Frontend/Backend format mismatch  
**Fix Time:** 5-15 minutes  
**Risk Level:** Low (only changes request format)  

**Files Modified:**
- `C:\Users\tsail\Desktop\smart-image-analysis-platform\src\App.tsx`

**Debugging Tools:**
- `C:\Users\tsail\Desktop\smart-image-analysis-platform\claudedocs\debug-utils.js`
- `C:\Users\tsail\Desktop\smart-image-analysis-platform\claudedocs\fix-api-format.js`