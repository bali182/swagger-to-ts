import {
  SchemaObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  ParameterObject,
} from '@loopback/openapi-v3-types'
import keys from 'lodash/keys'
import isNil from 'lodash/isNil'
import entries from 'lodash/entries'
import last from 'lodash/last'
import { TypeRegistry } from './TypeRegistry'

export function unique<T>(items: T[]): T[] {
  const set = new Set(items)
  return Array.from(set)
}
export function isObjectType(input: SchemaObject): boolean {
  if (!(input instanceof Object)) {
    return false
  }
  return input.type === 'object' || (isNil(input.type) && Boolean(input.properties))
}
export function isMapType(input: SchemaObject): boolean {
  return input instanceof Object && input.type === 'object' && Boolean(input.additionalProperties)
}
export function isPureMapType(input: SchemaObject): boolean {
  return (
    input instanceof Object &&
    input.type === 'object' &&
    (!Boolean(input.properties) || keys(input.properties).length === 0) &&
    input.additionalProperties !== false
  )
}
export function isEnumType(input: SchemaObject): boolean {
  // We only handle string enums
  return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'))
}
export function isArrayType(input: SchemaObject): boolean {
  return input.type === 'array' || Boolean(input.items)
}
export function isSimpleType(input: SchemaObject): boolean {
  return (
    input instanceof Object &&
    (input.type === 'string' ||
      input.type === 'number' ||
      input.type === 'boolean' ||
      input.type === 'integer' ||
      input.type === 'null' ||
      input.type === 'any')
  )
}
export function isOneOfType(input: any): boolean {
  return Boolean(input.oneOf)
}
export function isAnyOfType(input: any): boolean {
  return Boolean(input.anyOf)
}
export function isAllOfType(input: any): boolean {
  return Boolean(input.allOf)
}
export function isRefType(input: any): input is ReferenceObject {
  return input instanceof Object && Boolean(input.$ref)
}
export function isSchemaType(input: any): input is SchemaObject {
  return input instanceof Object && !Boolean(input.$ref)
}
export function isRequestBody(input: any): input is RequestBodyObject {
  return input instanceof Object && Boolean(input.content)
}
export function isResponse(input: any): input is ResponseObject {
  return input instanceof Object && (Boolean(input.description) || Boolean(input.content))
}
export function isParameter(input: any): input is ParameterObject {
  return input instanceof Object && Boolean(input.in)
}
export type DiscriminatorInfo = {
  propertyName: string
  value: string
}
export function getDiscriminator(inputShema: SchemaObject, registry: TypeRegistry): DiscriminatorInfo {
  if (!registry.hasSchema(inputShema)) {
    return null
  }
  const name = registry.getNameBySchema(inputShema)
  for (const { schema } of registry.getTypes()) {
    if (!schema.discriminator) {
      continue
    }
    const { mapping, propertyName } = schema.discriminator
    const entry = entries(mapping).find(([, ref]) => ref.endsWith(name))
    if (entry) {
      return { value: entry[0], propertyName }
    }
  }
  return null
}
export function getRefName(ref: string): string {
  return last(ref.split('/'))
}
