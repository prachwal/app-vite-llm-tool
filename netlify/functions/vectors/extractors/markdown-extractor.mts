/**
 * @fileoverview Ekstraktor tekstu z plików Markdown
 * Obsługuje pliki .md, .markdown, .mdown z zachowaniem struktury
 */

import type {
    TextExtractor,
    ExtractedText,
    ExtractionOptions
} from './text-extractor-interface.mjs';

/**
 * Ekstraktor tekstu z plików Markdown
 */
export class MarkdownExtractor implements TextExtractor {
    readonly name = 'markdown-extractor';
    readonly supportedMimeTypes = ['text/markdown', 'text/x-markdown'];
    readonly supportedExtensions = ['.md', '.markdown', '.mdown', '.mkd'];

    /**
     * Sprawdza czy może obsłużyć dany typ pliku
     */
    canHandle(mimeType: string, fileName?: string): boolean {
        if (this.supportedMimeTypes.includes(mimeType)) {
            return true;
        }

        if (fileName) {
            const extension = fileName.toLowerCase().split('.').pop();
            return extension ? this.supportedExtensions.includes(`.${extension}`) : false;
        }

        return false;
    }

    /**
     * Waliduje plik Markdown
     */
    async validateFile(buffer: ArrayBuffer): Promise<boolean> {
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        try {
            // Próbuj zdekodować jako UTF-8
            const text = new TextDecoder('utf-8').decode(buffer);

            // Sprawdź czy zawiera typowe elementy Markdown
            const hasMarkdownElements = /^#{1,6}\s+|^\*{1,3}|^_{1,3}|^\[.*\]\(.*\)|^```|^>|\|.*\|/m.test(text);

            return text.length > 0 && (hasMarkdownElements || text.length < 10000); // Małe pliki prawdopodobnie OK
        } catch {
            return false;
        }
    }

    /**
     * Szacuje czas przetwarzania
     */
    estimateProcessingTime(fileSize: number): number {
        // Markdown jest szybki do przetwarzania: ~0.1ms na KB + 50ms overhead
        return Math.max(50, fileSize * 0.0001);
    }

