import React, { useState, useRef } from 'react';
import {
  useBranding,
  type BrandingConfig,
} from '../../../context/BrandingContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabaseClient';
import { usePrimaryOrganizationId } from '../../../hooks/usePermissions';
import toast from 'react-hot-toast';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  description?: string;
}

function ColorPicker({
  label,
  value,
  onChange,
  description,
}: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-8 border border-slate-600 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm font-mono"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

interface LogoUploaderProps {
  currentLogoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
  isDisabled?: boolean;
}

function LogoUploader({
  currentLogoUrl,
  onLogoChange,
  isDisabled,
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organizationId } = usePrimaryOrganizationId();

  const handleFileSelect = async (file: File) => {
    if (isDisabled) {
      toast.error('Only super admins can edit branding');
      return;
    }
    if (!organizationId) {
      toast.error('No organization selected');
      return;
    }

    // Basic client-side validation
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      toast.error('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      // Get session for authentication
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await supabase.auth.getSession();
      let session = initialSession;

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Session error');
      }

      if (!session?.access_token) {
        console.error('No session or access token found');
        throw new Error('Not authenticated');
      }

      // Check if session is expired and try to refresh
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        console.log('Session expired, attempting refresh...');
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError || !refreshData.session?.access_token) {
          console.error('Session refresh failed:', refreshError);
          throw new Error('Session expired and refresh failed');
        }

        console.log('Session refreshed successfully');
        // Use the refreshed session
        session = refreshData.session;
      }

      console.log('Session found:', {
        hasToken: !!session.access_token,
        expiresAt: session.expires_at,
        expiresIn: session.expires_at ? session.expires_at - now : null,
      });

      // Create form data
      const formData = new FormData();
      formData.append('logo', file);
      formData.append('organizationId', organizationId.toString());

      const { data, error: functionError } = await supabase.functions.invoke(
        'process-org-logo',
        {
          body: formData,
        }
      );

      if (functionError) {
        let functionErrorMessage =
          functionError.message || 'Failed to upload logo';
        const contextBody = (functionError as { context?: { body?: unknown } })
          .context?.body;
        if (contextBody) {
          try {
            const parsedBody =
              typeof contextBody === 'string'
                ? JSON.parse(contextBody)
                : contextBody;
            if (
              parsedBody &&
              typeof parsedBody === 'object' &&
              'error' in parsedBody &&
              typeof parsedBody.error === 'string'
            ) {
              functionErrorMessage = parsedBody.error;
            }
          } catch (parseError) {
            console.warn('Error parsing function error body:', parseError);
          }
        }
        throw new Error(functionErrorMessage);
      }

      if (!data?.logoUrl) {
        throw new Error('Failed to upload logo');
      }

      onLogoChange(data.logoUrl);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload logo'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveLogo = async () => {
    if (!organizationId) return;

    try {
      // Delete from storage - try all possible logo files in org folder
      const possibleFiles = [
        `org-${organizationId}/logo.png`,
        `org-${organizationId}/logo.jpg`,
        `org-${organizationId}/logo.jpeg`,
        `org-${organizationId}/logo.svg`,
        `org-${organizationId}/logo.webp`,
      ];

      await supabase.storage.from('org-logos').remove(possibleFiles);

      onLogoChange(null);
      toast.success('Logo removed');
    } catch (error) {
      console.error('Error removing logo:', error);
      // Still update state even if storage delete fails
      onLogoChange(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Organization Logo
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Upload a logo to display in your organization's branding. Recommended
          size: 200x200px, max 5MB.
        </p>

        {/* Current logo preview */}
        {currentLogoUrl && (
          <div className="mb-4">
            <p className="text-xs text-slate-400 mb-2">Current logo:</p>
            <div className="inline-block p-4 bg-slate-800 rounded-lg border border-slate-700">
              <img
                src={currentLogoUrl}
                alt="Organization logo"
                className="max-w-24 max-h-24 object-contain"
              />
            </div>
          </div>
        )}

        {/* Upload controls */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded text-sm font-medium flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload Logo
              </>
            )}
          </button>

          {currentLogoUrl && (
            <button
              type="button"
              onClick={handleRemoveLogo}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium"
            >
              Remove Logo
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

export function BrandingSettings() {
  const { branding, updateBranding, isLoading, error } = useBranding();
  const { isSuperAdmin } = useAuth();
  const [localBranding, setLocalBranding] = useState(branding);
  const [isSaving, setIsSaving] = useState(false);

  // Update local state when branding changes
  React.useEffect(() => {
    setLocalBranding(branding);
  }, [branding]);

  const handleColorChange = (key: keyof BrandingConfig, value: string) => {
    if (!isSuperAdmin) return;
    if (!localBranding) return;
    setLocalBranding({
      ...localBranding,
      [key]: value,
    });
  };

  const handleLogoChange = (logoUrl: string | null) => {
    if (!isSuperAdmin) return;
    if (!localBranding) return;
    setLocalBranding({
      ...localBranding,
      logo_url: logoUrl,
    });
  };

  const handleSave = async () => {
    if (!localBranding) return;
    if (!isSuperAdmin) {
      toast.error('Only super admins can edit branding');
      return;
    }

    setIsSaving(true);
    try {
      await updateBranding(localBranding);
      toast.success('Branding updated successfully');
    } catch (err) {
      console.error('Error saving branding:', err);
      toast.error('Failed to save branding');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!isSuperAdmin) return;
    // Reset to Loughborough Sport defaults
    const defaults = {
      primary_color: '#361163',
      secondary_color: '#B70062',
      accent_color: '#E4002B',
      background_color: '#CBCECE',
      text_color: '#525E66',
      logo_url: null,
    };
    setLocalBranding(defaults);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-300 text-sm">
          Loading branding settings...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
        Error loading branding: {error}
      </div>
    );
  }

  if (!localBranding) {
    return (
      <div className="text-slate-400 text-center p-8">
        No branding configuration found
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Color Settings */}
      <div className="space-y-6">
        <h4 className="text-md font-medium text-slate-200">Colors</h4>
        {!isSuperAdmin && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-3 text-amber-200 text-sm">
            Branding edits are restricted to super admins.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ColorPicker
            label="Primary Color"
            value={localBranding.primary_color}
            onChange={(color) => handleColorChange('primary_color', color)}
            description="Used for buttons, links, and primary actions"
          />

          <ColorPicker
            label="Secondary Color"
            value={localBranding.secondary_color}
            onChange={(color) => handleColorChange('secondary_color', color)}
            description="Used for secondary elements and accents"
          />

          <ColorPicker
            label="Accent Color"
            value={localBranding.accent_color}
            onChange={(color) => handleColorChange('accent_color', color)}
            description="Used for highlights and call-to-action elements"
          />

          <ColorPicker
            label="Background Color"
            value={localBranding.background_color}
            onChange={(color) => handleColorChange('background_color', color)}
            description="Used for backgrounds and subtle elements"
          />

          <ColorPicker
            label="Text Color"
            value={localBranding.text_color}
            onChange={(color) => handleColorChange('text_color', color)}
            description="Used for secondary text and labels"
          />
        </div>
      </div>

      {/* Logo Settings */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-slate-200">Logo</h4>
        <LogoUploader
          currentLogoUrl={localBranding.logo_url}
          onLogoChange={handleLogoChange}
          isDisabled={!isSuperAdmin}
        />
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-slate-200">Preview</h4>
        <div className="bg-slate-900/50 rounded-lg border border-slate-700 p-6">
          <div className="space-y-4">
            {/* Logo preview */}
            {localBranding.logo_url && (
              <div className="flex items-center gap-4">
                <img
                  src={localBranding.logo_url}
                  alt="Logo preview"
                  className="w-12 h-12 object-contain"
                />
                <span className="text-slate-300">Organization Logo</span>
              </div>
            )}

            {/* Button preview */}
            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded text-sm font-medium"
                style={{
                  backgroundColor: localBranding.primary_color,
                  color: '#ffffff',
                }}
              >
                Primary Button
              </button>
              <button
                className="px-4 py-2 border rounded text-sm font-medium"
                style={{
                  borderColor: localBranding.secondary_color,
                  color: localBranding.secondary_color,
                }}
              >
                Secondary Button
              </button>
            </div>

            {/* Text preview */}
            <div className="space-y-2">
              <h3 style={{ color: localBranding.primary_color }}>
                Primary Color Heading
              </h3>
              <p style={{ color: localBranding.secondary_color }}>
                Secondary color text with{' '}
                <span style={{ color: localBranding.accent_color }}>
                  accent highlights
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-6 border-t border-slate-700">
        <button
          onClick={handleSave}
          disabled={isSaving || !isSuperAdmin}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded text-sm font-medium flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : (
            'Save Branding'
          )}
        </button>

        <button
          onClick={handleReset}
          disabled={!isSuperAdmin}
          className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-sm font-medium"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
