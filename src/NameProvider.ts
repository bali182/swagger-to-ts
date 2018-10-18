import pascalCase from 'pascalcase'
import camelCase from 'camel-case'

export class NameProvider {
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
    return 'Api'
  }
  getApiImplName(): string {
    return 'BaseApiImpl'
  }
  getOperatioName(id: string): string {
    return camelCase(id)
  }
}
