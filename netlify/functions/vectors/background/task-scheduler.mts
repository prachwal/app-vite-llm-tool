/**
 * @fileoverview Task Scheduler
 * System zarządzania i planowania zadań przetwarzania
 */

import type { ProcessingTask, QueueProvider } from './processing-queue.mjs';
import { ProcessingStatus, TaskPriority, generateTaskId, canProcessInNetlifyFunction, splitTaskForNetlify } from './processing-queue.mjs';
import type { TextChunk } from '../utils/text-chunker.mjs';

/**
 * Opcje tworzenia zadania
 */
export interface TaskCreationOptions {
    /** Priorytet zadania */
    priority?: TaskPriority;
    /** Maksymalna liczba chunków na batch */
    batchSize?: number;
    /** Maksymalna liczba ponownych prób */
    maxRetries?: number;
    /** Timeout dla zadania w ms */
    timeout?: number;
    /** Metadane użytkownika */
    metadata?: {
        userId?: string;
        source?: string;
        tags?: string[];
    };
}

/**
 * Wynik schedulowania zadania
 */
export interface SchedulingResult {
    /** Główne ID zadania */
    mainTaskId: string;
    /** IDs wszystkich sub-tasków (jeśli zadanie zostało podzielone) */
    subTaskIds: string[];
    /** Czy zadanie zostało podzielone */
    wasSplit: boolean;
    /** Szacowany czas przetwarzania */
    estimatedTime: number;
    /** Status zadania */
    status: ProcessingStatus;
}

/**
 * Task Scheduler do zarządzania zadaniami
 */
export class TaskScheduler {
    private readonly queueProvider: QueueProvider;

    constructor(queueProvider: QueueProvider) {
        this.queueProvider = queueProvider;
    }

    /**
     * Tworzy i planuje nowe zadanie
     */
    async scheduleTask(
        fileName: string,
        fileType: string,
        fileSize: number,
        chunks: TextChunk[],
        options: TaskCreationOptions = {}
    ): Promise<SchedulingResult> {
        // Utwórz główne zadanie
        const mainTask: ProcessingTask = {
            id: generateTaskId(),
            fileName,
            fileType,
            fileSize,
            chunks,
            status: ProcessingStatus.PENDING,
            priority: options.priority || TaskPriority.NORMAL,
            createdAt: new Date(),
            progress: 0,
            options: {
                batchSize: options.batchSize || 10,
                maxRetries: options.maxRetries || 3,
                timeout: options.timeout || 25000
            },
            metadata: {
                userId: options.metadata?.userId,
                source: options.metadata?.source || 'api',
                tags: options.metadata?.tags || []
            }
        };

        let subTaskIds: string[] = [];
        let wasSplit = false;

        // Sprawdź czy zadanie trzeba podzielić
        if (!canProcessInNetlifyFunction(mainTask)) {
            console.log(`Task ${mainTask.id} is too large, splitting...`);

            const subTasks = splitTaskForNetlify(mainTask);
            wasSplit = true;

            // Dodaj sub-taski do kolejki
            for (const subTask of subTasks) {
                await this.queueProvider.enqueue(subTask);
                subTaskIds.push(subTask.id);
            }

            // Zaktualizuj główne zadanie jako "parent"
            mainTask.status = ProcessingStatus.PENDING;
            mainTask.chunks = []; // Chunki są w sub-taskach
            mainTask.metadata.isParentTask = true;
            mainTask.metadata.subTaskIds = subTaskIds;

        } else {
            // Dodaj pojedyncze zadanie
            await this.queueProvider.enqueue(mainTask);
            subTaskIds = [mainTask.id];
        }

        // Szacuj czas przetwarzania
        const estimatedTime = this.estimateTaskTime(chunks.length, mainTask.options.batchSize);

        return {
            mainTaskId: mainTask.id,
            subTaskIds,
            wasSplit,
            estimatedTime,
            status: ProcessingStatus.PENDING
        };
    }

    /**
     * Anuluje zadanie
     */
    async cancelTask(taskId: string): Promise<boolean> {
        const task = await this.queueProvider.getTask(taskId);
        if (!task) {
            return false;
        }

        // Jeśli to parent task, anuluj wszystkie sub-taski
        if (task.metadata.isParentTask && task.metadata.subTaskIds) {
            for (const subTaskId of task.metadata.subTaskIds) {
                await this.queueProvider.updateTaskStatus(subTaskId, ProcessingStatus.CANCELLED);
            }
        }

        // Anuluj główne zadanie
        await this.queueProvider.updateTaskStatus(taskId, ProcessingStatus.CANCELLED);
        return true;
    }

