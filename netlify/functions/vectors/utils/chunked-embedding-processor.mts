/**
 * @fileoverview Chunked Embedding Processor
 * System do przetwarzania embeddingów dla dużych plików w partiach
 */

import type { TextChunk } from './text-chunker.mjs';
import type { EmbeddingProvider } from '../embeddings/embedding-interface.mjs';

/**
 * Opcje przetwarzania embeddingów w partiach
 */
export interface ChunkedProcessingOptions {
    /** Maksymalna liczba chunków przetwarzanych jednocześnie */
    batchSize: number;
    /** Maksymalny czas przetwarzania w ms (dla Netlify Functions) */
    maxProcessingTime: number;
    /** Czy wstrzymać się między partiami */
    pauseBetweenBatches: number;
    /** Maksymalna liczba ponownych prób dla nieudanych chunków */
    maxRetries: number;
    /** Callback dla postępu */
    onProgress?: (processed: number, total: number) => void;
    /** Callback dla błędów */
    onError?: (chunkIndex: number, error: Error) => void;
}

/**
 * Wynik przetwarzania partii
 */
export interface ChunkedProcessingResult {
    /** Wszystkie wygenerowane embeddingi */
    embeddings: Array<{
        chunkIndex: number;
        embedding: number[];
        tokenCount: number;
    }>;
    /** Informacje o przetwarzaniu */
    stats: {
        totalChunks: number;
        processedChunks: number;
        failedChunks: number;
        totalTokens: number;
        processingTime: number;
        avgTimePerChunk: number;
    };
    /** Błędy które wystąpiły */
    errors: Array<{
        chunkIndex: number;
        error: string;
        retryCount: number;
    }>;
    /** Czy przetwarzanie zostało ukończone */
    isComplete: boolean;
}

/**
 * Processor do przetwarzania embeddingów w partiach
 */
export class ChunkedEmbeddingProcessor {
    private readonly provider: EmbeddingProvider;
    private readonly options: ChunkedProcessingOptions;

    constructor(provider: EmbeddingProvider, options: Partial<ChunkedProcessingOptions> = {}) {
        this.provider = provider;
        this.options = {
            batchSize: 10,
            maxProcessingTime: 25000, // 25 sekund dla Netlify Functions
            pauseBetweenBatches: 100,
            maxRetries: 3,
            ...options
        };
    }

    /**
     * Przetwarza chunki i generuje embeddingi w partiach
     */
    async processChunks(chunks: TextChunk[]): Promise<ChunkedProcessingResult> {
        const startTime = Date.now();
        const result: ChunkedProcessingResult = {
            embeddings: [],
            stats: {
                totalChunks: chunks.length,
                processedChunks: 0,
                failedChunks: 0,
                totalTokens: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
                processingTime: 0,
                avgTimePerChunk: 0
            },
            errors: [],
            isComplete: false
        };

        const retryMap = new Map<number, number>(); // chunk index -> retry count

        try {
            // Przetwarzaj w partiach
            for (let i = 0; i < chunks.length; i += this.options.batchSize) {
                // Sprawdź limit czasu
                if (Date.now() - startTime > this.options.maxProcessingTime) {
                    console.warn('Processing time limit reached, stopping...');
                    break;
                }

                const batchChunks = chunks.slice(i, i + this.options.batchSize);
                const batchResults = await this.processBatch(batchChunks, i, retryMap);

                // Dodaj wyniki
                result.embeddings.push(...batchResults.embeddings);
                result.errors.push(...batchResults.errors);
                result.stats.processedChunks += batchResults.processed;
                result.stats.failedChunks += batchResults.failed;

                // Callback postępu
                if (this.options.onProgress) {
                    this.options.onProgress(result.stats.processedChunks, chunks.length);
                }

                // Pauza między partiami
                if (this.options.pauseBetweenBatches > 0 && i + this.options.batchSize < chunks.length) {
                    await new Promise(resolve => setTimeout(resolve, this.options.pauseBetweenBatches));
                }
            }

            // Ponowne próby dla nieudanych chunków
            await this.retryFailedChunks(chunks, result, retryMap);

            result.stats.processingTime = Date.now() - startTime;
            result.stats.avgTimePerChunk = result.stats.processingTime / Math.max(1, result.stats.processedChunks);
            result.isComplete = result.stats.failedChunks === 0;

            return result;

        } catch (error) {
            console.error('Chunked processing failed:', error);
            result.stats.processingTime = Date.now() - startTime;
            result.errors.push({
                chunkIndex: -1,
                error: error instanceof Error ? error.message : 'Unknown error',
                retryCount: 0
            });
            return result;
        }
    }

    /**
     * Przetwarza jedną partię chunków
     */
    private async processBatch(
        chunks: TextChunk[],
        startIndex: number,
        retryMap: Map<number, number>
    ): Promise<{
        embeddings: Array<{ chunkIndex: number; embedding: number[]; tokenCount: number }>;
        errors: Array<{ chunkIndex: number; error: string; retryCount: number }>;
        processed: number;
        failed: number;
    }> {
        const embeddings: Array<{ chunkIndex: number; embedding: number[]; tokenCount: number }> = [];
        const errors: Array<{ chunkIndex: number; error: string; retryCount: number }> = [];
        let processed = 0;
        let failed = 0;

        // Sprawdź czy provider obsługuje batch processing
        if (this.provider.getBatchEmbeddings) {
            try {
                const texts = chunks.map(chunk => chunk.content);
                const batchEmbeddings = await this.provider.getBatchEmbeddings(texts);

                for (let i = 0; i < batchEmbeddings.length; i++) {
                    const chunkIndex = startIndex + i;
                    embeddings.push({
                        chunkIndex,
                        embedding: batchEmbeddings[i],
                        tokenCount: chunks[i].tokenCount
                    });
                    processed++;
                }
            } catch (error) {
                console.warn('Batch processing failed, falling back to individual processing:', error);
                // Fallback na przetwarzanie indywidualne
                return this.processIndividualChunks(chunks, startIndex, retryMap);
            }
        } else {
            // Przetwarzanie indywidualne
            return this.processIndividualChunks(chunks, startIndex, retryMap);
        }

        return { embeddings, errors, processed, failed };
    }

