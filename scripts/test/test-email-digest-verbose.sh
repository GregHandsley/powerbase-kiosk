#!/bin/bash

# Comprehensive test script for send-email-digest Edge Function
# Checks prerequisites and tests the function with detailed output

set -e

echo "🧪 Testing send-email-digest Edge Function"
echo "=========================================="
echo ""

# Check if service role key is provided
if [ -z "$1" ]; then
    echo "Usage: ./test-email-digest-verbose.sh YOUR_SERVICE_ROLE_KEY [frequency]"
    echo ""
    echo "Get your service role key from:"
    echo "  Supabase Dashboard → Settings → API → service_role key"
    echo ""
    exit 1
fi

SERVICE_ROLE_KEY=$1
FREQUENCY=${2:-daily}

PROJECT_URL="https://qyzlqvfdmxvestditilq.supabase.co"
FUNCTION_URL="${PROJECT_URL}/functions/v1/send-email-digest"

echo "📋 Test Configuration:"
echo "   Function URL: $FUNCTION_URL"
echo "   Frequency: $FREQUENCY"
echo ""

# Step 1: Check if function is accessible
echo "1️⃣  Checking if function is accessible..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"frequency\": \"$FREQUENCY\"}" 2>&1)

if [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ Cannot reach function (network error or function not deployed)"
    exit 1
elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
    echo "   ❌ Authentication failed (check your service role key)"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ❌ Function not found (may not be deployed)"
    exit 1
else
    echo "   ✅ Function is accessible (HTTP $HTTP_CODE)"
fi
echo ""

# Step 2: Make the actual request and get response
echo "2️⃣  Calling Edge Function..."
echo ""

RESPONSE=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"frequency\": \"$FREQUENCY\"}")

# Try to parse as JSON, fallback to raw output
if command -v jq &> /dev/null; then
    echo "📊 Response (formatted):"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    echo ""
    
    # Extract key values
    SUCCESS=$(echo "$RESPONSE" | jq -r '.success // "unknown"' 2>/dev/null || echo "unknown")
    USERS_PROCESSED=$(echo "$RESPONSE" | jq -r '.usersProcessed // 0' 2>/dev/null || echo "0")
    EMAILS_SENT=$(echo "$RESPONSE" | jq -r '.emailsSent // 0' 2>/dev/null || echo "0")
    EMAILS_FAILED=$(echo "$RESPONSE" | jq -r '.emailsFailed // 0' 2>/dev/null || echo "0")
    ERROR=$(echo "$RESPONSE" | jq -r '.error // empty' 2>/dev/null || echo "")
    
    echo "📈 Summary:"
    echo "   Success: $SUCCESS"
    echo "   Users Processed: $USERS_PROCESSED"
    echo "   Emails Sent: $EMAILS_SENT"
    echo "   Emails Failed: $EMAILS_FAILED"
    echo ""
    
    if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
        echo "   ⚠️  Error: $ERROR"
        echo ""
    fi
    
    # Interpretation
    if [ "$SUCCESS" = "true" ]; then
        echo "✅ Function executed successfully!"
        echo ""
        if [ "$USERS_PROCESSED" = "0" ]; then
            echo "ℹ️  No users found with $FREQUENCY digest enabled."
            echo "   This is normal if:"
            echo "   - No users have enabled email digest yet"
            echo "   - Migration hasn't been applied"
            echo "   - Users haven't set their preferences"
        elif [ "$EMAILS_SENT" -gt 0 ]; then
            echo "✅ Successfully sent $EMAILS_SENT email(s)!"
        fi
    else
        echo "❌ Function returned an error"
        echo ""
        echo "Common issues:"
        echo "  1. Migration not applied: Run migrations/add_email_digest_preferences.sql"
        echo "  2. Missing environment variables: Check Supabase Dashboard → Edge Functions → send-email-digest → Settings"
        echo "  3. Check function logs: Supabase Dashboard → Edge Functions → send-email-digest → Logs"
    fi
else
    echo "📊 Response (raw):"
    echo "$RESPONSE"
    echo ""
    echo "💡 Tip: Install 'jq' for formatted JSON output: brew install jq"
fi

echo ""
echo "🔍 Next Steps:"
echo "   1. Check function logs: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions/send-email-digest/logs"
echo "   2. Verify migration applied: Check if get_users_for_email_digest() function exists"
echo "   3. Check environment variables in function settings"
echo "   4. Enable digest for a test user in Profile → Notification Preferences"
