
import { Button, type AppButtonProps } from '../components/Button';

export default {
    title: 'Design System/Button',
    component: Button,
    tags: ['autodocs'],
    argTypes: {
        label: { control: 'text', description: 'Tekst przycisku', required: true },
        color: { control: 'select', options: ['primary', 'secondary', 'success', 'error', 'info', 'warning'], description: 'Kolor MUI' },
        disabled: { control: 'boolean', description: 'Wyłączony' },
        variant: { control: 'select', options: ['contained', 'outlined', 'text'], description: 'Wariant MUI' },
        size: { control: 'select', options: ['small', 'medium', 'large'], description: 'Rozmiar' },
        onClick: { action: 'clicked', description: 'Akcja kliknięcia' },
    },
};

const Template = (args: AppButtonProps) => <Button {...args} />;

export const Default = {
    render: Template,
    args: {
        label: 'Przycisk',
        color: 'primary',
        variant: 'contained',
        size: 'large',
    },
};

export const Secondary = {
    render: Template,
    args: {
        label: 'Drugorzędny',
        color: 'secondary',
        variant: 'outlined',
        size: 'large',
    },
};

export const Disabled = {
    render: Template,
    args: {
        label: 'Wyłączony',
        disabled: true,
    },
};
