import { BusinessCard, type BusinessCardProps } from '../components/BusinessCard';

export default {
    title: 'Design System/BusinessCard',
    component: BusinessCard,
    tags: ['autodocs'],
    argTypes: {
        name: { control: 'text', description: 'Imię i nazwisko' },
        title: { control: 'text', description: 'Stanowisko' },
        description: { control: 'text', description: 'Opis' },
        avatarUrl: { control: 'text', description: 'URL zdjęcia' },
        email: { control: 'text', description: 'Email' },
        linkedin: { control: 'text', description: 'LinkedIn' },
        github: { control: 'text', description: 'GitHub' },
        portfolio: { control: 'text', description: 'Portfolio' },
    },
};

const Template = (args: BusinessCardProps) => <BusinessCard {...args} />;

export const Default = {
    render: Template,
    args: {
        name: 'Jan Kowalski',
        title: 'Frontend Developer & AI Enthusiast',
        description: 'Tworzę nowoczesne aplikacje webowe z naciskiem na wydajność, dostępność i UX. Specjalizuję się w Preact, React, Vite oraz integracjach AI.',
        avatarUrl: '/vite.svg',
        email: 'jan.kowalski@email.com',
        linkedin: 'https://linkedin.com/in/jankowalski',
        github: 'https://github.com/jankowalski',
        portfolio: 'https://portfolio.jankowalski.dev',
    },
};

export const Custom = {
    render: Template,
    args: {
        name: 'Anna Nowak',
        title: 'UI Designer',
        description: 'Projektuję intuicyjne interfejsy i dbam o dostępność. Specjalizacja: Figma, MUI, Tailwind.',
        avatarUrl: '/assets/preact.svg',
        email: 'anna.nowak@email.com',
        linkedin: 'https://linkedin.com/in/annanowak',
        github: 'https://github.com/annanowak',
        portfolio: 'https://portfolio.annanowak.dev',
    },
};
