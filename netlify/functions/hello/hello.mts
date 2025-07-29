import type { Context } from '@netlify/functions'
import { apiResponse } from '../_types/ApiResponse.mts'
import { universalHandler } from '../_utils/universalHandler.mts'
import { z } from 'zod'

type HelloAction = 'GREET'

const helloParamsSchema = z.object({
  action: z.string().optional().default('GREET'),
  name: z.string().optional()
})

const handleGreet = (url: URL) => {
  const subject = url.searchParams.get('name') || 'World'
  return apiResponse({ message: `Hello ${subject}` }, 200)
}

const createRouter = (url: URL) => ({
  GREET: () => handleGreet(url)
})

export default function helloHandler(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url)
  const action = (url.searchParams.get('action') || 'GREET') as HelloAction
  const router = createRouter(url)

  // Parameters for Zod validation
  const params = {
    action: url.searchParams.get('action') || 'GREET',
    name: url.searchParams.get('name') || undefined
  }

  return universalHandler({
    req,
    context,
    router,
    action,
    zodSchema: helloParamsSchema,
    params
  })
}
