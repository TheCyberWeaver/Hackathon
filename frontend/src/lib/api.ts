const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/[/]$/, '')

export type CurrentUser = { id: string; name: string }

export class IdentityError extends Error {
  readonly status: number
  constructor(status: number) {
    super('Could not load the signed-in user')
    this.status = status
  }
}

export async function getCurrentUser(
  signal?: AbortSignal,
): Promise<CurrentUser> {
  const response = await fetch(baseUrl + '/api/me', {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new IdentityError(response.status)
  const data: unknown = await response.json()
  if (
    typeof data !== 'object' ||
    data === null ||
    !('id' in data) ||
    typeof data.id !== 'string' ||
    !data.id.trim() ||
    !('name' in data) ||
    typeof data.name !== 'string' ||
    !data.name.trim()
  )
    throw new Error('Unexpected user profile response')
  return { id: data.id, name: data.name }
}

export type HelloResponse = { message: string }

export async function getHello(): Promise<HelloResponse> {
  const response = await fetch(baseUrl + '/api/hello')
  if (!response.ok) throw new Error('Request failed: ' + response.status)

  const data: unknown = await response.json()
  if (
    typeof data !== 'object' ||
    data === null ||
    !('message' in data) ||
    typeof data.message !== 'string'
  ) {
    throw new Error('The API returned an unexpected response')
  }
  return { message: data.message }
}
