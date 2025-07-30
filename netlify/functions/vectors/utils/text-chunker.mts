/**
 * @fileoverview Text Chunking Utilities
 * Implementacja narzędzi do dzielenia tekstu na fragmenty dla embeddingów
 */

/**
 * Konfiguracja chunking dla różnych typów plików
 */
export interface ChunkingConfig {
    /** Maksymalna liczba tokenów na fragment */
    maxTokens: number;
    /** Liczba tokenów nakładania między fragmentami */
    overlapTokens: number;
    /** Separatory używane do dzielenia tekstu */
    separators: string[];
    /** Czy zachować strukturę dokumentu */
    preserveStructure: boolean;
    /** Minimalna długość fragmentu */
    minChunkSize: number;
}

/**
 * Fragment tekstu
 */
export interface TextChunk {
    /** Indeks fragmentu */
    index: number;
    /** Zawartość fragmentu */
    content: string;
    /** Liczba tokenów (szacowana) */
    tokenCount: number;
    /** Pozycja początkowa w oryginalnym tekście */
    startPosition: number;
    /** Pozycja końcowa w oryginalnym tekście */
    endPosition: number;
    /** Metadane fragmentu */
    metadata: {
        /** Typ fragmentu (paragraph, heading, code, etc.) */
        type: string;
        /** Nagłówek sekcji (jeśli dostępny) */
        heading?: string;
        /** Poziom zagnieżdżenia */
        level?: number;
        /** Czy to początek nowej sekcji */
        isNewSection?: boolean;
        /** Dodatkowe metadane */
        [key: string]: unknown;
    };
}

/**
 * Domyślne konfiguracje chunking dla różnych typów plików
 */
export const DEFAULT_CHUNKING_CONFIGS: Record<string, ChunkingConfig> = {
    // Dokumenty tekstowe
    txt: {
        maxTokens: 1000,
        overlapTokens: 100,
        separators: ['\n\n', '\n', '. ', ', ', ' '],
        preserveStructure: false,
        minChunkSize: 50
    },

    // Markdown
    md: {
        maxTokens: 800,
        overlapTokens: 80,
        separators: ['\n## ', '\n### ', '\n#### ', '\n\n', '\n', '. '],
        preserveStructure: true,
        minChunkSize: 50
    },

    // Kod źródłowy
    code: {
        maxTokens: 500,
        overlapTokens: 50,
        separators: ['\nclass ', '\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\n\n', '\n'],
        preserveStructure: true,
        minChunkSize: 20
    },

    // PDF (tekst wyodrębniony)
    pdf: {
        maxTokens: 1000,
        overlapTokens: 100,
        separators: ['\n\n', '\n', '. ', ', ', ' '],
        preserveStructure: false,
        minChunkSize: 50
    },

    // HTML
    html: {
        maxTokens: 800,
        overlapTokens: 80,
        separators: ['\n\n', '\n', '. ', ', ', ' '],
        preserveStructure: true,
        minChunkSize: 50
    },

    // JSON
    json: {
        maxTokens: 600,
        overlapTokens: 60,
        separators: ['},\n{', '},', '\n'],
        preserveStructure: true,
        minChunkSize: 30
    },

    // CSV
    csv: {
        maxTokens: 1200,
        overlapTokens: 120,
        separators: ['\n'],
        preserveStructure: true,
        minChunkSize: 100
    },

    // DOCX
    docx: {
        maxTokens: 1000,
        overlapTokens: 100,
        separators: ['\n\n', '\n', '. ', ', ', ' '],
        preserveStructure: true,
        minChunkSize: 50
    }
};

/**
 * Konfiguracje smart chunking na podstawie rozmiaru pliku
 */
