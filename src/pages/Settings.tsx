import { Typography } from '@mui/material';
import type { FC } from 'preact/compat';
import { MainLayout } from '../layouts/MainLayout';

export const Settings: FC = () => (
    <MainLayout>
        <Typography variant="h3" gutterBottom>Settings</Typography>
        <Typography variant="body1">Tu możesz skonfigurować ustawienia aplikacji.</Typography>
    </MainLayout>
);
