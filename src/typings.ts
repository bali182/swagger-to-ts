import { SchemaObject, ReferenceObject, ParameterObject } from 'openapi3-ts'

export interface IGenerator<Input> {
  generate(input: Input): string
}

export type SchemaOrRef = SchemaObject | ReferenceObject
export type RefOrParameter = ReferenceObject | ParameterObject
export type PropertyMap = { [propertyName: string]: SchemaOrRef }

export enum GeneratorIds {
  Types = 'types',
  TypeGuards = 'typeguards',
  ApiContract = 'api-contract',
  Api = 'api',
  Validators = 'validators',
}

export type Args = {
  file: string
  apiTypeName: string
  targets: GeneratorIds[]
  typesPath?: string
  typeGuardsPath?: string
  apiContractPath?: string
  apiPath?: string
  validatorsPath?: string
}
