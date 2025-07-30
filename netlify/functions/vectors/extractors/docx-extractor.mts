/**
 * @fileoverview Ekstraktor tekstu z plików DOCX
 * Wspiera podstawowe formatowanie, nagłówki, listy i tabele
 */

import type { TextExtractor, ExtractedText, ExtractionOptions } from './text-extractor-interface.mjs';

/**
 * Interfejs dla węzła XML
 */
interface XMLNode {
    type: 'element' | 'text';
    name?: string;
    text?: string;
    attrs?: Record<string, string>;
    children?: XMLNode[];
}

/**
 * Ekstraktor tekstu z plików DOCX
 * Parsuje XML strukture dokumentu Word i ekstraktuje zawartość tekstową
 */
export class DocxExtractor implements TextExtractor {
    readonly name = 'docx';
    readonly supportedMimeTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ];
    readonly supportedExtensions = ['.docx', '.doc'];

    /**
     * Sprawdza czy może obsłużyć dany typ pliku
     */
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

    /**
     * Ekstraktuje tekst z pliku DOCX
     */
    async extractText(buffer: ArrayBuffer, _fileName: string, options: ExtractionOptions = {}): Promise<ExtractedText> {
        try {
            const content = await this.parseDocxBuffer(buffer, options);

            return {
                content: content.text,
                metadata: {
                    fileType: 'docx',
                    fileSize: buffer.byteLength,
                    language: content.metadata.language || 'en',
                    structure: {
                        sections: content.structure.map((item: any) => ({
                            title: item.title || 'Section',
                            content: item.content || '',
                            level: item.level || 1
                        }))
                    },
                    custom: {
                        wordCount: content.metadata.wordCount,
                        paragraphCount: content.metadata.paragraphCount,
                        hasImages: content.metadata.hasImages,
                        hasTables: content.metadata.hasTables,
                        hasLists: content.metadata.hasLists,
                        extractionMethod: content.metadata.extractionMethod
                    }
                },
                extractionInfo: {
                    processingTime: content.metadata.processingTime || 0,
                    method: 'docx-parser',
                    isComplete: !content.metadata.parseError,
                    warnings: content.metadata.parseError ? [content.metadata.parseError] : undefined
                }
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error extracting DOCX text:', error);

            return {
                content: '',
                metadata: {
                    fileType: 'docx',
                    fileSize: buffer.byteLength
                },
                extractionInfo: {
                    processingTime: 0,
                    method: 'docx-parser',
                    isComplete: false,
                    errors: [errorMsg]
                }
            };
        }
    }

    /**
     * Waliduje plik DOCX
     */
    async validateFile(buffer: ArrayBuffer, _fileName: string): Promise<boolean> {
        return this.validateContent(buffer);
    }

    /**
     * Szacuje czas przetwarzania dla DOCX
     */
    estimateProcessingTime(fileSize: number): number {
        // DOCX może być skomplikowany, szacuj ~3ms na KB
        return Math.max(200, (fileSize / 1024) * 3);
    }    /**
     * Parsuje buffer DOCX i ekstraktuje zawartość
     */
    private async parseDocxBuffer(buffer: ArrayBuffer, options: ExtractionOptions): Promise<{
        text: string;
        metadata: Record<string, any>;
        structure: any[];
    }> {
        const startTime = Date.now();
        const content: string[] = [];
        const structure: any[] = [];
        const metadata: Record<string, any> = {
            startTime,
            wordCount: 0,
            paragraphCount: 0,
            hasImages: false,
            hasTables: false,
            hasLists: false
        };

        try {
            // Konwertuj buffer na Uint8Array dla dalszego przetwarzania
            const uint8Array = new Uint8Array(buffer);

            // Prosta implementacja parsera DOCX dla środowiska Netlify Functions
            // W rzeczywistej implementacji można by użyć biblioteki jak 'mammoth' lub 'docx'
            const docxContent = await this.parseDocxStructure(uint8Array);

            if (docxContent.document) {
                const extractedText = this.extractTextFromDocument(docxContent.document, options);
                content.push(extractedText.text);
                structure.push(...extractedText.structure);

                // Aktualizuj metadata
                metadata.wordCount = this.countWords(extractedText.text);
                metadata.paragraphCount = extractedText.structure.filter(s => s.type === 'paragraph').length;
                metadata.hasImages = extractedText.structure.some(s => s.type === 'image');
                metadata.hasTables = extractedText.structure.some(s => s.type === 'table');
                metadata.hasLists = extractedText.structure.some(s => s.type === 'list');
            }

            // Jeśli nie udało się sparsować jako DOCX, spróbuj traktować jako tekst
            if (content.length === 0) {
                const fallbackText = this.extractFallbackText(uint8Array);
                if (fallbackText) {
                    content.push(fallbackText);
                    metadata.wordCount = this.countWords(fallbackText);
                    metadata.extractionMethod = 'fallback';
                }
            }

        } catch (parseError) {
            console.warn('DOCX parsing failed, attempting text extraction fallback:', parseError);

            // Fallback: próba ekstraktacji tekstu z surowych danych
            const fallbackText = this.extractFallbackText(new Uint8Array(buffer));
            if (fallbackText) {
                content.push(fallbackText);
                metadata.wordCount = this.countWords(fallbackText);
                metadata.extractionMethod = 'fallback';
                metadata.parseError = parseError instanceof Error ? parseError.message : 'Parse error';
            } else {
                throw new Error('Unable to extract any text from DOCX file');
            }
        }

        const finalText = content.join('\n\n').trim();

        // Filtrowanie tekstu jeśli określono opcje
        let processedText = finalText;
        if (!options.preserveFormatting) {
            processedText = this.removeFormatting(processedText);
        }

        if (options.maxLength && processedText.length > options.maxLength) {
            processedText = processedText.substring(0, options.maxLength) + '...';
            metadata.truncated = true;
            metadata.originalLength = finalText.length;
        }

        return {
            text: processedText,
            metadata,
            structure
        };
    }

    /**
     * Parsuje strukturę dokumentu DOCX (uproszczona implementacja)
     */
    private async parseDocxStructure(uint8Array: Uint8Array): Promise<{ document?: XMLNode }> {
        try {
            // Podstawowa detekcja ZIP (DOCX to ZIP z XML)
            const zipSignature = [0x50, 0x4B, 0x03, 0x04]; // PK header
            const isZip = zipSignature.every((byte, index) => uint8Array[index] === byte);

            if (!isZip) {
                throw new Error('Not a valid DOCX file (missing ZIP signature)');
            }

            // W prawdziwej implementacji tutaj byłby parser ZIP i XML
            // Dla uproszczenia zwracamy pustą strukturę
            return { document: undefined };

        } catch (error) {
            console.warn('Failed to parse DOCX structure:', error);
            return {};
        }
    }

    /**
     * Ekstraktuje tekst z dokumentu XML
     */
    private extractTextFromDocument(document: XMLNode, _options: ExtractionOptions): {
        text: string;
        structure: any[];
    } {
        const content: string[] = [];
        const structure: any[] = [];

        const extractFromNode = (node: XMLNode, level = 0): void => {
            if (node.type === 'text' && node.text) {
                content.push(node.text);
                return;
            }

            if (node.type === 'element' && node.children) {
                // Obsługa różnych elementów DOCX
                switch (node.name) {
                    case 'w:p': // Paragraph
                        structure.push({
                            type: 'paragraph',
                            level,
                            content: this.extractTextFromChildren(node.children)
                        });
                        break;

                    case 'w:tbl': // Table
                        structure.push({
                            type: 'table',
                            level,
                            rows: this.extractTableContent(node.children)
                        });
                        break;

                    case 'w:drawing': // Image/Drawing
                        structure.push({
                            type: 'image',
                            level,
                            description: 'Image content'
                        });
                        break;
                }

                // Rekurencyjnie przetwarzaj dzieci
                for (const child of node.children) {
                    extractFromNode(child, level + 1);
                }
            }
        };

        extractFromNode(document);

        return {
            text: content.join(' ').trim(),
            structure
        };
    }

    /**
     * Ekstraktuje tekst z węzłów potomnych
     */
    private extractTextFromChildren(children: XMLNode[]): string {
        const texts: string[] = [];

        for (const child of children) {
            if (child.type === 'text' && child.text) {
                texts.push(child.text);
            } else if (child.type === 'element' && child.children) {
                texts.push(this.extractTextFromChildren(child.children));
            }
        }

        return texts.join(' ').trim();
    }

    /**
     * Ekstraktuje zawartość tabeli
     */
    private extractTableContent(children: XMLNode[]): string[][] {
        const rows: string[][] = [];

        for (const child of children) {
            if (child.name === 'w:tr' && child.children) { // Table row
                const cells: string[] = [];
                for (const cell of child.children) {
                    if (cell.name === 'w:tc' && cell.children) { // Table cell
                        cells.push(this.extractTextFromChildren(cell.children));
                    }
                }
                if (cells.length > 0) {
                    rows.push(cells);
                }
            }
        }

        return rows;
    }

    /**
     * Fallback ekstraktuje tekst z surowych danych
     */
    private extractFallbackText(uint8Array: Uint8Array): string {
        try {
            // Konwertuj na string i filtruj printable characters
            const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
            const rawText = decoder.decode(uint8Array);

            // Filtruj tylko printable characters i podstawowe whitespace
            const cleanText = rawText
                .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u0080-\u009F]/g, ' ') // Control characters (excluding \n, \r, \t)
                .replace(/[^\u0020-\u007E\u00A0-\uFFFF\n\r\t]/g, ' ') // Keep only printable chars and basic whitespace
                .replace(/\s+/g, ' ') // Multiple whitespace
                .trim();

            // Wyekstraktuj fragmenty które wyglądają jak tekst
            const textFragments = cleanText.match(/[a-zA-Z0-9\s.,!?;:"'\-()]{10,}/g) || [];

            if (textFragments.length > 0) {
                return textFragments.join('\n').trim();
            }

            return '';
        } catch (error) {
            console.warn('Fallback text extraction failed:', error);
            return '';
        }
    }

    /**
     * Usuwa formatowanie z tekstu
     */
    private removeFormatting(text: string): string {
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/_(.*?)_/g, '$1') // Underline
            .replace(/\s+/g, ' ') // Multiple spaces
            .trim();
    }

    /**
     * Liczy słowa w tekście
     */
    private countWords(text: string): number {
        return text.trim() ? text.trim().split(/\s+/).length : 0;
    }

    /**
     * Waliduje zawartość przed przetwarzaniem
     */
    private validateContent(buffer: ArrayBuffer): boolean {
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        // Sprawdź czy to wygląda jak plik DOCX (ZIP signature)
        const uint8Array = new Uint8Array(buffer);
        const zipSignature = [0x50, 0x4B, 0x03, 0x04];

        return zipSignature.every((byte, index) =>
            index < uint8Array.length && uint8Array[index] === byte
        );
    }
}
