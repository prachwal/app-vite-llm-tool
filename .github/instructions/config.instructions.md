````instructions
# Standard dla Netlify Functions: Universal API Response & Error Handling

Każda funkcja serwerowa (np. w Netlify Functions) powinna:

- Zwracać odpowiedź w formacie uniwersalnego obiektu JSON:
  ```typescript
  {
    status: number,           // HTTP status code
    payload?: any,            // Response data (null for errors)
    error?: {                 // Error object (null for success)
      message: string,        // Human-readable error message
      code: string | number,  // Error code identifier
      details?: string        // Optional additional details
    } | null,
    metadata?: object         // Optional metadata object
  }
  ```
- Obsługiwać błędy przez strukturalny obiekt error (message, code, details)
- Używać helpera `apiResponse()` do generowania odpowiedzi
- Przykład implementacji:
  ```typescript
  import type { Context } from '@netlify/functions'
  import { apiResponse } from '../../types/ApiResponse.mts'

  export default (req: Request, context: Context): Response => {
    try {
      const url = new URL(req.url)
      const subject = url.searchParams.get('name') || 'World'
      return apiResponse({ message: `Hello ${subject}` }, 200)
    } catch (error) {
      return apiResponse(null, 500, {
        message: error instanceof Error ? error.message : String(error),
        code: 'INTERNAL_ERROR',
        details: error instanceof Error && error.stack ? error.stack : undefined
      })
    }
  }
  ```
- Routing table/mapowanie akcji na handlery stosować tylko w funkcjach obsługujących wiele endpointów (np. API CRUD)

**Ten wzorzec jest obowiązujący dla wszystkich funkcji serwerowych w projekcie.**

## Development Environment Configuration

### Port i serwer developmentu
**Port**: Używaj portu `8000` dla wszystkich serwisów Netlify
**Netlify Dev**: `netlify dev` domyślnie używa portu 8000
**Frontend**: Automatycznie wykrywa `localhost:8000` w trybie development
**Testowanie**: Wszystkie testy aplikacji web uruchamiaj na porcie 8000
**Nie używaj portów Vite ani domyślnych portów (5173)** – zawsze korzystaj z 8000

### Rozdzielenie requestów dla optymalizacji

#### Metadane bez danych binarnych
```typescript
// GET /blobs?action=METADATA&key=filename
{
  "status": 200,
  "payload": {
    "metadata": {
      "isBase64": true,
      "originalName": "file.mp3",
      "size": 735130,
      "type": "audio/mpeg",
      "uploadedAt": "2025-07-30T09:23:42.977Z"
    }
  },
  "error": null,
  "rawUrl": "http://localhost:8000/.netlify/functions/blobs?action=GET&key=filename&raw=true"
}
```

#### Surowe dane binarne
```typescript
// GET /blobs?action=GET&key=filename&raw=true
// Zwraca bezpośrednio Response z binarymi danymi:
// Headers: Content-Type, Content-Disposition, Accept-Ranges
// Body: ArrayBuffer z dekodowanymi danymi base64
```

### Rozpoznawanie typu plików we frontendzie
Frontend powinien rozpoznawać typy plików na podstawie:
1. **Content-Type** z metadanych
2. **Rozszerzenia pliku** z originalName
3. **Mapowanie MIME types** dla lepszej kompatybilności przeglądarek

```typescript
const detectFileType = (metadata: BlobMetadata): FileType => {
  const contentType = metadata.type as string;
  const fileName = metadata.originalName as string;
  
  // Priorytet: Content-Type > rozszerzenie pliku
  if (contentType?.startsWith('audio/')) return 'audio';
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType?.startsWith('image/')) return 'image';
  
  // Fallback na rozszerzenie
  const ext = fileName?.split('.').pop()?.toLowerCase();
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'avi'].includes(ext)) return 'video';
  if (['jpg', 'png', 'gif'].includes(ext)) return 'image';
  
  return 'unknown';
};
```

---
applyTo: '**'
---

# Vite + Preact + MUI - Profesjonalna Aplikacja Web

