import type { Meta, StoryObj } from '@storybook/preact';
import { MainLayout } from '../layouts/MainLayout';
import { Typography, Box, Card } from '@mui/material';

const meta: Meta<typeof MainLayout> = {
  title: 'Layout/MainLayout',
  component: MainLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Główny layout aplikacji z responsywną nawigacją, przełącznikiem motywów i półprzeźroczystym headerem.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MainLayout>;

const SampleContent = () => (
  <Box sx={{ py: 4 }}>
    <Typography variant="h3" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
      Przykładowa zawartość
    </Typography>
    <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
      To jest przykładowa zawartość strony pokazująca jak MainLayout renderuje się z różnymi motywami.
      Layout automatycznie dostosowuje kolory tła, tekstu i elementów nawigacyjnych.
    </Typography>
    
    <Box sx={{ mt: 4, display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' } }}>
      {[1, 2, 3].map((num) => (
        <Card key={num} sx={{ p: 3, bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'text.primary' }}>
            Karta {num}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Przykładowa karta pokazująca zastosowanie tokenów kolorów MUI w różnych motywach.
          </Typography>
        </Card>
      ))}
    </Box>
  </Box>
);

export const Default: Story = {
  name: 'Domyślny',
  render: () => (
    <MainLayout>
      <SampleContent />
    </MainLayout>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Standardowy layout z przykładową zawartością. Przetestuj różne motywy używając przełącznika w toolbar.',
      },
    },
  },
};

export const EmptyPage: Story = {
  name: 'Pusta strona',
  render: () => (
    <MainLayout>
      <Box sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'text.primary' }}>
          Pusta strona
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Minimalna zawartość do testowania layoutu.
        </Typography>
      </Box>
    </MainLayout>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Layout z minimalną zawartością.',
      },
    },
  },
};
