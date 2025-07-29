import { Header, type HeaderProps } from '../components/Header';

export default {
    title: 'Design System/Header',
    component: Header,
    tags: ['autodocs'],
    argTypes: {
        user: { control: 'object', description: 'Obiekt użytkownika' },
        onLogin: { action: 'login', description: 'Akcja logowania' },
        onLogout: { action: 'logout', description: 'Akcja wylogowania' },
        onCreateAccount: { action: 'createAccount', description: 'Akcja zakładania konta' },
    },
};

const Template = (args: HeaderProps) => <Header {...args} />;

export const LoggedIn = {
    render: Template,
    args: {
        user: { name: 'Jan Kowalski' },
    },
};

export const LoggedOut = {
    render: Template,
    args: {
        user: undefined,
    },
};
