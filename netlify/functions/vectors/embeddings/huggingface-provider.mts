/**
 * @fileoverview HuggingFace Embedding Provider
 * Implementacja providera dla API HuggingFace Inference
 */

import {
    type EmbeddingProvider,
    type HuggingFaceConfig,
    EmbeddingProviderError,
    type RateLimiter
} from './embedding-interface.mjs';

/**
 * Rate limiter dla HuggingFace API
 */
class HuggingFaceRateLimiter implements RateLimiter {
    private requests = 0;
    private tokens = 0;
    private resetTime = new Date();
    private readonly maxRequestsPerMinute: number;
    private readonly maxTokensPerMinute: number;

    constructor(
        maxRequestsPerMinute = 1000,
        maxTokensPerMinute = 100000
    ) {
        this.maxRequestsPerMinute = maxRequestsPerMinute;
        this.maxTokensPerMinute = maxTokensPerMinute;
        this.resetTime = new Date(Date.now() + 60000);
    }

    async checkLimit(tokens = 1): Promise<boolean> {
        const now = new Date();

        // Reset jeśli minęła minuta
        if (now >= this.resetTime) {
            this.requests = 0;
            this.tokens = 0;
            this.resetTime = new Date(now.getTime() + 60000);
        }

        // Sprawdź limity
        if (this.requests >= this.maxRequestsPerMinute) {
            throw new EmbeddingProviderError(
                'Rate limit exceeded: requests per minute',
                'huggingface',
                'RATE_LIMIT_REQUESTS'
            );
        }

        if (this.tokens + tokens > this.maxTokensPerMinute) {
            throw new EmbeddingProviderError(
                'Rate limit exceeded: tokens per minute',
                'huggingface',
                'RATE_LIMIT_TOKENS'
            );
        }

        this.requests++;
        this.tokens += tokens;
        return true;
    }

    reset(): void {
        this.requests = 0;
        this.tokens = 0;
        this.resetTime = new Date(Date.now() + 60000);
    }

    getStatus() {
        return {
            remainingRequests: this.maxRequestsPerMinute - this.requests,
            remainingTokens: this.maxTokensPerMinute - this.tokens,
            resetTime: this.resetTime
        };
    }
}

/**
 * HuggingFace Embedding Provider
 */
