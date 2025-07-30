/**
 * @fileoverview Provider Factory - Factory pattern dla zarządzania różnymi providerami embeddingów
 * Obsługuje wybór providera, fallback i cache
 */

import type { EmbeddingProvider } from './embedding-interface.mjs';
import { HuggingFaceEmbeddingProvider } from './huggingface-provider.mjs';

export type SupportedProvider = 'huggingface' | 'openai' | 'cohere';

export interface ProviderFactoryConfig {
    defaultProvider: SupportedProvider;
    fallbackProviders?: SupportedProvider[];
    enableCache?: boolean;
    cacheSize?: number;
    providerConfigs?: {
        huggingface?: {
            apiKey?: string;
            model?: string;
        };
        openai?: {
            apiKey?: string;
            model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
        };
        cohere?: {
            apiKey?: string;
            model?: 'embed-multilingual-v3.0' | 'embed-english-v3.0' | 'embed-multilingual-light-v3.0';
        };
    };
}

interface CacheEntry {
    embedding: number[];
    timestamp: number;
    provider: string;
    model: string;
}

/**
 * Factory dla tworzenia i zarządzania providerami embeddingów
 */
export class EmbeddingProviderFactory {
    private readonly config: ProviderFactoryConfig;
    private readonly providers: Map<SupportedProvider, EmbeddingProvider> = new Map();
    private readonly cache: Map<string, CacheEntry> = new Map();
    private readonly cacheTimeoutMs = 24 * 60 * 60 * 1000; // 24 godziny

    constructor(config: ProviderFactoryConfig) {
        this.config = {
            enableCache: true,
            cacheSize: 1000,
            fallbackProviders: ['huggingface'],
            ...config
        };

        this.initializeProviders();
    }

    /**
     * Inicjalizuje dostępnych providerów na podstawie konfiguracji
     */
    private initializeProviders(): void {
        // HuggingFace
        const hfApiKey = this.config.providerConfigs?.huggingface?.apiKey || process.env.HF_API_KEY;
        if (hfApiKey) {
            try {
                this.providers.set('huggingface', new HuggingFaceEmbeddingProvider({
                    apiKey: hfApiKey,
                    model: this.config.providerConfigs?.huggingface?.model || 'sentence-transformers/all-MiniLM-L6-v2'
                }));
            } catch (error) {
                console.warn('Failed to initialize HuggingFace provider:', error);
            }
        }

        console.log(`Initialized ${this.providers.size} embedding providers:`, Array.from(this.providers.keys()));
    }

    /**
     * Pobiera provider dla danego typu
     */
    getProvider(providerType?: SupportedProvider): EmbeddingProvider {
        const targetProvider = providerType || this.config.defaultProvider;

        const provider = this.providers.get(targetProvider);
        if (!provider) {
            throw new Error(`Provider ${targetProvider} not available. Check API key configuration.`);
        }

        return provider;
    }

