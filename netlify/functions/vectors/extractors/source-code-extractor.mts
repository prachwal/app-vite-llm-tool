/**
 * @fileoverview Ekstraktor tekstu z plików kodu źródłowego
 * Wspiera różne języki programowania z zachowaniem struktury i komentarzy
 */

import type { TextExtractor, ExtractedText, ExtractionOptions } from './text-extractor-interface.mjs';

/**
 * Ekstraktor tekstu z plików kodu źródłowego
 */
export class SourceCodeExtractor implements TextExtractor {
    readonly name = 'source-code';
    readonly supportedMimeTypes = [
        'text/javascript',
        'application/javascript',
        'text/typescript',
        'application/typescript',
        'text/x-python',
        'application/x-python',
        'text/x-java-source',
        'text/x-c',
        'text/x-c++',
        'text/x-csharp',
        'text/x-php',
        'text/x-ruby',
        'text/x-go',
        'text/x-rust',
        'text/css',
        'application/json',
        'text/x-sql'
    ];

    readonly supportedExtensions = [
        '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
        '.py', '.pyx', '.pyi',
        '.java',
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp',
        '.cs',
        '.php',
        '.rb',
        '.go',
        '.rs',
        '.css', '.scss', '.sass', '.less',
        '.json',
        '.sql',
        '.sh', '.bash',
        '.dockerfile'
    ];

    canHandle(mimeType: string, fileName?: string): boolean {
        if (this.supportedMimeTypes.includes(mimeType)) {
            return true;
        }
        if (fileName) {
            const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
            return this.supportedExtensions.includes(extension);
        }
        return false;
    }

    async extractText(buffer: ArrayBuffer, fileName: string, options: ExtractionOptions = {}): Promise<ExtractedText> {
        try {
            const startTime = Date.now();
            const decoder = new TextDecoder('utf-8');
            const sourceCode = decoder.decode(buffer);
            const language = this.detectLanguage(fileName);
            const analysis = this.analyzeCode(sourceCode, language);

            let content = sourceCode;
            if (!options.preserveFormatting) {
                content = this.cleanCodeFormatting(sourceCode);
            }
            if (options.maxLength && content.length > options.maxLength) {
                content = content.substring(0, options.maxLength) + '...';
            }

            const processingTime = Date.now() - startTime;

            return {
                content,
                metadata: {
                    fileType: language,
                    fileSize: buffer.byteLength,
                    language: 'en',
                    structure: { sections: analysis.sections },
                    custom: {
                        lineCount: analysis.lineCount,
                        commentLines: analysis.commentLines,
                        codeLines: analysis.codeLines,
                        functions: analysis.functions.length,
                        classes: analysis.classes.length,
                        imports: analysis.imports.length
                    }
                },
                extractionInfo: {
                    processingTime,
                    method: 'source-code-parser',
                    isComplete: true
                }
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
                content: '',
                metadata: { fileType: 'source-code', fileSize: buffer.byteLength },
                extractionInfo: {
                    processingTime: 0,
                    method: 'source-code-parser',
                    isComplete: false,
                    errors: [errorMsg]
                }
            };
        }
    }

    async validateFile(buffer: ArrayBuffer): Promise<boolean> {
        try {
            if (!buffer || buffer.byteLength === 0) return false;
            const decoder = new TextDecoder('utf-8');
            const sample = decoder.decode(buffer.slice(0, Math.min(1024, buffer.byteLength)));
            const binaryChars = sample.match(/[\u0001-\u0008\u000E-\u001F\u007F-\u00FF]/g);
            const binaryRatio = binaryChars ? binaryChars.length / sample.length : 0;
            return binaryRatio < 0.1;
        } catch {
            return false;
        }
    }

    estimateProcessingTime(fileSize: number): number {
        return Math.max(100, fileSize / 1024);
    }

    private detectLanguage(fileName: string): string {
        const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        const languageMap: Record<string, string> = {
            '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
            '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp',
            '.php': 'php', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.css': 'css',
            '.json': 'json', '.sql': 'sql', '.sh': 'bash', '.dockerfile': 'dockerfile'
        };
        return languageMap[extension] || 'unknown';
    }

    private analyzeCode(sourceCode: string, language: string) {
        const lines = sourceCode.split(/\r?\n/);
        const lineCount = lines.length;
        let commentLines = 0, codeLines = 0;
        const functions: string[] = [], classes: string[] = [], imports: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (this.isCommentLine(trimmedLine, language)) {
                commentLines++;
                continue;
            }
            codeLines++;

            const functionMatch = this.extractFunction(trimmedLine, language);
            if (functionMatch) {
                functions.push(functionMatch);
                sections.push({ title: `Function: ${functionMatch}`, content: line, level: 2 });
            }

            const classMatch = this.extractClass(trimmedLine, language);
            if (classMatch) {
                classes.push(classMatch);
                sections.push({ title: `Class: ${classMatch}`, content: line, level: 1 });
            }

            const importMatch = this.extractImport(trimmedLine, language);
            if (importMatch) imports.push(importMatch);
        }

        return { lineCount, commentLines, codeLines, functions, classes, imports, sections };
    }

    private isCommentLine(line: string, language: string): boolean {
        const commentPrefixes: Record<string, string[]> = {
            javascript: ['//'], typescript: ['//'], python: ['#'], java: ['//'],
            c: ['//'], cpp: ['//'], csharp: ['//'], php: ['//', '#'],
            ruby: ['#'], go: ['//'], rust: ['//'], sql: ['--'], bash: ['#']
        };
        const prefixes = commentPrefixes[language] || ['//'];
        return prefixes.some(prefix => line.startsWith(prefix));
    }

    private extractFunction(line: string, language: string): string | null {
        const patterns: Record<string, RegExp> = {
            javascript: /function\s+(\w+)|(\w+)\s*[:=]\s*function/,
            typescript: /function\s+(\w+)|(\w+)\s*[:=]\s*function/,
            python: /def\s+(\w+)\s*\(/, java: /(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*\{/,
            go: /func\s+(\w+)\s*\(/, rust: /fn\s+(\w+)\s*\(/
        };
        const pattern = patterns[language];
        if (!pattern) return null;
        const match = pattern.exec(line);
        return match ? (match[1] || match[2] || match[3]) : null;
    }

    private extractClass(line: string, language: string): string | null {
        const patterns: Record<string, RegExp> = {
            javascript: /class\s+(\w+)/, typescript: /class\s+(\w+)/,
            python: /class\s+(\w+)/, java: /class\s+(\w+)/,
            go: /type\s+(\w+)\s+struct/, rust: /struct\s+(\w+)/
        };
        const pattern = patterns[language];
        if (!pattern) return null;
        const match = pattern.exec(line);
        return match ? match[1] : null;
    }

    private extractImport(line: string, language: string): string | null {
        const patterns: Record<string, RegExp> = {
            javascript: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/, typescript: /import\s+.*?\s+from\s+['"]([^'"]+)['"]/,
            python: /(?:import\s+(\w+)|from\s+(\w+)\s+import)/, java: /import\s+([a-zA-Z0-9_.]+);/,
            go: /import\s+['"]([^'"]+)['"]/, rust: /use\s+([a-zA-Z0-9_:]+);/
        };
        const pattern = patterns[language];
        if (!pattern) return null;
        const match = pattern.exec(line);
        return match ? (match[1] || match[2]) : null;
    }

    private cleanCodeFormatting(sourceCode: string): string {
        return sourceCode
            .replace(/\t/g, '    ')
            .replace(/ {2,}/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}
