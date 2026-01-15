#!/bin/bash

# Script to deploy the accept-invitation Edge Function
# Run this after logging in to Supabase

echo "🚀 Deploying accept-invitation Edge Function..."
echo ""

# Check if supabase is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js"
    exit 1
fi

# Link to project (if not already linked)
echo "📎 Linking to project..."
npx supabase link --project-ref qyzlqvfdmxvestditilq

# Deploy the function
echo ""
echo "📦 Deploying function..."
npx supabase functions deploy accept-invitation

echo ""
echo "✅ Done! Check your Supabase dashboard to verify the function is deployed."
echo "   Dashboard: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions"
echo ""
echo "⚠️  Important: Make sure 'Allow new users to sign up' is DISABLED in:"
echo "   Supabase Dashboard → Authentication → Settings → Email Provider"
