import { Button, Typography, Card, CardContent, Avatar, Stack, Link, Box } from '@mui/material';
import { Email, LinkedIn, GitHub } from '@mui/icons-material';

export interface BusinessCardProps {
    readonly name?: string;
    readonly title?: string;
    readonly description?: string;
    readonly avatarUrl?: string;
    readonly email?: string;
    readonly linkedin?: string;
    readonly github?: string;
    readonly portfolio?: string;
}

/**
 * Komponent wizytówki użytkownika
 * @param props - dane wizytówki
 */
export function BusinessCard({
    name = 'Jan Kowalski',
    title = 'Frontend Developer & AI Enthusiast',
    description = 'Tworzę nowoczesne aplikacje webowe z naciskiem na wydajność, dostępność i UX. Specjalizuję się w Preact, React, Vite oraz integracjach AI.',
    avatarUrl = '/vite.svg',
    email = 'jan.kowalski@email.com',
    linkedin = 'https://linkedin.com/in/jankowalski',
    github = 'https://github.com/jankowalski',
    portfolio = 'https://portfolio.jankowalski.dev',
}: BusinessCardProps) {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
            aria-label="Strona wizytówki"
        >
            <Card
                sx={{
                    maxWidth: { xs: '100%', sm: 600 },
                    width: '100%',
                    boxShadow: 6,
                    borderRadius: 4,
                    bgcolor: 'background.paper',
                    mx: { xs: 0, sm: 2 },
                }}
                aria-labelledby="main-title"
            >
                <CardContent>
                    <Stack spacing={3} alignItems="center">
                        <Avatar
                            src={avatarUrl}
                            alt="Zdjęcie profilowe"
                            sx={{ width: 96, height: 96, boxShadow: 2 }}
                        />
                        <Typography id="main-title" variant="h4" component="h1" fontWeight={700} textAlign="center">
                            {name}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary" textAlign="center">
                            {title}
                        </Typography>
                        <Typography variant="body1" textAlign="center">
                            {description}
                        </Typography>
                        <Stack direction="row" spacing={2} justifyContent="center" aria-label="Dane kontaktowe">
                            <Link href={`mailto:${email}`} aria-label="Wyślij email" color="inherit">
                                <Button startIcon={<Email />} size="large" variant="outlined">Email</Button>
                            </Link>
                            <Link href={linkedin} target="_blank" aria-label="LinkedIn" color="inherit">
                                <Button startIcon={<LinkedIn />} size="large" variant="outlined">LinkedIn</Button>
                            </Link>
                            <Link href={github} target="_blank" aria-label="GitHub" color="inherit">
                                <Button startIcon={<GitHub />} size="large" variant="outlined">GitHub</Button>
                            </Link>
                        </Stack>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            fullWidth
                            sx={{ mt: 2, fontWeight: 600 }}
                            aria-label="Zobacz portfolio"
                            href={portfolio}
                            target="_blank"
                        >
                            Zobacz portfolio
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
}
