export function isPresent(varName: string): string {
  return `${varName} !== null && ${varName} !== undefined`
}

export function isAbsent(varName: string): string {
  return `${varName} === null || ${varName} === undefined`
}

export function isTypeOf(varName: string, type: string) {
  return `typeof ${varName} === '${type}'`
}

export function isNotTypeOf(varName: string, type: string) {
  return `typeof ${varName} !== '${type}'`
}

export function isObject(varName: string): string {
  return `(${varName} instanceof Object && !Array.isArray(${varName}))`
}

export function isNotObject(varName: string): string {
  return `(!(${varName} instanceof Object) || Array.isArray(${varName}))`
}

export function isArray(varName: string) {
  return `Array.isArray(${varName})`
}

export function isNotArray(varName: string) {
  return `!Array.isArray(${varName})`
}

export function isNotEqualString(varName: string, value: string): string {
  return `${varName} !== '${value}'`
}

export function forLoopCounter(arrayName: string, index: string = 'i') {
  return `let ${index} = 0, len = ${arrayName}.length; ${index} < len; ${index} += 1`
}

export function resultObject(path: string, message: string, pathInterpolated: boolean): string {
  if (pathInterpolated) {
    return `{ path: \`${path}\`, message: '${message}' }`
  } else {
    if (path === 'path') {
      return `{ path, message: '${message}' }`
    }
    return `{ path: ${path}, message: '${message}' }`
  }
}
