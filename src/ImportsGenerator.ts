import { BaseGenerator } from './BaseGenerator'
import { GeneratorIds } from './typings'

export class ImportsGenerator extends BaseGenerator<void> {
  generate(): string {
    const { registry } = this
    const { apiContractPath, typesPath, targets } = registry.getArgs()
    const np = registry.getNameProvider()
    const imports: string[] = []
    if (apiContractPath && targets.indexOf(GeneratorIds.ApiContract) < 0) {
      imports.push(`import * as ${np.getApiContractImport()} from '${apiContractPath}'`)
    }
    if (typesPath && targets.indexOf(GeneratorIds.Types) < 0) {
      imports.push(`import * as ${np.getTypesImport()} from '${typesPath}'`)
    }
    if (imports.length > 0) {
      imports.push('')
    }
    return imports.join('\n')
  }
}
