import { render, screen } from '@testing-library/react';
import { SeverityBadge, StatusBadge } from '@/components/ui/Badge';

describe('SeverityBadge', () => {
  it('renders the severity label', () => {
    render(<SeverityBadge severity="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it.each(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const)('renders %s without throwing', (severity) => {
    render(<SeverityBadge severity={severity} />);
    expect(screen.getByText(severity)).toBeInTheDocument();
  });
});

describe('StatusBadge', () => {
  it('renders a human-readable label for OPEN', () => {
    render(<StatusBadge status="OPEN" />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders a human-readable label for FALSE_POSITIVE', () => {
    render(<StatusBadge status="FALSE_POSITIVE" />);
    expect(screen.getByText('False positive')).toBeInTheDocument();
  });
});
