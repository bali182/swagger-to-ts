import { SchemaObject, ReferenceObject } from 'openapi3-ts'

export interface IGenerator<Input> {
  generate(input: Input): string
}

export type SchemaOrRef = SchemaObject | ReferenceObject
