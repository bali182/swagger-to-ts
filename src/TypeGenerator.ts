import { SchemaObject } from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import {
  isEnumType,
  isObjectType,
  isArrayType,
  isOneOfType,
  isAllOfType,
  isAnyOfType,
  isRefType,
  getDiscriminators,
} from './utils'
import { BaseGenerator } from './BaseGenerator'
import { SchemaOrRef } from './typings'
import { TypeRegistry } from './TypeRegistry'
import { TypeRefGenerator } from './TypeRefGenerator'

export class TypeGenerator extends BaseGenerator<string> {
  private readonly typeRefGenerator: TypeRefGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.typeRefGenerator = new TypeRefGenerator(registry)
  }
  generate(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    if (isEnumType(schema)) {
      return this.generateConstEnum(name)
    } else if (isArrayType(schema)) {
      return this.generateArrayType(name)
    } else if (isOneOfType(schema)) {
      return this.generateOneOfType(name)
    } else if (isAllOfType(schema)) {
      return this.generateAllOfType(name)
    } else if (isAnyOfType(schema)) {
      return this.generateAnyOfType(name)
    } else if (isObjectType(schema)) {
      return this.generateTypeDeclaration(name)
    }
    console.error(`${name} is of unknown type, cannot be generated`)
    return null
  }

  generateConstEnum(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const np = this.registry.getNameProvider()
    return `export enum ${name} {
      ${schema.enum.map((value) => `${np.getEnumConstantName(value)} = '${value}'`).join(',')}
    }`
  }

  generateTypeDeclarationField(name: string, schema: SchemaOrRef, isRequired: boolean): string {
    const colon = isRequired ? ':' : '?:'
    return `${name}${colon}${this.typeRefGenerator.generate(schema)}`
  }

  generateTypeDeclarationFields(schema: SchemaObject): string {
    const discriminators = getDiscriminators(schema, this.registry)
    const fields = entries(schema.properties || {})
      .map(([name, subSchema]) => {
        if (discriminators.some((d) => d.propertyName === name)) {
          return null
        }
        const isRequired = schema.required && schema.required.indexOf(name) >= 0
        return this.generateTypeDeclarationField(name, subSchema, isRequired)
      })
      .filter((field) => field !== null)
    const allFields = discriminators.map((d) => `${d.propertyName}: '${d.value}'`).concat(fields)
    return allFields.join(';\n')
  }

  generateTypeBody(schema: SchemaObject): string {
    return `{${this.generateTypeDeclarationFields(schema)}}`
  }

  getIntersectionTypes(name: string): string[] {
    const schema = this.registry.getSchemaByName(name)
    const types: string[] = []
    if (schema.allOf && schema.allOf.length > 0 && schema.allOf.every(isRefType)) {
      schema.allOf.forEach((t) => types.push(this.typeRefGenerator.generate(t)))
    }
    return types
  }

  generateTypeDeclaration(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const iss = this.getIntersectionTypes(name)

    if (schema.additionalProperties) {
      const mapDef = this.typeRefGenerator.generateMapType(schema.additionalProperties)
      return `export type ${name} = ${mapDef} // TODO not fully expressible, "properties" omitted`
    }
    if (iss.length === 0) {
      return `export type ${name} = ${this.generateTypeBody(schema)}`
    } else {
      const issStr = iss.length > 1 ? `(${iss.join('&')})` : iss.join('&')
      return `export type ${name} = ${issStr} & ${this.generateTypeBody(schema)}`
    }
  }

  generateAnyOfType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const types = schema.anyOf.map((e) => this.typeRefGenerator.generate(e)).join('|')
    return `export type ${name} = ${types}`
  }

  generateOneOfType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const types = schema.oneOf.map((e) => this.typeRefGenerator.generate(e)).join('|')
    return `export type ${name} = ${types}`
  }

  generateAllOfType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const { allOf, ...rest } = schema
    const types = allOf.map((e) => this.typeRefGenerator.generate(e))
    const ownType = this.typeRefGenerator.generate(rest)
    const typeLiteral = [ownType].concat(types).join('&')
    return `export type ${name} = ${typeLiteral}`
  }

  generateArrayType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    return `export type ${name} = ${this.typeRefGenerator.generateItemsType(schema.items)}[]`
  }
}
