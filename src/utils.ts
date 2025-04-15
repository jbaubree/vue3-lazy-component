export function getComponentFolderFromScript(script: string, compName: string): string | null {
  const regex = new RegExp(`import\\s+${compName}\\s+from\\s+['"](.+)/[^/]+\\.vue['"]`)
  const match = script.match(regex)
  return match?.[1] ?? null
}
export function addImportIfNeeded(code: string, importStatement: string, imports: string[]): void {
  if (!code.includes(importStatement)) {
    imports.push(importStatement)
  }
}
export function extractRawValue(template: string, prop: { loc: { start: { offset: number }, end: { offset: number } } }): string {
  const raw = template.slice(prop.loc.start.offset, prop.loc.end.offset)
  const match = raw.match(/=\s*(['"])(.*?)\1/)
  return match ? match[1] + match[2] + match[1] : ''
}
export function cleanValue(value: string, quote: string = '"'): string {
  return value.replaceAll('"', quote)
}
