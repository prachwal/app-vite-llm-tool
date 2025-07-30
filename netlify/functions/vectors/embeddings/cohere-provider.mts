/**
 * @fileoverview Cohere Embedding Provider - Implementacja providera dla embeddingów Cohere
 * Obsługuje modele: embed-multilingual-v3.0, embed-english-v3.0, embed-multilingual-light-v3.0
 */

import type { EmbeddingProvider, EmbeddingConfig, EmbeddingResult } from './embedding-interface.mjs';

export interface CohereEmbeddingConfig extends EmbeddingConfig {
    apiKey: string;
    model?: 'embed-multilingual-v3.0' | 'embed-english-v3.0' | 'embed-multilingual-light-v3.0';
    baseURL?: string;
    maxRetries?: number;
    timeout?: number;
    inputType?: 'search_document' | 'search_query' | 'classification' | 'clustering';
}

/**
 * Provider embeddingów Cohere
 */
export class CohereEmbeddingProvider implements EmbeddingProvider {
    private readonly config: Required<CohereEmbeddingConfig>;
    private requestCount = 0;
    private lastRequestTime = 0;
    private readonly rateLimitDelay = 200; // 200ms między requestami

    // Interface implementation
    readonly name = 'cohere';
    get model(): string { return this.config.model; }
    readonly dimensions = 1024; // embed-multilingual-v3.0 dimensions
    readonly maxInputLength = 2048;

    constructor(config: CohereEmbeddingConfig) {
        this.config = {
            model: 'embed-multilingual-v3.0',
            baseURL: 'https://api.cohere.ai/v1',
            maxRetries: 3,
            timeout: 30000,
            inputType: 'search_document',
            ...config
        };

        if (!this.config.apiKey) {
            throw new Error('Cohere API key is required');
        }
    }

    getName(): string {
        return 'cohere';
    }

    getModel(): string {
        return this.config.model;
    }

    getDimensions(): number {
        switch (this.config.model) {
            case 'embed-multilingual-v3.0':
                return 1024;
            case 'embed-english-v3.0':
                return 1024;
            case 'embed-multilingual-light-v3.0':
                return 384;
            default:
                return 1024;
        }
    }

    getMaxInputLength(): number {
        // Cohere obsługuje do 512 tokenów (w praktyce ~2048 znaków)
        return 2048;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        const result = await this.generateEmbeddingWithInfo(text);
        return result.embedding;
    }

    async generateEmbeddingWithInfo(text: string): Promise<EmbeddingResult> {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        if (text.length > this.getMaxInputLength()) {
            throw new Error(`Text too long. Maximum length: ${this.getMaxInputLength()} characters`);
        }

        const startTime = Date.now();

        try {
            // Rate limiting
            await this.enforceRateLimit();

            const response = await this.makeRequest([text]);

            if (!response.embeddings || response.embeddings.length === 0) {
                throw new Error('No embedding data received');
            }

            const embedding = response.embeddings[0];

            if (!Array.isArray(embedding) || embedding.length !== this.getDimensions()) {
                throw new Error(`Invalid embedding dimensions. Expected ${this.getDimensions()}, got ${embedding?.length || 0}`);
            }

            const processingTime = Date.now() - startTime;
            this.requestCount++;

            return {
                embedding,
                dimensions: this.getDimensions(),
                model: this.config.model,
                provider: this.getName(),
                tokenCount: this.estimateTokens(text),
                processingTime
            };

        } catch (error) {
            console.error('Cohere embedding generation failed:', error);

            if (error instanceof Error) {
                // Przekształć błędy Cohere na bardziej zrozumiałe komunikaty
                if (error.message.includes('rate limit')) {
                    throw new Error('Cohere API rate limit exceeded. Please try again later.');
                }
                if (error.message.includes('quota') || error.message.includes('credit')) {
                    throw new Error('Cohere API quota exceeded. Please check your billing.');
                }
                if (error.message.includes('unauthorized') || error.message.includes('api key')) {
                    throw new Error('Invalid Cohere API key.');
                }
                throw error;
            }

            throw new Error('Failed to generate Cohere embedding');
        }
    }

    async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('Texts array cannot be empty');
        }

        // Cohere obsługuje batch processing natively
        const batchSize = 96; // Cohere limit: 96 tekstów na request
        const results: EmbeddingResult[] = [];

        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            try {
                const batchResults = await this.processBatch(batch);
                results.push(...batchResults);
            } catch (error) {
                console.error(`Failed to process batch ${Math.floor(i / batchSize)}:`, error);
                throw error;
            }
        }

        return results;
    }

    getStats() {
        return {
            provider: this.getName(),
            model: this.config.model,
            requestCount: this.requestCount,
            dimensions: this.getDimensions(),
            maxInputLength: this.getMaxInputLength()
        };
    }

    /**
     * Przetwarza batch tekstów
     */
    private async processBatch(texts: string[]): Promise<EmbeddingResult[]> {
        const startTime = Date.now();

        // Rate limiting
        await this.enforceRateLimit();

        try {
            const response = await this.makeRequest(texts);

            if (!response.embeddings || response.embeddings.length !== texts.length) {
                throw new Error(`Mismatch in batch results. Expected ${texts.length}, got ${response.embeddings?.length || 0}`);
            }

            const processingTime = Date.now() - startTime;
            this.requestCount++;

            return response.embeddings.map((embedding: number[], index: number) => ({
                embedding,
                dimensions: this.getDimensions(),
                model: this.config.model,
                provider: this.getName(),
                tokenCount: this.estimateTokens(texts[index]),
                processingTime: Math.round(processingTime / texts.length) // Średni czas na tekst
            }));

        } catch (error) {
            console.error('Cohere batch processing failed:', error);
            throw error;
        }
    }

    /**
     * Rate limiting - Cohere ma limity requestów na minutę
     */
    private async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
            const delay = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Wykonuje request do Cohere API
     */
    private async makeRequest(texts: string[]): Promise<any> {
        const url = `${this.config.baseURL}/embed`;

        const requestBody = {
            model: this.config.model,
            texts: texts,
            input_type: this.config.inputType,
            embedding_types: ['float']
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'User-Agent': 'Netlify-Vector-App/1.0'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Cohere API error ${response.status}: ${errorData.message || response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Cohere API request timeout after ${this.config.timeout}ms`);
            }

            throw error;
        }
    }

    /**
     * Szacuje liczbę tokenów na podstawie liczby znaków
     * Przybliżone: 1 token ≈ 3 znaki dla różnych języków
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 3);
    }

    /**
     * Sprawdza czy provider jest dostępny
     */
    async healthCheck(): Promise<boolean> {
        try {
            // Test z bardzo krótkim tekstem
            await this.generateEmbedding('test');
            return true;
        } catch (error) {
            console.error('Cohere provider health check failed:', error);
            return false;
        }
    }

    async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        const results: number[][] = [];

        for (const text of texts) {
            const embedding = await this.generateEmbedding(text);
            results.push(embedding);
        }

        return results;
    }

    async isAvailable(): Promise<boolean> {
        return this.healthCheck();
    }

    validateConfig(): boolean {
        return !!this.config.apiKey;
    }

    getRateLimits() {
        return {
            requestsPerMinute: 100, // Cohere limit
            tokensPerMinute: 10000
        };
    }

    estimateCost(textLength: number): number {
        // Cohere pricing estimation
        const tokens = Math.ceil(textLength / 3);
        return (tokens / 1000) * 0.0002; // Estimated cost per 1K tokens
    }
}
