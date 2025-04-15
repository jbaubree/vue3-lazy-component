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
  return template.slice(prop.loc.start.offset, prop.loc.end.offset).split('=')[1]
}
export function cleanValue(value: string, quote: string = '"'): string {
  return value.replaceAll('"', quote)
}
