import { BaseGenerator } from './BaseGenerator'
import { OperationWrapper } from './OperationWrapper'
import { ParameterObject } from 'openapi3-ts'
import { isSimpleType, isArrayType, isObjectType } from './utils'

import endsWith from 'lodash/endsWith'
import startsWith from 'lodash/startsWith'
import isVarName from 'is-var-name'

export class UrlGenerator extends BaseGenerator<OperationWrapper> {
  generatePathSegment(param: ParameterObject): string {
    if (param.style && param.style !== 'simple') {
      throw new TypeError(`Only "simple" path parameters are allowed ("${param.style}" found}!`)
    }
    const value = isVarName(param.name) ? `params.${param.name}` : `params['${param.name}']`
    if (!param.schema || isSimpleType(param.schema)) {
      return value
    } else if (isArrayType(param.schema)) {
      return `${value}.join(',')`
    } else if (isObjectType(param.schema)) {
      if (param.explode) {
        return `Object.keys(${value}).map((key) => \`\${key}=${value}[\${key}]\`).join(',')`
      } else {
        return `Object.keys(${value}).map((key) => \`\${key},${value}[\${key}]\`).join(',')`
      }
    } else if (isObjectType(param.schema) && !param.explode) {
    } else {
      throw new TypeError(`Can't create serializer for param "${param.name}"`)
    }
  }

  generateQuerySegment(param: ParameterObject): string {
    if (param.style && param.style !== 'form') {
      throw new TypeError(`Only "form" query parameters are allowed ("${param.style}" found}!`)
    }
    const key = param.name
    const value = `params.${param.name}`
    if (!param.schema || isSimpleType(param.schema)) {
      const segment = `\`${key}=\${${value}}\``
      return param.required ? segment : `${value} === undefined ? null : ${segment}`
    } else if (isArrayType(param.schema)) {
      if (param.explode || param.explode === undefined) {
        const segment = `${value}.map((e) => \`${key}=\${e}\`).join('&')`
        const withEmptyCheck = `${value}.length === 0 ? null : ${segment}`
        return param.required ? withEmptyCheck : `${value} === undefined || ${withEmptyCheck}`
      }
    }
    throw new TypeError(`Can't generate query parameter: "${param.name}"!`)
  }

  generateUrlQuerySegments(op: OperationWrapper): string {
    const items = op
      .getQueryParameters()
      .map((param) => this.generateQuerySegment(param))
      .join(',\n')
    return `[${items}]`
  }

  generateUrlPath(op: OperationWrapper): string {
    const segments = op.url.split('/').filter((s) => s.length > 0)
    const pathParams = op.getPathParameters()
    const replacedSegments = segments.map((segment) => {
      if (startsWith(segment, '{') && endsWith(segment, '}')) {
        const paramName = segment.substring(1, segment.length - 1)
        const param = pathParams.find(({ name }) => name === paramName)
        if (!param) {
          throw new TypeError(`"${paramName}" is not a valid parameter in the URL of operation ${op.getId()}`)
        }
        return `\${${this.generatePathSegment(param)}}`
      }
      return segment
    })
    return replacedSegments.join('/')
  }

  quotePath(path: string, hasVars: boolean) {
    return hasVars ? `\`${path}\`` : `'${path}'`
  }

  generateWithoutQuerySegments(op: OperationWrapper) {
    if (op.getPathParameters().length > 0) {
      return `\`/${this.generateUrlPath(op)}\``
    }
    return `'/${this.generateUrlPath(op)}'`
  }

  generateWithQuerySegments(op: OperationWrapper): string {
    const querySegments = this.generateUrlQuerySegments(op)
    return `(() => {
      const querySegments = ${querySegments}
      const queryString = querySegments.filter((segment) => segment !== null).join('&')
      const query = queryString.length === 0 ? '' : \`?\${queryString}\`
      return \`\/${this.generateUrlPath(op)}\${query}\`
    })()`
  }

  generate(op: OperationWrapper): string {
    if (op.getQueryParameters().length > 0) {
      return this.generateWithQuerySegments(op)
    } else {
      return this.generateWithoutQuerySegments(op)
    }
  }
}
