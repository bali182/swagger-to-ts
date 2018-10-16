'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var keys = _interopDefault(require('lodash/keys'));
var entries = _interopDefault(require('lodash/entries'));
var pascalCase = _interopDefault(require('pascalcase'));
var prettier = _interopDefault(require('prettier'));
var last = _interopDefault(require('lodash/last'));
var fs = require('fs');
var path = require('path');

function isObjectType(input) {
    return (input instanceof Object && input.type === 'object') || Boolean(input.properties);
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

class TypeRegistry {
    constructor(spec) {
        this.types = [];
        this.spec = spec;
        this.registerAll();
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
        this.types.push({
            name: pascalCase(name),
            schema,
        });
    }
    registerTypeRecursively(name, schema, force) {
        if ((force || (isObjectType(schema) && !isPureMapType(schema)) || isEnumType(schema)) && !this.hasSchema(schema)) {
            this.registerType(name, schema);
        }
        if (isObjectType(schema) && schema.properties) {
            for (const [fieldName, subSchema] of entries(schema.properties)) {
                this.registerTypeRecursively(`${name}${pascalCase(fieldName)}`, subSchema, false);
            }
        }
        if (isArrayType(schema) && schema.items) {
            this.registerTypeRecursively(`${name}ArrayItem`, schema.items, false);
        }
        if (isOneOfType(schema)) {
            this.registerTypeRecursively(`${name}OneOf`, schema.oneOf, false);
        }
        if (isAllOfType(schema)) {
            this.registerTypeRecursively(`${name}AllOf`, schema.allOf, false);
        }
        if (isAnyOfType(schema)) {
            this.registerTypeRecursively(`${name}AnyOf`, schema.anyOf, false);
        }
    }
    registerAll() {
        for (const [name, schema] of entries(this.spec.components.schemas)) {
            this.registerTypeRecursively(name, schema, true);
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

class TypeGenerator extends BaseGenerator {
    generate(name) {
        const schema = this.registry.getSchemaByName(name);
        if (isEnumType(schema)) {
            return this.generateConstEnum(name);
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
        else if (isArrayType(schema)) {
            return this.generateArrayType(name);
        }
        throw new TypeError(`${name} is of unknown type, cannot be generated`);
    }
    generateConstEnum(name) {
        const schema = this.registry.getSchemaByName(name);
        return `export const enum ${name} {
      ${schema.enum.map((value) => `${pascalCase(value)} = '${value}'`).join(',')}
    }`;
    }
    refToTypeName(ref) {
        const name = pascalCase(last(ref.split('/')));
        this.registry.getSchemaByName(name);
        return name;
    }
    getPrimitiveFieldType(schema) {
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
    generateFieldType(schema) {
        if (schema === null || schema === undefined) {
            return 'any';
        }
        if (isSchemaType(schema)) {
            if (this.registry.hasSchema(schema)) {
                return this.registry.getNameBySchema(schema);
            }
            else if (isSimpleType(schema)) {
                return this.getPrimitiveFieldType(schema);
            }
            else if (isPureMapType(schema)) {
                return this.generateAdditionalProperties(schema.additionalProperties);
            }
            else if (isArrayType(schema)) {
                const { items } = schema;
                const itemsType = isSchemaType(items) && isOneOfType(items) && items.oneOf.length > 1
                    ? `(${this.generateFieldType(items)})`
                    : this.generateFieldType(items);
                return `${itemsType}[]`;
            }
            else if (isOneOfType(schema)) {
                return schema.oneOf.map((e) => this.generateFieldType(e)).join('|');
            }
            else if (isAllOfType(schema)) {
                return schema.allOf.map((e) => this.generateFieldType(e)).join('&');
            }
            else if (isAnyOfType(schema)) {
                return schema.anyOf.map((e) => this.generateFieldType(e)).join('|'); // TODO
            }
        }
        if (isRefType(schema)) {
            return this.refToTypeName(schema.$ref);
        }
        throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`);
    }
    generateInterfaceField(name, schema) {
        return `${name}:${this.generateFieldType(schema)}`;
    }
    generateInterfaceFields(schema) {
        return entries(schema || {})
            .map(([name, subSchema]) => this.generateInterfaceField(name, subSchema))
            .join(';\n');
    }
    generateAdditionalProperties(schema) {
        if (typeof schema === 'boolean') {
            return schema ? `{[key: string]: any}` : `{[key: string]: never}`;
        }
        return `{[key: string]: ${this.generateFieldType(schema)}}`;
    }
    generateTypeBody(schema) {
        return `{${this.generateInterfaceFields(schema.properties)}}`;
    }
    getIntersectionTypes(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = [];
        if (schema.allOf && schema.allOf.length > 0 && schema.allOf.every(isRefType)) {
            schema.allOf.forEach((t) => types.push(this.refToTypeName(t.$ref)));
        }
        return types;
    }
    generateTypeDeclaration(name) {
        const schema = this.registry.getSchemaByName(name);
        const iss = this.getIntersectionTypes(name);
        if (schema.additionalProperties) {
            const mapDef = this.generateAdditionalProperties(schema.additionalProperties);
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
        const types = schema.anyOf.map((e) => this.generateFieldType(e)).join('|');
        return `export type ${name} = ${types}`;
    }
    generateOneOfType(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = schema.oneOf.map((e) => this.generateFieldType(e)).join('|');
        return `export type ${name} = ${types}`;
    }
    generateAllOfType(name) {
        const schema = this.registry.getSchemaByName(name);
        const types = schema.allOf.map((e) => this.generateFieldType(e)).join('&');
        return `export type ${name} = ${types}`;
    }
    generateArrayType(name) {
        const schema = this.registry.getSchemaByName(name);
        return `export type ${name} = ${this.generateFieldType(schema)}`;
    }
}

class TypesGenerator extends BaseGenerator {
    generate() {
        const typeGenerator = new TypeGenerator(this.registry);
        const source = this.registry
            .getTypeNames()
            .map((name) => typeGenerator.generate(name))
            .join('\n');
        return this.format(source);
    }
}

const json = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema.json'), 'utf-8'));
const spec = json;
const registry = new TypeRegistry(spec);
const generator = new TypesGenerator(registry);
const source = generator.generate();
fs.writeFileSync(path.join(__dirname, '../output.ts'), source, 'utf-8');
