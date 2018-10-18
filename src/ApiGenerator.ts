import { BaseGenerator } from './BaseGenerator'
import { OperationGenerator } from './OperationGenerator'

export class ApiGenerator extends BaseGenerator<void> {
  generate(): string {
    const np = this.registry.getNameProvider()
    const opGenerator = new OperationGenerator(this.registry)
    const fns = this.registry
      .getOperationIds()
      .map((id) => opGenerator.generate(id))
      .join('\n')
    return `export abstract class ${np.getApiImplName()} implements ${np.getApiTypeName()} {
      abstract execute(request: __Request): Promise<__Response>
      abstract getBaseUrl(): string
      abstract getDefaultHeaders(): {[key: string]: string}
      ${fns}
    }`
  }
}
