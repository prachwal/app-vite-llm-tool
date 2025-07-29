import type { FC } from 'preact/compat';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';

export interface HeaderProps {
    user?: { name: string };
    onLogin: () => void;
    onLogout: () => void;
    onCreateAccount: () => void;
}

/**
 * Nagłówek aplikacji z obsługą logowania
 * @param props - props komponentu
 */
export const Header: FC<HeaderProps> = ({ user, onLogin, onLogout, onCreateAccount }) => (
    <AppBar position="static" color="default" elevation={2}>
        <Toolbar>
            <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div">
                    Acme
                </Typography>
            </Box>
            {user ? (
                <>
                    <Typography variant="body1" sx={{ mr: 2 }}>
                        Witaj, <b>{user.name}</b>!
                    </Typography>
                    <Button color="inherit" onClick={onLogout} size="large">Wyloguj</Button>
                </>
            ) : (
                <>
                    <Button color="inherit" onClick={onLogin} size="large">Zaloguj</Button>
                    <Button color="primary" variant="contained" onClick={onCreateAccount} size="large" sx={{ ml: 1 }}>Załóż konto</Button>
                </>
            )}
        </Toolbar>
    </AppBar>
);
