/**
 * @fileoverview Ekstraktor tekstu dla plików tekstowych
 * Obsługuje pliki TXT, CSV, JSON, kodu źródłowego i inne formaty tekstowe
 */

import { BaseTextExtractor, type ExtractedText, type ExtractionOptions, TextExtractionError } from './text-extractor-interface.mjs';

/**
 * Ekstraktor dla plików tekstowych
 */
export class PlainTextExtractor extends BaseTextExtractor {
    readonly name = 'PlainTextExtractor';

    readonly supportedMimeTypes = [
        'text/plain',
        'text/csv',
        'application/json',
        'application/javascript',
        'text/javascript',
        'text/typescript',
        'text/css',
        'text/html',
        'text/xml',
        'application/xml',
        'text/yaml',
        'application/yaml',
        'text/markdown',
        'text/x-python',
        'text/x-java',
        'text/x-c',
        'text/x-c++',
        'text/x-csharp',
        'text/x-php',
        'text/x-ruby',
        'text/x-go',
        'text/x-rust',
        'text/x-sql'
    ];

    readonly supportedExtensions = [
        'txt', 'text', 'csv', 'json', 'js', 'ts', 'jsx', 'tsx',
        'css', 'scss', 'sass', 'less', 'html', 'htm', 'xml',
        'yaml', 'yml', 'md', 'markdown', 'py', 'java', 'c',
        'cpp', 'cc', 'cxx', 'cs', 'php', 'rb', 'go', 'rs',
        'sql', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'ini',
        'conf', 'config', 'env', 'log', 'properties'
    ];

