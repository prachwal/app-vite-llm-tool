import { Typography, Stack, Divider } from '@mui/material';
import type { FC } from 'preact/compat';
import { MainLayout } from '../layouts/MainLayout';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { TypographySettings } from '../components/settings/TypographySettings';
import { ColorTokens } from '../components/settings/ColorTokens';

export const Settings: FC = () => (
    <MainLayout>
        <Typography variant="h3" gutterBottom>Settings</Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
            Customize your application appearance and behavior
        </Typography>

        <Stack spacing={4}>
            {/* Theme Settings */}
            <ThemeSettings />

            {/* Typography Settings */}
            <TypographySettings />

            <Divider />

            {/* Color Tokens Visualization */}
            <ColorTokens />
        </Stack>
    </MainLayout>
);
