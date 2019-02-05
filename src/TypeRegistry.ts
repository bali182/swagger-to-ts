import { SchemaObject, OpenApiSpec, OperationObject, PathItemObject, ReferenceObject } from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import {
  isObjectType,
  isEnumType,
  isArrayType,
  isOneOfType,
  isAllOfType,
  isAnyOfType,
  isPureMapType,
  isRefType,
} from './utils'
import { TypeWrapper } from './TypeWrapper'
import { HTTPMethod, OperationWrapper } from './OperationWrapper'
import { NameProvider } from './NameProvider'
import last from 'lodash/last'
import { Args } from './typings'

export class TypeRegistry {
  private readonly types: TypeWrapper[] = []
  private readonly operations: OperationWrapper[] = []
  private readonly spec: OpenApiSpec
  private readonly nameProvider: NameProvider
  private readonly args: Args

  constructor(args: Args, spec: OpenApiSpec, nameProvider: NameProvider) {
    this.spec = spec
    this.args = args
    this.nameProvider = nameProvider
    this.registerOperations()
    this.registerTypes()
  }
  getArgs(): Args {
    return this.args
  }
  getNameProvider(): NameProvider {
    return this.nameProvider
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
  resolveRef(ref: ReferenceObject): SchemaObject {
    return this.getSchemaByName(last(ref.$ref.split('/')))
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
    this.types.push({ name, schema })
  }
  protected registerTypeRecursively(name: string, schema: SchemaObject, force: boolean) {
    if ((force || (isObjectType(schema) && !isPureMapType(schema)) || isEnumType(schema)) && !this.hasSchema(schema)) {
      this.registerType(this.nameProvider.getTypeName(name), schema)
    }

    if (isObjectType(schema) && schema.properties) {
      for (const [fieldName, subSchema] of entries(schema.properties)) {
        this.registerTypeRecursively(this.nameProvider.getNestedTypeName(name, fieldName), subSchema, false)
      }
    }
    if (isArrayType(schema) && schema.items) {
      this.registerTypeRecursively(this.nameProvider.getNestedItemName(name), schema.items, false)
    }
    if (isOneOfType(schema)) {
      schema.oneOf.forEach((child, index) =>
        this.registerTypeRecursively(this.nameProvider.getNestedOneOfName(name, index), child, false),
      )
    }
    if (isAllOfType(schema) && !schema.allOf.every(isRefType)) {
      schema.allOf.forEach((child, index) =>
        this.registerTypeRecursively(this.nameProvider.getNestedAllOfName(name, index), child, false),
      )
    }
    if (isAnyOfType(schema)) {
      schema.anyOf.forEach((child, index) =>
        this.registerTypeRecursively(this.nameProvider.getNestedAnyOfName(name, index), child, false),
      )
    }
  }
  protected registerTypes(): void {
    for (const [name, schema] of entries(this.spec.components.schemas)) {
      this.registerTypeRecursively(name, schema, true)
    }
    for (const op of this.getOperations()) {
      for (const param of op.operation.parameters || []) {
        if (!isRefType(param) && param.schema) {
          this.registerTypeRecursively(
            this.nameProvider.getParameterTypeName(op.getId(), param.name),
            param.schema,
            false,
          )
        }
      }
      for (const schema of op.getRequestBodyTypes()) {
        this.registerTypeRecursively(this.nameProvider.getRequestBodyTypeName(op.getId(), op.method), schema, false)
      }
      for (const schema of op.getResponseTypes()) {
        if (schema !== null) {
          this.registerTypeRecursively(this.nameProvider.getResponseTypeName(op.getId(), op.method), schema, false)
        }
      }
    }
  }
  protected registerOperation(url: string, method: HTTPMethod, operation: OperationObject): void {
    this.operations.push(new OperationWrapper(url, method, operation, this.spec))
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