    /**
     * Przetwarza chunki indywidualnie
     */
    private async processIndividualChunks(
        chunks: TextChunk[],
        startIndex: number,
        retryMap: Map<number, number>
    ): Promise<{
        embeddings: Array<{ chunkIndex: number; embedding: number[]; tokenCount: number }>;
        errors: Array<{ chunkIndex: number; error: string; retryCount: number }>;
        processed: number;
        failed: number;
    }> {
        const embeddings: Array<{ chunkIndex: number; embedding: number[]; tokenCount: number }> = [];
        const errors: Array<{ chunkIndex: number; error: string; retryCount: number }> = [];
        let processed = 0;
        let failed = 0;

        for (let i = 0; i < chunks.length; i++) {
            try {
                const chunkIndex = startIndex + i;
                const embedding = await this.provider.generateEmbedding(chunks[i].content);

                embeddings.push({
                    chunkIndex,
                    embedding,
                    tokenCount: chunks[i].tokenCount
                });
                processed++;

            } catch (error) {
                const chunkIndex = startIndex + i;
                const retryCount = retryMap.get(chunkIndex) || 0;

                errors.push({
                    chunkIndex,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    retryCount
                });
                failed++;

                if (this.options.onError) {
                    this.options.onError(chunkIndex, error instanceof Error ? error : new Error('Unknown error'));
                }
            }
        }

        return { embeddings, errors, processed, failed };
    }

    /**
     * Ponawia przetwarzanie nieudanych chunków
     */
    private async retryFailedChunks(
        allChunks: TextChunk[],
        result: ChunkedProcessingResult,
        retryMap: Map<number, number>
    ): Promise<void> {
        const failedChunks = result.errors.filter(error =>
            (retryMap.get(error.chunkIndex) || 0) < this.options.maxRetries
        );

        if (failedChunks.length === 0) return;

        console.log(`Retrying ${failedChunks.length} failed chunks...`);

        for (const failedChunk of failedChunks) {
            try {
                const chunk = allChunks[failedChunk.chunkIndex];
                if (!chunk) continue;

                const retryCount = (retryMap.get(failedChunk.chunkIndex) || 0) + 1;
                retryMap.set(failedChunk.chunkIndex, retryCount);

                const embedding = await this.provider.generateEmbedding(chunk.content);

                // Usuń z błędów
                const errorIndex = result.errors.findIndex(e => e.chunkIndex === failedChunk.chunkIndex);
                if (errorIndex !== -1) {
                    result.errors.splice(errorIndex, 1);
                }

                // Dodaj do wyników
                result.embeddings.push({
                    chunkIndex: failedChunk.chunkIndex,
                    embedding,
                    tokenCount: chunk.tokenCount
                });

                result.stats.processedChunks++;
                result.stats.failedChunks--;

            } catch (error) {
                console.warn(`Retry failed for chunk ${failedChunk.chunkIndex}:`, error);
                // Aktualizuj błąd z nową liczbą prób
                const errorIndex = result.errors.findIndex(e => e.chunkIndex === failedChunk.chunkIndex);
                if (errorIndex !== -1) {
                    result.errors[errorIndex].retryCount = retryMap.get(failedChunk.chunkIndex) || 0;
                }
            }
        }
    }

    /**
     * Szacuje czas przetwarzania dla danej liczby chunków
     */
    estimateProcessingTime(chunkCount: number): number {
        // Szacujemy ~200ms na chunk dla pojedynczego embeddingu
        // Plus overhead na batch processing
        const baseTimePerChunk = 200;
        const batchOverhead = Math.ceil(chunkCount / this.options.batchSize) * 100;

        return (chunkCount * baseTimePerChunk) + batchOverhead;
    }

    /**
     * Sprawdza czy przetwarzanie zmieści się w limicie czasu
     */
    canProcessInTimeLimit(chunkCount: number): boolean {
        const estimatedTime = this.estimateProcessingTime(chunkCount);
        return estimatedTime <= this.options.maxProcessingTime;
    }

    /**
     * Dzieli chunki na grupy które zmieszczą się w limicie czasu
     */
    splitChunksForTimeLimit(chunks: TextChunk[]): TextChunk[][] {
        const groups: TextChunk[][] = [];
        let currentGroup: TextChunk[] = [];
        let currentEstimatedTime = 0;

        for (const chunk of chunks) {
            const chunkTime = this.estimateProcessingTime(1);

            if (currentEstimatedTime + chunkTime > this.options.maxProcessingTime && currentGroup.length > 0) {
                groups.push([...currentGroup]);
                currentGroup = [chunk];
                currentEstimatedTime = chunkTime;
            } else {
                currentGroup.push(chunk);
                currentEstimatedTime += chunkTime;
            }
        }

        if (currentGroup.length > 0) {
            groups.push(currentGroup);
        }

        return groups;
    }
}

/**
 * Factory function dla ChunkedEmbeddingProcessor
 */
export function createChunkedProcessor(
    provider: EmbeddingProvider,
    options?: Partial<ChunkedProcessingOptions>
): ChunkedEmbeddingProcessor {
    return new ChunkedEmbeddingProcessor(provider, options);
}
