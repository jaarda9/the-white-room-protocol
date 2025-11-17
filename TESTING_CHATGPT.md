# Testing ChatGPT Integration on Vercel

## Quick Test

1. **Deploy your code to Vercel** (if not already deployed)

2. **Navigate to the test page:**
   ```
   https://your-vercel-app.vercel.app/chatgpt-test
   ```

3. **Run the tests:**
   - Click **"Run Basic Test"** - This verifies the API connection works
   - Click **"Test JSON Response"** - This verifies JSON parsing works
   - Enter a custom prompt and click **"Send Prompt"** - Test with your own message

## What to Look For

### ✅ Success Indicators:
- Green checkmarks next to test results
- Response text appears in the "API Response" section
- No error messages in the console
- Toast notifications show "Success!"

### ❌ Failure Indicators:
- Red X marks next to test results
- Error messages in the "Error Response" section
- Console errors about API failures
- Toast notifications show "Error"

## Common Issues & Solutions

### Issue: "Missing OPENAI_API_KEY or CHATGPT_API_KEY env var"
**Solution:** 
- Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- Make sure `OPENAI_API_KEY` is set
- Redeploy your application

### Issue: "ChatGPT API Rate Limited"
**Solution:**
- You've hit OpenAI's rate limit
- Wait a few minutes and try again
- Check your OpenAI usage dashboard

### Issue: "ChatGPT API Server Error"
**Solution:**
- OpenAI API might be temporarily down
- Check OpenAI status page
- Wait and retry

### Issue: "Request timeout"
**Solution:**
- The request took too long (>30 seconds)
- Try a shorter prompt
- Check your Vercel function logs

## Testing via Browser Console

You can also test directly in the browser console:

```javascript
// Import the service (if available globally)
// Or test the API endpoint directly:

fetch('/api/chatgpt', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payload: {
      contents: [{
        parts: [{ text: 'Say hello' }]
      }]
    }
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Checking Vercel Logs

1. Go to Vercel Dashboard
2. Select your project
3. Go to **Deployments** → Click on latest deployment
4. Click **Functions** tab
5. Look for `/api/chatgpt` function logs
6. Check for any errors or warnings

## Expected Response Format

A successful response should look like:
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "Your response text here..."
      }]
    }
  }]
}
```

## Next Steps

Once testing is successful:
- Remove or hide the test page route (optional)
- Start using `chatGPTService` in your actual components
- See `CHATGPT_INTEGRATION.md` for usage examples

