import { BaseGenerator } from './BaseGenerator'
import { TypesGenerator } from './TypesGenerator'
import { ApiGenerator } from './ApiGenerator'
import { ParameterTypesGenerator } from './ParameterTypesGenerator'
import { StaticTypesGenerator } from './StaticTypesGenerator'
import { ApiTypeGenerator } from './ApiTypeGenerator'

export class RootGenerator extends BaseGenerator<void> {
  generate(): string {
    const generators = [
      new TypesGenerator(this.registry),
      new ParameterTypesGenerator(this.registry),
      new ApiTypeGenerator(this.registry),
      new StaticTypesGenerator(),
      new ApiGenerator(this.registry),
    ]
    return this.format(generators.map((g) => g.generate()).join('\n'))
  }
}
