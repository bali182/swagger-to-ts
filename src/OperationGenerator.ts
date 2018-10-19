import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { OperationWrapper } from './OperationWrapper'
import startsWith from 'lodash/startsWith'
import endsWith from 'lodash/endsWith'
import { OperationSignatureGenerator } from './OperationSignatureGenerator'
import { ResponseHandlerGenerator } from './ResponseHandlerGenerator'

export class OperationGenerator extends BaseGenerator<string> {
  private readonly signatureGenerator: OperationSignatureGenerator
  private readonly handlerGenerator: ResponseHandlerGenerator
  constructor(registry: TypeRegistry) {
    super(registry)
    this.signatureGenerator = new OperationSignatureGenerator(this.registry)
    this.handlerGenerator = new ResponseHandlerGenerator(this.registry)
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
    const bodyType = this.signatureGenerator.generateBodyParameter(op)
    return `${bodyType === null ? 'undefined' : `JSON.stringify(content)`}`
  }

  generateOperationBody(op: OperationWrapper): string {
    return `const request: __Request = {
        url: ${this.generateUrlValue(op)},
        method: '${op.method.toUpperCase()}',
        headers: ${this.generateHeadersValue(op)},
        body: ${this.generateBodyValue(op)},
      }
      return this.execute(request).then(${this.handlerGenerator.generate(op)})`
  }

  generate(id: string): string {
    return `${this.signatureGenerator.generate(id)} {
      ${this.generateOperationBody(this.registry.getOperation(id))}
    }`
  }
}