## Opis Projektu
Nowoczesna aplikacja web zbudowana w oparciu o:
- **Vite 7.0.6** - szybki build tool z HMR (Hot Module Replacement)
- **Preact 10.27.0** - lekka alternatywa dla React z pełną kompatybilnością
- **Material-UI v7.2.0** - system komponentów designu z tokenami kolorów
- **TypeScript 5.8.3** - typowanie statyczne dla lepszej jakości kodu
- **Preact ISO 2.9.2** - routing po stronie klienta z SSR support
- **Preact Signals 2.2.1** - reaktywne zarządzanie stanem
- **Emotion** - CSS-in-JS styling engine dla MUI
- **Storybook** - dokumentacja i rozwój komponentów w izolacji
- **Netlify** - deployment na edge functions

## Architektura Aplikacji

### Struktura Katalogów
```
src/
├── components/          # Komponenty UI (.tsx) - TYLKO prezentacja
│   ├── BusinessCard.tsx # Wizytówka biznesowa z kontaktami
│   └── ThemeModeIcon.tsx # Przełącznik motywów light/dark/system
├── layouts/            # Layouty aplikacji
│   └── MainLayout.tsx  # Główny layout z nawigacją i headerem
├── pages/              # Komponenty stron
│   ├── Home.tsx        # Strona główna z wizytówką
│   ├── About.tsx       # Strona informacyjna
│   └── Settings.tsx    # Strona ustawień
├── providers/          # Providery kontekstu
│   └── ThemeProvider.tsx # Zarządzanie motywami z localStorage
├── stories/            # Dokumentacja Storybook (.stories.tsx)
└── assets/             # Zasoby statyczne
```

### System Routingu
- **preact-iso**: Routing po stronie klienta z LocationProvider
- **Nawigacja**: Automatyczne wyróżnianie aktywnych linków
- **Ścieżki**: `/` (Home), `/about` (About), `/settings` (Settings)

### Zarządzanie Motywami
- **Preact Signals**: Reaktywny state management dla motywu
- **MUI ThemeProvider**: Centralne zarządzanie kolorami i stylami
- **Tryby**: light, dark, system (automatyczny na podstawie OS)
- **Persistence**: Zapisywanie preferencji w localStorage

## Wytyczne Kodowania

### 1. Komponenty i Architektura
- **Separacja odpowiedzialności**: Komponenty UI (.tsx) tylko prezentacja, logika w .ts
- **TypeScript**: Ścisłe typowanie z readonly interfaces
- **Funkcyjne komponenty**: Używaj hooks, unikaj class components
- **Props interfaces**: Zawsze definiuj interfejsy dla props komponentów

### 2. MUI Design System - Najlepsze Praktyki

#### Tokeny Kolorów (ZAWSZE używaj zamiast hardkodowanych wartości)
```tsx
// ✅ DOBRE - tokeny kolorów
color: 'text.primary'           // Tekst podstawowy
color: 'text.secondary'         // Tekst pomocniczy
bgcolor: 'background.paper'     // Tło komponentów
bgcolor: 'background.default'   // Tło strony
color: 'primary.main'           // Kolor główny marki
borderColor: 'divider'          // Linie podziału

// ❌ ZŁE - hardkodowane wartości
color: '#000000'
bgcolor: '#ffffff'
borderColor: 'rgba(0,0,0,0.12)'
```

#### Półprzeźroczystość z Tokenami
```tsx
import { alpha } from '@mui/material';

// ✅ DOBRE - alpha() z tokenami
bgcolor: alpha(theme.palette.background.paper, 0.9)
bgcolor: alpha(theme.palette.text.primary, 0.08)

// ❌ ZŁE - bezpośrednie RGBA
bgcolor: 'rgba(255,255,255,0.9)'
bgcolor: 'rgba(0,0,0,0.05)'
```

#### Cienie i Elevations
```tsx
// ✅ DOBRE - system cieni MUI
boxShadow: theme.shadows[2]     // Lekki cień
boxShadow: theme.shadows[4]     // Średni cień
elevation={2}                   // Dla Paper, Card components

// ❌ ZŁE - custom shadows
boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
```

