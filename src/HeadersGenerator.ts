import { BaseGenerator } from './BaseGenerator'
import { OperationWrapper } from './OperationWrapper'
import { ParameterObject } from 'openapi3-ts'
import { isSimpleType, isArrayType, isObjectType } from './utils'
import isVarName from 'is-var-name'

export class HeadersGenerator extends BaseGenerator<OperationWrapper> {
  generateValueAccess(param: ParameterObject): string {
    return isVarName(param.name) ? `params.${param.name}` : `params['${param.name}']`
  }
  generateKey(param: ParameterObject): string {
    return isVarName(param.name) ? param.name : `'${param.name}'`
  }

  generateValue(param: ParameterObject): string {
    if (param.style && param.style !== 'simple') {
      throw new TypeError(`Only "simple" header parameters are allowed ("${param.style}" found}!`)
    }
    const value = this.generateValueAccess(param)
    if (!param.schema || isSimpleType(param.schema)) {
      return `String(${value})`
    } else if (isArrayType(param.schema)) {
      return `${value}.join(',')`
    } else if (isObjectType(param.schema)) {
      if (param.explode) {
        return `Object.keys(${value}).map((key) => \`\${key}=${value}[\${key}]\`).join(',')`
      } else {
        return `Object.keys(${value}).map((key) => \`\${key},${value}[\${key}]\`).join(',')`
      }
    } else {
      throw new TypeError(`Can't create serializer for param "${param.name}"`)
    }
  }

  generateHeaderKeyValuePair(param: ParameterObject): string {
    const requiredKVPair = `${this.generateKey(param)}: ${this.generateValue(param)}`
    if (param.required) {
      return requiredKVPair
    } else {
      const value = this.generateValueAccess(param)
      return `...(${value} === undefined ? {} : {${requiredKVPair}})`
    }
  }
  generate(op: OperationWrapper): string {
    const kvPairs = op
      .getHeaderParameters()
      .map((param) => this.generateHeaderKeyValuePair(param))
      .join(',')
    return `{ ${kvPairs} }`
  }
}
