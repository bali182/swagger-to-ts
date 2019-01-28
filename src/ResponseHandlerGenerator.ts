import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { OperationWrapper } from './OperationWrapper'
import { TypeRefGenerator } from './TypeRefGenerator'
import { SchemaOrRef } from './typings'

export class ResponseHandlerGenerator extends BaseGenerator<OperationWrapper> {
  private readonly refGenerator: TypeRefGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.refGenerator = new TypeRefGenerator(this.registry)
  }

  generateReturnValue(types: SchemaOrRef[]): string {
    if (types.length === 0 || (types.length === 1 && types[0] === null)) {
      return ''
    } else if (types.every((t) => t !== null)) {
      const tString = types.map((t) => this.refGenerator.generate(t)).join('|')
      return `this.adapter.deserialize<${tString}>(response.body)`
    } else {
      throw new TypeError(`Can't handle multiple content-types!`)
    }
  }

  generateCaseBody(status: number, op: OperationWrapper): string {
    if (status >= 200 && status < 300) {
      return `Promise.resolve(${this.generateReturnValue(op.getResponseTypesForStatus(status))})`
    } else {
      return `Promise.reject(${this.generateReturnValue(op.getResponseTypesForStatus(status))})`
    }
  }

  generateSwitchBranches(op: OperationWrapper): string {
    const cases = op.getResponseStatuses().map((status) => {
      return `case ${status}: return ${this.generateCaseBody(status, op)}`
    })
    if (op.hasDefaultStatus()) {
      const value = this.generateReturnValue(op.getDefaultResponseTypes())
      cases.push(
        `default: return response.status >= 200 && response.status < 300 ? Promise.resolve(${value}) : Promise.reject(${value})`,
      )
    } else {
      cases.push(`default: return Promise.reject('Unexpected status!')`) // TODO
    }
    return cases.join('\n')
  }

  generateSwitch(op: OperationWrapper): string {
    return `switch(response.status) {
      ${this.generateSwitchBranches(op)}
    }`
  }

  generate(op: OperationWrapper): string {
    const statusesLength = op.getResponseStatuses().length + (op.hasDefaultStatus() ? 1 : 0)
    switch (statusesLength) {
      case 0:
        return `() => Promise.resolve()`
      default:
        const rawPType = op
          .getResolvedResponseTypes()
          .filter((t) => t !== null)
          .map((t) => this.refGenerator.generate(t))
          .join('|')
        const pType = rawPType.length > 0 ? rawPType : 'void'
        return `(response: __HttpResponse): Promise<${pType}> => {
          ${this.generateSwitch(op)}
        }`
    }
  }
}
