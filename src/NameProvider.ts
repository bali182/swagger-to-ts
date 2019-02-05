import pascalCase from 'pascalcase'
import camelCase from 'camel-case'
import { Args, GeneratorIds } from './typings'

export class NameProvider {
  private readonly args: Args
  constructor(args: Args) {
    this.args = args
  }
  addTypeNamespace(input: string) {
    return this.args.typesPath && this.args.targets.indexOf(GeneratorIds.Types) < 0
      ? `${this.getTypesImport()}.${input}`
      : input
  }
  addApiContractNamespace(input: string) {
    return this.args.apiContractPath && this.args.targets.indexOf(GeneratorIds.ApiContract) < 0
      ? `${this.getApiContractImport()}.${input}`
      : input
  }
  getEnumConstantName(name: string): string {
    return pascalCase(name)
  }
  getTypeName(name: string): string {
    return pascalCase(name)
  }
  getNestedTypeName(parentName: string, name: string): string {
    return `${parentName}${pascalCase(name)}`
  }
  getParametersTypeName(operationName: string): string {
    return `${pascalCase(operationName)}Params`
  }
  getParameterTypeName(operationName: string, paramName): string {
    return `${this.getParametersTypeName(operationName)}${pascalCase(paramName)}`
  }
  getNestedItemName(parentName: string): string {
    return `${parentName}ArrayItem`
  }
  getNestedOneOfName(parentName: string, no: number): string {
    return `${parentName}OneOf${no}`
  }
  getNestedAnyOfName(parentName: string, no: number): string {
    return `${parentName}AnyOf${no}`
  }
  getNestedAllOfName(parentName: string, no: number): string {
    return `${parentName}AllOf${no}`
  }
  getRequestBodyTypeName(operationName: string, method: string): string {
    return `${pascalCase(operationName)}${pascalCase(method)}RequestBody`
  }
  getResponseTypeName(operationName: string, method: string): string {
    return `${pascalCase(operationName)}${pascalCase(method)}Response`
  }
  getApiTypeName(): string {
    return this.args.apiTypeName
  }
  getApiImplName(): string {
    return `${this.getApiTypeName()}Impl`
  }
  getOperatioName(id: string): string {
    return camelCase(id)
  }
  getTypeGuardName(typeName: string) {
    return `is${pascalCase(typeName)}`
  }
  getValidatorName(typeName: string) {
    return `validate${pascalCase(typeName)}`
  }
  getTypesImport(): string {
    return '__T'
  }
  getApiContractImport(): string {
    return '__A'
  }
}