export const SMART_CHUNKING_CONFIGS = {
    // Małe pliki (< 5KB) - większe chunki
    small: {
        maxTokens: 1500,
        overlapTokens: 150,
        minChunkSize: 100
    },
    // Średnie pliki (5KB - 100KB) - standardowe chunki
    medium: {
        maxTokens: 1000,
        overlapTokens: 100,
        minChunkSize: 50
    },
    // Duże pliki (100KB - 1MB) - mniejsze chunki
    large: {
        maxTokens: 700,
        overlapTokens: 70,
        minChunkSize: 30
    },
    // Bardzo duże pliki (> 1MB) - bardzo małe chunki
    extraLarge: {
        maxTokens: 500,
        overlapTokens: 50,
        minChunkSize: 20
    }
};

/**
 * Funkcja do określenia rozmiaru chunków na podstawie rozmiaru pliku
 */
export function getSmartChunkingConfig(fileSizeBytes: number, baseConfig: ChunkingConfig): ChunkingConfig {
    let sizeConfig;

    if (fileSizeBytes < 5 * 1024) { // < 5KB
        sizeConfig = SMART_CHUNKING_CONFIGS.small;
    } else if (fileSizeBytes < 100 * 1024) { // < 100KB
        sizeConfig = SMART_CHUNKING_CONFIGS.medium;
    } else if (fileSizeBytes < 1024 * 1024) { // < 1MB
        sizeConfig = SMART_CHUNKING_CONFIGS.large;
    } else {
        sizeConfig = SMART_CHUNKING_CONFIGS.extraLarge;
    }

    return {
        ...baseConfig,
        maxTokens: sizeConfig.maxTokens,
        overlapTokens: sizeConfig.overlapTokens,
        minChunkSize: sizeConfig.minChunkSize
    };
}

/**
 * Klasa do dzielenia tekstu na fragmenty
 */
export class TextChunker {
    private readonly config: ChunkingConfig;

    constructor(config?: Partial<ChunkingConfig>) {
        this.config = {
            maxTokens: 1000,
            overlapTokens: 100,
            separators: ['\n\n', '\n', '. ', ', ', ' '],
            preserveStructure: false,
            minChunkSize: 50,
            ...config
        };
    }

    /**
     * Dzieli tekst na fragmenty z smart chunking
     * @param text Tekst do podzielenia
     * @param fileType Typ pliku (opcjonalny)
     * @param fileSizeBytes Rozmiar pliku w bajtach (opcjonalny)
     * @returns Array fragmentów
     */
    chunkText(text: string, fileType?: string, fileSizeBytes?: number): TextChunk[] {
        if (!text.trim()) {
            return [];
        }

        // Użyj konfiguracji specyficznej dla typu pliku
        let config = fileType && DEFAULT_CHUNKING_CONFIGS[fileType]
            ? { ...this.config, ...DEFAULT_CHUNKING_CONFIGS[fileType] }
            : this.config;

        // Zastosuj smart chunking na podstawie rozmiaru pliku
        if (fileSizeBytes) {
            config = getSmartChunkingConfig(fileSizeBytes, config);
        }

        // Jeśli tekst jest krótki, zwróć jako jeden fragment
        const estimatedTokens = this.estimateTokenCount(text);
        if (estimatedTokens <= config.maxTokens) {
            return [{
                index: 0,
                content: text.trim(),
                tokenCount: estimatedTokens,
                startPosition: 0,
                endPosition: text.length,
                metadata: {
                    type: 'single',
                    isNewSection: true
                }
            }];
        }

        // Podziel tekst na fragmenty
        if (config.preserveStructure && fileType) {
            return this.chunkWithStructure(text, config, fileType);
        } else {
            return this.chunkByLength(text, config);
        }
    }

    /**
     * Dzielenie z zachowaniem struktury dokumentu
     */
    private chunkWithStructure(text: string, config: ChunkingConfig, fileType: string): TextChunk[] {
        switch (fileType) {
            case 'md':
            case 'markdown':
                return this.chunkMarkdown(text, config);

            case 'js':
            case 'ts':
            case 'py':
            case 'java':
            case 'cpp':
            case 'cs':
                return this.chunkCode(text, config, fileType);

            case 'html':
            case 'htm':
                return this.chunkHtml(text, config);

            case 'json':
                return this.chunkJson(text, config);

            default:
                return this.chunkByLength(text, config);
        }
    }

