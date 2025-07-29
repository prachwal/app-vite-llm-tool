import { Typography } from '@mui/material';
import type { FC } from 'preact/compat';
import { MainLayout } from '../layouts/MainLayout';

export const About: FC = () => (
    <MainLayout>
        <Typography variant="h3" gutterBottom>About</Typography>
        <Typography variant="body1">To jest przykładowa strona "O nas". Tu możesz opisać swój projekt.</Typography>
    </MainLayout>
);
