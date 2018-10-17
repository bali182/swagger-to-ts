import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { OpenApiSpec } from '@loopback/openapi-v3-types'
import { TypeRegistry } from './TypeRegistry'
import { RootGenerator } from './RootGenerator'

const json = JSON.parse(readFileSync(join(__dirname, '../swagger.json'), 'utf-8'))

const spec = json as OpenApiSpec
const registry = new TypeRegistry(spec)
const generator = new RootGenerator(registry)
const source = generator.generate()

writeFileSync(join(__dirname, '../output.ts'), source, 'utf-8')