    /**
     * Dzielenie markdown z zachowaniem struktury nagłówków
     */
    private chunkMarkdown(text: string, config: ChunkingConfig): TextChunk[] {
        const chunks: TextChunk[] = [];
        const lines = text.split('\n');

        let currentChunk = '';
        let currentHeading = '';
        let currentLevel = 0;
        let startPosition = 0;
        let chunkIndex = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = /^(#{1,6})\s+(.+)/.exec(line);

            if (headingMatch) {
                // Nowy nagłówek - zakończ poprzedni chunk jeśli jest
                if (currentChunk.trim()) {
                    chunks.push(this.createChunk(
                        currentChunk.trim(),
                        chunkIndex++,
                        startPosition,
                        startPosition + currentChunk.length,
                        {
                            type: 'section',
                            heading: currentHeading,
                            level: currentLevel,
                            isNewSection: true
                        }
                    ));
                }

                // Rozpocznij nowy chunk
                currentHeading = headingMatch[2];
                currentLevel = headingMatch[1].length;
                currentChunk = line + '\n';
                startPosition = this.getLinePosition(text, i);
            } else {
                currentChunk += line + '\n';

                // Sprawdź czy chunk nie jest za długi
                if (this.estimateTokenCount(currentChunk) > config.maxTokens) {
                    // Podziel aktualny chunk
                    const subChunks = this.splitLongChunk(currentChunk, config, startPosition);
                    chunks.push(...subChunks.map(chunk => ({
                        ...chunk,
                        index: chunkIndex++,
                        metadata: {
                            ...chunk.metadata,
                            heading: currentHeading,
                            level: currentLevel
                        }
                    })));

                    currentChunk = '';
                    startPosition = this.getLinePosition(text, i + 1);
                }
            }
        }

        // Dodaj ostatni chunk
        if (currentChunk.trim()) {
            chunks.push(this.createChunk(
                currentChunk.trim(),
                chunkIndex,
                startPosition,
                startPosition + currentChunk.length,
                {
                    type: 'section',
                    heading: currentHeading,
                    level: currentLevel
                }
            ));
        }

        return chunks;
    }

    /**
     * Dzielenie kodu z zachowaniem funkcji/klas
     */
    private chunkCode(text: string, config: ChunkingConfig, language: string): TextChunk[] {
        const chunks: TextChunk[] = [];
        const lines = text.split('\n');

        // Patterns dla różnych języków
        const patterns = this.getCodePatterns(language);

        let currentChunk = '';
        let currentFunction = '';
        let startPosition = 0;
        let chunkIndex = 0;
        let braceLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Sprawdź czy to definicja funkcji/klasy
            const functionMatch = this.matchCodePattern(line, patterns);

            if (functionMatch && braceLevel === 0) {
                // Nowa funkcja - zakończ poprzedni chunk
                if (currentChunk.trim()) {
                    chunks.push(this.createChunk(
                        currentChunk.trim(),
                        chunkIndex++,
                        startPosition,
                        startPosition + currentChunk.length,
                        {
                            type: 'code_block',
                            function: currentFunction,
                            language
                        }
                    ));
                }

                currentFunction = functionMatch;
                currentChunk = line + '\n';
                startPosition = this.getLinePosition(text, i);
            } else {
                currentChunk += line + '\n';
            }

            // Śledź poziom zagnieżdżenia
            braceLevel += (line.match(/{/g) || []).length;
            braceLevel -= (line.match(/}/g) || []).length;

            // Sprawdź długość chunk
            if (this.estimateTokenCount(currentChunk) > config.maxTokens) {
                const subChunks = this.splitLongChunk(currentChunk, config, startPosition);
                chunks.push(...subChunks.map(chunk => ({
                    ...chunk,
                    index: chunkIndex++,
                    metadata: {
                        ...chunk.metadata,
                        function: currentFunction,
                        language
                    }
                })));

                currentChunk = '';
                startPosition = this.getLinePosition(text, i + 1);
            }
        }