    /**
     * Generuje embedding z obsługą fallback
     */
    async generateEmbedding(text: string, providerType?: SupportedProvider): Promise<number[]> {
        // Sprawdź cache
        if (this.config.enableCache) {
            const cached = this.getCachedEmbedding(text, providerType);
            if (cached) {
                return cached.embedding;
            }
        }

        const providersToTry = this.getProvidersToTry(providerType);
        let lastError: Error | null = null;

        for (const provider of providersToTry) {
            try {
                const embeddingProvider = this.getProvider(provider);
                const result = await embeddingProvider.generateEmbedding(text);

                // Cache wynik
                if (this.config.enableCache) {
                    this.cacheEmbedding(text, result, provider);
                }

                return result;

            } catch (error) {
                console.warn(`Provider ${provider} failed:`, error);
                lastError = error instanceof Error ? error : new Error(String(error));
                continue;
            }
        }

        throw new Error(`All embedding providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Generuje batch embeddingów
     */
    async generateBatchEmbeddings(texts: string[], providerType?: SupportedProvider): Promise<number[][]> {
        const providersToTry = this.getProvidersToTry(providerType);
        let lastError: Error | null = null;

        for (const provider of providersToTry) {
            try {
                const embeddingProvider = this.getProvider(provider);
                const results = await embeddingProvider.getBatchEmbeddings(texts);

                // Cache wyniki
                if (this.config.enableCache) {
                    results.forEach((result: number[], index: number) => {
                        this.cacheEmbedding(texts[index], result, provider);
                    });
                }

                return results;

            } catch (error) {
                console.warn(`Provider ${provider} batch processing failed:`, error);
                lastError = error instanceof Error ? error : new Error(String(error));
                continue;
            }
        }

        throw new Error(`All embedding providers failed for batch processing. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    /**
     * Zwraca listę dostępnych providerów
     */
    getAvailableProviders(): SupportedProvider[] {
        return Array.from(this.providers.keys());
    }

    /**
     * Sprawdza czy provider jest dostępny
     */
    isProviderAvailable(providerType: SupportedProvider): boolean {
        return this.providers.has(providerType);
    }

    /**
     * Czyszczenie cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Statystyki cache
     */
    getCacheStats() {
        const now = Date.now();
        const validEntries = Array.from(this.cache.values()).filter(
            entry => (now - entry.timestamp) < this.cacheTimeoutMs
        );

        return {
            totalEntries: this.cache.size,
            validEntries: validEntries.length,
            hitRate: this.cache.size > 0 ? (validEntries.length / this.cache.size) : 0,
            oldestEntry: validEntries.length > 0 ? Math.min(...validEntries.map(e => e.timestamp)) : null,
            newestEntry: validEntries.length > 0 ? Math.max(...validEntries.map(e => e.timestamp)) : null
        };
    }

    /**
     * Statystyki providerów
     */
    getProviderStats() {
        return Array.from(this.providers.entries()).map(([name, provider]) => ({
            name,
            model: provider.model,
            dimensions: provider.dimensions,
            maxInputLength: provider.maxInputLength
        }));
    }

    /**
     * Pobiera listę providerów do wypróbowania (z fallback)
     */
    private getProvidersToTry(preferredProvider?: SupportedProvider): SupportedProvider[] {
        const providersToTry: SupportedProvider[] = [];

        // Najpierw preferowany provider
        if (preferredProvider && this.isProviderAvailable(preferredProvider)) {
            providersToTry.push(preferredProvider);
        }

        // Potem domyślny provider
        if (this.isProviderAvailable(this.config.defaultProvider) &&
            !providersToTry.includes(this.config.defaultProvider)) {
            providersToTry.push(this.config.defaultProvider);
        }

        // Na końcu fallback providers
        this.config.fallbackProviders?.forEach(provider => {
            if (this.isProviderAvailable(provider) && !providersToTry.includes(provider)) {
                providersToTry.push(provider);
            }
        });

        return providersToTry;
    }

    /**
     * Generuje klucz cache dla tekstu
     */
    private getCacheKey(text: string, providerType?: SupportedProvider): string {
        const provider = providerType || this.config.defaultProvider;
        const providerModel = this.providers.get(provider)?.model || 'unknown';

        // Hash tekstu + provider + model
        return `${this.simpleHash(text)}_${provider}_${providerModel}`;
    }    /**
     * Pobiera embedding z cache
     */
    private getCachedEmbedding(text: string, providerType?: SupportedProvider): CacheEntry | null {
        if (!this.config.enableCache) return null;

        const key = this.getCacheKey(text, providerType);
        const cached = this.cache.get(key);

        if (!cached) return null;

        // Sprawdź czy cache nie wygasł
        const now = Date.now();
        if ((now - cached.timestamp) > this.cacheTimeoutMs) {
            this.cache.delete(key);
            return null;
        }

        return cached;
    }

    /**
     * Zapisuje embedding do cache
     */
    private cacheEmbedding(text: string, result: number[], providerType: SupportedProvider): void {
        if (!this.config.enableCache) return;

        // Sprawdź limit rozmiaru cache
        if (this.cache.size >= (this.config.cacheSize || 1000)) {
            // Usuń najstarsze wpisy
            this.cleanupCache();
        }

        const key = this.getCacheKey(text, providerType);
        const provider = this.providers.get(providerType);

        this.cache.set(key, {
            embedding: result,
            timestamp: Date.now(),
            provider: providerType,
            model: provider?.model || 'unknown'
        });
    }    /**
     * Czyści przestarzałe wpisy cache
     */
    private cleanupCache(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of Array.from(this.cache.entries())) {
            if ((now - entry.timestamp) > this.cacheTimeoutMs) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        // Jeśli wciąż za dużo, usuń połowę najstarszych
        if (this.cache.size >= (this.config.cacheSize || 1000)) {
            const entries = Array.from(this.cache.entries())
                .sort(([, a], [, b]) => a.timestamp - b.timestamp);

            const toDelete = entries.slice(0, Math.floor(entries.length / 2));
            toDelete.forEach(([key]) => this.cache.delete(key));
        }
    }

    /**
     * Prosty hash dla klucza cache
     */
    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }
}
