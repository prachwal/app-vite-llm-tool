import { render, screen } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';

// Very simple Preact component without any external dependencies
const SimpleComponent = () => {
    return (
        <div>
            <h1>Simple Test</h1>
            <p>This is a basic Preact component</p>
        </div>
    );
};

describe('Simple Preact Component Test', () => {
    it('should render basic Preact component', () => {
        render(<SimpleComponent />);

        expect(screen.getByText('Simple Test')).toBeInTheDocument();
        expect(screen.getByText('This is a basic Preact component')).toBeInTheDocument();
    });
});
