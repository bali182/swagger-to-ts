import { BaseGenerator } from './BaseGenerator'
import { SchemaObject } from 'openapi3-ts'
import { isOneOfType, isObjectType, getRefName } from './utils'
import entries from 'lodash/entries'
import flatMap from 'lodash/flatMap'

export class TypeGuardsGenerator extends BaseGenerator<void> {
  generate(): string {
    const types = this.registry.getTypes().filter((type) => this.needsTypeGuard(type.schema))
    return flatMap(types, (type) => {
      return entries(type.schema.discriminator.mapping).map(([propertyValue, ref]) => {
        const baseTypeName = type.name
        const checkedTypeName = getRefName(ref)
        const propertyName = type.schema.discriminator.propertyName
        return this.generateTypeGuard(baseTypeName, checkedTypeName, propertyName, propertyValue)
      })
    }).join('\n')
  }

  generateTypeGuard(
    baseTypeName: string,
    checkedTypeName: string,
    propertyName: string,
    propertyValue: string,
  ): string {
    const np = this.registry.getNameProvider()
    const tgName = np.getTypeGuardName(checkedTypeName)
    return `export function ${tgName}(input: ${np.addTypeNamespace(baseTypeName)}): input is ${np.addTypeNamespace(
      checkedTypeName,
    )} {
      return input && input.${propertyName} === '${propertyValue}'
    }`
  }

  needsTypeGuard(type: SchemaObject): boolean {
    return (
      isOneOfType(type) &&
      isObjectType(type) &&
      Boolean(type.discriminator) &&
      Boolean(type.discriminator.mapping) &&
      Boolean(type.discriminator.propertyName)
    )
  }
}
