#!/bin/bash

# Script to deploy the export-activity-logs-csv Edge Function
# Run this after logging in to Supabase

echo "🚀 Deploying export-activity-logs-csv Edge Function..."
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
npx supabase functions deploy export-activity-logs-csv

echo ""
echo "✅ Done! Check your Supabase dashboard to verify the function is deployed."
echo "   Dashboard: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions"
