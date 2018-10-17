import { BaseGenerator } from './BaseGenerator'
import { OperationGenerator } from './OperationGenerator'

export class ApiGenerator extends BaseGenerator<void> {
  generate(): string {
    const opGenerator = new OperationGenerator(this.registry)
    const fns = this.registry
      .getOperationIds()
      .map((id) => opGenerator.generate(id))
      .join('\n')
    return `
    export type __Request = {
      url: string
      method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE'
      body: string
      headers: { [key: string]: string }
    }
    export type __Response = {
      // status: number (We don't need it for now)
      body: string
    }
    export abstract class AbstractApi {
      abstract execute(request: __Request): Promise<__Response>
      abstract getBaseUrl(): string
      abstract getDefaultHeaders(): {[key: string]: string}
      ${fns}
    }`
  }
}