    /**
     * Pobiera status zadania (łącznie z sub-taskami)
     */
    async getTaskStatus(taskId: string): Promise<{
        mainTask: ProcessingTask | null;
        subTasks: ProcessingTask[];
        overallProgress: number;
        overallStatus: ProcessingStatus;
    }> {
        const mainTask = await this.queueProvider.getTask(taskId);
        if (!mainTask) {
            return {
                mainTask: null,
                subTasks: [],
                overallProgress: 0,
                overallStatus: ProcessingStatus.FAILED
            };
        }

        let subTasks: ProcessingTask[] = [];
        let overallProgress = 0;
        let overallStatus = mainTask.status;

        // Jeśli to parent task, sprawdź sub-taski
        if (mainTask.metadata.isParentTask && mainTask.metadata.subTaskIds) {
            for (const subTaskId of mainTask.metadata.subTaskIds) {
                const subTask = await this.queueProvider.getTask(subTaskId);
                if (subTask) {
                    subTasks.push(subTask);
                }
            }

            // Oblicz ogólny postęp
            if (subTasks.length > 0) {
                overallProgress = subTasks.reduce((sum, task) => sum + task.progress, 0) / subTasks.length;

                // Określ ogólny status
                const statuses = subTasks.map(task => task.status);
                if (statuses.every(status => status === ProcessingStatus.COMPLETED)) {
                    overallStatus = ProcessingStatus.COMPLETED;
                } else if (statuses.some(status => status === ProcessingStatus.FAILED)) {
                    overallStatus = ProcessingStatus.FAILED;
                } else if (statuses.some(status => status === ProcessingStatus.PROCESSING)) {
                    overallStatus = ProcessingStatus.PROCESSING;
                } else if (statuses.every(status => status === ProcessingStatus.CANCELLED)) {
                    overallStatus = ProcessingStatus.CANCELLED;
                } else {
                    overallStatus = ProcessingStatus.PENDING;
                }
            }
        } else {
            // Single task
            subTasks = [mainTask];
            overallProgress = mainTask.progress;
            overallStatus = mainTask.status;
        }

        return {
            mainTask,
            subTasks,
            overallProgress,
            overallStatus
        };
    }

    /**
     * Pobiera wszystkie zadania użytkownika
     */
    async getUserTasks(userId: string): Promise<ProcessingTask[]> {
        const allTasks = await this.queueProvider.getAllTasks();
        return allTasks.filter(task => task.metadata.userId === userId);
    }

    /**
     * Pobiera statystyki kolejki
     */
    async getQueueStats(): Promise<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        cancelled: number;
        total: number;
    }> {
        const allTasks = await this.queueProvider.getAllTasks();

        const stats = {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            total: allTasks.length
        };

        for (const task of allTasks) {
            switch (task.status) {
                case ProcessingStatus.PENDING:
                    stats.pending++;
                    break;
                case ProcessingStatus.PROCESSING:
                    stats.processing++;
                    break;
                case ProcessingStatus.COMPLETED:
                    stats.completed++;
                    break;
                case ProcessingStatus.FAILED:
                    stats.failed++;
                    break;
                case ProcessingStatus.CANCELLED:
                    stats.cancelled++;
                    break;
            }
        }

        return stats;
    }

    /**
     * Zmienia priorytet zadania
     */
    async setTaskPriority(taskId: string, priority: TaskPriority): Promise<boolean> {
        const task = await this.queueProvider.getTask(taskId);
        if (!task || task.status !== ProcessingStatus.PENDING) {
            return false;
        }

        // Jeśli to parent task, zmień priorytet sub-tasków
        if (task.metadata.isParentTask && task.metadata.subTaskIds) {
            for (const subTaskId of task.metadata.subTaskIds) {
                const subTask = await this.queueProvider.getTask(subTaskId);
                if (subTask && subTask.status === ProcessingStatus.PENDING) {
                    subTask.priority = priority;
                    // Re-enqueue z nowym priorytetem
                    await this.queueProvider.removeTask(subTaskId);
                    await this.queueProvider.enqueue(subTask);
                }
            }
        }

        // Zmień priorytet głównego zadania
        task.priority = priority;
        await this.queueProvider.removeTask(taskId);
        await this.queueProvider.enqueue(task);

        return true;
    }

    /**
     * Czyści ukończone zadania starsze niż określony czas
     */
    async cleanupOldTasks(maxAgeHours = 24): Promise<number> {
        const allTasks = await this.queueProvider.getAllTasks();
        const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

        let removedCount = 0;

        for (const task of allTasks) {
            if (
                (task.status === ProcessingStatus.COMPLETED ||
                    task.status === ProcessingStatus.FAILED ||
                    task.status === ProcessingStatus.CANCELLED) &&
                task.completedAt &&
                task.completedAt < cutoffTime
            ) {
                await this.queueProvider.removeTask(task.id);
                removedCount++;
            }
        }

        return removedCount;
    }

    /**
     * Estymuje czas przetwarzania
     */
    private estimateTaskTime(chunkCount: number, batchSize: number): number {
        const baseTimePerChunk = 200; // ms
        const batchOverhead = Math.ceil(chunkCount / batchSize) * 100;
        return (chunkCount * baseTimePerChunk) + batchOverhead;
    }

    /**
     * Retry failed task
     */
    async retryTask(taskId: string): Promise<boolean> {
        const task = await this.queueProvider.getTask(taskId);
        if (!task || task.status !== ProcessingStatus.FAILED) {
            return false;
        }

        // Reset task status
        task.status = ProcessingStatus.PENDING;
        task.progress = 0;
        task.error = undefined;
        task.startedAt = undefined;
        task.completedAt = undefined;

        // Re-enqueue
        await this.queueProvider.removeTask(taskId);
        await this.queueProvider.enqueue(task);

        return true;
    }
}

/**
 * Factory function dla TaskScheduler
 */
export function createTaskScheduler(queueProvider: QueueProvider): TaskScheduler {
    return new TaskScheduler(queueProvider);
}
