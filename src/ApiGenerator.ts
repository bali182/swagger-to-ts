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
    return `export class ${np.getApiImplName()} implements ${np.addApiContractNamespace(np.getApiTypeName())} {
      private readonly adapter: __HttpAdapter 
      constructor(adapter: __HttpAdapter) {
        this.adapter = adapter
      }
      ${fns}
    }`
  }
}
