import { ArgumentParser } from 'argparse'
import { readFileSync } from 'fs'
import { resolve, extname } from 'path'
import { OpenApiSpec } from '@loopback/openapi-v3-types'
import { TypeRegistry } from './TypeRegistry'
import { RootGenerator } from './RootGenerator'
import YAML from 'yamljs'

type Args = {
  file: string
}

const parser = new ArgumentParser({
  description: 'OpenAPI 3.0 -> TypeScript generator',
})

parser.addArgument(['--file', '-f'], {
  required: true,
  dest: 'file',
  help: 'Path to the .json file to be consumed.',
})

export class CliGenerator {
  private readonly args: Args = parser.parseArgs()

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
    const registry = new TypeRegistry(schema)
    const generator = new RootGenerator(registry)
    const source = generator.generate()
    this.writeOutput(source)
  }
}
