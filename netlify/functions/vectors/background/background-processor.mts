/**
 * @fileoverview Background Processor
 * Główny processor do obsługi zadań w tle
 */

import type { EmbeddingProvider } from '../embeddings/embedding-interface.mjs';
import type { ProcessingTask, ProcessingResult, QueueProvider } from './processing-queue.mjs';
import { ProcessingStatus, TaskPriority } from './processing-queue.mjs';
import { ChunkedEmbeddingProcessor } from '../utils/chunked-embedding-processor.mjs';

/**
 * Konfiguracja background processor
 */
export interface BackgroundProcessorConfig {
    /** Maksymalna liczba zadań przetwarzanych jednocześnie */
    maxConcurrentTasks: number;
    /** Interwał sprawdzania kolejki (ms) */
    queueCheckInterval: number;
    /** Maksymalny czas przetwarzania zadania (ms) */
    maxTaskTimeout: number;
    /** Czy automatycznie uruchamiać processor */
    autoStart: boolean;
    /** Callback dla postępu */
    onProgress?: (taskId: string, progress: number) => void;
    /** Callback dla ukończenia */
    onTaskComplete?: (result: ProcessingResult) => void;
    /** Callback dla błędów */
    onTaskError?: (taskId: string, error: Error) => void;
}

/**
 * Statystyki processora
 */
export interface ProcessorStats {
    /** Liczba aktywnych zadań */
    activeTasks: number;
    /** Liczba zadań w kolejce */
    queuedTasks: number;
    /** Liczba ukończonych zadań */
    completedTasks: number;
    /** Liczba nieudanych zadań */
    failedTasks: number;
    /** Całkowity czas przetwarzania */
    totalProcessingTime: number;
    /** Średni czas na zadanie */
    avgTaskTime: number;
    /** Czy processor jest aktywny */
    isRunning: boolean;
}

/**
 * Background Processor dla obsługi kolejki zadań
 */
export class BackgroundProcessor {
    private readonly embeddingProvider: EmbeddingProvider;
    private readonly queueProvider: QueueProvider;
    private readonly config: BackgroundProcessorConfig;
    private readonly activeTasks = new Map<string, AbortController>();
    private isRunning = false;
    private processingInterval?: NodeJS.Timeout;
    private stats: ProcessorStats;

    constructor(
        embeddingProvider: EmbeddingProvider,
        queueProvider: QueueProvider,
        config: Partial<BackgroundProcessorConfig> = {}
    ) {
        this.embeddingProvider = embeddingProvider;
        this.queueProvider = queueProvider;
        this.config = {
            maxConcurrentTasks: 3,
            queueCheckInterval: 5000,
            maxTaskTimeout: 300000, // 5 minut
            autoStart: false,
            ...config
        };

        this.stats = {
            activeTasks: 0,
            queuedTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            totalProcessingTime: 0,
            avgTaskTime: 0,
            isRunning: false
        };

        if (this.config.autoStart) {
            this.start();
        }
    }

    /**
     * Uruchamia background processor
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            console.warn('Background processor is already running');
            return;
        }

        console.log('Starting background processor...');
        this.isRunning = true;
        this.stats.isRunning = true;

        this.processingInterval = setInterval(() => {
            this.processQueue().catch(error => {
                console.error('Error in processing queue:', error);
            });
        }, this.config.queueCheckInterval);

        // Rozpocznij przetwarzanie od razu
        await this.processQueue();
    }

    /**
     * Zatrzymuje background processor
     */
    async stop(): Promise<void> {
        console.log('Stopping background processor...');
        this.isRunning = false;
        this.stats.isRunning = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }

        // Anuluj wszystkie aktywne zadania
        for (const [taskId, controller] of Array.from(this.activeTasks.entries())) {
            console.log(`Cancelling task ${taskId}`);
            controller.abort();
            await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.CANCELLED);
        }

        this.activeTasks.clear();
        this.stats.activeTasks = 0;
    }

    /**
     * Przetwarza kolejkę zadań
     */
    private async processQueue(): Promise<void> {
        if (!this.isRunning) return;

        // Aktualizuj statystyki kolejki
        const queuedTasks = await this.queueProvider.getTasksByStatus(ProcessingStatus.PENDING);
        this.stats.queuedTasks = queuedTasks.length;

        // Sprawdź czy możemy rozpocząć nowe zadania
        const availableSlots = this.config.maxConcurrentTasks - this.activeTasks.size;
        if (availableSlots <= 0) {
            return;
        }

        // Pobierz zadania do przetworzenia
        for (let i = 0; i < availableSlots; i++) {
            const task = await this.queueProvider.dequeue();
            if (!task) break;

            // Rozpocznij przetwarzanie zadania
            this.processTask(task).catch(error => {
                console.error(`Error processing task ${task.id}:`, error);
            });
        }
    }

    /**
     * Przetwarza pojedyncze zadanie
     */
    private async processTask(task: ProcessingTask): Promise<void> {
        const taskId = task.id;
        const controller = new AbortController();
        this.activeTasks.set(taskId, controller);
        this.stats.activeTasks = this.activeTasks.size;

        const startTime = Date.now();

        try {
            console.log(`Starting task ${taskId} (${task.chunks.length} chunks)`);

            // Oznacz jako przetwarzane
            await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.PROCESSING, 0);

            // Timeout dla zadania
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Task timeout')), this.config.maxTaskTimeout);
            });

            // Przetwarzaj embeddingi
            const processingPromise = this.processTaskEmbeddings(task, controller.signal);

            const result = await Promise.race([processingPromise, timeoutPromise]) as ProcessingResult;

            // Zakończ pomyślnie
            await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.COMPLETED, 100);

            const processingTime = Date.now() - startTime;
            this.updateStats(true, processingTime);

            console.log(`Task ${taskId} completed in ${processingTime}ms`);

            if (this.config.onTaskComplete) {
                this.config.onTaskComplete(result);
            }

        } catch (error) {
            // Obsłuż błąd
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Task ${taskId} failed:`, errorMessage);

            await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.FAILED);

            const processingTime = Date.now() - startTime;
            this.updateStats(false, processingTime);

            if (this.config.onTaskError) {
                this.config.onTaskError(taskId, error instanceof Error ? error : new Error(errorMessage));
            }

        } finally {
            // Usuń z aktywnych zadań
            this.activeTasks.delete(taskId);
            this.stats.activeTasks = this.activeTasks.size;
        }
    }

    /**
     * Przetwarza embeddingi dla zadania
     */
    private async processTaskEmbeddings(task: ProcessingTask, signal: AbortSignal): Promise<ProcessingResult> {
        const processor = new ChunkedEmbeddingProcessor(this.embeddingProvider, {
            batchSize: task.options.batchSize,
            maxRetries: task.options.maxRetries,
            maxProcessingTime: task.options.timeout,
            onProgress: (processed, total) => {
                const progress = Math.round((processed / total) * 100);
                this.queueProvider.updateTaskStatus(task.id, ProcessingStatus.PROCESSING, progress);

                if (this.config.onProgress) {
                    this.config.onProgress(task.id, progress);
                }
            }
        });

        // Sprawdź anulowanie
        if (signal.aborted) {
            throw new Error('Task was cancelled');
        }

        const result = await processor.processChunks(task.chunks);

        return {
            taskId: task.id,
            status: result.isComplete ? ProcessingStatus.COMPLETED : ProcessingStatus.FAILED,
            embeddings: result.embeddings,
            stats: result.stats,
            errors: result.errors
        };
    }

    /**
     * Aktualizuje statystyki processora
     */
    private updateStats(success: boolean, processingTime: number): void {
        if (success) {
            this.stats.completedTasks++;
        } else {
            this.stats.failedTasks++;
        }

        this.stats.totalProcessingTime += processingTime;

        const totalTasks = this.stats.completedTasks + this.stats.failedTasks;
        this.stats.avgTaskTime = totalTasks > 0 ? this.stats.totalProcessingTime / totalTasks : 0;
    }

    /**
     * Pobiera statystyki processora
     */
    getStats(): ProcessorStats {
        return { ...this.stats };
    }

    /**
     * Sprawdza czy processor jest aktywny
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Pobiera liczbę aktywnych zadań
     */
    getActiveTaskCount(): number {
        return this.activeTasks.size;
    }

    /**
     * Anuluje konkretne zadanie
     */
    async cancelTask(taskId: string): Promise<boolean> {
        const controller = this.activeTasks.get(taskId);
        if (controller) {
            controller.abort();
            await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.CANCELLED);
            return true;
        }
        return false;
    }

    /**
     * Ustala priorytet zadania
     */
    async setTaskPriority(taskId: string, priority: TaskPriority): Promise<boolean> {
        const task = await this.queueProvider.getTask(taskId);
        if (task && task.status === ProcessingStatus.PENDING) {
            task.priority = priority;
            // Re-enqueue z nowym priorytetem
            await this.queueProvider.removeTask(taskId);
            await this.queueProvider.enqueue(task);
            return true;
        }
        return false;
    }
}

/**
 * Factory function dla BackgroundProcessor
 */
export function createBackgroundProcessor(
    embeddingProvider: EmbeddingProvider,
    queueProvider: QueueProvider,
    config?: Partial<BackgroundProcessorConfig>
): BackgroundProcessor {
    return new BackgroundProcessor(embeddingProvider, queueProvider, config);
}