        // Dodaj ostatni chunk
        if (currentChunk.trim()) {
            chunks.push(this.createChunk(
                currentChunk.trim(),
                chunkIndex,
                startPosition,
                startPosition + currentChunk.length,
                {
                    type: 'code_block',
                    function: currentFunction,
                    language
                }
            ));
        }

        return chunks;
    }

    /**
     * Dzielenie HTML z zachowaniem elementów
     */
    private chunkHtml(text: string, config: ChunkingConfig): TextChunk[] {
        // Uproszczona implementacja - podziel po tagach blokowych
        const blockTags = ['</p>', '</div>', '</section>', '</article>', '</h1>', '</h2>', '</h3>', '</h4>', '</h5>', '</h6>'];

        return this.chunkBySeparators(text, [...blockTags, ...config.separators], config);
    }

    /**
     * Dzielenie JSON z zachowaniem obiektów
     */
    private chunkJson(text: string, config: ChunkingConfig): TextChunk[] {
        try {
            // Spróbuj sparsować JSON
            JSON.parse(text);

            // JSON - używamy standardowego podziału po długości
            return this.chunkByLength(text, config);
        } catch {
            // Jeśli parsing się nie uda, podziel po liniach
            return this.chunkByLength(text, config);
        }
    }

    /**
     * Dzielenie po długości z użyciem separatorów
     */
    private chunkByLength(text: string, config: ChunkingConfig): TextChunk[] {
        return this.chunkBySeparators(text, config.separators, config);
    }

    /**
     * Dzielenie tekstu przy użyciu separatorów
     */
    private chunkBySeparators(text: string, separators: string[], config: ChunkingConfig): TextChunk[] {
        const chunks: TextChunk[] = [];
        let remaining = text;
        let globalPosition = 0;
        let chunkIndex = 0;

        while (remaining.length > 0) {
            let chunkEnd = Math.min(remaining.length, config.maxTokens * 4); // Estymacja tokenów
            let bestSeparatorPos = -1;

            // Znajdź najlepsze miejsce podziału
            for (const separator of separators) {
                const pos = remaining.lastIndexOf(separator, chunkEnd);
                if (pos > bestSeparatorPos && pos > chunkEnd / 2) {
                    bestSeparatorPos = pos + separator.length;
                }
            }

            if (bestSeparatorPos === -1) {
                bestSeparatorPos = chunkEnd;
            }

            const chunkContent = remaining.substring(0, bestSeparatorPos).trim();

            if (chunkContent.length >= config.minChunkSize) {
                chunks.push(this.createChunk(
                    chunkContent,
                    chunkIndex++,
                    globalPosition,
                    globalPosition + bestSeparatorPos,
                    { type: 'text_segment' }
                ));
            }

            // Przejdź do następnego fragmentu z nakładaniem
            const overlapStart = Math.max(0, bestSeparatorPos - config.overlapTokens * 4);
            remaining = remaining.substring(overlapStart);
            globalPosition += overlapStart;

            // Zabezpieczenie przed nieskończoną pętlą
            if (bestSeparatorPos === 0) {
                break;
            }
        }

        return chunks;
    }

    /**
     * Dzieli długi chunk na mniejsze
     */
    private splitLongChunk(text: string, config: ChunkingConfig, startPos: number): TextChunk[] {
        const tempChunker = new TextChunker({
            ...config,
            preserveStructure: false
        });

        return tempChunker.chunkText(text).map((chunk) => ({
            ...chunk,
            startPosition: startPos + chunk.startPosition,
            endPosition: startPos + chunk.endPosition
        }));
    }

    /**
     * Tworzy obiekt chunk
     */
    private createChunk(
        content: string,
        index: number,
        startPos: number,
        endPos: number,
        metadata: TextChunk['metadata']
    ): TextChunk {
        return {
            index,
            content,
            tokenCount: this.estimateTokenCount(content),
            startPosition: startPos,
            endPosition: endPos,
            metadata
        };
    }

    /**
     * Szacuje liczbę tokenów w tekście
     * Ulepszona heurystyka uwzględniająca różne rodzaje tekstu
     */
    private estimateTokenCount(text: string): number {
        if (!text.trim()) return 0;

        // Podstawowa heurystyka: liczymy słowa i znaki specjalne
        const words = text.trim().split(/\s+/).length;
        const punctuation = (text.match(/[.,!?;:()[\]{}"'-]/g) || []).length;
        const numbers = (text.match(/\d+/g) || []).length;

        // Szacujemy tokeny na podstawie słów + dodatkowych elementów
        // GPT-style tokenization: ~1.3 tokena na słowo dla języka angielskiego
        // Dodajemy tokeny za znaki specjalne i liczby
        const estimatedTokens = Math.ceil(words * 1.3 + punctuation * 0.5 + numbers * 0.7);

        // Minumum 1 token dla niepustego tekstu
        return Math.max(1, estimatedTokens);
    }

    /**
     * Bardziej precyzyjne liczenie tokenów dla różnych języków
     */
    estimateTokenCountForLanguage(text: string, language?: string): number {
        if (!text.trim()) return 0;

        // Współczynniki dla różnych języków (tokeny na słowo)
        const languageMultipliers: Record<string, number> = {
            'en': 1.3,  // Angielski
            'pl': 1.4,  // Polski (więcej końcówek)
            'de': 1.5,  // Niemiecki (długie słowa)
            'fr': 1.3,  // Francuski
            'es': 1.3,  // Hiszpański
            'it': 1.3,  // Włoski
            'ru': 1.6,  // Rosyjski (cyrylica)
            'zh': 1.0,  // Chiński (jeden znak = jeden token często)
            'ja': 1.0,  // Japoński
            'ko': 1.1   // Koreański
        };

        const multiplier = languageMultipliers[language || 'en'] || 1.3;

        const words = text.trim().split(/\s+/).length;
        const punctuation = (text.match(/[.,!?;:()[\]{}"'-]/g) || []).length;
        const numbers = (text.match(/\d+/g) || []).length;

        const estimatedTokens = Math.ceil(words * multiplier + punctuation * 0.5 + numbers * 0.7);

        return Math.max(1, estimatedTokens);
    }

    /**
     * Znajduje pozycję linii w tekście
     */
    private getLinePosition(text: string, lineIndex: number): number {
        const lines = text.split('\n');
        let position = 0;

        for (let i = 0; i < lineIndex && i < lines.length; i++) {
            position += lines[i].length + 1; // +1 dla \n
        }

        return position;
    }

    /**
     * Pobiera patterns dla danego języka
     */
    private getCodePatterns(language: string): RegExp[] {
        const patterns: Record<string, RegExp[]> = {
            js: [/^function\s+(\w+)/, /^const\s+(\w+)\s*=/, /^class\s+(\w+)/],
            ts: [/^function\s+(\w+)/, /^const\s+(\w+)\s*=/, /^class\s+(\w+)/, /^interface\s+(\w+)/],
            py: [/^def\s+(\w+)/, /^class\s+(\w+)/],
            java: [/^public\s+class\s+(\w+)/, /^public\s+\w+\s+(\w+)\s*\(/],
            cpp: [/^class\s+(\w+)/, /^\w+\s+(\w+)\s*\(/],
            cs: [/^public\s+class\s+(\w+)/, /^public\s+\w+\s+(\w+)\s*\(/]
        };

        return patterns[language] || [];
    }

    /**
     * Sprawdza czy linia pasuje do pattern
     */
    private matchCodePattern(line: string, patterns: RegExp[]): string | null {
        const trimmed = line.trim();

        for (const pattern of patterns) {
            const match = pattern.exec(trimmed);
            if (match?.[1]) {
                return match[1];
            }
        }

        return null;
    }

}

/**
 * Factory function dla TextChunker
 */
export function createTextChunker(fileType?: string, customConfig?: Partial<ChunkingConfig>): TextChunker {
    const baseConfig = fileType && DEFAULT_CHUNKING_CONFIGS[fileType]
        ? DEFAULT_CHUNKING_CONFIGS[fileType]
        : DEFAULT_CHUNKING_CONFIGS.txt;

    return new TextChunker({ ...baseConfig, ...customConfig });
}
