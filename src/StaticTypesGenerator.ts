import { IGenerator, GeneratorIds } from './typings'
import { readFileSync } from 'fs'
import { join } from 'path'

const apiTypes = readFileSync(join(__dirname, '../', 'ApiStaticTypes.ts'), 'utf-8')
const validatorTypes = readFileSync(join(__dirname, '../', 'ValidatorStaticTypes.ts'), 'utf-8')

export class StaticTypesGenerator implements IGenerator<void> {
  constructor(private readonly id: GeneratorIds) {}
  generate() {
    switch (this.id) {
      case GeneratorIds.Api:
        return apiTypes.trim()
      case GeneratorIds.Validators:
        return validatorTypes.trim()
    }
    return ''
  }
}
