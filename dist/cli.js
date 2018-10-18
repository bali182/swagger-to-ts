#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var keys = _interopDefault(require('lodash/keys'));
var isNil = _interopDefault(require('lodash/isNil'));
var entries = _interopDefault(require('lodash/entries'));
var pascalCase = _interopDefault(require('pascalcase'));
var camelCase = _interopDefault(require('camel-case'));
var prettier = _interopDefault(require('prettier'));
var last = _interopDefault(require('lodash/last'));
var startsWith = _interopDefault(require('lodash/startsWith'));
var endsWith = _interopDefault(require('lodash/endsWith'));
var openapiV3Types = require('@loopback/openapi-v3-types');
var argparse = require('argparse');
var fs = require('fs');
var path = require('path');

function isObjectType(input) {
    if (!(input instanceof Object)) {
        return false;
    }
    return input.type === 'object' || (isNil(input.type) && Boolean(input.properties));
}
function isPureMapType(input) {
    return (input instanceof Object &&
        input.type === 'object' &&
        (!Boolean(input.properties) || keys(input.properties).length === 0) &&
        input.additionalProperties !== false);
}
function isEnumType(input) {
    // We only handle string enums
    return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'));
}
function isArrayType(input) {
    return input.type === 'array' || Boolean(input.items);
}
function isSimpleType(input) {
    return (input instanceof Object &&
        (input.type === 'string' ||
            input.type === 'number' ||
            input.type === 'boolean' ||
            input.type === 'integer' ||
            input.type === 'null' ||
            input.type === 'any'));
}
function isOneOfType(input) {
    return Boolean(input.oneOf);
}
function isAnyOfType(input) {
    return Boolean(input.anyOf);
}
function isAllOfType(input) {
    return Boolean(input.allOf);
}
function isRefType(input) {
    return input instanceof Object && Boolean(input.$ref);
}
function isSchemaType(input) {
    return input instanceof Object && !Boolean(input.$ref);
}
function isRequestBody(input) {
    return input instanceof Object && Boolean(input.content);
}
function isResponse(input) {
    return input instanceof Object && (Boolean(input.description) || Boolean(input.content));
}

class OperationWrapper {
    constructor(url, method, operation) {
        this.url = url;
        this.method = method;
        this.operation = operation;
    }
    getId() {
        return this.operation.operationId;
    }
    getRequestBodyTypes() {
        const types = [];
        const { requestBody } = this.operation;
        if (isRefType(requestBody)) {
            types.push(requestBody);
        }
        else if (isRequestBody(requestBody)) {
            for (const [, mediaObj] of entries(requestBody.content)) {
                if (mediaObj.schema) {
                    types.push(mediaObj.schema);
                }
            }
        }
        return types;
    }
    getResponseTypes() {
        const types = [];
        for (const [, response] of entries(this.operation.responses || {})) {
            if (isRefType(response)) {
                types.push(response);
            }
            else if (isResponse(response) && response.content) {
                for (const [, mediaObj] of entries(response.content)) {
                    if (mediaObj.schema) {
                        types.push(mediaObj.schema);
                    }
                }
            }
        }
        return types;
    }
}

class NameProvider {
    getEnumConstantName(name) {
        return pascalCase(name);
    }
    getTypeName(name) {
        return pascalCase(name);
    }
    getNestedTypeName(parentName, name) {
        return `${parentName}${pascalCase(name)}`;
    }
    getParametersTypeName(operationName) {
        return `${pascalCase(operationName)}Params`;
    }
    getParameterTypeName(operationName, paramName) {
        return `${this.getParametersTypeName(operationName)}${pascalCase(paramName)}`;
    }
    getNestedItemName(parentName) {
        return `${parentName}ArrayItem`;
    }
    getNestedOneOfName(parentName, no) {
        return `${parentName}OneOf${no}`;
    }
    getNestedAnyOfName(parentName, no) {
        return `${parentName}AnyOf${no}`;
    }
    getNestedAllOfName(parentName, no) {
        return `${parentName}AllOf${no}`;
    }
    getRequestBodyTypeName(operationName, method) {
        return `${pascalCase(operationName)}${pascalCase(method)}RequestBody`;
    }
    getResponseTypeName(operationName, method) {
        return `${pascalCase(operationName)}${pascalCase(method)}Response`;
    }
    getApiTypeName() {
        return 'Api';
    }
    getApiImplName() {
        return 'BaseApiImpl';
    }
    getOperatioName(id) {
        return camelCase(id);
    }
}