    async extractText(
        buffer: ArrayBuffer,
        fileName: string,
        options: ExtractionOptions = {}
    ): Promise<ExtractedText> {
        const startTime = Date.now();

        try {
            // Wykryj encoding
            const encoding = options.encoding || this.detectEncoding(buffer);

            // Konwertuj buffer na tekst
            const decoder = new TextDecoder(encoding);
            let content = decoder.decode(buffer);

            // Sprawdź czy plik nie jest binarny
            if (this.isBinaryContent(content)) {
                throw new TextExtractionError(
                    'File appears to be binary, not text',
                    fileName,
                    this.name,
                    { detectedEncoding: encoding }
                );
            }

            // Czyść tekst jeśli wymagane
            if (!options.preserveFormatting) {
                content = this.cleanText(content);
            }

            // Ogranicz długość jeśli wymagane
            if (options.maxLength && content.length > options.maxLength) {
                content = content.substring(0, options.maxLength) + '...';
            }

            // Wykryj typ pliku bardziej precyzyjnie
            const fileType = this.detectFileType(fileName, content);

            // Wyodrębnij strukturę jeśli wymagane
            let structure;
            if (options.extractStructure) {
                structure = this.extractStructure(content, fileType);
            }

            const processingTime = Date.now() - startTime;
            const metadata = this.createBaseMetadata(fileName, buffer.byteLength, content);

            return {
                content,
                metadata: {
                    ...metadata,
                    fileType,
                    encoding,
                    structure,
                    lineCount: content.split('\n').length,
                    isCode: this.isCodeFile(fileType),
                    syntax: this.getSyntaxHighlightLanguage(fileType)
                },
                extractionInfo: {
                    processingTime,
                    method: 'TextDecoder',
                    isComplete: true,
                    warnings: []
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            if (error instanceof TextExtractionError) {
                throw error;
            }

            throw new TextExtractionError(
                `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`,
                fileName,
                this.name,
                {
                    processingTime,
                    originalError: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }

    /**
     * Wykrywa encoding pliku
     * @param buffer Buffer z danymi pliku
     * @returns Nazwa encoding
     */
    private detectEncoding(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer.slice(0, 1024)); // Sprawdź pierwsze 1KB

        // Sprawdź BOM (Byte Order Mark)
        if (bytes.length >= 3 &&
            bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            return 'utf-8';
        }

        if (bytes.length >= 2 &&
            bytes[0] === 0xFF && bytes[1] === 0xFE) {
            return 'utf-16le';
        }

        if (bytes.length >= 2 &&
            bytes[0] === 0xFE && bytes[1] === 0xFF) {
            return 'utf-16be';
        }

        // Sprawdź czy to wygląda na UTF-8
        try {
            const decoder = new TextDecoder('utf-8', { fatal: true });
            decoder.decode(bytes);
            return 'utf-8';
        } catch {
            // Fallback na latin-1
            return 'latin-1';
        }
    }

    /**
     * Sprawdza czy zawartość wygląda na binarną
     * @param content Tekst do sprawdzenia
     * @returns True jeśli to prawdopodobnie plik binarny
     */
    private isBinaryContent(content: string): boolean {
        // Sprawdź czy więcej niż 1% znaków to znaki kontrolne (poza standardowymi)
        let controlChars = 0;
        for (let i = 0; i < Math.min(content.length, 8192); i++) {
            const code = content.charCodeAt(i);
            if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
                controlChars++;
            }
        }

        const sampleSize = Math.min(content.length, 8192);
        return (controlChars / sampleSize) > 0.01;
    }

    /**
     * Wykrywa bardziej precyzyjny typ pliku
     * @param fileName Nazwa pliku
     * @param content Zawartość pliku
     * @returns Typ pliku
     */
    private detectFileType(fileName: string, content: string): string {
        const extension = this.getFileExtension(fileName);

        // Jeśli mamy rozszerzenie, użyj go
        if (extension && this.supportedExtensions.includes(extension)) {
            return extension;
        }

        // Analiza zawartości dla plików bez rozszerzenia
        return this.detectFileTypeByContent(content) || extension || 'txt';
    }

    /**
     * Wykrywa typ pliku na podstawie zawartości
     */
    private detectFileTypeByContent(content: string): string | null {
        const firstLine = content.split('\n')[0].trim();

        // Shebang detection
        const shebangType = this.detectShebangType(firstLine);
        if (shebangType) return shebangType;

        // JSON detection
        const jsonType = this.detectJsonType(content);
        if (jsonType) return jsonType;

        // XML/HTML detection
        const xmlType = this.detectXmlType(content);
        if (xmlType) return xmlType;

        // CSV detection
        if (this.looksLikeCsv(content)) {
            return 'csv';
        }

        return null;
    }

    /**
     * Wykrywa typ na podstawie shebang
     */
    private detectShebangType(firstLine: string): string | null {
        if (!firstLine.startsWith('#!')) return null;

        if (firstLine.includes('python')) return 'py';
        if (firstLine.includes('node') || firstLine.includes('nodejs')) return 'js';
        if (firstLine.includes('bash') || firstLine.includes('sh')) return 'sh';
        if (firstLine.includes('powershell') || firstLine.includes('pwsh')) return 'ps1';

        return null;
    }

    /**
     * Wykrywa JSON
     */
    private detectJsonType(content: string): string | null {
        const trimmed = content.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                JSON.parse(trimmed);
                return 'json';
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * Wykrywa XML/HTML
     */
    private detectXmlType(content: string): string | null {
        const trimmed = content.trim();
        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<!DOCTYPE')) {
            return trimmed.toLowerCase().includes('html') ? 'html' : 'xml';
        }
        return null;
    }

    /**
     * Sprawdza czy zawartość wygląda jak CSV
     * @param content Zawartość do sprawdzenia
     * @returns True jeśli wygląda jak CSV
     */
    private looksLikeCsv(content: string): boolean {
        const lines = content.split('\n').slice(0, 10); // Sprawdź pierwsze 10 linii
        if (lines.length < 2) return false;

        // Sprawdź czy linie mają podobną liczbę przecinków/średników
        const separators = [',', ';', '\t'];

        for (const sep of separators) {
            const counts = lines.map(line => (line.match(new RegExp(sep, 'g')) || []).length);
            const firstCount = counts[0];

            if (firstCount > 0 && counts.every(count => Math.abs(count - firstCount) <= 1)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Wyodrębnia strukturę dokumentu
     * @param content Zawartość pliku
     * @param fileType Typ pliku
     * @returns Struktura dokumentu
     */
    private extractStructure(content: string, fileType: string): ExtractedText['metadata']['structure'] {
        const lines = content.split('\n');

        switch (fileType) {
            case 'md':
            case 'markdown':
                return this.extractMarkdownStructure(lines);

            case 'html':
            case 'htm':
                return this.extractHtmlStructure(content);

            case 'py':
            case 'js':
            case 'ts':
            case 'java':
            case 'cpp':
            case 'cs':
                return this.extractCodeStructure(lines, fileType);

            default:
                // Prosta struktura bazowana na pustych liniach
                return this.extractSimpleStructure(lines);
        }
    }

    /**
     * Wyodrębnia strukturę Markdown
     */
    private extractMarkdownStructure(lines: string[]): ExtractedText['metadata']['structure'] {
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        let currentSection = { title: '', content: '', level: 0 };

        for (const line of lines) {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

            if (headingMatch) {
                // Zapisz poprzednią sekcję
                if (currentSection.title || currentSection.content) {
                    sections.push({ ...currentSection });
                }

                const level = headingMatch[1].length;
                const title = headingMatch[2];

                headings.push(title);
                currentSection = { title, content: '', level };
            } else {
                currentSection.content += line + '\n';
            }
        }

        // Dodaj ostatnią sekcję
        if (currentSection.title || currentSection.content) {
            sections.push(currentSection);
        }

        return { headings, sections };
    }

    /**
     * Wyodrębnia strukturę HTML
     */
    private extractHtmlStructure(content: string): ExtractedText['metadata']['structure'] {
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        // Prosta regex dla nagłówków HTML
        const headingRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/gi;
        let match;

        while ((match = headingRegex.exec(content)) !== null) {
            const level = parseInt(match[1]);
            const title = match[2].trim();

            headings.push(title);
            sections.push({ title, content: '', level });
        }

        return { headings, sections };
    }

    /**
     * Wyodrębnia strukturę kodu
     */
    private extractCodeStructure(lines: string[], fileType: string): ExtractedText['metadata']['structure'] {
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        // Patterns dla różnych języków
        const patterns = {
            py: [/^class\s+(\w+)/, /^def\s+(\w+)/],
            js: [/^class\s+(\w+)/, /^function\s+(\w+)/, /^const\s+(\w+)\s*=/],
            ts: [/^class\s+(\w+)/, /^function\s+(\w+)/, /^interface\s+(\w+)/, /^type\s+(\w+)/],
            java: [/^class\s+(\w+)/, /^interface\s+(\w+)/, /^public\s+\w+\s+(\w+)\s*\(/],
            cpp: [/^class\s+(\w+)/, /^\w+\s+(\w+)\s*\(/],
            cs: [/^class\s+(\w+)/, /^interface\s+(\w+)/, /^public\s+\w+\s+(\w+)\s*\(/]
        };

        const langPatterns = patterns[fileType as keyof typeof patterns] || [];

        for (const line of lines) {
            for (const pattern of langPatterns) {
                const match = line.trim().match(pattern);
                if (match) {
                    headings.push(match[1]);
                    sections.push({ title: match[1], content: line, level: 1 });
                    break;
                }
            }
        }

        return { headings, sections };
    }

    /**
     * Wyodrębnia prostą strukturę
     */
    private extractSimpleStructure(lines: string[]): ExtractedText['metadata']['structure'] {
        const sections: Array<{ title: string; content: string; level: number }> = [];

        let currentSection = { title: '', content: '', level: 0 };
        let sectionIndex = 0;

        for (const line of lines) {
            if (line.trim() === '') {
                // Pusta linia - koniec sekcji
                if (currentSection.content.trim()) {
                    currentSection.title = `Section ${++sectionIndex}`;
                    sections.push({ ...currentSection });
                    currentSection = { title: '', content: '', level: 0 };
                }
            } else {
                currentSection.content += line + '\n';
            }
        }

        // Dodaj ostatnią sekcję
        if (currentSection.content.trim()) {
            currentSection.title = `Section ${++sectionIndex}`;
            sections.push(currentSection);
        }

        return { headings: [], sections };
    }

    /**
     * Sprawdza czy to plik kodu
     */
    private isCodeFile(fileType: string): boolean {
        const codeExtensions = [
            'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'cs',
            'php', 'rb', 'go', 'rs', 'sql', 'sh', 'ps1', 'css', 'scss',
            'sass', 'less', 'html', 'htm', 'xml', 'yaml', 'yml', 'json'
        ];

        return codeExtensions.includes(fileType);
    }

    /**
     * Zwraca język dla syntax highlighting
     */
    private getSyntaxHighlightLanguage(fileType: string): string {
        const languageMap: Record<string, string> = {
            js: 'javascript',
            ts: 'typescript',
            jsx: 'javascript',
            tsx: 'typescript',
            py: 'python',
            rb: 'ruby',
            cs: 'csharp',
            cpp: 'cpp',
            cc: 'cpp',
            cxx: 'cpp',
            yml: 'yaml',
            htm: 'html',
            md: 'markdown'
        };

        return languageMap[fileType] || fileType;
    }
}
