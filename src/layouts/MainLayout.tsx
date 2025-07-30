import { AppBar, Toolbar, Typography, Box, Container, Link as MuiLink, useTheme, alpha } from '@mui/material';
import type { FC, PropsWithChildren } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import { ThemeModeIcon } from '../components/ThemeModeIcon';
import { useLocation } from 'preact-iso';

interface NavLink {
    readonly label: string;
    readonly href: string;
    readonly ariaLabel?: string;
}

const NAV_LINKS: NavLink[] = [
    { label: 'Home', href: '/', ariaLabel: 'Przejdź do strony głównej' },
    { label: 'About', href: '/about', ariaLabel: 'Przejdź do strony o nas' },
    { label: 'Settings', href: '/settings', ariaLabel: 'Przejdź do ustawień' },
    { label: 'Blobs', href: '/blobs', ariaLabel: 'Zarządzaj plikami w Netlify Blobs' },
] as const;

/**
 * Layout z nieruchomym, półprzeźroczystym headerem i responsywnym kontentem
 */
export const MainLayout: FC<PropsWithChildren> = ({ children }) => {
    const theme = useTheme();
    const location = useLocation();
    const currentPath = location?.url || '/';

    const isActive = (href: string): boolean => {
        return currentPath === href || (href !== '/' && currentPath.startsWith(href));
    };

    const { activeStyle, defaultStyle, appBarStyle } = useMemo(() => ({
        activeStyle: {
            mx: { xs: 1, sm: 2 },
            px: { xs: 1, sm: 2 },
            py: 1,
            fontWeight: 700,
            color: 'primary.main',
            borderBottom: 2,
            borderColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
                bgcolor: 'primary.light',
                color: 'primary.contrastText',
                transform: 'translateY(-1px)',
            },
        },
        defaultStyle: {
            mx: { xs: 1, sm: 2 },
            px: { xs: 1, sm: 2 },
            py: 1,
            color: 'text.primary',
            fontWeight: 500,
            borderRadius: 1,
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
                bgcolor: alpha(theme.palette.text.primary, 0.08),
                transform: 'translateY(-1px)',
            },
        },
        appBarStyle: {
            bgcolor: alpha(theme.palette.background.paper, 0.9),
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[2],
        },
    }), [theme, currentPath]);

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar
                position="fixed"
                sx={appBarStyle}
                elevation={0}
                component="header"
            >
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Typography
                        variant="h6"
                        component="h1"
                        sx={{
                            flexGrow: 1,
                            fontWeight: 600,
                            fontSize: { xs: '1.1rem', sm: '1.25rem' },
                            color: 'text.primary'
                        }}
                    >
                        Moja Aplikacja
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ThemeModeIcon />
                        <Box
                            component="nav"
                            aria-label="Nawigacja główna"
                            sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center' }}
                        >
                            {NAV_LINKS.map(({ label, href, ariaLabel }) => (
                                <MuiLink
                                    key={href}
                                    href={href}
                                    underline="none"
                                    aria-label={ariaLabel}
                                    sx={isActive(href) ? activeStyle : defaultStyle}
                                >
                                    {label}
                                </MuiLink>
                            ))}
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>

            <Toolbar component="div" /> {/* Spacer pod AppBar */}
            <Container
                maxWidth="lg"
                component="main"
                sx={{
                    py: { xs: 2, sm: 3, md: 4 },
                    px: { xs: 2, sm: 3 },
                    flex: 1,
                }}
            >
                {children}
            </Container>
        </Box>
    );
};
