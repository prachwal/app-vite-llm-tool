import type { Preview } from '@storybook/preact-vite';
import { ThemeProvider, setThemeMode, type ThemeMode } from '../src/providers/ThemeProvider';
import { createElement } from 'preact';
import { LocationProvider } from 'preact-iso';

// Wrapper do izolacji router context dla Storybook
const StorybookWrapper = ({ children }: { children: any }) => {
  return createElement(LocationProvider, null, children);
};

// Decorator do opakowywania stories w ThemeProvider i Router
const withThemeProvider = (Story: any, context: any) => {
  const theme = context.globals.theme || 'light';

  // Ustawiamy motyw w naszym systemie
  setThemeMode(theme as ThemeMode);

  return createElement(StorybookWrapper, null,
    createElement(ThemeProvider, null,
      createElement('div', { style: { minHeight: '100vh', padding: '20px' } },
        createElement(Story, context.args)
      )
    )
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The 'docs' object is now empty or can be removed if not otherwise needed
    docs: {},
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light', icon: 'sun' },
          { value: 'dark', title: 'Dark', icon: 'moon' },
          { value: 'system', title: 'System', icon: 'browser' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withThemeProvider],
};

export default preview;