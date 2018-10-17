import { OperationObject, SchemaObject, ReferenceObject } from '@loopback/openapi-v3-types'
import entries from 'lodash/entries'
import { isRefType, isRequestBody } from './utils'

export type HTTPMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'
export type SchemaOrRef = SchemaObject | ReferenceObject

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
    for (const [, body] of entries(this.operation.requestBody)) {
      if (isRefType(body)) {
        types.push(body)
      } else if (isRequestBody(body)) {
        for (const [, mediaObj] of entries(body.content)) {
          if (mediaObj.schema) {
            types.push(mediaObj.schema)
          }
        }
      }
    }
    return types
  }
}