class TypeRegistry {
    constructor(spec) {
        this.types = [];
        this.operations = [];
        this.nameProvider = new NameProvider();
        this.spec = spec;
        this.registerOperations();
        this.registerTypes();
    }
    getNameProvider() {
        return this.nameProvider;
    }
    getSpec() {
        return this.spec;
    }
    getTypes() {
        return this.types;
    }
    getTypeNames() {
        return this.types.map(({ name }) => name);
    }
    getOperations() {
        return this.operations;
    }
    getOperation(id) {
        return this.getOperations().find(({ operation }) => operation.operationId === id);
    }
    getOperationIds() {
        return this.getOperations().map(({ operation }) => operation.operationId);
    }
    hasSchemaName(name) {
        return this.types.find(({ name: n }) => n === name) !== undefined;
    }
    hasSchema(schema) {
        return this.types.find(({ schema: s }) => s === schema) !== undefined;
    }
    getSchemaByName(name) {
        const wrapper = this.types.find(({ name: n }) => n === name);
        if (wrapper === undefined) {
            throw new TypeError(`Type "${name}" is not registered!`);
        }
        return wrapper.schema;
    }
    getNameBySchema(schema) {
        const wrapper = this.types.find(({ schema: s }) => s === schema);
        if (wrapper === undefined) {
            throw new TypeError(`Type for schema "${JSON.stringify(schema, null, 2)}" is not registered!`);
        }
        return wrapper.name;
    }
    registerType(name, schema) {
        const byName = this.types.find(({ name: n }) => n === name);
        if (byName !== undefined) {
            throw new TypeError(`Type "${name}" is already registered!`);
        }
        const bySchema = this.types.find(({ schema: s }) => s === schema);
        if (bySchema !== undefined) {
            throw new TypeError(`Type for schema "${JSON.stringify(schema, null, 2)}" is already registered!`);
        }
        this.types.push({ name, schema });
    }
    registerTypeRecursively(name, schema, force) {
        if ((force || (isObjectType(schema) && !isPureMapType(schema)) || isEnumType(schema)) && !this.hasSchema(schema)) {
            this.registerType(this.nameProvider.getTypeName(name), schema);
        }
        if (isObjectType(schema) && schema.properties) {
            for (const [fieldName, subSchema] of entries(schema.properties)) {
                this.registerTypeRecursively(this.nameProvider.getNestedTypeName(name, fieldName), subSchema, false);
            }
        }
        if (isArrayType(schema) && schema.items) {
            this.registerTypeRecursively(this.nameProvider.getNestedItemName(name), schema.items, false);
        }
        if (isOneOfType(schema)) {
            schema.oneOf.forEach((child, index) => this.registerTypeRecursively(this.nameProvider.getNestedOneOfName(name, index), child, false));
        }
        if (isAllOfType(schema)) {
            schema.allOf.forEach((child, index) => this.registerTypeRecursively(this.nameProvider.getNestedAllOfName(name, index), child, false));
        }
        if (isAnyOfType(schema)) {
            schema.anyOf.forEach((child, index) => this.registerTypeRecursively(this.nameProvider.getNestedAnyOfName(name, index), child, false));
        }
    }
    registerTypes() {
        for (const [name, schema] of entries(this.spec.components.schemas)) {
            this.registerTypeRecursively(name, schema, true);
        }
        for (const op of this.getOperations()) {
            for (const param of op.operation.parameters || []) {
                if (!isRefType(param) && param.schema) {
                    this.registerTypeRecursively(this.nameProvider.getParameterTypeName(op.getId(), param.name), param.schema, false);
                }
            }
            for (const schema of op.getRequestBodyTypes()) {
                this.registerTypeRecursively(this.nameProvider.getRequestBodyTypeName(op.getId(), op.method), schema, false);
            }
            for (const schema of op.getResponseTypes()) {
                this.registerTypeRecursively(this.nameProvider.getResponseTypeName(op.getId(), op.method), schema, false);
            }
        }
    }
    registerOperation(url, method, operation) {
        this.operations.push(new OperationWrapper(url, method, operation));
    }
    registerOperations() {
        for (const [url, path$$1] of entries(this.getSpec().paths)) {
            const { get, put, post, delete: _delete, options, head, patch, trace } = path$$1;
            get ? this.registerOperation(url, 'get', get) : null;
            put ? this.registerOperation(url, 'put', put) : null;
            post ? this.registerOperation(url, 'post', post) : null;
            _delete ? this.registerOperation(url, 'delete', _delete) : null;
            options ? this.registerOperation(url, 'options', options) : null;
            head ? this.registerOperation(url, 'head', head) : null;
            patch ? this.registerOperation(url, 'patch', patch) : null;
            trace ? this.registerOperation(url, 'trace', trace) : null;
        }
    }
}

