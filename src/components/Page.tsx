import type { FC } from 'preact/compat';
import { useState } from 'preact/hooks';
import { Container, Typography, Box } from '@mui/material';
import { Header } from './Header';
import { BusinessCard } from './BusinessCard';

/**
 * Strona demonstracyjna z nagłówkiem i sekcją treści
 */
export const Page: FC = () => {
    const [user, setUser] = useState<{ name: string } | undefined>();

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Header
                user={user}
                onLogin={() => setUser({ name: 'Jan Kowalski' })}
                onLogout={() => setUser(undefined)}
                onCreateAccount={() => setUser({ name: 'Jan Kowalski' })}
            />
            <Box sx={{ mt: 4 }}>
                <BusinessCard />
                <Typography variant="h4" gutterBottom sx={{ mt: 6 }}>Strona w Storybook</Typography>
                <Typography variant="body1" component="p">
                    Buduj interfejsy w oparciu o komponenty, zaczynając od atomowych elementów, kończąc na stronach.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Renderuj strony z mockowanymi danymi, testuj stany bez konieczności nawigacji w aplikacji.
                </Typography>
            </Box>
        </Container>
    );
}
