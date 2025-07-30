/**
 * @fileoverview Ekstraktor tekstu z plików HTML
 * Usuwa tagi HTML i wyodrębnia czysty tekst z zachowaniem struktury
 */

import type {
    TextExtractor,
    ExtractedText,
    ExtractionOptions
} from './text-extractor-interface.mjs';

/**
 * Ekstraktor tekstu z plików HTML
 */
export class HTMLExtractor implements TextExtractor {
    readonly name = 'html-extractor';
    readonly supportedMimeTypes = ['text/html', 'application/xhtml+xml'];
    readonly supportedExtensions = ['.html', '.htm', '.xhtml'];

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
     * Waliduje plik HTML
     */
    async validateFile(buffer: ArrayBuffer): Promise<boolean> {
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        try {
            const text = new TextDecoder('utf-8').decode(buffer);

            // Sprawdź czy zawiera typowe elementy HTML
            const hasHtmlElements = /<\/?[a-z][\s\S]*>/i.test(text) ||
                text.includes('<!DOCTYPE') ||
                text.includes('<html');

            return text.length > 0 && hasHtmlElements;
        } catch {
            return false;
        }
    }

    /**
     * Szacuje czas przetwarzania
     */
    estimateProcessingTime(fileSize: number): number {
        // HTML wymaga parsowania: ~0.2ms na KB + 100ms overhead
        return Math.max(100, fileSize * 0.0002);
    }

    /**
     * Wyodrębnia tekst z pliku HTML
     */
    async extractText(
        buffer: ArrayBuffer,
        _fileName: string,
        options: ExtractionOptions = {}
    ): Promise<ExtractedText> {
        const startTime = Date.now();
        const {
            preserveFormatting = false,
            maxLength,
            extractStructure = true,
            encoding = 'utf-8'
        } = options;

        try {
            // Dekoduj HTML
            let content = new TextDecoder(encoding).decode(buffer);

            // Wyodrębnij podstawowe metadane HTML
            const title = this.extractTitle(content);
            const meta = this.extractMetaTags(content);

            // Wyodrębnij strukturę przed usuwaniem tagów
            const structure = extractStructure ? this.extractHTMLStructure(content) : undefined;

            // Usuń tagi HTML i wyodrębnij tekst
            content = this.stripHtmlTags(content, preserveFormatting);

            // Ograniczenie długości jeśli podane
            if (maxLength && content.length > maxLength) {
                content = content.substring(0, maxLength) + '...';
            }

            // Wykryj język
            const detectedLanguage = this.detectLanguage(content, meta.language);

            const processingTime = Date.now() - startTime;

            return {
                content,
                metadata: {
                    fileType: 'html',
                    fileSize: buffer.byteLength,
                    language: detectedLanguage,
                    structure,
                    // Dodatkowe metadane HTML
                    htmlInfo: {
                        title,
                        description: meta.description,
                        keywords: meta.keywords,
                        author: meta.author,
                        language: meta.language,
                        hasImages: /<img\s/i.test(content),
                        hasLinks: /<a\s/i.test(content),
                        hasScripts: /<script\s/i.test(content),
                        hasStyles: /<style\s/i.test(content) || /<link[^>]*rel=["\']stylesheet/i.test(content)
                    }
                },
                extractionInfo: {
                    processingTime,
                    method: 'html-parser',
                    isComplete: true
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            throw new Error(
                `HTML extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Processing time: ${processingTime}ms`
            );
        }
    }

    /**
     * Usuwa tagi HTML i wyodrębnia tekst
     */
    private stripHtmlTags(html: string, preserveFormatting: boolean): string {
        let text = html;

        // Usuń sekcje które nie zawierają tekstu użytkownika
        text = text
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '');

        if (preserveFormatting) {
            // Zachowaj podstawowe formatowanie
            text = text
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<\/h[1-6]>/gi, '\n\n')
                .replace(/<\/li>/gi, '\n')
                .replace(/<hr\s*\/?>/gi, '\n---\n');
        }

        // Usuń wszystkie tagi HTML
        text = text.replace(/<[^>]*>/g, ' ');

        // Dekoduj HTML entities
        text = this.decodeHtmlEntities(text);

        // Oczyszczenie białych znaków
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
    }

    /**
     * Dekoduje podstawowe HTML entities
     */
    private decodeHtmlEntities(text: string): string {
        const entities: Record<string, string> = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#39;': "'",
            '&apos;': "'",
            '&nbsp;': ' ',
            '&copy;': '©',
            '&reg;': '®',
            '&trade;': '™'
        };

        return text.replace(/&[#\w]+;/g, (entity) => {
            return entities[entity] || entity;
        });
    }

    /**
     * Wyodrębnia tytuł strony
     */
    private extractTitle(html: string): string | undefined {
        const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
        return match ? match[1].trim() : undefined;
    }

    /**
     * Wyodrębnia meta tagi
     */
    private extractMetaTags(html: string) {
        const meta = {
            description: undefined as string | undefined,
            keywords: undefined as string | undefined,
            author: undefined as string | undefined,
            language: undefined as string | undefined
        };

        // Description
        let match = /<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"']*)["\']/i.exec(html);
        if (match) meta.description = match[1];

        // Keywords
        match = /<meta[^>]*name=["\']keywords["\'][^>]*content=["\']([^"']*)["\']/i.exec(html);
        if (match) meta.keywords = match[1];

        // Author
        match = /<meta[^>]*name=["\']author["\'][^>]*content=["\']([^"']*)["\']/i.exec(html);
        if (match) meta.author = match[1];

        // Language
        match = /<html[^>]*lang=["\']([^"']*)["\']/i.exec(html);
        if (match) meta.language = match[1];

        return meta;
    }

    /**
     * Wyodrębnia strukturę HTML (nagłówki)
     */
    private extractHTMLStructure(html: string) {
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        // Znajdź wszystkie nagłówki
        const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h[1-6]>/gi;
        let match;

        while ((match = headingRegex.exec(html)) !== null) {
            const level = parseInt(match[1]);
            const title = this.stripHtmlTags(match[2], false).trim();

            if (title) {
                headings.push(title);
                sections.push({
                    title,
                    content: '', // Trudno wyodrębnić zawartość sekcji bez parsera DOM
                    level
                });
            }
        }

        return {
            headings: headings.length > 0 ? headings : undefined,
            sections: sections.length > 0 ? sections : undefined
        };
    }

    /**
     * Wykrywa język na podstawie treści i meta tagów
     */
    private detectLanguage(text: string, metaLanguage?: string): string | undefined {
        // Użyj meta language jeśli dostępne
        if (metaLanguage) {
            return metaLanguage.substring(0, 2); // ISO 639-1
        }

        // Fallback do heurystyk językowych
        if (!text || text.length < 50) {
            return undefined;
        }

        const sample = text.substring(0, 1000).toLowerCase();

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
 * Factory function tworząca instancję ekstraktora HTML
 */
export function createHTMLExtractor(): TextExtractor {
    return new HTMLExtractor();
}
