import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { SchemaObject } from 'openapi3-ts'
import {
  isObjectType,
  isSimpleType,
  isRefType,
  PrimitiveType,
  isEnumType,
  isArrayType,
  isOneOfType,
  getRefName,
  accessor,
} from './utils'
import { SchemaOrRef } from './typings'
import entries from 'lodash/entries'
import isNil from 'lodash/isNil'

export class ValidatorGenerator extends BaseGenerator<string> {
  constructor(registry: TypeRegistry) {
    super(registry)
  }
  generate(name: string): string {
    const np = this.registry.getNameProvider()
    const fnName = np.getValidatorName(name)
    const typeName = np.getTypeName(name)
    return `export function ${fnName}(input: ${np.addTypeNamespace(
      typeName,
    )}, path: string = '$'): __ValidationResult[] {
      const results: __ValidationResult[] = []
      ${this.schemaValidators(this.registry.getSchemaByName(name))}
      return results
    }`
  }
  schemaValidators(schema: SchemaObject) {
    if (isOneOfType(schema)) {
      if (schema.discriminator) {
        return this.oneOfValidator(schema)
      }
      if (schema.oneOf.length === 1) {
        const oneOf = schema.oneOf[0]
        const name = isRefType(oneOf) ? getRefName(oneOf.$ref) : this.registry.getNameBySchema(oneOf)
        const validatorName = this.registry.getNameProvider().getValidatorName(name)
        return `if(!(input instanceof Object)) {
          results.push({ message: '${name} should be an object', path })
        }
        results.push(...${validatorName}(input, path))`
      }
    } else if (isObjectType(schema)) {
      return this.objectValidator(schema)
    } else if (isEnumType(schema)) {
      return this.enumValidator(schema)
    }
    return ''
  }
  objectValidator(schema: SchemaObject) {
    const name = this.registry.getNameBySchema(schema)
    const objectCheck = `if(!(input instanceof Object)) {
      results.push({ message: '${name} should be an object', path })
    }`
    const props = entries(schema.properties || {})
      .filter(([name]) => name !== 'traversableAgain' && name !== 'empty') // TODO scala collection bullshit
      .map(([name, propSchema]) =>
        this.propertyValidator(name, propSchema, schema.required && schema.required.indexOf(name) >= 0),
      )
      .filter((str) => str !== null && str.length > 0)
    return [objectCheck].concat(props).join('\n')
  }
  enumValidator(schema: SchemaObject) {
    const name = this.registry.getNameBySchema(schema)
    const stringCheck = `if (typeof input !== 'string') {
      results.push({ message: '${name} should represented as a string', path })
    }`
    const values = `${schema.enum.map((v) => `"${v}"`).join(', ')}`
    const enumValueCheck = `if([${values}].indexOf(input) < 0) {
      results.push({ message: '${name} should be one of ${values}', path})
    }`
    return [stringCheck, enumValueCheck].join('\n')
  }
  oneOfValidator(schema: SchemaObject) {
    const name = this.registry.getNameBySchema(schema)
    const { mapping, propertyName } = schema.discriminator
    return `if(!(input instanceof Object)) {
      results.push({ message: '${name} should be an object', path })
    }
    switch(input.${propertyName}) {
      ${entries(mapping)
        .map(([value, ref]) => this.oneOfDispatcher(value, ref))
        .join('\n')}
    }`
  }
  oneOfDispatcher(value: string, ref: string): string {
    const validatorName = this.registry.getNameProvider().getValidatorName(getRefName(ref))
    return `case '${value}': return ${validatorName}(input, path)`
  }
  propertyValidator(prop: string, propSchema: SchemaOrRef, required: boolean): string {
    const validators: string[] = []
    const path = `\${path}.${prop}`
    if (required) {
      validators.push(this.requiredPropertyValidator(prop, path, 'input'))
    }
    const schema = isRefType(propSchema) ? this.registry.resolveRef(propSchema) : propSchema
    return this.propValidator(path, accessor('input', prop), schema)
  }

