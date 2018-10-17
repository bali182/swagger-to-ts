import { OperationObject } from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import { isRefType, isRequestBody, isResponse } from './utils'
import { SchemaOrRef } from './typings'

export type HTTPMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

export class OperationWrapper {
  public readonly url: string
  public readonly method: HTTPMethod
  public readonly operation: OperationObject
  constructor(url: string, method: HTTPMethod, operation: OperationObject) {
    this.url = url
    this.method = method
    this.operation = operation
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
  getResponseBodyTypes(): SchemaOrRef[] {
    const types: SchemaOrRef[] = []
    for (const [, response] of entries(this.operation.responses || {})) {
      if (isRefType(response)) {
        types.push(response)
      } else if (isResponse(response) && response.content) {
        for (const [, mediaObj] of entries(response.content)) {
          if (mediaObj.schema) {
            types.push(mediaObj.schema)
          }
        }
      }
    }
    return types
  }
}
