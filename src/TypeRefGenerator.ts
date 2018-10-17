import { BaseGenerator } from './BaseGenerator'
import { SchemaOrRef } from './typings'
import { SchemaObject, ReferenceObject } from '@loopback/openapi-v3-types'
import {
  isSchemaType,
  isSimpleType,
  isPureMapType,
  isArrayType,
  isOneOfType,
  isAllOfType,
  isAnyOfType,
  isRefType,
} from './utils'
import last from 'lodash/last'
import pascalCase from 'pascalcase'

export class TypeRefGenerator extends BaseGenerator<SchemaOrRef> {
  generate(schema: SchemaOrRef): string {
    if (schema === null || schema === undefined) {
      return this.generatePrimitiveType(schema)
    }
    if (isRefType(schema)) {
      return this.generateRefType(schema)
    }
    if (isSchemaType(schema)) {
      if (this.registry.hasSchema(schema)) {
        return this.generateRootType(schema)
      } else if (isSimpleType(schema)) {
        return this.generatePrimitiveType(schema)
      } else if (isPureMapType(schema)) {
        return this.generateMapType(schema.additionalProperties)
      } else if (isArrayType(schema)) {
        return this.generateArrayType(schema)
      } else if (isOneOfType(schema)) {
        return this.generateOneOfType(schema)
      } else if (isAllOfType(schema)) {
        return this.generateAllOfType(schema)
      } else if (isAnyOfType(schema)) {
        return this.generateAnyOfType(schema)
      }
    }
    throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`)
  }

  generateOneOfType(schema: SchemaObject): string {
    return this.generateCompositeSchema(schema.oneOf, '|')
  }

  generateAnyOfType(schema: SchemaObject): string {
    return this.generateCompositeSchema(schema.anyOf, '|')
  }

  generateAllOfType(schema: SchemaObject): string {
    return this.generateCompositeSchema(schema.allOf, '&')
  }

  generateCompositeSchema(schemas: SchemaOrRef[], glue: string): string {
    return schemas.map((e) => this.generate(e)).join(glue)
  }

  generateRefType(ref: ReferenceObject): string {
    const name = pascalCase(last(ref.$ref.split('/')))
    this.registry.getSchemaByName(name)
    return name
  }

  generateMapType(schema: boolean | SchemaOrRef): string {
    if (typeof schema === 'boolean') {
      return schema ? `{[key: string]: any}` : `{[key: string]: never}`
    }
    return `{[key: string]: ${this.generate(schema)}}`
  }

  generateItemsType(schema: SchemaOrRef): string {
    return isSchemaType(schema) && isOneOfType(schema) && schema.oneOf.length > 1
      ? `(${this.generate(schema)})`
      : this.generate(schema)
  }

  generateArrayType(schema: SchemaObject): string {
    return `${this.generateItemsType(schema.items)}[]`
  }

  generatePrimitiveType(schema: SchemaObject): string {
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

  generateRootType(schema: SchemaObject): string {
    return this.registry.getNameBySchema(schema)
  }
}
