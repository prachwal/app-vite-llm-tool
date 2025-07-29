/**
 * Universal Netlify Function Handler
 * Handles routing table, action validation, error handling, and response formatting
 * Usage: universalHandler({ req, context, router, action, validate, zodSchema, params })
 */
import type { Context } from '@netlify/functions'
import { apiResponse } from '../_types/ApiResponse.mts'
import { z } from 'zod'

interface UniversalHandlerOptions {
    req: Request
    context: Context
    router: Record<string, () => Promise<Response> | Response>
    action: string
    validate?: () => Response | null
    zodSchema?: z.ZodSchema
    params?: Record<string, any>
}

/**
 * Universal handler for Netlify Functions
 * @param options - Options containing request, context, router, action, validation function, Zod schema, and parameters
 * @returns Response object
 */
// @ts-ignore - req and context parameters are part of interface but not used in current implementation
export async function universalHandler({ req, context, router, action, validate, zodSchema, params }: UniversalHandlerOptions): Promise<Response> {
    try {
        // Zod schema validation if provided
        if (zodSchema && params) {
            const result = zodSchema.safeParse(params)
            if (!result.success) {
                return apiResponse(null, 400, {
                    message: 'Invalid parameters',
                    code: 'INVALID_PARAMS',
                    details: JSON.stringify(result.error.issues)
                })
            }
        }

        // Custom validation (e.g. store name, params)
        if (validate) {
            const validationResult = validate()
            if (validationResult) return validationResult
        }

        const handler = router[action]
        if (!handler) {
            return apiResponse(null, 400, {
                message: `Invalid action: ${action}`,
                code: 'INVALID_ACTION',
                details: `Available actions: ${Object.keys(router).join(', ')}`
            })
        }

        return await handler()
    } catch (error) {
        return apiResponse(null, 500, {
            message: error instanceof Error ? error.message : String(error),
            code: 'INTERNAL_ERROR',
            details: error instanceof Error && error.stack ? error.stack : undefined
        })
    }
}
