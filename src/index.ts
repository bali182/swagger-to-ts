import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { generateTypes } from './generateTypes'

const defs = JSON.parse(readFileSync(join(__dirname, '../schema.json'), 'utf-8')).definitions
writeFileSync(join(__dirname, '../output.ts'), generateTypes(defs), 'utf-8')
