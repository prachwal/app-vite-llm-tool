/**
 * @fileoverview Interfejs i implementacja bazowa dla ekstraktorów tekstu
 * Ujednolicony interfejs dla wyodrębniania tekstu z różnych formatów plików
 */

/**
 * Metadane wyodrębnionego tekstu
 */
export interface ExtractedText {
    /** Wyodrębniony tekst */
    content: string;

    /** Metadane pliku */
    metadata: {
        /** Typ pliku */
        fileType: string;
        /** Rozmiar pliku w bajtach */
        fileSize: number;
        /** Wykryty język (ISO 639-1) */
        language?: string;
        /** Liczba stron (dla PDF) */
        pageCount?: number;
        /** Struktura dokumentu */
        structure?: {
            headings?: string[];
            sections?: Array<{
                title: string;
                content: string;
                level: number;
            }>;
        };
        /** Dodatkowe metadane specyficzne dla formatu */
        [key: string]: unknown;
    };

    /** Informacje o procesie ekstrakcji */
    extractionInfo: {
        /** Czas ekstrakcji w ms */
        processingTime: number;
        /** Użyta metoda ekstrakcji */
        method: string;
        /** Czy ekstrakcja była kompletna */
        isComplete: boolean;
        /** Ostrzeżenia */
        warnings?: string[];
        /** Błędy nie-krytyczne */
        errors?: string[];
    };
}

/**
 * Opcje ekstrakcji tekstu
 */
export interface ExtractionOptions {
    /** Czy zachować formatowanie */
    preserveFormatting?: boolean;
    /** Czy włączyć OCR dla obrazów */
    enableOCR?: boolean;
    /** Maksymalna długość tekstu */
    maxLength?: number;
    /** Czy wyodrębnić strukturę dokumentu */
    extractStructure?: boolean;
    /** Kodowanie pliku (dla plików tekstowych) */
    encoding?: string;
    /** Język dla OCR */
    ocrLanguage?: string;
}

/**
 * Interfejs dla wszystkich ekstraktorów tekstu
 */
export interface TextExtractor {
    /** Nazwa ekstraktora */
    readonly name: string;

    /** Obsługiwane typy MIME */
    readonly supportedMimeTypes: string[];

    /** Obsługiwane rozszerzenia plików */
    readonly supportedExtensions: string[];

    /**
     * Sprawdza czy ekstraktor obsługuje dany typ pliku
     * @param mimeType Typ MIME pliku
     * @param fileName Nazwa pliku (opcjonalna)
     * @returns True jeśli obsługuje
     */
    canHandle(mimeType: string, fileName?: string): boolean;

    /**
     * Wyodrębnia tekst z pliku
     * @param buffer Buffer z danymi pliku
     * @param fileName Nazwa pliku
     * @param options Opcje ekstrakcji
     * @returns Wyodrębniony tekst z metadanymi
     */
    extractText(
        buffer: ArrayBuffer,
        fileName: string,
        options?: ExtractionOptions
    ): Promise<ExtractedText>;

    /**
     * Waliduje plik przed ekstrakcją
     * @param buffer Buffer z danymi pliku
     * @param fileName Nazwa pliku
     * @returns True jeśli plik jest prawidłowy
     */
    validateFile(buffer: ArrayBuffer, fileName: string): Promise<boolean>;

    /**
     * Szacuje czas przetwarzania
     * @param fileSize Rozmiar pliku w bajtach
     * @returns Szacowany czas w ms
     */
    estimateProcessingTime(fileSize: number): number;
}

/**
 * Abstrakcyjna klasa bazowa dla ekstraktorów
 */
export abstract class BaseTextExtractor implements TextExtractor {
    abstract readonly name: string;
    abstract readonly supportedMimeTypes: string[];
    abstract readonly supportedExtensions: string[];

    canHandle(mimeType: string, fileName?: string): boolean {
        // Sprawdź typ MIME
        if (this.supportedMimeTypes.includes(mimeType)) {
            return true;
        }

        // Sprawdź rozszerzenie jako fallback
        if (fileName) {
            const extension = this.getFileExtension(fileName);
            return this.supportedExtensions.includes(extension);
        }

        return false;
    }

    abstract extractText(
        buffer: ArrayBuffer,
        fileName: string,
        options?: ExtractionOptions
    ): Promise<ExtractedText>;