#### Responsive Breakpoints
```tsx
// ✅ DOBRE - MUI breakpoints
sx={{
  fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' },
  padding: { xs: 1, sm: 2, md: 3 },
  display: { xs: 'none', sm: 'flex' }
}}

// Breakpoints: xs: 0px, sm: 600px, md: 900px, lg: 1200px, xl: 1536px
```

#### Nowoczesne API MUI v7
```tsx
// ✅ DOBRE - nowe API
<Card styles={{ body: { padding: '16px' } }}>
  <Input size="large" />
</Card>

// ❌ ZŁE - przestarzałe API
<Card bodyStyle={{ padding: '16px' }}>
  <input type="text" />
</Card>
```

### 3. Preact Signals - State Management
```tsx
import { signal } from '@preact/signals';

// Definicja sygnału
const themeMode = signal<'light' | 'dark' | 'system'>('system');

// Użycie w komponencie
export const ThemeProvider = () => {
  const currentMode = themeMode.value;
  
  const setThemeMode = (mode: typeof themeMode.value) => {
    themeMode.value = mode;
    localStorage.setItem('theme-mode', mode);
  };
};
```

### 4. Routing z preact-iso
```tsx
import { LocationProvider, Router, Route } from 'preact-iso';

// Setup w głównej aplikacji
<LocationProvider>
  <Router>
    <Route path="/" component={Home} />
    <Route path="/about" component={About} />
    <Route default component={NotFound} />
  </Router>
</LocationProvider>

// Nawigacja z wykrywaniem aktywnych linków
const isActive = (href: string): boolean => {
  return currentPath === href || (href !== '/' && currentPath.startsWith(href));
};
```

### 5. Performance i Optymalizacja
```tsx
import { useMemo } from 'preact/hooks';

// Memoizacja kosztownych obliczeń stylów
const { activeStyle, defaultStyle } = useMemo(() => ({
  activeStyle: { /* style definitions */ },
  defaultStyle: { /* style definitions */ }
}), [theme, currentPath]);
```

### 6. Accessibility (A11Y)
```tsx
// Semantic HTML
<Box component="nav" aria-label="Nawigacja główna">
<Typography component="h1" variant="h6">

// ARIA attributes
aria-label="Przejdź do strony głównej"
aria-current={isActive ? 'page' : undefined}

// Focus management
autoFocus
tabIndex={0}
```

### 7. Storybook Documentation
- **KAŻDY KOMPONENT** musi mieć plik `.stories.tsx`
- Dokumentuj wszystkie props i warianty
- Używaj `tags: ['autodocs']` dla automatycznej dokumentacji
- Interaktywne controls dla wszystkich props

### 8. Deployment (Netlify)
- **Netlify Functions**: Serverless backend w `/netlify/functions/`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**: Konfiguracja w Netlify dashboard

## Konwencje Projektowe

### Naming Conventions
- **Komponenty**: PascalCase (`BusinessCard.tsx`)
- **Pliki**: kebab-case (`theme-provider.ts`)
- **Interfaces**: PascalCase z suffix (`NavLink`, `BusinessCardProps`)
- **Signals**: camelCase (`themeMode`)

### Import Organization
```tsx
// 1. External libraries
import { AppBar, Toolbar } from '@mui/material';
import type { FC } from 'preact/compat';

// 2. Internal components
import { ThemeModeIcon } from '../components/ThemeModeIcon';

// 3. Utilities and types
import type { NavLink } from './types';
```

### Error Handling
- **Graceful degradation**: Zawsze przewiduj fallback states
- **Loading states**: Użyj MUI Skeleton lub CircularProgress
- **Error boundaries**: Implementuj dla krytycznych komponentów
- **Network errors**: Obsługa offline/online states

### Testing Strategy
- **Unit tests**: Każdy plik .ts MUSI mieć .test.ts
- **Component tests**: @testing-library/preact dla .tsx
- **100% coverage**: Wszystkie ścieżki kodu i edge cases
- **Mock zewnętrzne zależności**: API calls, localStorage

## Przykłady Implementacji

