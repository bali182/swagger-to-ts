import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { generateTypes } from './generateTypes'
import { OpenApiSpec } from '@loopback/openapi-v3-types'

const spec = JSON.parse(readFileSync(join(__dirname, '../schema.json'), 'utf-8')) as OpenApiSpec
writeFileSync(join(__dirname, '../output.ts'), generateTypes(spec.components.schemas), 'utf-8')
