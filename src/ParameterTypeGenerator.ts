import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { TypeRefGenerator } from './TypeRefGenerator'
import { OperationObject } from 'openapi3-ts'
import { RefOrParameter } from './typings'
import { isRefType } from './utils'
import isVarName from 'is-var-name'

export class ParameterTypeGenerator extends BaseGenerator<string> {
  private readonly refGenerator: TypeRefGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.refGenerator = new TypeRefGenerator(this.registry)
  }

  generateParameterField(param: RefOrParameter): string {
    if (isRefType(param)) {
      throw new TypeError(`Can't handle this!!!`)
    }
    const colon = param.required || param.in === 'path' ? ':' : '?:'
    const paramName = isVarName(param.name) ? param.name : `'${param.name}'`
    return `${paramName}${colon} ${this.refGenerator.generate(param.schema)}`
  }

  generateParamsType(op: OperationObject): string {
    const name = this.registry.getNameProvider().getParametersTypeName(op.operationId)
    return `export type ${name} = {
      ${op.parameters.map((param) => this.generateParameterField(param))}
    }`
  }

  generate(operationId: string): string {
    const op = this.registry.getOperation(operationId)
    if (!op.operation.parameters || op.operation.parameters.length === 0) {
      return null
    }
    return this.generateParamsType(op.operation)
  }
}
