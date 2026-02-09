import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePrimaryOrganizationId } from '../hooks/usePermissions';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

export interface BrandingConfig {
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  background_color: string;
  text_color: string;
  logo_url?: string | null;
}

interface BrandingContextType {
  branding: BrandingConfig | null;
  isLoading: boolean;
  error: string | null;
  updateBranding: (newBranding: Partial<BrandingConfig>) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(
  undefined
);

const toRgb = (hexColor: string) => {
  const cleaned = hexColor.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return `${r} ${g} ${b}`;
  }
  const normalized = cleaned.length === 8 ? cleaned.slice(0, 6) : cleaned;
  if (normalized.length !== 6) {
    return null;
  }
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

// Loughborough Sport default branding
const DEFAULT_BRANDING: BrandingConfig = {
  primary_color: '#361163', // African Violet
  secondary_color: '#B70062', // Mulberry
  accent_color: '#E4002B', // Mercia Red
  background_color: '#CBCECE', // Fountain Grey
  text_color: '#525E66', // Asphalt
  logo_url: null,
};

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { organizationId } = usePrimaryOrganizationId();
  const { isSuperAdmin } = useAuth();
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Apply CSS variables to document root
  const applyTheme = React.useCallback((brand: BrandingConfig) => {
    const root = document.documentElement;

    // Set CSS custom properties
    root.style.setProperty('--brand-primary', brand.primary_color);
    root.style.setProperty('--brand-secondary', brand.secondary_color);
    root.style.setProperty('--brand-accent', brand.accent_color);
    root.style.setProperty('--brand-background', brand.background_color);
    root.style.setProperty('--brand-text', brand.text_color);
    const primaryRgb = toRgb(brand.primary_color);
    const secondaryRgb = toRgb(brand.secondary_color);
    const accentRgb = toRgb(brand.accent_color);
    const backgroundRgb = toRgb(brand.background_color);
    const textRgb = toRgb(brand.text_color);

    if (primaryRgb) {
      root.style.setProperty('--brand-primary-rgb', primaryRgb);
    }
    if (secondaryRgb) {
      root.style.setProperty('--brand-secondary-rgb', secondaryRgb);
    }
    if (accentRgb) {
      root.style.setProperty('--brand-accent-rgb', accentRgb);
    }
    if (backgroundRgb) {
      root.style.setProperty('--brand-background-rgb', backgroundRgb);
    }
    if (textRgb) {
      root.style.setProperty('--brand-text-rgb', textRgb);
    }

    // Set logo URL as CSS variable
    if (brand.logo_url) {
      root.style.setProperty('--brand-logo-url', `url(${brand.logo_url})`);
    } else {
      root.style.setProperty('--brand-logo-url', 'none');
    }
  }, []);

  // Load branding configuration
  useEffect(() => {
    const loadBranding = async () => {
      if (!organizationId) {
        setBranding(DEFAULT_BRANDING);
        applyTheme(DEFAULT_BRANDING);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Call database function to get branding
        const { data, error } = await supabase.rpc(
          'get_organization_branding',
          {
            p_organization_id: organizationId,
          }
        );

        if (error) {
          console.error('Error loading branding:', error);
          setError('Failed to load branding configuration');
          // Fall back to defaults
          setBranding(DEFAULT_BRANDING);
          applyTheme(DEFAULT_BRANDING);
          return;
        }

        const brandConfig: BrandingConfig = data || DEFAULT_BRANDING;
        setBranding(brandConfig);
        applyTheme(brandConfig);
      } catch (err) {
        console.error('Unexpected error loading branding:', err);
        setError('Unexpected error loading branding');
        setBranding(DEFAULT_BRANDING);
        applyTheme(DEFAULT_BRANDING);
      } finally {
        setIsLoading(false);
      }
    };

    loadBranding();
  }, [organizationId, applyTheme]);

  // Update branding configuration
  const updateBranding = async (newBranding: Partial<BrandingConfig>) => {
    if (!organizationId) {
      throw new Error('No organization selected');
    }
    if (!isSuperAdmin) {
      throw new Error('Only super admins can edit branding');
    }

    try {
      // Merge with current branding
      const currentBranding = branding || DEFAULT_BRANDING;
      const updatedBranding = { ...currentBranding, ...newBranding };

      // Validate colors (basic client-side validation)
      const hexRegex = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/;
      if (!hexRegex.test(updatedBranding.primary_color)) {
        throw new Error('Invalid primary color format');
      }
      if (!hexRegex.test(updatedBranding.secondary_color)) {
        throw new Error('Invalid secondary color format');
      }

      // Update in database
      const { error } = await supabase
        .from('organizations')
        .update({
          settings: {
            branding: updatedBranding,
          },
        })
        .eq('id', organizationId);

      if (error) {
        throw new Error(error.message);
      }

      // Update local state and apply theme
      setBranding(updatedBranding);
      applyTheme(updatedBranding);
    } catch (err) {
      console.error('Error updating branding:', err);
      throw err;
    }
  };

  const value: BrandingContextType = {
    branding,
    isLoading,
    error,
    updateBranding,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}

// Hook to get current branding values with defaults
// eslint-disable-next-line react-refresh/only-export-components
export function useBrandColors() {
  const { branding } = useBranding();
  return branding || DEFAULT_BRANDING;
}
