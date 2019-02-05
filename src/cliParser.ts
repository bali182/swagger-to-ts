import { ArgumentParser } from 'argparse'
import { GeneratorIds } from './typings'
import values from 'lodash/values'

export const cliParser = new ArgumentParser({
  description: 'OpenAPI 3.0 -> TypeScript generator',
})

cliParser.addArgument(['--file', '-f'], {
  required: true,
  dest: 'file',
  help: 'Path to the .json file to be consumed.',
})

cliParser.addArgument(['--name', '-n'], {
  required: false,
  dest: 'apiTypeName',
  help: 'Name of the generated type.',
  defaultValue: 'Api',
})

cliParser.addArgument(['--targets', '-t'], {
  required: true,
  dest: 'targets',
  action: 'append',
  choices: values(GeneratorIds),
})

const paths = ['typesPath', 'typeGuardsPath', 'apiContractPath', 'apiPath', 'validatorsPath']

paths.forEach((path) =>
  cliParser.addArgument([`--${path}`], {
    required: false,
    dest: path,
    help: `Path for ${path.replace('Path', '')} relative to the generated file (used as import)`,
  }),
)
