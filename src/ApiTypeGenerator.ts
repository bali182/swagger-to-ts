import { BaseGenerator } from './BaseGenerator'
import { OperationSignatureGenerator } from './OperationSignatureGenerator'

export class ApiTypeGenerator extends BaseGenerator<void> {
  generate(): string {
    const signatureGen = new OperationSignatureGenerator(this.registry)
    const fns = this.registry
      .getOperationIds()
      .map((id) => signatureGen.generate(id))
      .join('\n')
    return `export type ${this.registry.getNameProvider().getApiTypeName()} = {
      ${fns}
    }`
  }
}