export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
    readonly name = 'huggingface';

    private readonly config: HuggingFaceConfig;
    private readonly rateLimiter: HuggingFaceRateLimiter;
    private readonly baseUrl: string;

    // Model configurations
    private static readonly MODEL_CONFIGS = {
        'sentence-transformers/all-MiniLM-L6-v2': {
            dimensions: 384,
            maxInputLength: 512,
            cost: 0.0 // Free tier
        },
        'sentence-transformers/all-mpnet-base-v2': {
            dimensions: 768,
            maxInputLength: 512,
            cost: 0.0
        },
        'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2': {
            dimensions: 384,
            maxInputLength: 512,
            cost: 0.0
        }
    };

    constructor(config: HuggingFaceConfig) {
        this.config = {
            baseUrl: 'https://api-inference.huggingface.co',
            timeout: 30000,
            retries: 3,
            ...config
        };

        this.baseUrl = this.config.baseUrl!;
        this.rateLimiter = new HuggingFaceRateLimiter();

        if (!this.validateConfig()) {
            throw new EmbeddingProviderError(
                'Invalid HuggingFace configuration',
                this.name,
                'INVALID_CONFIG'
            );
        }
    }

    get model(): string {
        return this.config.model;
    }

    get dimensions(): number {
        const modelConfig = HuggingFaceEmbeddingProvider.MODEL_CONFIGS[
            this.config.model as keyof typeof HuggingFaceEmbeddingProvider.MODEL_CONFIGS
        ];
        return modelConfig?.dimensions || 384;
    }

    get maxInputLength(): number {
        const modelConfig = HuggingFaceEmbeddingProvider.MODEL_CONFIGS[
            this.config.model as keyof typeof HuggingFaceEmbeddingProvider.MODEL_CONFIGS
        ];
        return modelConfig?.maxInputLength || 512;
    }

    validateConfig(): boolean {
        return !!(
            this.config.apiKey &&
            this.config.model &&
            this.config.baseUrl
        );
    }

    getRateLimits() {
        return {
            requestsPerMinute: 1000,
            tokensPerMinute: 100000
        };
    }

    estimateCost(): number {
        // HuggingFace Inference API jest darmowe dla większości modeli
        return 0;
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.makeRequest(
                'Hello world',
                { timeout: 5000 }
            );
            return Array.isArray(response) && response.length > 0;
        } catch {
            return false;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!text.trim()) {
            throw new EmbeddingProviderError(
                'Text cannot be empty',
                this.name,
                'EMPTY_TEXT'
            );
        }

        // Sprawdź długość tekstu
        if (text.length > this.maxInputLength * 4) { // Gruba estymacja tokenów
            throw new EmbeddingProviderError(
                `Text too long: ${text.length} chars, max: ${this.maxInputLength * 4}`,
                this.name,
                'TEXT_TOO_LONG'
            );
        }

        // Sprawdź rate limit
        await this.rateLimiter.checkLimit(Math.ceil(text.length / 4));

        try {
            const embedding = await this.makeRequest(text);

            if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
                throw new EmbeddingProviderError(
                    `Invalid embedding response: expected ${this.dimensions} dimensions`,
                    this.name,
                    'INVALID_RESPONSE'
                );
            }

            return embedding;
        } catch (error) {
            if (error instanceof EmbeddingProviderError) {
                throw error;
            }

            throw new EmbeddingProviderError(
                `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
                this.name,
                'API_ERROR',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        if (texts.length === 0) {
            return [];
        }

        // HuggingFace Inference API nie obsługuje batch, wykonaj sekwencyjnie
        const embeddings: number[][] = [];

        for (const text of texts) {
            try {
                const embedding = await this.generateEmbedding(text);
                embeddings.push(embedding);

                // Krótka pauza między requestami aby uniknąć throttling
                await this.sleep(100);
            } catch (error) {
                // Loguj błąd ale kontynuuj z pozostałymi
                console.warn(`Failed to embed text: ${text.substring(0, 50)}...`, error);

                // Dodaj zero vector jako placeholder
                embeddings.push(new Array(this.dimensions).fill(0));
            }
        }

        return embeddings;
    }

    /**
     * Wykonuje request do HuggingFace API
     */
    private async makeRequest(
        text: string,
        options: { timeout?: number } = {}
    ): Promise<number[]> {
        const url = `${this.baseUrl}/pipeline/feature-extraction/${this.config.model}`;
        const timeout = options.timeout || this.config.timeout || 30000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Use-Cache': 'false' // Disable caching for fresh results
                },
                body: JSON.stringify({
                    inputs: text,
                    options: {
                        wait_for_model: true,
                        use_cache: false
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');

                // Handle specific HuggingFace errors
                if (response.status === 401) {
                    throw new EmbeddingProviderError(
                        'Invalid API key',
                        this.name,
                        'INVALID_API_KEY'
                    );
                }

                if (response.status === 429) {
                    throw new EmbeddingProviderError(
                        'Rate limit exceeded',
                        this.name,
                        'RATE_LIMIT'
                    );
                }

                if (response.status === 503) {
                    throw new EmbeddingProviderError(
                        'Model loading, please retry',
                        this.name,
                        'MODEL_LOADING'
                    );
                }

                throw new EmbeddingProviderError(
                    `HTTP ${response.status}: ${errorText}`,
                    this.name,
                    'HTTP_ERROR',
                    { status: response.status, body: errorText }
                );
            }

            const data = await response.json();

            // HuggingFace zwraca różne formaty w zależności od modelu
            if (Array.isArray(data)) {
                // Flat array of numbers
                return data;
            }

            if (Array.isArray(data[0])) {
                // Nested array, take first element
                return data[0];
            }

            throw new EmbeddingProviderError(
                'Unexpected response format',
                this.name,
                'INVALID_RESPONSE_FORMAT',
                { response: data }
            );

        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof EmbeddingProviderError) {
                throw error;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                throw new EmbeddingProviderError(
                    `Request timeout after ${timeout}ms`,
                    this.name,
                    'TIMEOUT'
                );
            }

            throw new EmbeddingProviderError(
                `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                this.name,
                'NETWORK_ERROR',
                { originalError: error instanceof Error ? error.message : String(error) }
            );
        }
    }

    /**
     * Pomocnicza funkcja do sleep
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Factory function dla HuggingFace provider
 */
export function createHuggingFaceProvider(config: HuggingFaceConfig): HuggingFaceEmbeddingProvider {
    return new HuggingFaceEmbeddingProvider(config);
}

/**
 * Sprawdza dostępność modelu HuggingFace
 */
export async function checkHuggingFaceModel(apiKey: string, model: string): Promise<boolean> {
    try {
        const provider = new HuggingFaceEmbeddingProvider({ apiKey, model });
        return await provider.isAvailable();
    } catch {
        return false;
    }
}
