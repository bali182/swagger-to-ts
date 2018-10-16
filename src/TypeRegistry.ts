import { SchemaObject, OpenApiSpec } from '@loopback/openapi-v3-types'
import { isObjectType, isEnumType, isArrayType, isOneOfType, isAllOfType, isAnyOfType, isPureMapType } from './utils'
import entries from 'lodash/entries'
import pascalCase from 'pascalcase'

export type TypeWrapper = {
  name: string
  schema: SchemaObject
}

export class TypeRegistry {
  private readonly types: TypeWrapper[] = []
  private readonly spec: OpenApiSpec
  constructor(spec: OpenApiSpec) {
    this.spec = spec
    this.registerAll()
  }
  getSpec(): OpenApiSpec {
    return this.spec
  }
  getTypes(): TypeWrapper[] {
    return this.types
  }
  getTypeNames(): string[] {
    return this.types.map(({ name }) => name)
  }
  hasSchemaName(name: string): boolean {
    return this.types.find(({ name: n }) => n === name) !== undefined
  }
  hasSchema(schema: SchemaObject): boolean {
    return this.types.find(({ schema: s }) => s === schema) !== undefined
  }
  getSchemaByName(name: string): SchemaObject {
    const wrapper = this.types.find(({ name: n }) => n === name)
    if (wrapper === undefined) {
      throw new TypeError(`Type "${name}" is not registered!`)
    }
    return wrapper.schema
  }
  getNameBySchema(schema: SchemaObject): string {
    const wrapper = this.types.find(({ schema: s }) => s === schema)
    if (wrapper === undefined) {
      throw new TypeError(`Type for schema "${JSON.stringify(schema, null, 2)}" is not registered!`)
    }
    return wrapper.name
  }
  protected registerType(name: string, schema: SchemaObject): void {
    const byName = this.types.find(({ name: n }) => n === name)
    if (byName !== undefined) {
      throw new TypeError(`Type "${name}" is already registered!`)
    }
    const bySchema = this.types.find(({ schema: s }) => s === schema)
    if (bySchema !== undefined) {
      throw new TypeError(`Type for schema "${JSON.stringify(schema, null, 2)}" is already registered!`)
    }
    this.types.push({
      name: pascalCase(name),
      schema,
    })
  }
  protected registerTypeRecursively(name: string, schema: SchemaObject, force: boolean) {
    if ((force || (isObjectType(schema) && !isPureMapType(schema)) || isEnumType(schema)) && !this.hasSchema(schema)) {
      this.registerType(name, schema)
    }

    if (isObjectType(schema) && schema.properties) {
      for (const [fieldName, subSchema] of entries(schema.properties)) {
        this.registerTypeRecursively(`${name}${pascalCase(fieldName)}`, subSchema, false)
      }
    }
    if (isArrayType(schema) && schema.items) {
      this.registerTypeRecursively(`${name}ArrayItem`, schema.items, false)
    }
    if (isOneOfType(schema)) {
      this.registerTypeRecursively(`${name}OneOf`, schema.oneOf, false)
    }
    if (isAllOfType(schema)) {
      this.registerTypeRecursively(`${name}AllOf`, schema.allOf, false)
    }
    if (isAnyOfType(schema)) {
      this.registerTypeRecursively(`${name}AnyOf`, schema.anyOf, false)
    }
  }
  protected registerAll(): void {
    for (const [name, schema] of entries(this.spec.components.schemas)) {
      this.registerTypeRecursively(name, schema, true)
    }
  }
}
