import { JSONSchema4 } from 'json-schema'

export function isObjectType(input: JSONSchema4): boolean {
  return input.type === 'object' || Boolean(input.properties)
}
export function isEnumType(input: JSONSchema4): boolean {
  // We only handle string enums
  return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'))
}
export function isArrayType(input: JSONSchema4): boolean {
  return input.type === 'array' || Boolean(input.items)
}
export function isPrimitiveType(input: JSONSchema4): boolean {
  return (
    input.type === 'string' ||
    input.type === 'number' ||
    input.type === 'boolean' ||
    input.type === 'integer' ||
    input.type === 'null'
  )
}
export function isRefType(input: JSONSchema4): boolean {
  return Boolean(input.$ref)
}

export function isOneOfType(input: JSONSchema4): boolean {
  return Boolean(input.oneOf)
}
