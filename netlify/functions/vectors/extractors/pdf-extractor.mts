/**
 * @fileoverview Ekstraktor tekstu z plików PDF
 * Używa pdf-parse dla wyodrębniania tekstu z dokumentów PDF
 */

import type {
    TextExtractor,
    ExtractedText,
    ExtractionOptions
} from './text-extractor-interface.mjs';

/**
 * Ekstraktor tekstu z plików PDF
 */
export class PDFExtractor implements TextExtractor {
    readonly name = 'pdf-extractor';
    readonly supportedMimeTypes = ['application/pdf'];
    readonly supportedExtensions = ['.pdf'];

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
     * Waliduje plik PDF
     */
    async validateFile(buffer: ArrayBuffer, _fileName: string): Promise<boolean> {
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        // Sprawdź sygnaturę PDF (pierwsze 4 bajty powinny być "%PDF")
        const uint8Array = new Uint8Array(buffer, 0, 4);
        const signature = String.fromCharCode(...Array.from(uint8Array));
        return signature === '%PDF';
    }

    /**
     * Szacuje czas przetwarzania na podstawie rozmiaru pliku
     */
    estimateProcessingTime(fileSize: number): number {
        // Szacowanie: ~0.5ms na KB + 500ms overhead
        return Math.max(500, fileSize * 0.0005);
    }

