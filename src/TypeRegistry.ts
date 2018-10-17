import { SchemaObject, OpenApiSpec, OperationObject, PathItemObject } from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import pascalCase from 'pascalcase'

import { isObjectType, isEnumType, isArrayType, isOneOfType, isAllOfType, isAnyOfType, isPureMapType } from './utils'
import { TypeWrapper } from './TypeWrapper'
import { HTTPMethod, OperationWrapper } from './OperationWrapper'

export class TypeRegistry {
  private readonly types: TypeWrapper[] = []
  private readonly operations: OperationWrapper[] = []
  private readonly spec: OpenApiSpec
  constructor(spec: OpenApiSpec) {
    this.spec = spec
    this.registerTypes()
    this.registerOperations()
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
  getOperations(): OperationWrapper[] {
    return this.operations
  }
  getOperation(id: string): OperationWrapper {
    return this.getOperations().find(({ operation }) => operation.operationId === id)
  }
  getOperationIds(): string[] {
    return this.getOperations().map(({ operation }) => operation.operationId)
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
    this.types.push({ name: pascalCase(name), schema })
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
  protected registerTypes(): void {
    for (const [name, schema] of entries(this.spec.components.schemas)) {
      this.registerTypeRecursively(name, schema, true)
    }
  }
  protected registerOperation(url: string, method: HTTPMethod, operation: OperationObject): void {
    this.operations.push(new OperationWrapper(url, method, operation))
  }
  protected registerOperations() {
    for (const [url, path] of entries(this.getSpec().paths)) {
      const { get, put, post, delete: _delete, options, head, patch, trace } = path as PathItemObject
      get ? this.registerOperation(url, 'get', get) : null
      put ? this.registerOperation(url, 'put', put) : null
      post ? this.registerOperation(url, 'post', post) : null
      _delete ? this.registerOperation(url, 'delete', _delete) : null
      options ? this.registerOperation(url, 'options', options) : null
      head ? this.registerOperation(url, 'head', head) : null
      patch ? this.registerOperation(url, 'patch', patch) : null
      trace ? this.registerOperation(url, 'trace', trace) : null
    }
  }
}
