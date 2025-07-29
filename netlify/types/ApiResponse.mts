// Typ uniwersalnej odpowiedzi API
export interface ApiResponse<T = unknown> {
    status: number;
    payload?: T;
    error?: {
        message: string;
        code: string | number;
        details?: string;
    } | null;
    metadata?: Record<string, unknown>;
}

export function apiResponse<T>(payload?: T, status: number = 200, error?: { message: string; code: string | number; details?: string; } | null, metadata?: Record<string, unknown>) {
    return Response.json({ status, payload, error: error ?? null, metadata: metadata ?? {} }, { status });
}

