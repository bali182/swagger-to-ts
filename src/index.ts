import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { OpenApiSpec } from '@loopback/openapi-v3-types'
import { TypeRegistry } from './TypeRegistry'
import { TypesGenerator } from './TypesGenerator'

const json = JSON.parse(readFileSync(join(__dirname, '../schema.json'), 'utf-8'))

const spec = json as OpenApiSpec
const registry = new TypeRegistry(spec)
const generator = new TypesGenerator(registry)
const source = generator.generate()

writeFileSync(join(__dirname, '../output.ts'), source, 'utf-8')
