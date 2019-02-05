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
  getDiscriminators,
} from './utils'
import { SchemaOrRef } from './typings'
import entries from 'lodash/entries'
import isNil from 'lodash/isNil'
import camelCase from 'camel-case'

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
        return this.oneOfValidator('input', schema)
      }
      if (schema.oneOf.length === 1) {
        const oneOf = schema.oneOf[0]
        const name = isRefType(oneOf) ? getRefName(oneOf.$ref) : this.registry.getNameBySchema(oneOf)
        const validatorName = this.registry.getNameProvider().getValidatorName(name)
        return `if(!(input instanceof Object)) {
          results.push({ path, message: 'Should be an object!' })
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
    const validators: string[] = []
    const discriminators = getDiscriminators(schema, this.registry)
    if (discriminators && discriminators.length > 0) {
      discriminators.forEach(({ propertyName, value }) =>
        validators.push(
          this.discriminatorValidator(`\${path}.${propertyName}`, accessor('input', propertyName), value),
        ),
      )
    }
    entries(schema.properties || {})
      .filter(([name]) => name !== 'traversableAgain' && name !== 'empty') // TODO scala collection bullshit
      .map(([name, propSchema]) =>
        this.propertyValidator(name, propSchema, schema.required && schema.required.indexOf(name) >= 0),
      )
      .filter((str) => str !== null && str.length > 0)
      .forEach((v) => validators.push(v))

    return `if(input === null || input === undefined || !(input instanceof Object)) {
      results.push({ path, message: 'Should be an object!' })
    } else {
      ${validators.join('\n')}
    }`
  }
  enumValidator(schema: SchemaObject) {
    const stringCheck = `if (typeof input !== 'string') {
      results.push({ path, message: 'Should represented as a string!' })
    }`
    const enumName = this.registry.getNameBySchema(schema)
    const valuesConstName = `${camelCase(enumName)}Values`
    const values = `${schema.enum.map((v) => `"${v}"`).join(', ')}`
    const enumValueCheck = `const ${valuesConstName} = [${values}]
    if(${valuesConstName}.indexOf(input) < 0) {
      results.push({ path, message: \`Should be one of \${${valuesConstName}.map((v) => \`"\${v}"\`).join(", ")}!\`})
    }`
    return [stringCheck, enumValueCheck].join('\n')
  }
  oneOfValidator(path: string, schema: SchemaObject) {
    const { mapping, propertyName } = schema.discriminator
    const defaultPath = `${path}.${propertyName}`
    return `if(input === null || input === undefined || !(input instanceof Object)) {
      results.push({ path, message: 'Should be an object!' })
    } else {
      switch(input.${propertyName}) {
        ${entries(mapping)
          .map(([value, ref]) => this.oneOfDispatcher(value, ref))
          .join('\n')}
        default: results.push({ path: \`${defaultPath}\`, message: \`Unexpected discriminator "\${(input as any).${propertyName}}"!\` })
      }
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
      validators.push(this.requiredPropertyValidator(path, accessor('input', prop)))
    }
    const schema = isRefType(propSchema) ? this.registry.resolveRef(propSchema) : propSchema
    validators.push(this.propValidator(path, accessor('input', prop), schema))
    return validators.join('\n')
  }

  discriminatorValidator(path: string, varName: string, value: string): string {
    return `if(${varName} !== '${value}') {
      results.push({path: \`${path}\`, message: 'Should be "${value}"!'})
    }`
  }

  propValidator(path: string, varName: string, schema: SchemaObject): string {
    const validators: string[] = []
    if (schema) {
      if (isObjectType(schema) || isEnumType(schema)) {
        validators.push(this.referenceValidator(path, varName, schema))
      } else if (isSimpleType(schema)) {
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
        const item = ${varName}[i]
        ${this.propValidator(`${basePath}[\${i}]`, 'item', itemsSchema)}
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

  requiredPropertyValidator(path: string, varName: string) {
    return `if(${varName} === null || ${varName} === undefined) {
      results.push({ path: \`${path}\`, message: 'Should not be empty!'})
    }`
  }

  minLengthChecker(message: (minLength: number) => string) {
    return (path: string, varName: string, minLength: number): string => {
      return `if(${this.presenceCheckCondition(varName)} && ${varName}.length < ${minLength}) {
        results.push({ path: \`${path}\`, message: '${message(minLength)}' })
      }`
    }
  }

  maxLengthChecker(message: (minLength: number) => string) {
    return (path: string, varName: string, maxLength: number): string => {
      return `if(${this.presenceCheckCondition(varName)} && ${varName}.length > ${maxLength}) {
        results.push({ path: \`${path}\`, message: '${message(maxLength)}' })
      }`
    }
  }

  stringMinLengthChecker = this.minLengthChecker((l) => `Should be at least ${l} charater(s)!`)
  arrayMinLengthChecker = this.minLengthChecker((l) => `Should have at least ${l} element(s)!`)
  stringMaxLengthChecker = this.maxLengthChecker((l) => `Should not be longer than ${l} charater(s)!`)
  arrayMaxLengthChecker = this.maxLengthChecker((l) => `Should not have more than ${l} element(s)!`)

  basicTypeCheckerValidator(type: string) {
    return (path: string, varName: string) => {
      return `if(${this.presenceCheckCondition(varName)} && typeof ${varName} !== '${type}') {
        results.push({ path: \`${path}\`, message: 'Should be a ${type}!' })
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
