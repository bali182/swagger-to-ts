import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { TypeRefGenerator } from './TypeRefGenerator'
import { OperationWrapper } from './OperationWrapper'
import startsWith from 'lodash/startsWith'
import endsWith from 'lodash/endsWith'

export class OperationGenerator extends BaseGenerator<string> {
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
      const type = this.registry.getNameProvider().getParametersTypeName(op.getId())
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
    const resTypes = op.getResponseBodyTypes()
    const { refGenerator } = this
    switch (resTypes.length) {
      case 0:
        return `void`
      case 1:
        return refGenerator.generate(resTypes[0])
      default:
        return refGenerator.generate({ oneOf: resTypes })
    }
  }

  generateUrlValue(op: OperationWrapper): string {
    const segments = op.url.split('/').filter((s) => s.length > 0)
    const replacedSegments = segments.map((segment) => {
      if (startsWith(segment, '{') && endsWith(segment, '}')) {
        const varName = segment.substring(1, segment.length - 1)
        return `\${params.${varName}}`
      }
      return segment
    })
    const partialUrl = replacedSegments.join('/')
    return `\`\${this.getBaseUrl()}/${partialUrl}\``
  }

  generateHeadersValue(op: OperationWrapper): string {
    return `this.getDefaultHeaders()`
  }

  generateBodyValue(op: OperationWrapper): string {
    const bodyType = this.generateBodyParameter(op)
    return `${bodyType === null ? 'undefined' : `JSON.stringify(content)`}`
  }

  generateResponseHandler(op: OperationWrapper) {
    const resTypes = op.getResponseBodyTypes()
    switch (resTypes.length) {
      case 0:
        return `() => undefined`
      default:
        return `(response) => JSON.parse(response.body) as ${this.generatePromiseInnerType(op)}`
    }
  }

  generate(id: string): string {
    const op = this.registry.getOperation(id)
    return `${id}(${this.generateParameters(op)}): ${this.generateReturnType(op)} {
      const request: __Request = {
        url: ${this.generateUrlValue(op)},
        method: '${op.method.toUpperCase()}',
        headers: ${this.generateHeadersValue(op)},
        body: ${this.generateBodyValue(op)},
      }
      return this.execute(request).then(${this.generateResponseHandler(op)})
    }`
  }
}
