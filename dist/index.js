'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var openapiV3Types = require('@loopback/openapi-v3-types');
var prettier = _interopDefault(require('prettier'));
var fs = require('fs');
var path = require('path');

function isObjectType(input) {
    return input.type === 'object' || Boolean(input.properties);
}
function isEnumType(input) {
    // We only handle string enums
    return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'));
}
function isArrayType(input) {
    return input.type === 'array' || Boolean(input.items);
}
function isPrimitiveType(input) {
    return (input.type === 'string' ||
        input.type === 'number' ||
        input.type === 'boolean' ||
        input.type === 'integer' ||
        input.type === 'null');
}
function isOneOfType(input) {
    return Boolean(input.oneOf);
}
function isRefType(input) {
    return Boolean(input.$ref);
}

function generateConstEnum(name, schema) {
    return `export const enum ${name} {
    ${schema.enum.map((value) => `${value} = '${value}'`).join(',')}
  }`;
}
function refToTypeName(ref) {
    const parts = ref.split('/');
    return parts[parts.length - 1];
}
function getPrimitiveFieldType(schema) {
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
    }
}
function generateFieldType(schema) {
    if (openapiV3Types.isSchemaObject(schema)) {
        if (isPrimitiveType(schema)) {
            return getPrimitiveFieldType(schema);
        }
        if (isArrayType(schema)) {
            const { items: iSchema } = schema;
            const itemsType = openapiV3Types.isSchemaObject(iSchema) && isOneOfType(iSchema) && iSchema.oneOf.length > 1
                ? `(${generateFieldType(iSchema)})`
                : generateFieldType(iSchema);
            return `${itemsType}[]`;
        }
        if (isOneOfType(schema)) {
            return schema.oneOf.map(generateFieldType).join('|');
        }
        if (isObjectType(schema)) {
            return `{${generateInterfaceFields(schema.properties)}}`;
        }
        if (isEnumType(schema)) {
            return schema.enum.map((value) => `'${value}'`).join('|');
        }
    }
    if (openapiV3Types.isReferenceObject(schema)) {
        return refToTypeName(schema.$ref);
    }
    throw new TypeError(`${JSON.stringify(schema)} is of unknown type, cannot be generated`);
}
function generateInterfaceField(name, schema) {
    return `${name}:${generateFieldType(schema)}`;
}
function generateInterfaceFields(schema) {
    return Object.keys(schema || {})
        .map((name) => generateInterfaceField(name, schema[name]))
        .join(';\n');
}
function generateTypeBody(schema) {
    return `{${generateInterfaceFields(schema.properties)}}`;
}
function generateInterface(name, schema) {
    if (schema.allOf && schema.allOf.length > 0 && schema.allOf.every(isRefType)) {
        const extendedIfs = schema.allOf.map((t) => refToTypeName(t.$ref)).join(' & ');
        const ifsWithBraces = schema.allOf.length > 1 ? `(${extendedIfs})` : extendedIfs;
        return `export type ${name} = ${ifsWithBraces} & ${generateTypeBody(schema)}`;
    }
    return `export type ${name} = ${generateTypeBody(schema)}`;
}
function generateOneOfType(name, schema) {
    return `export type ${name} = ${schema.oneOf.map(generateFieldType).join('|')}`;
}
function generateArrayType(name, schema) {
    return `export type ${name} = ${generateFieldType(schema)}`;
}
function generateType(name, schema) {
    if (isEnumType(schema)) {
        return generateConstEnum(name, schema);
    }
    else if (isObjectType(schema)) {
        return generateInterface(name, schema);
    }
    else if (isOneOfType(schema)) {
        return generateOneOfType(name, schema);
    }
    else if (isArrayType(schema)) {
        return generateArrayType(name, schema);
    }
    throw new TypeError(`${name} is of unknown type, cannot be generated`);
}
function format(source) {
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
function generateTypes(defs) {
    const source = Object.keys(defs)
        .map((name) => generateType(name, defs[name]))
        .join('\n');
    return format(source);
}

const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema.json'), 'utf-8'));
fs.writeFileSync(path.join(__dirname, '../output.ts'), generateTypes(spec.components.schemas), 'utf-8');
