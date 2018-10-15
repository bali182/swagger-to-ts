import { SchemaObject, ReferenceObject } from '@loopback/openapi-v3-types'

export function isObjectType(input: SchemaObject): boolean {
  return input.type === 'object' || Boolean(input.properties)
}
export function isEnumType(input: SchemaObject): boolean {
  // We only handle string enums
  return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'))
}
export function isArrayType(input: SchemaObject): boolean {
  return input.type === 'array' || Boolean(input.items)
}
export function isPrimitiveType(input: SchemaObject): boolean {
  return (
    input.type === 'string' ||
    input.type === 'number' ||
    input.type === 'boolean' ||
    input.type === 'integer' ||
    input.type === 'null'
  )
}
export function isOneOfType(input: any): boolean {
  return Boolean(input.oneOf)
}

export function isRefType(input: SchemaObject | ReferenceObject): input is ReferenceObject {
  return Boolean(input.$ref)
}
export function isSchemaType(input: SchemaObject | ReferenceObject): input is SchemaObject {
  return !Boolean(input.$ref)
}