class BaseGenerator {
    constructor(registry) {
        this.registry = registry;
    }
    format(source) {
        return prettier.format(source, {
            printWidth: 120,
            semi: false,
            parser: 'typescript',
            tabWidth: 2,
            useTabs: false,
            singleQuote: true,
            trailingComma: 'es5',
            bracketSpacing: true,
            arrowParens: 'always',
        });
    }
}

class TypeRefGenerator extends BaseGenerator {
    generate(schema) {
        if (schema === null || schema === undefined) {
            return this.generatePrimitiveType(schema);
        }
        if (isRefType(schema)) {
            return this.generateRefType(schema);
        }
        if (isSchemaType(schema)) {
            if (this.registry.hasSchema(schema)) {
                return this.generateRootType(schema);
            }
            else if (isSimpleType(schema)) {
                return this.generatePrimitiveType(schema);
            }
            else if (isPureMapType(schema)) {
                return this.generateMapType(schema.additionalProperties);
            }
            else if (isArrayType(schema)) {
                return this.generateArrayType(schema);
            }
            else if (isOneOfType(schema)) {
                return this.generateOneOfType(schema);
            }
            else if (isAllOfType(schema)) {
                return this.generateAllOfType(schema);
            }
            else if (isAnyOfType(schema)) {
                return this.generateAnyOfType(schema);
            }
        }
        throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`);
    }
    generateOneOfType(schema) {
        return this.generateCompositeSchema(schema.oneOf, '|');
    }
    generateAnyOfType(schema) {
        return this.generateCompositeSchema(schema.anyOf, '|');
    }
    generateAllOfType(schema) {
        return this.generateCompositeSchema(schema.allOf, '&');
    }
    generateCompositeSchema(schemas, glue) {
        return schemas.map((e) => this.generate(e)).join(glue);
    }
    generateRefType(ref) {
        const name = pascalCase(last(ref.$ref.split('/')));
        this.registry.getSchemaByName(name);
        return name;
    }
    generateMapType(schema) {
        if (typeof schema === 'boolean') {
            return schema ? `{[key: string]: any}` : `{[key: string]: never}`;
        }
        return `{[key: string]: ${this.generate(schema)}}`;
    }
    generateItemsType(schema) {
        return isSchemaType(schema) && isOneOfType(schema) && schema.oneOf.length > 1
            ? `(${this.generate(schema)})`
            : this.generate(schema);
    }
    generateArrayType(schema) {
        return `${this.generateItemsType(schema.items)}[]`;
    }
    generatePrimitiveType(schema) {
        if (schema === null || schema === undefined) {
            return 'any';
        }
        switch (schema.type) {
            case 'string':
                return 'string';
            case 'boolean':
                return 'boolean';
            case 'number':
            case 'integer':
                return 'number';
            case 'null':
                return 'null';
            case 'any':
                return 'any';
        }
    }
    generateRootType(schema) {
        return this.registry.getNameBySchema(schema);
    }
}

class TypeGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.typeRefGenerator = new TypeRefGenerator(registry);
    }
    generate(name) {
        const schema = this.registry.getSchemaByName(name);
        if (isEnumType(schema)) {
            return this.generateConstEnum(name);
        }
        else if (isArrayType(schema)) {
            return this.generateArrayType(name);
        }
        else if (isObjectType(schema)) {
            return this.generateTypeDeclaration(name);
        }
        else if (isOneOfType(schema)) {
            return this.generateOneOfType(name);
        }
        else if (isAllOfType(schema)) {
            return this.generateAllOfType(name);
        }
        else if (isAnyOfType(schema)) {
            return this.generateAnyOfType(name);
        }
        throw new TypeError(`${name} is of unknown type, cannot be generated`);
    }
    generateConstEnum(name) {
        const schema = this.registry.getSchemaByName(name);
        const np = this.registry.getNameProvider();
        return `export const enum ${name} {
      ${schema.enum.map((value) => `${np.getEnumConstantName(value)} = '${value}'`).join(',')}
    }`;
    }
    generateTypeDeclarationField(name, schema, isRequired) {
        const colon = isRequired ? ':' : '?:';
        return `${name}${colon}${this.typeRefGenerator.generate(schema)}`;
    }
    generateTypeDeclarationFields(schema) {
        return entries(schema.properties || {})
            .map(([name, subSchema]) => {
            const isRequired = schema.required && schema.required.indexOf(name) >= 0;
            return this.generateTypeDeclarationField(name, subSchema, isRequired);
        })
            .join(';\n');
    }
    generateTypeBody(schema) {
        return `{${this.generateTypeDeclarationFields(schema)}}`;
    }
    getIntersectionTypes(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = [];
        if (schema.allOf && schema.allOf.length > 0 && schema.allOf.every(isRefType)) {
            schema.allOf.forEach((t) => types.push(this.typeRefGenerator.generate(t)));
        }
        return types;
    }
    generateTypeDeclaration(name) {
        const schema = this.registry.getSchemaByName(name);
        const iss = this.getIntersectionTypes(name);
        if (schema.additionalProperties) {
            const mapDef = this.typeRefGenerator.generateMapType(schema.additionalProperties);
            return `export type ${name} = ${mapDef} // TODO not fully expressible, "properties" omitted`;
        }
        if (iss.length === 0) {
            return `export type ${name} = ${this.generateTypeBody(schema)}`;
        }
        else {
            const issStr = iss.length > 1 ? `(${iss.join('&')})` : iss.join('&');
            return `export type ${name} = ${issStr} & ${this.generateTypeBody(schema)}`;
        }
    }
    generateAnyOfType(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = schema.anyOf.map((e) => this.typeRefGenerator.generate(e)).join('|');
        return `export type ${name} = ${types}`;
    }
    generateOneOfType(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = schema.oneOf.map((e) => this.typeRefGenerator.generate(e)).join('|');
        return `export type ${name} = ${types}`;
    }
    generateAllOfType(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = schema.allOf.map((e) => this.typeRefGenerator.generate(e)).join('&');
        return `export type ${name} = ${types}`;
    }
    generateArrayType(name) {
        const schema = this.registry.getSchemaByName(name);
        return `export type ${name} = ${this.typeRefGenerator.generateItemsType(schema.items)}[]`;
    }
}