### Responsive Component
```tsx
const BusinessCard: FC<BusinessCardProps> = ({ name, email, phone }) => (
  <Card
    sx={{
      maxWidth: { xs: '100%', sm: 600, md: 800 },
      margin: 'auto',
      bgcolor: 'background.paper',
      boxShadow: theme.shadows[3]
    }}
    styles={{
      body: { 
        padding: { xs: 2, sm: 3, md: 4 } 
      }
    }}
  >
    <Typography 
      variant="h4" 
      component="h1"
      sx={{ 
        color: 'text.primary',
        fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' }
      }}
    >
      {name}
    </Typography>
  </Card>
);
```

### Theme-Aware Styling
```tsx
const Navigation: FC = () => {
  const theme = useTheme();
  
  const navStyle = useMemo(() => ({
    bgcolor: alpha(theme.palette.background.paper, 0.9),
    backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[2]
  }), [theme]);

  return (
    <AppBar sx={navStyle}>
      {/* navigation content */}
    </AppBar>
  );
};
```

## Wskazówki Debugowania

### Vite HMR Issues
- **WebSocket**: Sprawdź `clientPort` w vite.config.ts
- **CORS**: Konfiguruj `server.cors` dla external APIs
- **Environment**: Użyj `import.meta.env` zamiast `process.env`

### MUI Theme Issues
- **Console warnings**: Zawsze sprawdzaj i aktualizuj deprecated props
- **Color tokens**: Sprawdź `theme.palette` w dev tools
- **Breakpoints**: Testuj responsive design z różnymi rozmiarami

### Preact vs React
- **Import paths**: `import { useState } from 'preact/hooks'`
- **Type definitions**: `import type { FC } from 'preact/compat'`
- **Event handling**: Niektóre eventy mogą się różnić od React

Projekt ma na celu dostarczenie profesjonalnej, skalowalnej aplikacji z nowoczesnym stackiem technologicznym, zachowując najlepsze praktyki development i accessibility.
````
---
applyTo: '**'
---

# Vite + Preact + MUI - Profesjonalna Aplikacja Web

## Opis Projektu
Nowoczesna aplikacja web zbudowana w oparciu o:
- **Vite 7.0.6** - szybki build tool z HMR (Hot Module Replacement)
- **Preact 10.27.0** - lekka alternatywa dla React z pełną kompatybilnością
- **Material-UI v7.2.0** - system komponentów designu z tokenami kolorów
- **TypeScript 5.8.3** - typowanie statyczne dla lepszej jakości kodu
- **Preact ISO 2.9.2** - routing po stronie klienta z SSR support
- **Preact Signals 2.2.1** - reaktywne zarządzanie stanem
- **Emotion** - CSS-in-JS styling engine dla MUI
- **Storybook** - dokumentacja i rozwój komponentów w izolacji
- **Netlify** - deployment na edge functions

## Architektura Aplikacji

### Struktura Katalogów
```
src/
├── components/          # Komponenty UI (.tsx) - TYLKO prezentacja
│   ├── BusinessCard.tsx # Wizytówka biznesowa z kontaktami
│   └── ThemeModeIcon.tsx # Przełącznik motywów light/dark/system
├── layouts/            # Layouty aplikacji
│   └── MainLayout.tsx  # Główny layout z nawigacją i headerem
├── pages/              # Komponenty stron
│   ├── Home.tsx        # Strona główna z wizytówką
│   ├── About.tsx       # Strona informacyjna
│   └── Settings.tsx    # Strona ustawień
├── providers/          # Providery kontekstu
│   └── ThemeProvider.tsx # Zarządzanie motywami z localStorage
├── stories/            # Dokumentacja Storybook (.stories.tsx)
└── assets/             # Zasoby statyczne
```

### System Routingu
- **preact-iso**: Routing po stronie klienta z LocationProvider
- **Nawigacja**: Automatyczne wyróżnianie aktywnych linków
- **Ścieżki**: `/` (Home), `/about` (About), `/settings` (Settings)

### Zarządzanie Motywami
- **Preact Signals**: Reaktywny state management dla motywu
- **MUI ThemeProvider**: Centralne zarządzanie kolorami i stylami
- **Tryby**: light, dark, system (automatyczny na podstawie OS)
- **Persistence**: Zapisywanie preferencji w localStorage

