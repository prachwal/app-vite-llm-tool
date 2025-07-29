import { Button as MuiButton, type ButtonProps } from '@mui/material';
import type { FC } from 'preact/compat';

export interface AppButtonProps extends ButtonProps {
    label: string;
}

/**
 * Uniwersalny przycisk aplikacji zgodny z MUI
 * @param props - props komponentu
 */
export const Button: FC<AppButtonProps> = ({ label, ...props }) => (
    <MuiButton size="large" variant="contained" {...props}>
        {label}
    </MuiButton>
);
