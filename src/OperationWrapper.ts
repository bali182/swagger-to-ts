import {
  OperationObject,
  ResponseObject,
  ReferenceObject,
  ParameterObject,
  ParameterLocation,
  OpenApiSpec,
} from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import last from 'lodash/last'
import { isRefType, isRequestBody, isResponse, isParameter } from './utils'
import { SchemaOrRef } from './typings'

export type HTTPMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

export class OperationWrapper {
  public readonly url: string
  public readonly method: HTTPMethod
  public readonly operation: OperationObject
  private readonly spec: OpenApiSpec
  constructor(url: string, method: HTTPMethod, operation: OperationObject, spec: OpenApiSpec) {
    this.url = url
    this.method = method
    this.operation = operation
    this.spec = spec
  }
  getParameters(): ParameterObject[] {
    const params: (ParameterObject | ReferenceObject)[] = this.operation.parameters || []
    return params.map((paramOrRef) => {
      if (isParameter(paramOrRef)) {
        return paramOrRef
      } else if (isRefType(paramOrRef)) {
        const name = last(paramOrRef.$ref.split('/'))
        const resolvedParam = this.spec.components.parameters[name]
        if (!resolvedParam) {
          throw new Error(`Missing param '${name}'!`)
        }
        return resolvedParam
      }
    })
  }
  getPathParameters(): ParameterObject[] {
    return this.getParametersByLocation('path')
  }
  getQueryParameters(): ParameterObject[] {
    return this.getParametersByLocation('query')
  }
  getHeaderParameters(): ParameterObject[] {
    return this.getParametersByLocation('header')
  }
  getCookieParameters(): ParameterObject[] {
    return this.getParametersByLocation('cookie')
  }
  getParametersByLocation(loc: ParameterLocation): ParameterObject[] {
    return this.getParameters().filter((param) => param.in === loc)
  }
  getId(): string {
    return this.operation.operationId
  }
  getRequestBodyTypes(): SchemaOrRef[] {
    const types: SchemaOrRef[] = []
    const { requestBody } = this.operation
    if (isRefType(requestBody)) {
      types.push(requestBody)
    } else if (isRequestBody(requestBody)) {
      for (const [, mediaObj] of entries(requestBody.content)) {
        if (mediaObj.schema) {
          types.push(mediaObj.schema)
        }
      }
    }
    return types
  }
  getResponseTypes(): SchemaOrRef[] {
    const types: Set<SchemaOrRef> = new Set()
    for (const [, response] of entries(this.operation.responses || {})) {
      for (const type of this._getResponseTypes(response)) {
        types.add(type)
      }
    }
    return Array.from(types)
  }
  getResponseStatuses(): number[] {
    const statuses: number[] = []
    for (const [status] of entries(this.operation.responses || {})) {
      if (status !== 'default') {
        statuses.push(parseInt(status, 10))
      }
    }
    return statuses
  }
  hasDefaultStatus(): boolean {
    return Boolean((this.operation.responses || ({} as ResponseObject)).default)
  }
  private _getResponseTypes(res: ResponseObject | ReferenceObject): SchemaOrRef[] {
    if (isRefType(res)) {
      return [res]
    }
    if (isResponse(res)) {
      if (!res.content) {
        return [null]
      } else {
        const types = new Set<SchemaOrRef>()
        for (const [, mediaObj] of entries(res.content)) {
          if (mediaObj.schema) {
            types.add(mediaObj.schema)
          } else {
            types.add(null)
          }
        }
        return Array.from(types)
      }
    }
    return [null]
  }
  getDefaultResponseTypes(): SchemaOrRef[] {
    return this._getResponseTypes((this.operation.responses || ({} as ResponseObject)).default)
  }
  getResponseTypesForStatus(status: number): SchemaOrRef[] {
    return this._getResponseTypes((this.operation.responses || ({} as ResponseObject))[status])
  }
}