    async validateFile(buffer: ArrayBuffer, _fileName: string): Promise<boolean> {
        // Podstawowa walidacja - sprawdź czy buffer nie jest pusty
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        // Sprawdź maksymalny rozmiar (100MB)
        const maxSize = 100 * 1024 * 1024;
        if (buffer.byteLength > maxSize) {
            return false;
        }

        return true;
    }

    estimateProcessingTime(fileSize: number): number {
        // Bazowe szacowanie: 1ms na KB
        return Math.max(100, fileSize / 1024);
    }

    /**
     * Wykrywa język tekstu
     * @param text Tekst do analizy
     * @returns Kod języka ISO 639-1
     */
    protected detectLanguage(text: string): string {
        // Prosta heurystyka - można rozszerzyć o bibliotekę do detekcji języka
        const polishWords = ['i', 'w', 'na', 'z', 'do', 'od', 'przez', 'dla', 'o', 'po'];
        const englishWords = ['the', 'and', 'or', 'of', 'to', 'in', 'for', 'with', 'on', 'at'];

        const words = text.toLowerCase().split(/\s+/).slice(0, 100);

        let polishCount = 0;
        let englishCount = 0;

        words.forEach(word => {
            if (polishWords.includes(word)) polishCount++;
            if (englishWords.includes(word)) englishCount++;
        });

        if (polishCount > englishCount) return 'pl';
        if (englishCount > polishCount) return 'en';

        return 'unknown';
    }

    /**
     * Czyści tekst z niepotrzebnych elementów
     * @param text Tekst do wyczyszczenia
     * @returns Wyczyszczony tekst
     */
    protected cleanText(text: string): string {
        return text
            // Usuń nadmiarowe białe znaki
            .replace(/\s+/g, ' ')
            // Usuń pustę linie
            .replace(/\n\s*\n/g, '\n')
            // Usuń znaki kontrolne (niebezpieczne ASCII)
            .split('').filter(char => {
                const code = char.charCodeAt(0);
                return code >= 32 || code === 9 || code === 10 || code === 13;
            }).join('')
            // Przytnij białe znaki na początku i końcu
            .trim();
    }

    /**
     * Pobiera rozszerzenie pliku
     * @param fileName Nazwa pliku
     * @returns Rozszerzenie (bez kropki)
     */
    protected getFileExtension(fileName: string): string {
        return fileName.split('.').pop()?.toLowerCase() || '';
    }

    /**
     * Tworzy obiekt z metadanymi bazowymi
     * @param fileName Nazwa pliku
     * @param fileSize Rozmiar pliku
     * @param content Wyodrębniony tekst
     * @returns Obiekt metadanych
     */
    protected createBaseMetadata(
        fileName: string,
        fileSize: number,
        content: string
    ): ExtractedText['metadata'] {
        return {
            fileType: this.getFileExtension(fileName),
            fileSize,
            language: this.detectLanguage(content),
            wordCount: content.split(/\s+/).length,
            characterCount: content.length,
            extractedAt: new Date().toISOString()
        };
    }
}

/**
 * Factory dla ekstraktorów tekstu
 */
export class TextExtractorFactory {
    private readonly extractors: Map<string, TextExtractor> = new Map();

    /**
     * Rejestruje nowy ekstraktor
     * @param extractor Instancja ekstraktora
     */
    registerExtractor(extractor: TextExtractor): void {
        this.extractors.set(extractor.name, extractor);
    }

    /**
     * Znajduje odpowiedni ekstraktor dla pliku
     * @param mimeType Typ MIME pliku
     * @param fileName Nazwa pliku
     * @returns Ekstraktor lub null jeśli nie znaleziono
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
     * Zwraca listę wszystkich zarejestrowanych ekstraktorów
     * @returns Array ekstraktorów
     */
    getAllExtractors(): TextExtractor[] {
        return Array.from(this.extractors.values());
    }

    /**
     * Zwraca listę obsługiwanych typów MIME
     * @returns Array typów MIME
     */
    getSupportedMimeTypes(): string[] {
        const mimeTypes = new Set<string>();
        for (const extractor of Array.from(this.extractors.values())) {
            extractor.supportedMimeTypes.forEach(type => mimeTypes.add(type));
        }
        return Array.from(mimeTypes);
    }
}

/**
 * Globalna instancja factory
 */
export const textExtractorFactory = new TextExtractorFactory();

/**
 * Błędy ekstrakcji tekstu
 */
export class TextExtractionError extends Error {
    public readonly fileName: string;
    public readonly extractor: string;
    public readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        fileName: string,
        extractor: string,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'TextExtractionError';
        this.fileName = fileName;
        this.extractor = extractor;
        this.details = details;
    }
}
