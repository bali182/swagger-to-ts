import { SchemaObject, ReferenceObject } from '@loopback/openapi-v3-types'
import {
  isEnumType,
  isObjectType,
  isArrayType,
  isSimpleType,
  isOneOfType,
  isAllOfType,
  isAnyOfType,
  isSchemaType,
  isRefType,
  isPureMapType,
} from './utils'
import { BaseGenerator } from './BaseGenerator'
import last from 'lodash/last'
import entries from 'lodash/entries'
import pascalCase from 'pascalcase'

export class TypeGenerator extends BaseGenerator<string> {
  generate(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    if (isEnumType(schema)) {
      return this.generateConstEnum(name)
    } else if (isObjectType(schema)) {
      return this.generateTypeDeclaration(name)
    } else if (isOneOfType(schema)) {
      return this.generateOneOfType(name)
    } else if (isAllOfType(schema)) {
      return this.generateAllOfType(name)
    } else if (isAnyOfType(schema)) {
      return this.generateAnyOfType(name)
    } else if (isArrayType(schema)) {
      return this.generateArrayType(name)
    }
    throw new TypeError(`${name} is of unknown type, cannot be generated`)
  }

  generateConstEnum(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    return `export const enum ${name} {
      ${schema.enum.map((value) => `${pascalCase(value)} = '${value}'`).join(',')}
    }`
  }

  refToTypeName(ref: string): string {
    const name = pascalCase(last(ref.split('/')))
    this.registry.getSchemaByName(name)
    return name
  }

  getPrimitiveFieldType(schema: SchemaObject): string {
    if (schema === null || schema === undefined) {
      return 'any'
    }
    switch (schema.type) {
      case 'string':
        return 'string'
      case 'boolean':
        return 'boolean'
      case 'number':
      case 'integer':
        return 'number'
      case 'null':
        return 'null'
      case 'any':
        return 'any'
    }
  }

  generateFieldType(schema: SchemaObject | ReferenceObject): string {
    if (schema === null || schema === undefined) {
      return 'any'
    }
    if (isSchemaType(schema)) {
      if (this.registry.hasSchema(schema)) {
        return this.registry.getNameBySchema(schema)
      } else if (isSimpleType(schema)) {
        return this.getPrimitiveFieldType(schema)
      } else if (isPureMapType(schema)) {
        return this.generateAdditionalProperties(schema.additionalProperties)
      } else if (isArrayType(schema)) {
        const { items } = schema
        const itemsType =
          isSchemaType(items) && isOneOfType(items) && items.oneOf.length > 1
            ? `(${this.generateFieldType(items)})`
            : this.generateFieldType(items)
        return `${itemsType}[]`
      } else if (isOneOfType(schema)) {
        return schema.oneOf.map((e) => this.generateFieldType(e)).join('|')
      } else if (isAllOfType(schema)) {
        return schema.allOf.map((e) => this.generateFieldType(e)).join('&')
      } else if (isAnyOfType(schema)) {
        return schema.anyOf.map((e) => this.generateFieldType(e)).join('|') // TODO
      }
    }
    if (isRefType(schema)) {
      return this.refToTypeName(schema.$ref)
    }
    throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`)
  }

  generateInterfaceField(name: string, schema: SchemaObject | ReferenceObject): string {
    return `${name}:${this.generateFieldType(schema)}`
  }

  generateInterfaceFields(schema: SchemaObject): string {
    return entries(schema || {})
      .map(([name, subSchema]) => this.generateInterfaceField(name, subSchema))
      .join(';\n')
  }

  generateAdditionalProperties(schema: boolean | SchemaObject | ReferenceObject) {
    if (typeof schema === 'boolean') {
      return schema ? `{[key: string]: any}` : `{[key: string]: never}`
    }
    return `{[key: string]: ${this.generateFieldType(schema)}}`
  }

  generateTypeBody(schema: SchemaObject): string {
    return `{${this.generateInterfaceFields(schema.properties)}}`
  }

  getIntersectionTypes(name: string): string[] {
    const schema = this.registry.getSchemaByName(name)
    const types: string[] = []
    if (schema.allOf && schema.allOf.length > 0 && schema.allOf.every(isRefType)) {
      schema.allOf.forEach((t) => types.push(this.refToTypeName(t.$ref)))
    }
    return types
  }

  generateTypeDeclaration(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const iss = this.getIntersectionTypes(name)

    if (schema.additionalProperties) {
      const mapDef = this.generateAdditionalProperties(schema.additionalProperties)
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
    const types = schema.anyOf.map((e) => this.generateFieldType(e)).join('|')
    return `export type ${name} = ${types}`
  }

  generateOneOfType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const types = schema.oneOf.map((e) => this.generateFieldType(e)).join('|')
    return `export type ${name} = ${types}`
  }

  generateAllOfType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    const types = schema.allOf.map((e) => this.generateFieldType(e)).join('&')
    return `export type ${name} = ${types}`
  }

  generateArrayType(name: string): string {
    const schema = this.registry.getSchemaByName(name)
    return `export type ${name} = ${this.generateFieldType(schema)}`
  }
}
