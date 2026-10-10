import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const cache = new Map()
export async function sourceUrl(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const source = await readFile(url, 'utf8')
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  })
  const imports = [...outputText.matchAll(/from (['"])([^'"]+)\1/g)]
  for (const [match, , name] of imports) {
    const resolved = name.startsWith('.')
      ? await sourceUrl(new URL(`${name}.ts`, url))
      : import.meta.resolve(name)
    outputText = outputText.replace(match, `from ${JSON.stringify(resolved)}`)
  }
  outputText = outputText.replace('import.meta.env', '{}')
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  cache.set(url.href, result)
  return result
}
export async function loadSource(path) {
  return import(await sourceUrl(path))
}
