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
import values from 'lodash/values'
import isNumber from 'lodash/isNumber'
import isVarName from 'is-var-name'

import { TypeRegistry } from './TypeRegistry'

export enum PrimitiveType {
  string = 'string',
  number = 'number',
  boolean = 'boolean',
  integer = 'integer',
  int = 'int',
  float = 'float',
  double = 'double',
  null = 'null',
  any = 'any',
}

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
  return input instanceof Object && values(PrimitiveType).indexOf(input.type) >= 0
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
  parentName: string
  propertyName: string
  value: string
}
function getDiscriminator(inputSchema: SchemaObject, registry: TypeRegistry): DiscriminatorInfo {
  if (!registry.hasSchema(inputSchema)) {
    return null
  }
  const name = registry.getNameBySchema(inputSchema)
  for (const { name: parentName, schema } of registry.getTypes()) {
    if (!schema.discriminator) {
      continue
    }
    const { mapping, propertyName } = schema.discriminator
    const entry = entries(mapping).find(([, ref]) => getRefName(ref) === name)
    if (entry) {
      return { value: entry[0], propertyName, parentName }
    }
  }
  return null
}
function getDiscriminatorsInternal(
  inputSchema: SchemaObject,
  registry: TypeRegistry,
  discriminators: DiscriminatorInfo[],
): void {
  const discriminator = getDiscriminator(inputSchema, registry)
  if (discriminator === null) {
    return
  }
  if (discriminators.some((d) => d.parentName === discriminator.parentName)) {
    return
  }
  discriminators.push(discriminator)
  if (registry.hasSchemaName(discriminator.parentName)) {
    const parentSchema = registry.getSchemaByName(discriminator.parentName)
    getDiscriminatorsInternal(parentSchema, registry, discriminators)
  }
}

export function getDiscriminators(inputSchema: SchemaObject, registry: TypeRegistry): DiscriminatorInfo[] {
  const discriminators: DiscriminatorInfo[] = []
  getDiscriminatorsInternal(inputSchema, registry, discriminators)
  return discriminators
}
export function getRefName(ref: string): string {
  return last(ref.split('/'))
}

export enum AccessorType {
  PROPERTY = 'PROPERTY',
  INDEX = 'INDEX',
  INDEX_PROPERTY = 'INDEX_PROPERTY',
}

export function accessor(root: string, element: string, hint: AccessorType = null) {
  if (isNumber(element) || hint === AccessorType.INDEX) {
    return `${root}[${element}]`
  } else if (!isVarName(element) || hint === AccessorType.INDEX_PROPERTY) {
    return `${root}['${element}']`
  } else {
    return `${root}.${element}`
  }
}
