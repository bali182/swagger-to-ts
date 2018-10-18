import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { TypeRefGenerator } from './TypeRefGenerator'
import { OperationObject } from 'openapi3-ts'
import { RefOrParameter } from './typings'
import { isReferenceObject } from '@loopback/openapi-v3-types'

export class ParameterTypeGenerator extends BaseGenerator<string> {
  private readonly refGenerator: TypeRefGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.refGenerator = new TypeRefGenerator(this.registry)
  }

  generateParameterField(param: RefOrParameter): string {
    if (isReferenceObject(param)) {
      throw new TypeError(`Can't handle this!!!`)
    }
    const colon = param.required ? ':' : '?:'
    return `${param.name}${colon} ${this.refGenerator.generate(param.schema)}`
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
