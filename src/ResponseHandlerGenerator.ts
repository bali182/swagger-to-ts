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
      return `JSON.parse(body) as ${tString}`
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
      cases.push(`default: return status >= 200 && status < 300 ? Promise.resolve(${value}) : Promise.reject(${value})`)
    }
    return cases.join('\n')
  }

  generateSwitch(op: OperationWrapper): string {
    return `switch(status) {
      ${this.generateSwitchBranches(op)}
    }`
  }

  generate(op: OperationWrapper): string {
    const statusesLength = op.getResponseStatuses().length + (op.hasDefaultStatus() ? 1 : 0)
    switch (statusesLength) {
      case 0:
        return `() => Promise.resolve()`
      default:
        const pType = op
          .getResponseTypes()
          .map((t) => (t === null ? 'void' : this.refGenerator.generate(t)))
          .join('|')
        return `({body, status}: __Response): Promise<${pType}> => {
          ${this.generateSwitch(op)}
        }`
    }
  }
}
