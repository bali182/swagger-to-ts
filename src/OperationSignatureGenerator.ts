import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { TypeRefGenerator } from './TypeRefGenerator'
import { OperationWrapper } from './OperationWrapper'
import { unique } from './utils'

export class OperationSignatureGenerator extends BaseGenerator<string> {
  private readonly refGenerator: TypeRefGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.refGenerator = new TypeRefGenerator(this.registry)
  }

  generateBodyParameter(op: OperationWrapper): string {
    const reqTypes = op.getRequestBodyTypes()
    const { refGenerator } = this
    switch (reqTypes.length) {
      case 0:
        return null
      case 1:
        return `content: ${refGenerator.generate(reqTypes[0])}`
      default:
        return `content: ${refGenerator.generate({ oneOf: reqTypes })}`
    }
  }

  generateParamsParameter(op: OperationWrapper): string {
    if (op.operation.parameters && op.operation.parameters.length > 0) {
      const np = this.registry.getNameProvider()
      const type = np.addTypeNamespace(np.getParametersTypeName(op.getId()))
      return `params: ${type}`
    }
    return null
  }

  generateParameters(op: OperationWrapper): string {
    const params = [this.generateParamsParameter(op), this.generateBodyParameter(op)]
    return params.filter((code) => code !== null).join(',')
  }

  generateReturnType(op: OperationWrapper): string {
    return `Promise<${this.generatePromiseInnerType(op)}>`
  }

  generatePromiseInnerType(op: OperationWrapper): string {
    const resTypes = op.getResolvedResponseTypes()
    const { refGenerator } = this
    switch (resTypes.length) {
      case 0:
        return 'void'
      default:
        if (resTypes.every((t) => t === null)) {
          return 'void'
        }
        return unique(resTypes.filter((t) => t !== null).map((t) => refGenerator.generate(t))).join(' | ')
    }
  }

  generate(id: string): string {
    const op = this.registry.getOperation(id)
    const name = this.registry.getNameProvider().getOperatioName(id)
    return `${name}(${this.generateParameters(op)}): ${this.generateReturnType(op)}`
  }
}
