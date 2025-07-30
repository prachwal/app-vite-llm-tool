// Test Preact hooks i state management
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import { useState, useEffect } from 'preact/hooks';

// Komponent testowy z hookami Preact
const CounterComponent = () => {
    const [count, setCount] = useState(0);
    const [message, setMessage] = useState('Initial');

    useEffect(() => {
        if (count > 5) {
            setMessage('Count is high!');
        } else {
            setMessage('Count is normal');
        }
    }, [count]);

    return (
        <div>
            <p data-testid="count">Count: {count}</p>
            <p data-testid="message">{message}</p>
            <button onClick={() => setCount(count + 1)}>Increment</button>
            <button onClick={() => setCount(0)}>Reset</button>
        </div>
    );
};

// Komponent z props
const GreetingComponent = ({ name, age }: { name: string; age: number }) => {
    const [greeting, setGreeting] = useState(`Hello, ${name}!`);

    return (
        <div>
            <h1 data-testid="greeting">{greeting}</h1>
            <p data-testid="age">Age: {age}</p>
            <button onClick={() => setGreeting(`Hi there, ${name}!`)}>
                Change Greeting
            </button>
        </div>
    );
};

describe('Preact Hooks Tests', () => {
    describe('useState hook', () => {
        it('should handle state updates correctly', () => {
            render(<CounterComponent />);

            // Sprawdź początkowy stan
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 0');
            expect(screen.getByTestId('message')).toHaveTextContent('Count is normal');

            // Kliknij przycisk increment
            fireEvent.click(screen.getByText('Increment'));
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 1');

            // Kliknij kilka razy więcej
            fireEvent.click(screen.getByText('Increment'));
            fireEvent.click(screen.getByText('Increment'));
            fireEvent.click(screen.getByText('Increment'));
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 4');
        });

        it('should handle reset functionality', () => {
            render(<CounterComponent />);

            // Zwiększ licznik
            fireEvent.click(screen.getByText('Increment'));
            fireEvent.click(screen.getByText('Increment'));
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 2');

            // Reset
            fireEvent.click(screen.getByText('Reset'));
            expect(screen.getByTestId('count')).toHaveTextContent('Count: 0');
        });
    });

    describe('useEffect hook', () => {
        it('should trigger effects on state changes', () => {
            render(<CounterComponent />);

            // Początkowy message
            expect(screen.getByTestId('message')).toHaveTextContent('Count is normal');

            // Zwiększ count powyżej 5
            for (let i = 0; i < 6; i++) {
                fireEvent.click(screen.getByText('Increment'));
            }

            expect(screen.getByTestId('count')).toHaveTextContent('Count: 6');
            expect(screen.getByTestId('message')).toHaveTextContent('Count is high!');

            // Reset i sprawdź czy message się zmienił
            fireEvent.click(screen.getByText('Reset'));
            expect(screen.getByTestId('message')).toHaveTextContent('Count is normal');
        });
    });

    describe('Component props', () => {
        it('should render with props correctly', () => {
            render(<GreetingComponent name="John" age={25} />);

            expect(screen.getByTestId('greeting')).toHaveTextContent('Hello, John!');
            expect(screen.getByTestId('age')).toHaveTextContent('Age: 25');
        });

        it('should handle prop-based state changes', () => {
            render(<GreetingComponent name="Alice" age={30} />);

            expect(screen.getByTestId('greeting')).toHaveTextContent('Hello, Alice!');

            // Zmień greeting
            fireEvent.click(screen.getByText('Change Greeting'));
            expect(screen.getByTestId('greeting')).toHaveTextContent('Hi there, Alice!');
        });
    });

    describe('Event handling', () => {
        it('should handle multiple click events', () => {
            render(<CounterComponent />);

            const incrementButton = screen.getByText('Increment');

            // Kilka szybkich klików
            fireEvent.click(incrementButton);
            fireEvent.click(incrementButton);
            fireEvent.click(incrementButton);

            expect(screen.getByTestId('count')).toHaveTextContent('Count: 3');
        });

        it('should handle different event types', () => {
            const InputComponent = () => {
                const [value, setValue] = useState('');
                const [focused, setFocused] = useState(false);

                const handleChange = (e: Event) => {
                    setValue((e.target as HTMLInputElement).value);
                };

                const handleFocus = () => setFocused(true);
                const handleBlur = () => setFocused(false);

                return (
                    <div>
                        <input
                            data-testid="input"
                            value={value}
                            onChange={handleChange}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                        />
                        <p data-testid="value">Value: {value}</p>
                        <p data-testid="focus">Focused: {focused ? 'Yes' : 'No'}</p>
                    </div>
                );
            };

            render(<InputComponent />);

            const input = screen.getByTestId('input');

            // Test change event
            fireEvent.change(input, { target: { value: 'test input' } });
            expect(screen.getByTestId('value')).toHaveTextContent('Value: test input');

            // Test focus events
            fireEvent.focus(input);
            expect(screen.getByTestId('focus')).toHaveTextContent('Focused: Yes');

            fireEvent.blur(input);
            expect(screen.getByTestId('focus')).toHaveTextContent('Focused: No');
        });
    });
});
