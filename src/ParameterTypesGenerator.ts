import { BaseGenerator } from './BaseGenerator'
import { ParameterTypeGenerator } from './ParameterTypeGenerator'

export class ParameterTypesGenerator extends BaseGenerator<void> {
  generate(): string {
    if (this.registry.getOperations().some((op) => op.getCookieParameters().length > 0)) {
      throw new Error(`Can't use Cookie parameters at the moment!`)
    }
    const generator = new ParameterTypeGenerator(this.registry)
    return this.registry
      .getOperationIds()
      .map((id) => generator.generate(id))
      .filter((source) => source !== null)
      .join('\n')
  }
}
