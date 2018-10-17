import pascalCase from 'pascalcase'

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
  getNestedItemName(parentName: string): string {
    return `${parentName}ArrayItem`
  }
  getNestedOneOfName(parentName: string): string {
    return `${parentName}OneOf`
  }
  getNestedAnyOfName(parentName: string): string {
    return `${parentName}AnyOf`
  }
  getNestedAllOfName(parentName: string): string {
    return `${parentName}AllOf`
  }
}
