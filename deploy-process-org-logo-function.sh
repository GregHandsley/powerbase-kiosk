#!/bin/bash

# Script to deploy the process-org-logo Edge Function
# Run this after logging in to Supabase

echo "🚀 Deploying process-org-logo Edge Function..."
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
npx supabase functions deploy process-org-logo

echo ""
echo "✅ Done! Check your Supabase dashboard to verify the function is deployed."
echo "   Dashboard: https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions"
echo ""
echo "📋 Next steps:"
echo "   1. Apply the branding migration: migrations/add_organization_branding.sql"
echo "   2. Set up the org-logos storage bucket: setup-org-logos-storage.sql"
echo "   3. The branding feature will be available in Admin → Branding"