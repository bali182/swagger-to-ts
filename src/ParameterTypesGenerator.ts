import { BaseGenerator } from './BaseGenerator'
import { ParameterTypeGenerator } from './ParameterTypeGenerator'

export class ParameterTypesGenerator extends BaseGenerator<void> {
  generate(): string {
    const generator = new ParameterTypeGenerator(this.registry)
    return this.registry
      .getOperationIds()
      .map((id) => generator.generate(id))
      .filter((source) => source !== null)
      .join('\n')
  }
}
