const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/[/]$/, '')

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
