/**
 * @fileoverview Implementacja bazy danych Neon PostgreSQL z pgvector dla systemu wektorowego
 * Używa @netlify/neon dla łączności z bazą danych Neon
 */

import { neon } from '@netlify/neon';
import type {
    VectorDatabase,
    VectorMetadata,
    VectorChunk,
    VectorSearchResult,
    VectorDatabaseStats,
    SearchOptions
} from './database-interface.mjs';
import {
    VectorDatabaseError,
    DatabaseConnectionError
} from './database-interface.mjs';

/**
 * Implementacja bazy danych Neon PostgreSQL z pgvector
 */
export class NeonVectorDatabase implements VectorDatabase {
    private readonly sql: ReturnType<typeof neon>;
    private initialized = false;

    constructor() {
        const databaseUrl = process.env.NETLIFY_DATABASE_URL;

        if (!databaseUrl) {
            throw new DatabaseConnectionError(
                'NETLIFY_DATABASE_URL environment variable is required'
            );
        }

        try {
            this.sql = neon(databaseUrl);
        } catch (error) {
            throw new DatabaseConnectionError(
                'Failed to initialize Neon database connection',
                error as Error
            );
        }
    }

    /**
     * Inicializuje bazę danych - tworzy tabele i indeksy
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Włącz rozszerzenie pgvector
            await this.sql`CREATE EXTENSION IF NOT EXISTS vector`;

            // Tabela metadanych plików
            await this.sql`
                CREATE TABLE IF NOT EXISTS vector_files (
                    file_key VARCHAR(255) PRIMARY KEY,
                    container VARCHAR(100) NOT NULL,
                    file_name VARCHAR(500) NOT NULL,
                    mime_type VARCHAR(100) NOT NULL,
                    file_size BIGINT NOT NULL,
                    provider VARCHAR(50) NOT NULL,
                    model VARCHAR(200) NOT NULL,
                    dimensions INTEGER NOT NULL,
                    language VARCHAR(10),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            `;

            // Tabela chunków wektorowych
            await this.sql`
                CREATE TABLE IF NOT EXISTS vector_chunks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    file_key VARCHAR(255) NOT NULL REFERENCES vector_files(file_key) ON DELETE CASCADE,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    embedding vector NOT NULL,
                    token_count INTEGER NOT NULL,
                    start_position INTEGER,
                    end_position INTEGER,
                    metadata JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(file_key, chunk_index)
                )
            `;

            // Indeksy dla wydajności
            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_vector_files_container 
                ON vector_files(container)
            `;

            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_vector_files_provider 
                ON vector_files(provider)
            `;

            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_vector_files_created_at 
                ON vector_files(created_at DESC)
            `;

            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_vector_chunks_file_key 
                ON vector_chunks(file_key)
            `;

            // Indeks HNSW dla wyszukiwania wektorowego (pgvector)
            await this.sql`
                CREATE INDEX IF NOT EXISTS idx_vector_chunks_embedding_cosine
                ON vector_chunks USING hnsw (embedding vector_cosine_ops)
                WITH (m = 16, ef_construction = 64)
            `;

            // Trigger dla automatycznego update timestamp
            await this.sql`
                CREATE OR REPLACE FUNCTION update_updated_at_column()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            `;

            await this.sql`
                DROP TRIGGER IF EXISTS update_vector_files_updated_at ON vector_files
            `;

            await this.sql`
                CREATE TRIGGER update_vector_files_updated_at
                    BEFORE UPDATE ON vector_files
                    FOR EACH ROW
                    EXECUTE FUNCTION update_updated_at_column()
            `;

            this.initialized = true;
            console.log('Neon vector database initialized successfully');

        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to initialize database schema',
                'INITIALIZATION_ERROR',
                error as Error
            );
        }
    }

    /**
     * Sprawdza czy baza danych jest dostępna
     */
    async isHealthy(): Promise<boolean> {
        try {
            await this.sql`SELECT 1`;

            // Sprawdź czy rozszerzenie pgvector jest dostępne
            const result = await this.sql`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'vector'
                ) as vector_available
            `;

            return result[0]?.vector_available === true;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }

    /**
     * Zapisuje metadane pliku
     */
    async saveFileMetadata(
        metadata: Omit<VectorMetadata, 'createdAt' | 'updatedAt'>
    ): Promise<VectorMetadata> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                INSERT INTO vector_files (
                    file_key, container, file_name, mime_type, file_size,
                    provider, model, dimensions, language
                ) VALUES (
                    ${metadata.fileKey}, ${metadata.container}, ${metadata.fileName},
                    ${metadata.mimeType}, ${metadata.fileSize}, ${metadata.provider},
                    ${metadata.model}, ${metadata.dimensions}, ${metadata.language}
                )
                ON CONFLICT (file_key) DO UPDATE SET
                    container = EXCLUDED.container,
                    file_name = EXCLUDED.file_name,
                    mime_type = EXCLUDED.mime_type,
                    file_size = EXCLUDED.file_size,
                    provider = EXCLUDED.provider,
                    model = EXCLUDED.model,
                    dimensions = EXCLUDED.dimensions,
                    language = EXCLUDED.language,
                    updated_at = NOW()
                RETURNING *
            `;

            return this.rowToFileMetadata(result[0]);
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to save file metadata',
                'SAVE_METADATA_ERROR',
                error as Error
            );
        }
    }

    /**
     * Aktualizuje metadane pliku
     */
    async updateFileMetadata(
        fileKey: string,
        updates: Partial<VectorMetadata>
    ): Promise<VectorMetadata | null> {
        await this.ensureInitialized();

        try {
            const setClause = Object.keys(updates)
                .filter(key => key !== 'fileKey' && key !== 'createdAt' && key !== 'updatedAt')
                .map(key => {
                    const dbKey = this.camelToSnake(key);
                    return `${dbKey} = $${Object.keys(updates).indexOf(key) + 2}`;
                })
                .join(', ');

            if (!setClause) {
                return this.getFileMetadata(fileKey);
            }

            const result = await this.sql`
                UPDATE vector_files 
                SET ${this.sql(setClause)}, updated_at = NOW()
                WHERE file_key = ${fileKey}
                RETURNING *
            `;

            return result.length > 0 ? this.rowToFileMetadata(result[0]) : null;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to update file metadata',
                'UPDATE_METADATA_ERROR',
                error as Error
            );
        }
    }

    /**
     * Pobiera metadane pliku
     */
    async getFileMetadata(fileKey: string): Promise<VectorMetadata | null> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                SELECT * FROM vector_files WHERE file_key = ${fileKey}
            `;

            return result.length > 0 ? this.rowToFileMetadata(result[0]) : null;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to get file metadata',
                'GET_METADATA_ERROR',
                error as Error
            );
        }
    }

    /**
     * Usuwa plik i wszystkie powiązane chunki
     */
    async deleteFile(fileKey: string): Promise<boolean> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                DELETE FROM vector_files WHERE file_key = ${fileKey}
            `;

            return result.length > 0;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to delete file',
                'DELETE_FILE_ERROR',
                error as Error
            );
        }
    }

    /**
     * Zapisuje chunki wektorowe
     */
    async saveChunks(chunks: Omit<VectorChunk, 'id'>[]): Promise<VectorChunk[]> {
        await this.ensureInitialized();

        if (chunks.length === 0) {
            return [];
        }

        try {
            // Usuń istniejące chunki dla tego pliku
            await this.deleteChunks(chunks[0].fileKey);

            // Wstaw nowe chunki - używamy pojedynczych insertów dla kompatybilności
            const savedChunks: VectorChunk[] = [];

            for (const chunk of chunks) {
                const result = await this.sql`
                    INSERT INTO vector_chunks (
                        file_key, chunk_index, content, embedding, token_count,
                        start_position, end_position, metadata
                    ) VALUES (
                        ${chunk.fileKey},
                        ${chunk.chunkIndex},
                        ${chunk.content},
                        ${JSON.stringify(chunk.embedding)},
                        ${chunk.tokenCount},
                        ${chunk.startPosition || null},
                        ${chunk.endPosition || null},
                        ${chunk.metadata ? JSON.stringify(chunk.metadata) : null}
                    )
                    RETURNING *
                `;

                if (result.length > 0) {
                    savedChunks.push(this.rowToChunk(result[0]));
                }
            }

            return savedChunks;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to save chunks',
                'SAVE_CHUNKS_ERROR',
                error as Error
            );
        }
    }

    /**
     * Usuwa wszystkie chunki dla pliku
     */
    async deleteChunks(fileKey: string): Promise<number> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                DELETE FROM vector_chunks WHERE file_key = ${fileKey}
            `;

            return result.length;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to delete chunks',
                'DELETE_CHUNKS_ERROR',
                error as Error
            );
        }
    }

    /**
     * Wyszukuje podobne wektory używając cosine similarity
     */
    async searchSimilar(
        queryEmbedding: number[],
        options: SearchOptions = {}
    ): Promise<VectorSearchResult[]> {
        await this.ensureInitialized();

        const {
            limit = 20,
            threshold = 0.7,
            containers,
            mimeTypes,
            languages,
            timeRange
        } = options;

        try {
            let whereConditions = [`1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)}) >= ${threshold}`];

            if (containers && containers.length > 0) {
                whereConditions.push(`f.container = ANY(${JSON.stringify(containers)})`);
            }

            if (mimeTypes && mimeTypes.length > 0) {
                whereConditions.push(`f.mime_type = ANY(${JSON.stringify(mimeTypes)})`);
            }

            if (languages && languages.length > 0) {
                whereConditions.push(`f.language = ANY(${JSON.stringify(languages)})`);
            }

            if (timeRange?.from) {
                whereConditions.push(`f.created_at >= ${timeRange.from.toISOString()}`);
            }

            if (timeRange?.to) {
                whereConditions.push(`f.created_at <= ${timeRange.to.toISOString()}`);
            }

            const whereClause = whereConditions.join(' AND ');

            const result = await this.sql`
                SELECT 
                    c.*,
                    f.*,
                    (1 - (c.embedding <=> ${JSON.stringify(queryEmbedding)})) as similarity,
                    ROW_NUMBER() OVER (ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}) as rank
                FROM vector_chunks c
                JOIN vector_files f ON c.file_key = f.file_key
                WHERE ${this.sql(whereClause)}
                ORDER BY c.embedding <=> ${JSON.stringify(queryEmbedding)}
                LIMIT ${limit}
            `;

            return result.map((row: any) => ({
                chunk: this.rowToChunk(row),
                fileMetadata: this.rowToFileMetadata(row),
                similarity: parseFloat(row.similarity),
                rank: parseInt(row.rank)
            }));

        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to search similar vectors',
                'SEARCH_ERROR',
                error as Error
            );
        }
    }

    /**
     * Pobiera chunki dla pliku
     */
    async getFileChunks(fileKey: string): Promise<VectorChunk[]> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                SELECT * FROM vector_chunks 
                WHERE file_key = ${fileKey}
                ORDER BY chunk_index
            `;

            return result.map((row: any) => this.rowToChunk(row));
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to get file chunks',
                'GET_CHUNKS_ERROR',
                error as Error
            );
        }
    }

    /**
     * Sprawdza czy plik jest już zwektoryzowany
     */
    async isFileVectorized(fileKey: string): Promise<boolean> {
        await this.ensureInitialized();

        try {
            const result = await this.sql`
                SELECT EXISTS(
                    SELECT 1 FROM vector_files WHERE file_key = ${fileKey}
                ) as exists
            `;

            return result[0]?.exists === true;
        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to check if file is vectorized',
                'CHECK_VECTORIZED_ERROR',
                error as Error
            );
        }
    }

    /**
     * Pobiera statystyki systemu
     */
    async getStats(): Promise<VectorDatabaseStats> {
        await this.ensureInitialized();

        try {
            // Podstawowe statystyki
            const basicStats = await this.sql`
                SELECT 
                    COUNT(*) as total_files,
                    (SELECT COUNT(*) FROM vector_chunks) as total_chunks
                FROM vector_files
            `;

            // Statystyki providerów
            const providerStats = await this.sql`
                SELECT 
                    provider as name,
                    COUNT(*) as file_count,
                    (SELECT COUNT(*) FROM vector_chunks c WHERE c.file_key IN 
                        (SELECT file_key FROM vector_files f2 WHERE f2.provider = f.provider)
                    ) as chunk_count
                FROM vector_files f
                GROUP BY provider
            `;

            // Statystyki kontenerów
            const containerStats = await this.sql`
                SELECT 
                    container as name,
                    COUNT(*) as file_count,
                    (SELECT COUNT(*) FROM vector_chunks c WHERE c.file_key IN 
                        (SELECT file_key FROM vector_files f2 WHERE f2.container = f.container)
                    ) as chunk_count
                FROM vector_files f
                GROUP BY container
            `;

            // Rozmiar bazy danych
            const sizeResult = await this.sql`
                SELECT 
                    pg_total_relation_size('vector_files') + 
                    pg_total_relation_size('vector_chunks') as size_bytes
            `;

            const sizeBytes = parseInt(sizeResult[0]?.size_bytes || '0');

            return {
                totalFiles: parseInt(basicStats[0]?.total_files || '0'),
                totalChunks: parseInt(basicStats[0]?.total_chunks || '0'),
                providers: providerStats.map((row: any) => ({
                    name: row.name,
                    fileCount: parseInt(row.file_count),
                    chunkCount: parseInt(row.chunk_count)
                })),
                containers: containerStats.map((row: any) => ({
                    name: row.name,
                    fileCount: parseInt(row.file_count),
                    chunkCount: parseInt(row.chunk_count)
                })),
                databaseSize: {
                    bytes: sizeBytes,
                    human: this.formatBytes(sizeBytes)
                },
                lastUpdated: new Date()
            };

        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to get database stats',
                'GET_STATS_ERROR',
                error as Error
            );
        }
    }

    /**
     * Pobiera listę zwektoryzowanych plików
     */
    async getVectorizedFiles(
        container?: string,
        limit = 50,
        offset = 0
    ): Promise<{ files: VectorMetadata[]; total: number }> {
        await this.ensureInitialized();

        try {
            let whereClause = '1=1';
            if (container) {
                whereClause = `container = '${container}'`;
            }

            const filesResult = await this.sql`
                SELECT * FROM vector_files 
                WHERE ${this.sql(whereClause)}
                ORDER BY created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            const countResult = await this.sql`
                SELECT COUNT(*) as total FROM vector_files
                WHERE ${this.sql(whereClause)}
            `;

            return {
                files: filesResult.map((row: any) => this.rowToFileMetadata(row)),
                total: parseInt(countResult[0]?.total || '0')
            };

        } catch (error) {
            throw new VectorDatabaseError(
                'Failed to get vectorized files',
                'GET_FILES_ERROR',
                error as Error
            );
        }
    }

    /**
     * Wykonuje operacje w transakcji
     */
    async transaction<T>(operation: (db: VectorDatabase) => Promise<T>): Promise<T> {
        // Neon nie wspiera transakcji w sposób tradycyjny
        // Wykonujemy operację bezpośrednio
        return operation(this);
    }

    /**
     * Zamyka połączenie z bazą danych
     */
    async close(): Promise<void> {
        // Neon automatycznie zarządza połączeniami
        this.initialized = false;
    }

    // Metody pomocnicze

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    private rowToFileMetadata(row: any): VectorMetadata {
        return {
            fileKey: row.file_key,
            container: row.container,
            fileName: row.file_name,
            mimeType: row.mime_type,
            fileSize: parseInt(row.file_size),
            provider: row.provider,
            model: row.model,
            dimensions: parseInt(row.dimensions),
            language: row.language,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }

    private rowToChunk(row: any): VectorChunk {
        return {
            id: row.id,
            fileKey: row.file_key,
            chunkIndex: parseInt(row.chunk_index),
            content: row.content,
            embedding: Array.isArray(row.embedding) ? row.embedding : JSON.parse(row.embedding),
            tokenCount: parseInt(row.token_count),
            startPosition: row.start_position ? parseInt(row.start_position) : undefined,
            endPosition: row.end_position ? parseInt(row.end_position) : undefined,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
    }

    private camelToSnake(camelStr: string): string {
        return camelStr.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * Factory function tworząca instancję bazy danych Neon
 */
export function createNeonVectorDatabase(): VectorDatabase {
    return new NeonVectorDatabase();
}
