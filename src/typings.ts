export interface IGenerator<Input> {
  generate(input: Input): string
}
