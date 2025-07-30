/**
 * @fileoverview Background Processing Queue System
 * System kolejki do przetwarzania dużych plików w tle
 */

import type { TextChunk } from '../utils/text-chunker.mjs';

/**
 * Status zadania w kolejce
 */
export enum ProcessingStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled'
}

/**
 * Priorytet zadania
 */
export enum TaskPriority {
    LOW = 1,
    NORMAL = 2,
    HIGH = 3,
    URGENT = 4
}

/**
 * Definicja zadania w kolejce
 */
export interface ProcessingTask {
    /** Unikalny identyfikator zadania */
    id: string;
    /** Nazwa pliku */
    fileName: string;
    /** Typ pliku */
    fileType: string;
    /** Rozmiar pliku w bajtach */
    fileSize: number;
    /** Chunki do przetworzenia */
    chunks: TextChunk[];
    /** Status zadania */
    status: ProcessingStatus;
    /** Priorytet */
    priority: TaskPriority;
    /** Czas utworzenia */
    createdAt: Date;
    /** Czas rozpoczęcia przetwarzania */
    startedAt?: Date;
    /** Czas zakończenia */
    completedAt?: Date;
    /** Postęp (0-100) */
    progress: number;
    /** Błąd (jeśli wystąpił) */
    error?: string;
    /** Opcje przetwarzania */
    options: {
        batchSize: number;
        maxRetries: number;
        timeout: number;
    };
    /** Metadane */
    metadata: {
        userId?: string;
        source?: string;
        tags?: string[];
        /** Czy to zadanie nadrzędne */
        isParentTask?: boolean;
        /** IDs zadań podrzędnych */
        subTaskIds?: string[];
        /** ID zadania nadrzędnego */
        parentTaskId?: string;
        /** Numer części */
        partNumber?: number;
        /** Całkowita liczba części */
        totalParts?: number;
    };
}

/**
 * Wynik przetwarzania zadania
 */
export interface ProcessingResult {
    /** ID zadania */
    taskId: string;
    /** Status */
    status: ProcessingStatus;
    /** Wygenerowane embeddingi */
    embeddings: Array<{
        chunkIndex: number;
        embedding: number[];
        tokenCount: number;
    }>;
    /** Statystyki */
    stats: {
        totalChunks: number;
        processedChunks: number;
        failedChunks: number;
        processingTime: number;
    };
    /** Błędy */
    errors: Array<{
        chunkIndex: number;
        error: string;
    }>;
}

/**
 * Interfejs providera kolejki
 */
export interface QueueProvider {
    /** Dodaj zadanie do kolejki */
    enqueue(task: ProcessingTask): Promise<void>;
    /** Pobierz następne zadanie */
    dequeue(): Promise<ProcessingTask | null>;
    /** Aktualizuj status zadania */
    updateTaskStatus(taskId: string, status: ProcessingStatus, progress?: number): Promise<void>;
    /** Pobierz zadanie po ID */
    getTask(taskId: string): Promise<ProcessingTask | null>;
    /** Pobierz wszystkie zadania */
    getAllTasks(): Promise<ProcessingTask[]>;
    /** Usuń zadanie */
    removeTask(taskId: string): Promise<void>;
    /** Pobierz zadania według statusu */
    getTasksByStatus(status: ProcessingStatus): Promise<ProcessingTask[]>;
}

/**
 * In-memory implementation kolejki (dla testów i development)
 */
export class MemoryQueueProvider implements QueueProvider {
    private readonly tasks = new Map<string, ProcessingTask>();
    private readonly queue: string[] = [];

    async enqueue(task: ProcessingTask): Promise<void> {
        this.tasks.set(task.id, task);

        // Wstaw w odpowiednim miejscu według priorytetu
        let insertIndex = this.queue.length;
        for (let i = 0; i < this.queue.length; i++) {
            const existingTask = this.tasks.get(this.queue[i]);
            if (existingTask && existingTask.priority < task.priority) {
                insertIndex = i;
                break;
            }
        }

        this.queue.splice(insertIndex, 0, task.id);
    }

    async dequeue(): Promise<ProcessingTask | null> {
        while (this.queue.length > 0) {
            const taskId = this.queue.shift();
            if (taskId) {
                const task = this.tasks.get(taskId);
                if (task && task.status === ProcessingStatus.PENDING) {
                    return task;
                }
            }
        }
        return null;
    }

    async updateTaskStatus(taskId: string, status: ProcessingStatus, progress?: number): Promise<void> {
        const task = this.tasks.get(taskId);
        if (task) {
            task.status = status;
            if (progress !== undefined) {
                task.progress = progress;
            }
            if (status === ProcessingStatus.PROCESSING && !task.startedAt) {
                task.startedAt = new Date();
            }
            if (status === ProcessingStatus.COMPLETED || status === ProcessingStatus.FAILED) {
                task.completedAt = new Date();
                task.progress = 100;
            }
        }
    }

    async getTask(taskId: string): Promise<ProcessingTask | null> {
        return this.tasks.get(taskId) || null;
    }

    async getAllTasks(): Promise<ProcessingTask[]> {
        return Array.from(this.tasks.values());
    }

    async removeTask(taskId: string): Promise<void> {
        this.tasks.delete(taskId);
        const index = this.queue.indexOf(taskId);
        if (index !== -1) {
            this.queue.splice(index, 1);
        }
    }

    async getTasksByStatus(status: ProcessingStatus): Promise<ProcessingTask[]> {
        return Array.from(this.tasks.values()).filter(task => task.status === status);
    }

    // Utility methods
    getQueueSize(): number {
        return this.queue.length;
    }

    getTaskCount(): number {
        return this.tasks.size;
    }

    clear(): void {
        this.tasks.clear();
        this.queue.length = 0;
    }
}

/**
 * Generator unikalnych ID dla zadań
 */
export function generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Estymuje czas przetwarzania zadania
 */
export function estimateTaskProcessingTime(task: ProcessingTask): number {
    // Szacujemy ~200ms na chunk + overhead
    const baseTimePerChunk = 200;
    const chunkCount = task.chunks.length;
    const batchOverhead = Math.ceil(chunkCount / task.options.batchSize) * 100;

    return (chunkCount * baseTimePerChunk) + batchOverhead;
}

/**
 * Sprawdza czy zadanie może być przetworzone w funkcji Netlify (25s limit)
 */
export function canProcessInNetlifyFunction(task: ProcessingTask): boolean {
    const estimatedTime = estimateTaskProcessingTime(task);
    return estimatedTime <= 23000; // 23 sekund margines bezpieczeństwa
}

/**
 * Dzieli zadanie na mniejsze części
 */
export function splitTaskForNetlify(task: ProcessingTask): ProcessingTask[] {
    if (canProcessInNetlifyFunction(task)) {
        return [task];
    }

    const maxChunksPerTask = Math.floor(23000 / 250); // ~250ms na chunk z marginesem
    const subTasks: ProcessingTask[] = [];

    for (let i = 0; i < task.chunks.length; i += maxChunksPerTask) {
        const subTaskChunks = task.chunks.slice(i, i + maxChunksPerTask);

        const subTask: ProcessingTask = {
            ...task,
            id: `${task.id}_part_${Math.floor(i / maxChunksPerTask) + 1}`,
            chunks: subTaskChunks,
            metadata: {
                ...task.metadata,
                parentTaskId: task.id,
                partNumber: Math.floor(i / maxChunksPerTask) + 1,
                totalParts: Math.ceil(task.chunks.length / maxChunksPerTask)
            }
        };

        subTasks.push(subTask);
    }

    return subTasks;
}
