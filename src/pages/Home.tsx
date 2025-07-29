import { Typography } from '@mui/material';
import type { FC } from 'preact/compat';
import { MainLayout } from '../layouts/MainLayout';

export const Home: FC = () => (
    <MainLayout>
        <Typography variant="h3" gutterBottom>Home</Typography>
        <Typography variant="body1">Witamy na stronie głównej aplikacji!</Typography>
    </MainLayout>
);
