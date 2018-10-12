import { JSONSchema4 } from 'json-schema'
import prettier from 'prettier'
import { isEnumType, isObjectType, isRefType, isArrayType, isPrimitiveType, isOneOfType } from './utils'

type Defs = { [name: string]: JSONSchema4 }

function generateConstEnum(name: string, schema: JSONSchema4): string {
  return `export const enum ${name} {
    ${schema.enum.map((value) => `${value} = '${value}'`).join(',\n')}
  }`
}

function refToTypeName(ref: string): string {
  const parts = ref.split('/')
  return parts[parts.length - 1]
}

function getPrimitiveFieldType(schema: JSONSchema4): string {
  switch (schema.type) {
    case 'string':
      return 'string'
    case 'boolean':
      return 'boolean'
    case 'number':
    case 'integer':
      return 'number'
    case 'null':
      return 'null'
  }
}

function generateFieldType(schema: JSONSchema4): string {
  if (isEnumType(schema)) {
    return schema.enum.map((value) => `'${value}'`).join('|')
  } else if (isPrimitiveType(schema)) {
    return getPrimitiveFieldType(schema)
  } else if (isRefType(schema)) {
    return refToTypeName(schema.$ref)
  } else if (isArrayType(schema)) {
    const itemsType =
      isOneOfType(schema.items) && schema.items.length > 1
        ? `(${generateFieldType(schema.items)})`
        : generateFieldType(schema.items)
    return `${itemsType}[]`
  } else if (isOneOfType(schema)) {
    return schema.oneOf.map(generateFieldType).join('|')
  }
  throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`)
}

function generateInterfaceField(name: string, schema: JSONSchema4): string {
  return `${name}:${generateFieldType(schema)}`
}

function generateInterface(name: string, schema: JSONSchema4): string {
  const fields = Object.keys(schema.properties || {})
    .map((name) => generateInterfaceField(name, schema.properties[name]))
    .join('\n')
  return `export type ${name} = {
    ${fields}
  }`
}

function generateOneOfType(name: string, schema: JSONSchema4): string {
  return `export type ${name} = ${schema.oneOf.map(generateFieldType).join('|')}`
}

function generateArrayType(name: string, schema: JSONSchema4): string {
  return `export type ${name} = ${generateFieldType(schema)}`
}

function generateType(name: string, schema: JSONSchema4): string {
  if (isEnumType(schema)) {
    return generateConstEnum(name, schema)
  } else if (isObjectType(schema)) {
    return generateInterface(name, schema)
  } else if (isOneOfType(schema)) {
    return generateOneOfType(name, schema)
  } else if (isArrayType(schema)) {
    return generateArrayType(name, schema)
  }
  throw new TypeError(`${name} is of unknown type, cannot be generated`)
}

export function format(source: string): string {
  return prettier.format(source, {
    printWidth: 120,
    semi: false,
    parser: 'typescript',
    tabWidth: 2,
    useTabs: false,
    singleQuote: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    arrowParens: 'always',
  })
}

export function generateTypes(defs: Defs): string {
  const source = Object.keys(defs)
    .map((name) => generateType(name, defs[name]))
    .join('\n')

  return format(source)
}
