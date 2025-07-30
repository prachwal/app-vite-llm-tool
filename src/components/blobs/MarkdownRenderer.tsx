import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import type { FC } from 'preact/compat';
import { CodeHighlighter } from './CodeHighlighter';

interface MarkdownRendererProps {
    content: string;
    isFullscreen?: boolean;
}

export const MarkdownRenderer: FC<MarkdownRendererProps> = ({
    content,
    isFullscreen = false
}) => {
    const theme = useTheme();

    return (
        <Box
            sx={{
                height: isFullscreen ? 'calc(80vh - 100px)' : '60vh',
                overflow: 'auto',
                p: 3,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                '& > *:first-of-type': { mt: 0 },
                '& > *:last-child': { mb: 0 },
                // Markdown styling
                '& h1': {
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    marginTop: '1.5rem',
                    marginBottom: '1rem',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    paddingBottom: '0.5rem'
                },
                '& h2': {
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    marginTop: '1.5rem',
                    marginBottom: '0.75rem'
                },
                '& h3': {
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    marginTop: '1rem',
                    marginBottom: '0.5rem'
                },
                '& h4, & h5, & h6': {
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    marginTop: '1rem',
                    marginBottom: '0.5rem'
                },
                '& p': {
                    marginBottom: '1rem',
                    lineHeight: 1.6
                },
                '& ul, & ol': {
                    marginBottom: '1rem',
                    paddingLeft: '1.5rem'
                },
                '& li': {
                    marginBottom: '0.25rem'
                },
                '& blockquote': {
                    borderLeft: '4px solid',
                    borderColor: 'primary.main',
                    backgroundColor: theme.palette.action.hover,
                    padding: '1rem',
                    margin: '1rem 0',
                    fontStyle: 'italic'
                },
                '& code': {
                    backgroundColor: theme.palette.action.hover,
                    padding: '0.125rem 0.25rem',
                    borderRadius: '0.25rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875em'
                },
                '& pre': {
                    backgroundColor: theme.palette.action.hover,
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    overflow: 'auto',
                    margin: '1rem 0'
                },
                '& table': {
                    width: '100%',
                    borderCollapse: 'collapse',
                    margin: '1rem 0'
                },
                '& th, & td': {
                    border: '1px solid',
                    borderColor: 'divider',
                    padding: '0.5rem',
                    textAlign: 'left'
                },
                '& th': {
                    backgroundColor: theme.palette.action.hover,
                    fontWeight: 'bold'
                },
                '& img': {
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '0.5rem',
                    margin: '1rem 0'
                },
                '& a': {
                    color: theme.palette.primary.main,
                    textDecoration: 'underline'
                },
                '& hr': {
                    border: 'none',
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    margin: '2rem 0'
                }
            }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                    code: ({ className, children, ...props }) => {
                        const classNameStr = typeof className === 'string' ? className : (className?.value || '');
                        const match = /language-(\w+)/.exec(classNameStr);
                        const language = match ? match[1] : '';

                        // Extract code content safely
                        let codeContent = '';
                        if (typeof children === 'string') {
                            codeContent = children;
                        } else if (Array.isArray(children)) {
                            codeContent = children
                                .filter(child => typeof child === 'string')
                                .join('');
                        } else if (children) {
                            // Try to convert to string, but avoid [object Object]
                            try {
                                if (typeof children.toString === 'function') {
                                    const childStr = children.toString();
                                    if (childStr && childStr !== '[object Object]') {
                                        codeContent = childStr;
                                    }
                                }
                            } catch {
                                // Fallback to empty string if conversion fails
                                codeContent = '';
                            }
                        }

                        // Check if this is a block-level code (has language or multiline content)
                        const isBlockCode = language || codeContent?.includes('\n');

                        // For block-level code with language
                        if (isBlockCode && language && codeContent) {
                            return (
                                <Box sx={{ my: 2 }}>
                                    <CodeHighlighter
                                        code={codeContent.replace(/\n$/, '')} // Remove trailing newline
                                        language={language}
                                        isFullscreen={false}
                                    />
                                </Box>
                            );
                        }

                        // For block-level code without language
                        if (isBlockCode && codeContent) {
                            return (
                                <Box
                                    component="pre"
                                    sx={{
                                        backgroundColor: theme.palette.action.hover,
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        overflow: 'auto',
                                        margin: '1rem 0',
                                        fontFamily: 'monospace',
                                        fontSize: '0.875rem',
                                        border: '1px solid',
                                        borderColor: 'divider'
                                    }}
                                >
                                    <Box component="code" sx={{ fontFamily: 'inherit' }}>
                                        {codeContent}
                                    </Box>
                                </Box>
                            );
                        }

                        // For inline code
                        return (
                            <Box
                                component="code"
                                sx={{
                                    backgroundColor: theme.palette.action.hover,
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '0.25rem',
                                    fontFamily: 'monospace',
                                    fontSize: '0.875em',
                                    border: '1px solid',
                                    borderColor: 'divider'
                                }}
                                {...props}
                            >
                                {children}
                            </Box>
                        );
                    },
                    // Enhanced pre blocks for better fallback
                    pre: ({ children }) => {
                        // If pre contains code element, let code component handle it
                        return (
                            <Box sx={{ margin: 0 }}>
                                {children}
                            </Box>
                        );
                    }
                }}
            >
                {content}
            </ReactMarkdown>
        </Box>
    );
};
