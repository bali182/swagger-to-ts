import { BaseGenerator } from './BaseGenerator'
import { ValidatorGenerator } from './ValidatorGenerator'

export class ValidatorsGenerator extends BaseGenerator<void> {
  generate(): string {
    const generator = new ValidatorGenerator(this.registry)
    return this.registry
      .getTypes()
      .map((type) => generator.generate(type.name))
      .join('\n')
  }
}
