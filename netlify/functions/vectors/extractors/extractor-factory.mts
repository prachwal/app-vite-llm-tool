/**
 * @fileoverview Factory dla ekstraktorów tekstu
 * Zarządza różnymi typami ekstraktorów i wybiera odpowiedni dla danego pliku
 */

import type { TextExtractor } from './text-extractor-interface.mjs';
import { PlainTextExtractor } from './plain-text-extractor.mjs';
import { PDFExtractor } from './pdf-extractor.mjs';
import { MarkdownExtractor } from './markdown-extractor.mjs';
import { HTMLExtractor } from './html-extractor.mjs';
import { JSONCSVExtractor } from './json-csv-extractor.mjs';
import { DocxExtractor } from './docx-extractor.mjs';
import { SourceCodeExtractor } from './source-code-extractor.mjs';

/**
 * Factory dla ekstraktorów tekstu
 */
export class TextExtractorFactory {
    private readonly extractors: Map<string, TextExtractor> = new Map();

    constructor() {
        this.initializeExtractors();
    }

    /**
     * Inicializuje dostępne ekstraktory
     */
    private initializeExtractors(): void {
        const extractors = [
            new PlainTextExtractor(),
            new PDFExtractor(),
            new MarkdownExtractor(),
            new HTMLExtractor(),
            new JSONCSVExtractor(),
            new DocxExtractor(),
            new SourceCodeExtractor()
        ];

        for (const extractor of extractors) {
            this.extractors.set(extractor.name, extractor);
        }

        console.log(`Initialized ${this.extractors.size} text extractors:`, Array.from(this.extractors.keys()));
    }

    /**
     * Znajduje odpowiedni ekstraktor dla danego pliku
     */
    getExtractor(mimeType: string, fileName?: string): TextExtractor | null {
        for (const extractor of Array.from(this.extractors.values())) {
            if (extractor.canHandle(mimeType, fileName)) {
                return extractor;
            }
        }

        return null;
    }

    /**
     * Pobiera wszystkie dostępne ekstraktory
     */
    getAllExtractors(): TextExtractor[] {
        return Array.from(this.extractors.values());
    }

    /**
     * Pobiera ekstraktor po nazwie
     */
    getExtractorByName(name: string): TextExtractor | null {
        return this.extractors.get(name) || null;
    }

    /**
     * Sprawdza czy dany typ pliku jest obsługiwany
     */
    isSupported(mimeType: string, fileName?: string): boolean {
        return this.getExtractor(mimeType, fileName) !== null;
    }

    /**
     * Pobiera listę obsługiwanych typów MIME
     */
    getSupportedMimeTypes(): string[] {
        const mimeTypes = new Set<string>();

        for (const extractor of Array.from(this.extractors.values())) {
            for (const mimeType of extractor.supportedMimeTypes) {
                mimeTypes.add(mimeType);
            }
        }

        return Array.from(mimeTypes).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Pobiera listę obsługiwanych rozszerzeń
     */
    getSupportedExtensions(): string[] {
        const extensions = new Set<string>();

        for (const extractor of Array.from(this.extractors.values())) {
            for (const extension of extractor.supportedExtensions) {
                extensions.add(extension);
            }
        }

        return Array.from(extensions).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Pobiera statystyki ekstraktorów
     */
    getStats() {
        return Array.from(this.extractors.entries()).map(([name, extractor]) => ({
            name,
            supportedMimeTypes: extractor.supportedMimeTypes,
            supportedExtensions: extractor.supportedExtensions
        }));
    }
}

// Singleton instance
let extractorFactory: TextExtractorFactory | null = null;

/**
 * Pobiera instancję factory ekstraktora (singleton)
 */
export function getTextExtractorFactory(): TextExtractorFactory {
    extractorFactory ??= new TextExtractorFactory();
    return extractorFactory;
}

/**
 * Bezpośrednia funkcja pomocnicza do wyodrębniania tekstu
 */
export async function extractTextFromFile(
    buffer: ArrayBuffer,
    fileName: string,
    mimeType: string,
    options?: any
) {
    const factory = getTextExtractorFactory();
    const extractor = factory.getExtractor(mimeType, fileName);

    if (!extractor) {
        throw new Error(`No extractor available for file type: ${mimeType} (${fileName})`);
    }

    // Walidacja przed ekstrakcją
    const isValid = await extractor.validateFile(buffer, fileName);
    if (!isValid) {
        throw new Error(`File validation failed: ${fileName}`);
    }

    return extractor.extractText(buffer, fileName, options);
}
