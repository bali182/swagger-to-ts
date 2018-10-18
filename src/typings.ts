import { SchemaObject, ReferenceObject, ParameterObject } from 'openapi3-ts'

export interface IGenerator<Input> {
  generate(input: Input): string
}

export type SchemaOrRef = SchemaObject | ReferenceObject
export type RefOrParameter = ReferenceObject | ParameterObject
export type PropertyMap = { [propertyName: string]: SchemaOrRef }
