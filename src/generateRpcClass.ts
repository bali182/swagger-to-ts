import { PathsObject, PathItemObject, OperationObject } from '@loopback/openapi-v3-types'

type HTTPMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace'

function generateOperation(path: string, method: HTTPMethod, operation: OperationObject): string {
  operation.responses
  return `${operation.operationId}(): Promise<any> {
    return null
  }`
}

function generatePathContent(path: string, item: PathItemObject): string {
  const code = [
    item.get ? generateOperation(path, 'get', item.get) : null,
    item.put ? generateOperation(path, 'put', item.put) : null,
    item.post ? generateOperation(path, 'post', item.post) : null,
    item.delete ? generateOperation(path, 'delete', item.delete) : null,
    item.options ? generateOperation(path, 'options', item.options) : null,
    item.head ? generateOperation(path, 'head', item.head) : null,
    item.patch ? generateOperation(path, 'patch', item.patch) : null,
    item.trace ? generateOperation(path, 'trace', item.trace) : null,
  ]
  return code.filter((s) => s !== null).join('\n')
}

function generatePaths(paths: PathsObject): string {
  return Object.keys(paths)
    .map((path) => generatePathContent(path, paths[path] as PathItemObject))
    .join('\n')
}

export function generateRpcClass(paths: PathsObject): string {
  return `export class Api {
    ${generatePaths(paths)}
  }`
}
