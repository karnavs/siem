import { render, screen } from '@testing-library/react';
import { MitreTacticGrid } from '@/components/charts/MitreTacticGrid';

const sampleData = [
  { tacticId: 'TA0001', tacticName: 'Initial Access', count: 3 },
  { tacticId: 'TA0002', tacticName: 'Execution', count: 0 },
  { tacticId: 'TA0006', tacticName: 'Credential Access', count: 7 },
];

describe('MitreTacticGrid', () => {
  it('renders a cell for every tactic provided', () => {
    render(<MitreTacticGrid data={sampleData} />);
    expect(screen.getByText('TA0001')).toBeInTheDocument();
    expect(screen.getByText('TA0002')).toBeInTheDocument();
    expect(screen.getByText('TA0006')).toBeInTheDocument();
  });

  it('renders the alert count inside each cell', () => {
    render(<MitreTacticGrid data={sampleData} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders tactic names', () => {
    render(<MitreTacticGrid data={sampleData} />);
    expect(screen.getByText('Credential Access')).toBeInTheDocument();
  });
});