## Wytyczne Kodowania

### 1. Komponenty i Architektura
- **Separacja odpowiedzialności**: Komponenty UI (.tsx) tylko prezentacja, logika w .ts
- **TypeScript**: Ścisłe typowanie z readonly interfaces
- **Funkcyjne komponenty**: Używaj hooks, unikaj class components
- **Props interfaces**: Zawsze definiuj interfejsy dla props komponentów

### 2. MUI Design System - Najlepsze Praktyki

#### Tokeny Kolorów (ZAWSZE używaj zamiast hardkodowanych wartości)
```tsx
// ✅ DOBRE - tokeny kolorów
color: 'text.primary'           // Tekst podstawowy
color: 'text.secondary'         // Tekst pomocniczy
bgcolor: 'background.paper'     // Tło komponentów
bgcolor: 'background.default'   // Tło strony
color: 'primary.main'           // Kolor główny marki
borderColor: 'divider'          // Linie podziału

// ❌ ZŁE - hardkodowane wartości
color: '#000000'
bgcolor: '#ffffff'
borderColor: 'rgba(0,0,0,0.12)'
```

#### Półprzeźroczystość z Tokenami
```tsx
import { alpha } from '@mui/material';

// ✅ DOBRE - alpha() z tokenami
bgcolor: alpha(theme.palette.background.paper, 0.9)
bgcolor: alpha(theme.palette.text.primary, 0.08)

// ❌ ZŁE - bezpośrednie RGBA
bgcolor: 'rgba(255,255,255,0.9)'
bgcolor: 'rgba(0,0,0,0.05)'
```

#### Cienie i Elevations
```tsx
// ✅ DOBRE - system cieni MUI
boxShadow: theme.shadows[2]     // Lekki cień
boxShadow: theme.shadows[4]     // Średni cień
elevation={2}                   // Dla Paper, Card components

// ❌ ZŁE - custom shadows
boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
```

#### Responsive Breakpoints
```tsx
// ✅ DOBRE - MUI breakpoints
sx={{
  fontSize: { xs: '1rem', sm: '1.25rem', md: '1.5rem' },
  padding: { xs: 1, sm: 2, md: 3 },
  display: { xs: 'none', sm: 'flex' }
}}

// Breakpoints: xs: 0px, sm: 600px, md: 900px, lg: 1200px, xl: 1536px
```

#### Nowoczesne API MUI v7
```tsx
// ✅ DOBRE - nowe API
<Card styles={{ body: { padding: '16px' } }}>
  <Input size="large" />
</Card>

// ❌ ZŁE - przestarzałe API
<Card bodyStyle={{ padding: '16px' }}>
  <input type="text" />
</Card>
```

### 3. Preact Signals - State Management
```tsx
import { signal } from '@preact/signals';

// Definicja sygnału
const themeMode = signal<'light' | 'dark' | 'system'>('system');

// Użycie w komponencie
export const ThemeProvider = () => {
  const currentMode = themeMode.value;
  
  const setThemeMode = (mode: typeof themeMode.value) => {
    themeMode.value = mode;
    localStorage.setItem('theme-mode', mode);
  };
};
```

### 4. Routing z preact-iso
```tsx
import { LocationProvider, Router, Route } from 'preact-iso';

// Setup w głównej aplikacji
<LocationProvider>
  <Router>
    <Route path="/" component={Home} />
    <Route path="/about" component={About} />
    <Route default component={NotFound} />
  </Router>
</LocationProvider>

// Nawigacja z wykrywaniem aktywnych linków
const isActive = (href: string): boolean => {
  return currentPath === href || (href !== '/' && currentPath.startsWith(href));
};
```

### 5. Performance i Optymalizacja
```tsx
import { useMemo } from 'preact/hooks';

// Memoizacja kosztownych obliczeń stylów
const { activeStyle, defaultStyle } = useMemo(() => ({
  activeStyle: { /* style definitions */ },
  defaultStyle: { /* style definitions */ }
}), [theme, currentPath]);
```