    /**
     * Wyodrębnia tekst z pliku Markdown
     */
    async extractText(
        buffer: ArrayBuffer,
        _fileName: string,
        options: ExtractionOptions = {}
    ): Promise<ExtractedText> {
        const startTime = Date.now();
        const {
            preserveFormatting = true,
            maxLength,
            extractStructure = true,
            encoding = 'utf-8'
        } = options;

        try {
            // Dekoduj tekst
            let content = new TextDecoder(encoding).decode(buffer);

            // Wyodrębnij strukturę przed przetwarzaniem
            const structure = extractStructure ? this.extractMarkdownStructure(content) : undefined;

            // Przetwórz zawartość
            if (!preserveFormatting) {
                content = this.stripMarkdownFormatting(content);
            }

            // Ograniczenie długości jeśli podane
            if (maxLength && content.length > maxLength) {
                content = content.substring(0, maxLength) + '...';
            }

            // Wykryj język
            const detectedLanguage = this.detectLanguage(content);

            const processingTime = Date.now() - startTime;

            return {
                content,
                metadata: {
                    fileType: 'markdown',
                    fileSize: buffer.byteLength,
                    language: detectedLanguage,
                    structure,
                    // Dodatkowe metadane Markdown
                    markdownInfo: {
                        hasCodeBlocks: /```/.test(content),
                        hasLinks: /\[.*\]\(.*\)/.test(content),
                        hasImages: /!\[.*\]\(.*\)/.test(content),
                        hasTables: /\|.*\|/.test(content),
                        headingCount: structure?.headings?.length || 0
                    }
                },
                extractionInfo: {
                    processingTime,
                    method: 'markdown-parser',
                    isComplete: true
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            throw new Error(
                `Markdown extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Processing time: ${processingTime}ms`
            );
        }
    }

    /**
     * Usuwa formatowanie Markdown, pozostawiając czysty tekst
     */
    private stripMarkdownFormatting(content: string): string {
        return content
            // Usuń nagłówki (zachowaj tekst)
            .replace(/^#{1,6}\s+(.+)$/gm, '$1')
            // Usuń formatowanie bold/italic
            .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
            .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
            // Usuń kod inline
            .replace(/`([^`]+)`/g, '$1')
            // Usuń bloki kodu
            .replace(/```[\s\S]*?```/g, '[CODE BLOCK]')
            .replace(/^    .+$/gm, '[CODE LINE]')
            // Usuń linki (zachowaj tekst)
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            // Usuń obrazy
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, '[IMAGE: $1]')
            // Usuń cytaty (zachowaj tekst)
            .replace(/^>\s*(.+)$/gm, '$1')
            // Usuń linie poziome
            .replace(/^[-*_]{3,}$/gm, '')
            // Usuń listy (zachowaj tekst)
            .replace(/^[\s]*[-*+]\s+(.+)$/gm, '• $1')
            .replace(/^[\s]*\d+\.\s+(.+)$/gm, '• $1')
            // Oczyszczenie białych znaków
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Wyodrębnia strukturę dokumentu Markdown
     */
    private extractMarkdownStructure(content: string) {
        const lines = content.split('\n');
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        let currentSection: { title: string; content: string; level: number } | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Sprawdź nagłówki ATX (# ## ###)
            const atxMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
            if (atxMatch) {
                const level = atxMatch[1].length;
                const title = atxMatch[2];

                // Zapisz poprzednią sekcję
                if (currentSection) {
                    sections.push(currentSection);
                }

                headings.push(title);
                currentSection = {
                    title,
                    content: '',
                    level
                };
            }
            // Sprawdź nagłówki Setext (podkreślenie = lub -)
            else if (trimmedLine.match(/^[=]{3,}$/)) {
                // Poprzednia linia to nagłówek poziomu 1
                const prevLineIndex = lines.indexOf(line) - 1;
                if (prevLineIndex >= 0) {
                    const title = lines[prevLineIndex].trim();
                    if (title) {
                        if (currentSection) {
                            sections.push(currentSection);
                        }
                        headings.push(title);
                        currentSection = {
                            title,
                            content: '',
                            level: 1
                        };
                    }
                }
            }
            else if (trimmedLine.match(/^[-]{3,}$/)) {
                // Poprzednia linia to nagłówek poziomu 2
                const prevLineIndex = lines.indexOf(line) - 1;
                if (prevLineIndex >= 0) {
                    const title = lines[prevLineIndex].trim();
                    if (title) {
                        if (currentSection) {
                            sections.push(currentSection);
                        }
                        headings.push(title);
                        currentSection = {
                            title,
                            content: '',
                            level: 2
                        };
                    }
                }
            }
            // Dodaj do treści aktualnej sekcji
            else if (currentSection && trimmedLine) {
                currentSection.content += (currentSection.content ? ' ' : '') + trimmedLine;
            }
        }

        // Dodaj ostatnią sekcję
        if (currentSection) {
            sections.push(currentSection);
        }

        return {
            headings: headings.length > 0 ? headings : undefined,
            sections: sections.length > 0 ? sections : undefined
        };
    }

    /**
     * Podstawowe wykrywanie języka
     */
    private detectLanguage(text: string): string | undefined {
        if (!text || text.length < 50) {
            return undefined;
        }

        const sample = text.substring(0, 1000).toLowerCase();

        // Proste heurystyki językowe
        const patterns = {
            'en': /\b(the|and|that|have|for|not|with|you|this|but|his|from|they)\b/g,
            'pl': /\b(jest|oraz|tego|może|będzie|która|które|przez|można|należy)\b/g,
            'de': /\b(und|der|die|das|den|mit|für|ist|auf|eine)\b/g,
            'fr': /\b(les|des|une|dans|pour|que|sur|avec|par|son)\b/g,
            'es': /\b(los|las|una|para|por|con|del|que|sus|más)\b/g
        };

        let maxMatches = 0;
        let detectedLang = undefined;

        for (const [lang, pattern] of Object.entries(patterns)) {
            let matches = 0;
            const regex = new RegExp(pattern.source, pattern.flags);

            while (regex.exec(sample) !== null) {
                matches++;
                if (regex.global === false) break;
            }

            if (matches > maxMatches) {
                maxMatches = matches;
                detectedLang = lang;
            }
        }

        return maxMatches > 3 ? detectedLang : undefined;
    }
}

/**
 * Factory function tworząca instancję ekstraktora Markdown
 */
export function createMarkdownExtractor(): TextExtractor {
    return new MarkdownExtractor();
}
