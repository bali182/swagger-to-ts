import { BaseGenerator } from './BaseGenerator'
import { TypeRegistry } from './TypeRegistry'
import { OperationWrapper } from './OperationWrapper'
import { OperationSignatureGenerator } from './OperationSignatureGenerator'
import { ResponseHandlerGenerator } from './ResponseHandlerGenerator'
import { UrlGenerator } from './UrlGenerator'

export class OperationGenerator extends BaseGenerator<string> {
  private readonly signatureGenerator: OperationSignatureGenerator
  private readonly handlerGenerator: ResponseHandlerGenerator
  private readonly urlGenerator: UrlGenerator

  constructor(registry: TypeRegistry) {
    super(registry)
    this.signatureGenerator = new OperationSignatureGenerator(this.registry)
    this.handlerGenerator = new ResponseHandlerGenerator(this.registry)
    this.urlGenerator = new UrlGenerator(this.registry)
  }

  generateHeadersValue(op: OperationWrapper): string {
    return `this.getDefaultHeaders()`
  }

  generateBody(op: OperationWrapper): string {
    const bodyType = this.signatureGenerator.generateBodyParameter(op)
    if (bodyType === null) {
      return ''
    }
    return 'body: JSON.stringify(content),'
  }

  generateOperationBody(op: OperationWrapper): string {
    return `const request: __Request = {
        url: ${this.urlGenerator.generate(op)},
        method: '${op.method.toUpperCase()}',
        headers: ${this.generateHeadersValue(op)},
        ${this.generateBody(op)}
      }
      return this.execute(request).then(${this.handlerGenerator.generate(op)})`
  }

  generate(id: string): string {
    return `${this.signatureGenerator.generate(id)} {
      ${this.generateOperationBody(this.registry.getOperation(id))}
    }`
  }
}
