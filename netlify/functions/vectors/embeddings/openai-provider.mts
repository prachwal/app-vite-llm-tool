/**
 * @fileoverview OpenAI Embedding Provider - Implementacja providera dla embeddingów OpenAI
 * Obsługuje modele: text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large
 */

import type { EmbeddingProvider, EmbeddingConfig, EmbeddingResult } from './embedding-interface.mjs';

export interface OpenAIEmbeddingConfig extends EmbeddingConfig {
    apiKey: string;
    model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
    baseURL?: string;
    maxRetries?: number;
    timeout?: number;
}

/**
 * Provider embeddingów OpenAI
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private readonly config: Required<OpenAIEmbeddingConfig>;
    private requestCount = 0;
    private lastRequestTime = 0;
    private readonly rateLimitDelay = 100; // 100ms między requestami

    // Interface implementation
    readonly name = 'openai';
    get model(): string { return this.config.model; }
    readonly dimensions = 1536; // text-embedding-ada-002 dimensions
    readonly maxInputLength = 32000;

    constructor(config: OpenAIEmbeddingConfig) {
        this.config = {
            model: 'text-embedding-ada-002',
            baseURL: 'https://api.openai.com/v1',
            maxRetries: 3,
            timeout: 30000,
            ...config
        };

        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
    }

    getName(): string {
        return 'openai';
    }

    getModel(): string {
        return this.config.model;
    }

    getDimensions(): number {
        switch (this.config.model) {
            case 'text-embedding-ada-002':
                return 1536;
            case 'text-embedding-3-small':
                return 1536;
            case 'text-embedding-3-large':
                return 3072;
            default:
                return 1536;
        }
    }

    getMaxInputLength(): number {
        // OpenAI obsługuje do ~8192 tokenów (w praktyce ~32000 znaków)
        return 32000;
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

            const response = await this.makeRequest(text);

            if (!response.data || response.data.length === 0) {
                throw new Error('No embedding data received');
            }

            const embedding = response.data[0].embedding;

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
                tokenCount: response.usage?.total_tokens || this.estimateTokens(text),
                processingTime
            };

        } catch (error) {
            console.error('OpenAI embedding generation failed:', error);

            if (error instanceof Error) {
                // Przekształć błędy OpenAI na bardziej zrozumiałe komunikaty
                if (error.message.includes('rate limit')) {
                    throw new Error('OpenAI API rate limit exceeded. Please try again later.');
                }
                if (error.message.includes('quota')) {
                    throw new Error('OpenAI API quota exceeded. Please check your billing.');
                }
                if (error.message.includes('api key')) {
                    throw new Error('Invalid OpenAI API key.');
                }
                throw error;
            }

            throw new Error('Failed to generate OpenAI embedding');
        }
    }

    async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
        if (!Array.isArray(texts) || texts.length === 0) {
            throw new Error('Texts array cannot be empty');
        }

        // OpenAI obsługuje batch processing, ale dla bezpieczeństwa przetwarzamy pojedynczo
        const results: EmbeddingResult[] = [];

        for (let i = 0; i < texts.length; i++) {
            try {
                const result = await this.generateEmbeddingWithInfo(texts[i]);
                results.push(result);
            } catch (error) {
                console.error(`Failed to process text ${i}:`, error);
                // Możemy kontynuować z błędami lub przerwać - zależy od strategii
                throw error;
            }
        }

        return results;
    }

    async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        const results = await this.generateBatchEmbeddings(texts);
        return results.map(result => result.embedding);
    }

    async isAvailable(): Promise<boolean> {
        try {
            // Test z krótkim tekstem
            await this.generateEmbedding('test');
            return true;
        } catch {
            return false;
        }
    }

    validateConfig(): boolean {
        return !!this.config.apiKey;
    }

    getRateLimits() {
        return {
            requestsPerMinute: 600, // OpenAI limit
            tokensPerMinute: 150000
        };
    }

    estimateCost(textLength: number): number {
        // OpenAI pricing: $0.0001 per 1K tokens
        const tokens = Math.ceil(textLength / 4); // Rough estimation
        return (tokens / 1000) * 0.0001;
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
     * Rate limiting - OpenAI ma limity requestów na minutę
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
     * Wykonuje request do OpenAI API
     */
    private async makeRequest(text: string): Promise<any> {
        const url = `${this.config.baseURL}/embeddings`;

        const requestBody = {
            model: this.config.model,
            input: text,
            encoding_format: 'float'
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
                throw new Error(`OpenAI API error ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`OpenAI API request timeout after ${this.config.timeout}ms`);
            }

            throw error;
        }
    }

    /**
     * Szacuje liczbę tokenów na podstawie liczby znaków
     * Przybliżone: 1 token ≈ 4 znaki dla angielskiego tekstu
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
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
            console.error('OpenAI provider health check failed:', error);
            return false;
        }
    }
}
