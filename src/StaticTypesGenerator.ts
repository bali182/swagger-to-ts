import { IGenerator } from './typings'

export class StaticTypesGenerator implements IGenerator<void> {
  generate() {
    return `export type __Request = {
      url: string
      method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE'
      body: string
      headers: { [key: string]: string }
    }
    export type __Response = {
      status: number
      body: string
    }`
  }
}
