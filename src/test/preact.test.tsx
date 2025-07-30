import { render, screen } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import { useState } from 'preact/hooks';

// Simple test component with hooks
const TestComponent = () => {
    const [count, setCount] = useState(0);

    return (
        <div>
            <span data-testid="count">{count}</span>
            <button data-testid="increment" onClick={() => setCount(c => c + 1)}>
                Increment
            </button>
        </div>
    );
};

describe('Preact Basic Test', () => {
    it('should render and use hooks correctly', async () => {
        render(<TestComponent />);

        const countElement = screen.getByTestId('count');
        expect(countElement).toHaveTextContent('0');

        const button = screen.getByTestId('increment');
        button.click();

        expect(countElement).toHaveTextContent('1');
    });
});
