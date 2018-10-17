import { SchemaObject } from '@loopback/openapi-v3-types'

export class TypeWrapper {
  public readonly name: string
  public readonly schema: SchemaObject
  constructor(name: string, schema: SchemaObject) {
    this.name = name
    this.schema = schema
  }
}