class TypesGenerator extends BaseGenerator {
    generate() {
        const typeGenerator = new TypeGenerator(this.registry);
        return this.registry
            .getTypeNames()
            .map((name) => typeGenerator.generate(name))
            .join('\n');
    }
}

class OperationSignatureGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.refGenerator = new TypeRefGenerator(this.registry);
    }
    generateBodyParameter(op) {
        const reqTypes = op.getRequestBodyTypes();
        const { refGenerator } = this;
        switch (reqTypes.length) {
            case 0:
                return null;
            case 1:
                return `content: ${refGenerator.generate(reqTypes[0])}`;
            default:
                return `content: ${refGenerator.generate({ oneOf: reqTypes })}`;
        }
    }
    generateParamsParameter(op) {
        if (op.operation.parameters && op.operation.parameters.length > 0) {
            const type = this.registry.getNameProvider().getParametersTypeName(op.getId());
            return `params: ${type}`;
        }
        return null;
    }
    generateParameters(op) {
        const params = [this.generateParamsParameter(op), this.generateBodyParameter(op)];
        return params.filter((code) => code !== null).join(',');
    }
    generateReturnType(op) {
        return `Promise<${this.generatePromiseInnerType(op)}>`;
    }
    generatePromiseInnerType(op) {
        const resTypes = op.getResponseTypes();
        const { refGenerator } = this;
        switch (resTypes.length) {
            case 0:
                return `void`;
            case 1:
                return refGenerator.generate(resTypes[0]);
            default:
                return refGenerator.generate({ oneOf: resTypes });
        }
    }
    generate(id) {
        const op = this.registry.getOperation(id);
        const name = this.registry.getNameProvider().getOperatioName(id);
        return `${name}(${this.generateParameters(op)}): ${this.generateReturnType(op)}`;
    }
}

class OperationGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.signatureGenerator = new OperationSignatureGenerator(this.registry);
    }
    generateUrlValue(op) {
        const segments = op.url.split('/').filter((s) => s.length > 0);
        const replacedSegments = segments.map((segment) => {
            if (startsWith(segment, '{') && endsWith(segment, '}')) {
                const varName = segment.substring(1, segment.length - 1);
                return `\${params.${varName}}`;
            }
            return segment;
        });
        const partialUrl = replacedSegments.join('/');
        return `\`\${this.getBaseUrl()}/${partialUrl}\``;
    }
    generateHeadersValue(op) {
        return `this.getDefaultHeaders()`;
    }
    generateBodyValue(op) {
        const bodyType = this.signatureGenerator.generateBodyParameter(op);
        return `${bodyType === null ? 'undefined' : `JSON.stringify(content)`}`;
    }
    generateResponseHandler(op) {
        const resTypes = op.getResponseTypes();
        switch (resTypes.length) {
            case 0:
                return `() => undefined`;
            default:
                return `(response) => JSON.parse(response.body) as ${this.signatureGenerator.generatePromiseInnerType(op)}`;
        }
    }
    generateOperationBody(op) {
        return `const request: __Request = {
        url: ${this.generateUrlValue(op)},
        method: '${op.method.toUpperCase()}',
        headers: ${this.generateHeadersValue(op)},
        body: ${this.generateBodyValue(op)},
      }
      return this.execute(request).then(${this.generateResponseHandler(op)})`;
    }
    generate(id) {
        return `${this.signatureGenerator.generate(id)} {
      ${this.generateOperationBody(this.registry.getOperation(id))}
    }`;
    }
}

class ApiGenerator extends BaseGenerator {
    generate() {
        const np = this.registry.getNameProvider();
        const opGenerator = new OperationGenerator(this.registry);
        const fns = this.registry
            .getOperationIds()
            .map((id) => opGenerator.generate(id))
            .join('\n');
        return `export abstract class ${np.getApiImplName()} implements ${np.getApiTypeName()} {
      abstract execute(request: __Request): Promise<__Response>
      abstract getBaseUrl(): string
      abstract getDefaultHeaders(): {[key: string]: string}
      ${fns}
    }`;
    }
}

class ParameterTypeGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.refGenerator = new TypeRefGenerator(this.registry);
    }
    generateParameterField(param) {
        if (openapiV3Types.isReferenceObject(param)) {
            throw new TypeError(`Can't handle this!!!`);
        }
        const colon = param.required ? ':' : '?:';
        return `${param.name}${colon} ${this.refGenerator.generate(param.schema)}`;
    }
    generateParamsType(op) {
        const name = this.registry.getNameProvider().getParametersTypeName(op.operationId);
        return `export type ${name} = {
      ${op.parameters.map((param) => this.generateParameterField(param))}
    }`;
    }
    generate(operationId) {
        const op = this.registry.getOperation(operationId);
        if (!op.operation.parameters || op.operation.parameters.length === 0) {
            return null;
        }
        return this.generateParamsType(op.operation);
    }
}

class ParameterTypesGenerator extends BaseGenerator {
    generate() {
        const generator = new ParameterTypeGenerator(this.registry);
        return this.registry
            .getOperationIds()
            .map((id) => generator.generate(id))
            .filter((source) => source !== null)
            .join('\n');
    }
}

class StaticTypesGenerator {
    generate() {
        return `export type __Request = {
      url: string
      method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH' | 'TRACE'
      body: string
      headers: { [key: string]: string }
    }
    export type __Response = {
      // status: number (We don't need it for now)
      body: string
    }`;
    }
}

class ApiTypeGenerator extends BaseGenerator {
    generate() {
        const signatureGen = new OperationSignatureGenerator(this.registry);
        const fns = this.registry
            .getOperationIds()
            .map((id) => signatureGen.generate(id))
            .join('\n');
        return `export type ${this.registry.getNameProvider().getApiTypeName()} = {
      ${fns}
    }`;
    }
}

class RootGenerator extends BaseGenerator {
    generate() {
        const generators = [
            new TypesGenerator(this.registry),
            new ParameterTypesGenerator(this.registry),
            new ApiTypeGenerator(this.registry),
            new StaticTypesGenerator(),
            new ApiGenerator(this.registry),
        ];
        return this.format(generators.map((g) => g.generate()).join('\n'));
    }
}

const parser = new argparse.ArgumentParser({
    description: 'OpenAPI 3.0 -> TypeScript generator',
});
parser.addArgument(['--file', '-f'], {
    required: true,
    dest: 'file',
    help: 'Path to the .json file to be consumed.',
});
class CliGenerator {
    constructor() {
        this.args = parser.parseArgs();
    }
    readSchema() {
        const file = path.resolve(this.args.file);
        const content = fs.readFileSync(file, 'UTF8');
        const schema = JSON.parse(content);
        return schema;
    }
    writeOutput(source) {
        process.stdout.write(source);
    }
    execute() {
        const schema = this.readSchema();
        const registry = new TypeRegistry(schema);
        const generator = new RootGenerator(registry);
        const source = generator.generate();
        this.writeOutput(source);
    }
}

new CliGenerator().execute();