  propValidator(path: string, varName: string, schema: SchemaObject): string {
    const validators: string[] = []
    if (schema) {
      if (isSimpleType(schema)) {
        switch (schema.type) {
          case PrimitiveType.string: {
            validators.push(this.stringPropertyValidator(path, varName))
            if (!isNil(schema.minLength)) {
              validators.push(this.stringMinLengthChecker(path, varName, schema.minLength))
            }
            if (!isNil(schema.maxLength)) {
              validators.push(this.stringMaxLengthChecker(path, varName, schema.maxLength))
            }
            break
          }
          case PrimitiveType.boolean: {
            validators.push(this.boolPropertyValidator(path, varName))
            break
          }
          case PrimitiveType.number:
          case PrimitiveType.int:
          case PrimitiveType.integer:
          case PrimitiveType.double:
          case PrimitiveType.float: {
            validators.push(this.numberPropertyValidator(path, varName))
            break
          }
        }
      } else if (isObjectType(schema)) {
        validators.push(this.referenceValidator(path, varName, schema))
      } else if (isArrayType(schema)) {
        validators.push(this.arrayValidator(path, varName, schema))
        if (!isNil(schema.minLength)) {
          validators.push(this.arrayMinLengthChecker(path, varName, schema.minLength))
        }
        if (!isNil(schema.maxLength)) {
          validators.push(this.arrayMaxLengthChecker(path, varName, schema.maxLength))
        }
      }
    }
    return validators.join('\n')
  }

  arrayValidator(basePath: string, varName: string, schema: SchemaObject): string {
    if (!schema.items) {
      return null
    }
    const itemsSchema = isRefType(schema.items) ? this.registry.resolveRef(schema.items) : schema.items
    return `if(${this.presenceCheckCondition(varName)}) {
      for (let i=0; i<${varName}.length; i+=1 ) {
        const __item = ${varName}[i]
        ${this.propValidator(`${basePath}[\${i}]`, '__item', itemsSchema)}
      }
    }`
  }

  referenceValidator(path: string, varName: string, schema: SchemaObject): string {
    if (!this.registry.hasSchema(schema)) {
      return null
    }
    const np = this.registry.getNameProvider()
    const name = this.registry.getNameBySchema(schema)
    return `if(${this.presenceCheckCondition(varName)}) {
      results.push(...${np.getValidatorName(name)}(${varName}, \`${path}\`))
    }`
  }

  requiredPropertyValidator(prop: string, path: string, varName: string) {
    return `if(${varName}.${prop} === null || ${varName}.${prop} === undefined) {
      results.push({ message: '${prop} is required!', path: \`${path}\`})
    }`
  }

  minLengthChecker(message: (minLength: number) => string) {
    return (path: string, varName: string, minLength: number): string => {
      return `if(${this.presenceCheckCondition(varName)} && ${varName}.length < ${minLength}) {
        results.push({message: '${message(minLength)}', path: \`${path}\`})
      }`
    }
  }

  maxLengthChecker(message: (minLength: number) => string) {
    return (path: string, varName: string, maxLength: number): string => {
      return `if(${this.presenceCheckCondition(varName)} && ${varName}.length > ${maxLength}) {
        results.push({message: '${message(maxLength)}', path: \`${path}\`})
      }`
    }
  }

  minChecker(path: string, varName: string, min: number) {}

  stringMinLengthChecker = this.minLengthChecker((l) => `Should be at least ${l} charater(s)!`)
  arrayMinLengthChecker = this.minLengthChecker((l) => `Should have at least ${l} element(s)!`)
  stringMaxLengthChecker = this.maxLengthChecker((l) => `Should not be longer than ${l} charater(s)!`)
  arrayMaxLengthChecker = this.maxLengthChecker((l) => `Should not have more than ${l} element(s)!`)

  basicTypeCheckerValidator(type: string) {
    return (path: string, varName: string) => {
      return `if(${this.presenceCheckCondition(varName)} && typeof ${varName} !== '${type}') {
        results.push({message: 'Should be a ${type}!', path: \`${path}\`})
      }`
    }
  }
  stringPropertyValidator = this.basicTypeCheckerValidator('string')
  boolPropertyValidator = this.basicTypeCheckerValidator('boolean')
  numberPropertyValidator = this.basicTypeCheckerValidator('number')

  presenceCheckCondition(varName: string) {
    return `${varName} !== null && ${varName} !== undefined`
  }
}
