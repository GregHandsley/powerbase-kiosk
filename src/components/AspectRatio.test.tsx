import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AspectRatio } from './AspectRatio';

describe('AspectRatio', () => {
  it('renders children in the document', () => {
    render(
      <AspectRatio>
        <span>Kiosk</span>
      </AspectRatio>
    );
    expect(screen.getByText('Kiosk')).toBeInTheDocument();
  });
});
