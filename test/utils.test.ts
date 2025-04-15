import { describe, expect, it } from 'vitest'
import { addImportIfNeeded, cleanValue, extractRawValue, getComponentFolderFromScript } from '../src/utils'

describe('getComponentFolderFromScript', () => {
  it('should return the component folder from a basic import', () => {
    const script = `import MyComponent from './components/base/MyComponent.vue'`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBe('./components/base')
  })

  it('should return null if the component is not found', () => {
    const script = `import OtherComponent from './components/base/OtherComponent.vue'`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBeNull()
  })

  it('should work with double quotes', () => {
    const script = `import MyComponent from "./components/base/MyComponent.vue"`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBe('./components/base')
  })

  it('should handle extra whitespace around the import', () => {
    const script = `import   MyComponent    from   './components/base/MyComponent.vue'`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBe('./components/base')
  })

  it('should return null if import path does not match expected pattern', () => {
    const script = `import MyComponent from './components/base/'`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBeNull()
  })

  it('should handle nested component folders correctly', () => {
    const script = `import MyComponent from '../shared/components/ui/MyComponent.vue'`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBe('../shared/components/ui')
  })

  it('should not match incorrect import statements', () => {
    const script = `const x = require('./MyComponent.vue')`
    const result = getComponentFolderFromScript(script, 'MyComponent')
    expect(result).toBeNull()
  })
})

describe('addImportIfNeeded', () => {
  it('should add import if not already present', () => {
    const code = `const something = true`
    const imports: string[] = []
    addImportIfNeeded(code, 'import Foo from \'./Foo.vue\'', imports)
    expect(imports).toContain('import Foo from \'./Foo.vue\'')
  })

  it('should not add import if already present', () => {
    const code = `import Foo from './Foo.vue'`
    const imports: string[] = []
    addImportIfNeeded(code, 'import Foo from \'./Foo.vue\'', imports)
    expect(imports).toHaveLength(0)
  })

  it('should not add import if a similar import exists', () => {
    const code = `import Foo from './components/Foo.vue'`
    const imports: string[] = []
    addImportIfNeeded(code, 'import Foo from \'./Foo.vue\'', imports)
    expect(imports).toContain('import Foo from \'./Foo.vue\'')
  })

  it('should handle multiple imports correctly', () => {
    const code = `import Bar from './Bar.vue'`
    const imports: string[] = []
    addImportIfNeeded(code, 'import Foo from \'./Foo.vue\'', imports)
    addImportIfNeeded(code, 'import Bar from \'./Bar.vue\'', imports)
    expect(imports).toContain('import Foo from \'./Foo.vue\'')
    expect(imports).not.toContain('import Bar from \'./Bar.vue\'')
  })
})

describe('extractRawValue', () => {
  it('should extract the raw value of a prop', () => {
    const template = `<MyComp my-prop="value" />`
    const prop = {
      loc: {
        start: { offset: 13 },
        end: { offset: 27 },
      },
    }
    const result = extractRawValue(template, prop)
    expect(result).toBe('"value"')
  })

  it('should extract value with equal sign and extra spaces', () => {
    const template = `<MyComp my-prop =  'value' />`
    const prop = {
      loc: {
        start: { offset: 13 },
        end: { offset: 30 },
      },
    }
    const result = extractRawValue(template, prop)
    expect(result).toBe('\'value\'')
  })

  it('should return empty string if no value is present', () => {
    const template = `<MyComp my-prop />`
    const prop = {
      loc: {
        start: { offset: 13 },
        end: { offset: 21 },
      },
    }
    const result = extractRawValue(template, prop)
    expect(result).toBe('')
  })
})

describe('cleanValue', () => {
  it('should replace double quotes with single quotes', () => {
    const result = cleanValue('"value"', '\'')
    expect(result).toBe('\'value\'')
  })

  it('should keep double quotes if no custom quote is passed', () => {
    const result = cleanValue('"value"')
    expect(result).toBe('"value"')
  })

  it('should handle mixed quote characters inside value', () => {
    const result = cleanValue('"some \\"quoted\\" text"', '\'')
    expect(result).toBe('\'some \\\'quoted\\\' text\'')
  })

  it('should replace all double quotes, even multiple ones', () => {
    const result = cleanValue('"a" + "b" + "c"', '\'')
    expect(result).toBe('\'a\' + \'b\' + \'c\'')
  })

  it('should do nothing if no double quotes are present', () => {
    const result = cleanValue('value')
    expect(result).toBe('value')
  })
})
