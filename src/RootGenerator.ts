import { BaseGenerator } from './BaseGenerator'
import { TypesGenerator } from './TypesGenerator'
import { ApiGenerator } from './ApiGenerator'
import { ParameterTypesGenerator } from './ParameterTypesGenerator'
import { StaticTypesGenerator } from './StaticTypesGenerator'
import { ApiTypeGenerator } from './ApiTypeGenerator'
import { TypeGuardsGenerator } from './TypeGuardsGenerator'
import { ValidatorsGenerator } from './ValidatorsGenerator'
import { GeneratorIds } from './typings'
import { ImportsGenerator } from './ImportsGenerator'

export class RootGenerator extends BaseGenerator<void> {
  generate() {
    const { targets } = this.registry.getArgs()
    const results: string[] = []
    if (targets.indexOf(GeneratorIds.Types) >= 0) {
      results.push(this.generateTypes())
    }
    if (targets.indexOf(GeneratorIds.ApiContract) >= 0) {
      results.push(this.generateApiContract())
    }
    if (targets.indexOf(GeneratorIds.TypeGuards) >= 0) {
      results.push(this.generateTypeGuards())
    }
    if (targets.indexOf(GeneratorIds.Api) >= 0) {
      results.push(this.generateApi())
    }
    if (targets.indexOf(GeneratorIds.Validators) >= 0) {
      results.push(this.generateValidators())
    }
    return this.format(results.join('\n'))
  }

  generateTypes() {
    return [new TypesGenerator(this.registry), new ParameterTypesGenerator(this.registry)]
      .map((generator) => generator.generate())
      .join('\n')
  }

  generateApiContract() {
    return [new ImportsGenerator(this.registry), new ApiTypeGenerator(this.registry)]
      .map((generator) => generator.generate())
      .join('\n')
  }
  generateTypeGuards() {
    return [new ImportsGenerator(this.registry), new TypeGuardsGenerator(this.registry)]
      .map((generator) => generator.generate())
      .join('\n')
  }
  generateApi() {
    return [
      new ImportsGenerator(this.registry),
      new StaticTypesGenerator(GeneratorIds.Api),
      new ApiGenerator(this.registry),
    ]
      .map((generator) => generator.generate())
      .join('\n')
  }
  generateValidators() {
    return [
      new ImportsGenerator(this.registry),
      new StaticTypesGenerator(GeneratorIds.Validators),
      new ValidatorsGenerator(this.registry),
    ]
      .map((generator) => generator.generate())
      .join('\n')
  }
}
