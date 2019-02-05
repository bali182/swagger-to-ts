import { readFileSync } from 'fs'
import { resolve, extname } from 'path'
import { OpenApiSpec } from '@loopback/openapi-v3-types'
import { TypeRegistry } from './TypeRegistry'
import { RootGenerator } from './RootGenerator'
import YAML from 'yamljs'
import { NameProvider } from './NameProvider'
import { Args } from './typings'
import { cliParser } from './cliParser'

export class CliGenerator {
  private readonly args: Args = cliParser.parseArgs()

  readSchema(): OpenApiSpec {
    const file = resolve(this.args.file)
    const content = readFileSync(file, 'UTF8')
    const schema: OpenApiSpec = this.parseSchema(extname(file), content)
    return schema
  }

  parseSchema(ext: string, content: string): OpenApiSpec {
    switch (ext.toLowerCase()) {
      case '.yaml':
        return YAML.parse(content)
      default:
        return JSON.parse(content)
    }
  }

  writeOutput(source: string) {
    process.stdout.write(source)
  }

  execute(): void {
    const schema = this.readSchema()
    const registry = new TypeRegistry(this.args, schema, new NameProvider(this.args))
    const generator = new RootGenerator(registry)
    const source = generator.generate()
    this.writeOutput(source)
  }
}