    /**
     * Wyodrębnia tekst z pliku PDF
     */
    async extractText(
        buffer: ArrayBuffer,
        fileName: string,
        options: ExtractionOptions = {}
    ): Promise<ExtractedText> {
        const startTime = Date.now();
        const {
            preserveFormatting = false,
            maxLength,
            extractStructure = false
        } = options;

        try {
            // Dynamicznie importuj pdf-parse (będzie dostępne po dodaniu do package.json)
            let pdfParse: any;
            try {
                const pdfModule = await import('pdf-parse');
                pdfParse = (pdfModule as any).default || pdfModule;
            } catch (error) {
                // Fallback - próbuj wyodrębnić jako tekst lub zwróć błąd informacyjny
                return this.createFallbackResult(buffer, fileName, startTime, error as Error);
            }

            // Konwertuj ArrayBuffer na Buffer
            const uint8Array = new Uint8Array(buffer);
            const nodeBuffer = Buffer.from(uint8Array);

            // Wyodrębnij tekst używając pdf-parse
            const data = await pdfParse(nodeBuffer, {
                // Opcje pdf-parse
                max: maxLength || 0, // 0 = bez limitu
                version: 'v1.10.100' // Wersja kompatybilności
            });

            let content = data.text;

            // Oczyszczanie tekstu
            if (!preserveFormatting) {
                content = this.cleanText(content);
            }

            // Ograniczenie długości jeśli podane
            if (maxLength && content.length > maxLength) {
                content = content.substring(0, maxLength) + '...';
            }

            // Podstawowe wykrywanie języka (uproszczone)
            const detectedLanguage = this.detectLanguage(content);

            // Wyodrębnij strukturę jeśli wymagane
            const structure = extractStructure ? this.extractStructure(content) : undefined;

            const processingTime = Date.now() - startTime;

            return {
                content,
                metadata: {
                    fileType: 'pdf',
                    fileSize: buffer.byteLength,
                    language: detectedLanguage,
                    pageCount: data.numpages,
                    structure,
                    // Dodatkowe metadane PDF
                    pdfInfo: {
                        title: data.info?.Title || undefined,
                        author: data.info?.Author || undefined,
                        subject: data.info?.Subject || undefined,
                        creator: data.info?.Creator || undefined,
                        producer: data.info?.Producer || undefined,
                        creationDate: data.info?.CreationDate || undefined,
                        modificationDate: data.info?.ModDate || undefined
                    }
                },
                extractionInfo: {
                    processingTime,
                    method: 'pdf-parse',
                    isComplete: true,
                    warnings: data.text.length === 0 ? ['No text content found in PDF'] : undefined
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            throw new Error(
                `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Processing time: ${processingTime}ms`
            );
        }
    }

    /**
     * Tworzy wynik fallback gdy pdf-parse nie jest dostępne
     */
    private createFallbackResult(
        buffer: ArrayBuffer,
        _fileName: string,
        startTime: number,
        originalError: Error
    ): ExtractedText {
        const processingTime = Date.now() - startTime;

        return {
            content: '',
            metadata: {
                fileType: 'pdf',
                fileSize: buffer.byteLength,
                language: undefined,
                pageCount: undefined
            },
            extractionInfo: {
                processingTime,
                method: 'fallback',
                isComplete: false,
                errors: [
                    'pdf-parse dependency not available',
                    `Original error: ${originalError.message}`,
                    'Install pdf-parse: npm install pdf-parse @types/pdf-parse'
                ],
                warnings: [
                    'PDF text extraction requires pdf-parse package',
                    'Consider adding pdf-parse to dependencies for full PDF support'
                ]
            }
        };
    }

    /**
     * Oczyszcza wyodrębniony tekst
     */
    private cleanText(text: string): string {
        return text
            // Usuń nadmierne białe znaki
            .replace(/\s+/g, ' ')
            // Usuń zbędne znaki końca linii
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            // Usuń znaki kontrolne - używamy prostszego podejścia
            .replace(/[^\x20-\x7E\n\r\t]/g, '')
            // Trim
            .trim();
    }

    /**
     * Podstawowe wykrywanie języka na podstawie częstotliwości słów
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

    /**
     * Wyodrębnia podstawową strukturę dokumentu
     */
    private extractStructure(content: string) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const headings: string[] = [];
        const sections: Array<{ title: string; content: string; level: number }> = [];

        let currentSection: { title: string; content: string; level: number } | null = null;

        for (const line of lines) {
            // Prosta heurystyka dla nagłówków:
            // - Krótkie linie (< 100 znaków)
            // - Zaczynają się wielką literą
            // - Nie kończą się kropką
            // - Mogą zawierać cyfry (numeracja)
            const isLikelyHeading = line.length < 100 &&
                line.length > 3 &&
                /^[A-Z0-9]/.test(line) &&
                !line.endsWith('.') &&
                !line.includes(' the ') && // mniej prawdopodobne w nagłówkach
                !/\b(and|or|but|with|from|into|onto|upon)\b/.test(line.toLowerCase());

            if (isLikelyHeading) {
                // Zapisz poprzednią sekcję
                if (currentSection) {
                    sections.push(currentSection);
                }

                headings.push(line);

                // Rozpocznij nową sekcję
                currentSection = {
                    title: line,
                    content: '',
                    level: this.guessHeadingLevel(line)
                };
            } else if (currentSection) {
                // Dodaj do treści aktualnej sekcji
                currentSection.content += (currentSection.content ? ' ' : '') + line;
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
     * Zgaduje poziom nagłówka na podstawie formatowania
     */
    private guessHeadingLevel(heading: string): number {
        // Heurystyki dla poziomu nagłówka
        if (/^\d+\.?\s/.test(heading)) return 1; // "1. Nagłówek"
        if (/^\d+\.\d+\.?\s/.test(heading)) return 2; // "1.1. Podnagłówek"
        if (/^\d+\.\d+\.\d+\.?\s/.test(heading)) return 3; // "1.1.1. Podpodnagłówek"
        if (heading.length < 30) return 1; // Krótkie = prawdopodobnie główny
        if (heading.length < 60) return 2; // Średnie = prawdopodobnie podrzędny
        return 3; // Długie = szczegółowy
    }
}

/**
 * Factory function tworząca instancję ekstraktora PDF
 */
export function createPDFExtractor(): TextExtractor {
    return new PDFExtractor();
}
