import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import type { FC } from 'preact/compat';

interface CodeHighlighterProps {
    code: string;
    language: string;
    isFullscreen?: boolean;
}

// Map file extensions to Prism language identifiers
const getLanguageFromExtension = (extension: string): string => {
    const languageMap: Record<string, string> = {
        'js': 'javascript',
        'jsx': 'jsx',
        'ts': 'typescript',
        'tsx': 'tsx',
        'py': 'python',
        'python': 'python',
        'css': 'css',
        'scss': 'scss',
        'sass': 'sass',
        'less': 'less',
        'html': 'markup',
        'xml': 'xml',
        'svg': 'svg',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'md': 'markdown',
        'markdown': 'markdown',
        'sh': 'bash',
        'bash': 'bash',
        'zsh': 'bash',
        'fish': 'bash',
        'ps1': 'powershell',
        'sql': 'sql',
        'php': 'php',
        'java': 'java',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin',
        'dart': 'dart',
        'r': 'r',
        'matlab': 'matlab',
        'lua': 'lua',
        'perl': 'perl',
        'vim': 'vim',
        'dockerfile': 'docker',
        'gitignore': 'git',
        'ini': 'ini',
        'toml': 'toml',
        'graphql': 'graphql',
        'diff': 'diff',
        'patch': 'diff'
    };

    return languageMap[extension.toLowerCase()] || 'text';
};

export const CodeHighlighter: FC<CodeHighlighterProps> = ({
    code,
    language,
    isFullscreen = false
}) => {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    const prismLanguage = getLanguageFromExtension(language);

    return (
        <Box
            sx={{
                height: isFullscreen ? 'calc(80vh - 100px)' : '60vh',
                overflow: 'auto',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                '& pre': {
                    margin: '0 !important',
                    padding: '16px !important',
                    fontSize: '0.875rem !important',
                    lineHeight: '1.5 !important',
                    fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", "Monaco", monospace !important'
                }
            }}
        >
            <SyntaxHighlighter
                language={prismLanguage}
                style={isDarkMode ? oneDark : oneLight}
                showLineNumbers={code.split('\n').length > 10}
                wrapLines={true}
                customStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    margin: 0,
                    padding: '16px'
                }}
            >
                {code}
            </SyntaxHighlighter>
        </Box>
    );
};
