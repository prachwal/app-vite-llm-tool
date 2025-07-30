/**
 * @fileoverview Factory dla tworzenia instancji bazy danych wektorowej
 * Automatycznie wybiera odpowiednią implementację na podstawie konfiguracji
 */

import type { VectorDatabase } from './database-interface.mjs';
import { createNeonVectorDatabase } from './neon-database.mjs';
import { VectorDatabaseError } from './database-interface.mjs';

/**
 * Typ dostawcy bazy danych
 */
export type DatabaseProvider = 'neon' | 'postgresql';

/**
 * Interfejs konfiguracji bazy danych
 */
export interface DatabaseConfig {
    /** Dostawca bazy danych */
    provider: DatabaseProvider;
    /** URL połączenia z bazą danych */
    connectionUrl: string;
    /** URL połączenia bez poolingu (opcjonalne) */
    unpooledConnectionUrl?: string;
    /** Maksymalna liczba połączeń */
    maxConnections?: number;
    /** Timeout połączenia w ms */
    connectionTimeout?: number;
    /** Czy włączyć pooling połączeń */
    enablePooling?: boolean;
}

/**
 * Pobiera konfigurację bazy danych ze zmiennych środowiskowych
 */
export function getDatabaseConfig(): DatabaseConfig {
    const connectionUrl = process.env.NETLIFY_DATABASE_URL;

    if (!connectionUrl) {
        throw new VectorDatabaseError(
            'Database connection URL not found in environment variables',
            'MISSING_DATABASE_URL'
        );
    }

    return {
        provider: 'neon', // Obecnie wspieramy tylko Neon
        connectionUrl,
        unpooledConnectionUrl: process.env.NETLIFY_DATABASE_URL_UNPOOLED,
        maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
        connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
        enablePooling: process.env.DATABASE_ENABLE_POOLING !== 'false'
    };
}

/**
 * Tworzy instancję bazy danych na podstawie konfiguracji
 */
export function createVectorDatabase(config?: DatabaseConfig): VectorDatabase {
    const dbConfig = config || getDatabaseConfig();

    switch (dbConfig.provider) {
        case 'neon':
            return createNeonVectorDatabase();

        case 'postgresql':
            // TODO: Implementacja dla standardowego PostgreSQL
            throw new VectorDatabaseError(
                'PostgreSQL provider not yet implemented',
                'PROVIDER_NOT_IMPLEMENTED'
            );

        default:
            throw new VectorDatabaseError(
                `Unsupported database provider: ${dbConfig.provider}`,
                'UNSUPPORTED_PROVIDER'
            );
    }
}

/**
 * Tworzy singleton instancji bazy danych
 */
class DatabaseSingleton {
    private static instance: VectorDatabase | null = null;
    private static config: DatabaseConfig | null = null;

    /**
     * Pobiera singleton instancji bazy danych
     */
    static getInstance(config?: DatabaseConfig): VectorDatabase {
        if (!this.instance || (config && this.hasConfigChanged(config))) {
            this.instance = createVectorDatabase(config);
            this.config = config || getDatabaseConfig();
        }

        return this.instance;
    }

    /**
     * Resetuje singleton (przydatne w testach)
     */
    static reset(): void {
        if (this.instance) {
            this.instance.close().catch(console.error);
        }
        this.instance = null;
        this.config = null;
    }

    /**
     * Sprawdza czy konfiguracja się zmieniła
     */
    private static hasConfigChanged(newConfig: DatabaseConfig): boolean {
        if (!this.config) return true;

        return (
            this.config.provider !== newConfig.provider ||
            this.config.connectionUrl !== newConfig.connectionUrl ||
            this.config.unpooledConnectionUrl !== newConfig.unpooledConnectionUrl
        );
    }
}

/**
 * Pobiera singleton instancji bazy danych
 * Preferowana metoda do użycia w aplikacji
 */
export function getVectorDatabase(config?: DatabaseConfig): VectorDatabase {
    return DatabaseSingleton.getInstance(config);
}

/**
 * Resetuje singleton bazy danych
 * Przydatne w testach i podczas hot reloadu
 */
export function resetVectorDatabase(): void {
    DatabaseSingleton.reset();
}

/**
 * Sprawdza czy system bazy danych jest skonfigurowany i dostępny
 */
export async function isDatabaseAvailable(): Promise<boolean> {
    try {
        const config = getDatabaseConfig();
        const db = createVectorDatabase(config);
        const isHealthy = await db.isHealthy();
        await db.close();
        return isHealthy;
    } catch (error) {
        console.error('Database availability check failed:', error);
        return false;
    }
}

/**
 * Inicializuje bazę danych (tworzy tabele, indeksy)
 * Bezpieczne do wywołania wielokrotnego
 */
export async function initializeDatabase(config?: DatabaseConfig): Promise<void> {
    const db = getVectorDatabase(config);
    await db.initialize();
}

/**
 * Wykonuje migracje bazy danych
 * TODO: Implementacja systemu migracji
 */
export async function migrateDatabase(config?: DatabaseConfig): Promise<void> {
    // TODO: Implementacja migracji
    console.log('Database migrations not yet implemented');
    await initializeDatabase(config);
}