### 6. Accessibility (A11Y)
```tsx
// Semantic HTML
<Box component="nav" aria-label="Nawigacja główna">
<Typography component="h1" variant="h6">

// ARIA attributes
aria-label="Przejdź do strony głównej"
aria-current={isActive ? 'page' : undefined}

// Focus management
autoFocus
tabIndex={0}
```

### 7. Storybook Documentation
- **KAŻDY KOMPONENT** musi mieć plik `.stories.tsx`
- Dokumentuj wszystkie props i warianty
- Używaj `tags: ['autodocs']` dla automatycznej dokumentacji
- Interaktywne controls dla wszystkich props

### 8. Deployment (Netlify)
- **Netlify Functions**: Serverless backend w `/netlify/functions/`
- **Build Command**: `npm run build`
- **Publish Directory**: `dist`
- **Environment Variables**: Konfiguracja w Netlify dashboard

## Konwencje Projektowe

### Naming Conventions
- **Komponenty**: PascalCase (`BusinessCard.tsx`)
- **Pliki**: kebab-case (`theme-provider.ts`)
- **Interfaces**: PascalCase z suffix (`NavLink`, `BusinessCardProps`)
- **Signals**: camelCase (`themeMode`)

### Import Organization
```tsx
// 1. External libraries
import { AppBar, Toolbar } from '@mui/material';
import type { FC } from 'preact/compat';

// 2. Internal components
import { ThemeModeIcon } from '../components/ThemeModeIcon';

// 3. Utilities and types
import type { NavLink } from './types';
```

### Error Handling
- **Graceful degradation**: Zawsze przewiduj fallback states
- **Loading states**: Użyj MUI Skeleton lub CircularProgress
- **Error boundaries**: Implementuj dla krytycznych komponentów
- **Network errors**: Obsługa offline/online states

### Testing Strategy
- **Unit tests**: Każdy plik .ts MUSI mieć .test.ts
- **Component tests**: @testing-library/preact dla .tsx
- **100% coverage**: Wszystkie ścieżki kodu i edge cases
- **Mock zewnętrzne zależności**: API calls, localStorage

## Przykłady Implementacji

### Responsive Component
```tsx
const BusinessCard: FC<BusinessCardProps> = ({ name, email, phone }) => (
  <Card
    sx={{
      maxWidth: { xs: '100%', sm: 600, md: 800 },
      margin: 'auto',
      bgcolor: 'background.paper',
      boxShadow: theme.shadows[3]
    }}
    styles={{
      body: { 
        padding: { xs: 2, sm: 3, md: 4 } 
      }
    }}
  >
    <Typography 
      variant="h4" 
      component="h1"
      sx={{ 
        color: 'text.primary',
        fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' }
      }}
    >
      {name}
    </Typography>
  </Card>
);
```

### Theme-Aware Styling
```tsx
const Navigation: FC = () => {
  const theme = useTheme();
  
  const navStyle = useMemo(() => ({
    bgcolor: alpha(theme.palette.background.paper, 0.9),
    backdropFilter: 'blur(12px)',
    borderBottom: `1px solid ${theme.palette.divider}`,
    boxShadow: theme.shadows[2]
  }), [theme]);

  return (
    <AppBar sx={navStyle}>
      {/* navigation content */}
    </AppBar>
  );
};
```

## Wskazówki Debugowania

### Vite HMR Issues
- **WebSocket**: Sprawdź `clientPort` w vite.config.ts
- **CORS**: Konfiguruj `server.cors` dla external APIs
- **Environment**: Użyj `import.meta.env` zamiast `process.env`

### MUI Theme Issues
- **Console warnings**: Zawsze sprawdzaj i aktualizuj deprecated props
- **Color tokens**: Sprawdź `theme.palette` w dev tools
- **Breakpoints**: Testuj responsive design z różnymi rozmiarami

### Preact vs React
- **Import paths**: `import { useState } from 'preact/hooks'`
- **Type definitions**: `import type { FC } from 'preact/compat'`
- **Event handling**: Niektóre eventy mogą się różnić od React

Projekt ma na celu dostarczenie profesjonalnej, skalowalnej aplikacji z nowoczesnym stackiem technologicznym, zachowując najlepsze praktyki development i accessibility.