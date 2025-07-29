import type { Meta, StoryObj } from '@storybook/preact';
import { ThemeModeIcon } from '../components/ThemeModeIcon';
import { Box, Typography } from '@mui/material';

const meta: Meta<typeof ThemeModeIcon> = {
    title: 'Design System/ThemeModeIcon',
    component: ThemeModeIcon,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component: 'Przełącznik motywów aplikacji z obsługą light/dark/system mode. Używa Preact Signals do zarządzania stanem.',
            },
        },
    },
    decorators: [
        (Story) => (
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" sx={{ color: 'text.primary' }}>
                    Przełącznik motywu:
                </Typography>
                <Story />
            </Box>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof ThemeModeIcon>;

export const Default: Story = {
    name: 'Domyślny',
    parameters: {
        docs: {
            description: {
                story: 'Standardowy przełącznik motywów z automatyczną detekcją aktualnego trybu.',
            },
        },
    },
};

export const InAppBar: Story = {
    name: 'W AppBar',
    decorators: [
        (Story) => (
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    p: 2,
                    borderRadius: 1,
                    boxShadow: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                <Typography variant="h6" sx={{ color: 'text.primary' }}>
                    Moja Aplikacja
                </Typography>
                <Story />
            </Box>
        ),
    ],
    parameters: {
        docs: {
            description: {
                story: 'Przełącznik motywów umieszczony w pasku nawigacyjnym aplikacji.',
            },
        },
    },
};

export const WithDescription: Story = {
    name: 'Z opisem',
    decorators: [
        (Story) => (
            <Box sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
                    Ustawienia motywu
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                    Wybierz preferowany motyw aplikacji. Opcja "System" automatycznie dostosuje się do ustawień systemu operacyjnego.
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Story />
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Aktualny motyw
                    </Typography>
                </Box>
            </Box>
        ),
    ],
    parameters: {
        docs: {
            description: {
                story: 'Przełącznik motywów z opisem funkcjonalności dla strony ustawień.',
            },
        },
    },
};
