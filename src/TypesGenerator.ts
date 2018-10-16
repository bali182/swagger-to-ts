import { BaseGenerator } from './BaseGenerator'
import { TypeGenerator } from './TypeGenerator'

export class TypesGenerator extends BaseGenerator<void> {
  generate(): string {
    const typeGenerator = new TypeGenerator(this.registry)
    const source = this.registry
      .getTypeNames()
      .map((name) => typeGenerator.generate(name))
      .join('\n')
    return this.format(source)
  }
}
