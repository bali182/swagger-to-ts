'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var prettier = _interopDefault(require('prettier'));
var fs = require('fs');
var path = require('path');

function isObjectType(input) {
    return input.type === 'object' || Boolean(input.properties);
}
function isEnumType(input) {
    return Boolean(input.enum);
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
function isRefType(input) {
    return Boolean(input.$ref);
}
function isOneOfType(input) {
    return Boolean(input.oneOf);
}

function generateConstEnum(name, schema) {
    return `export const enum ${name} {
    ${schema.enum.map((value) => `${value} = '${value}'`).join(',\n')}
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
    if (isPrimitiveType(schema)) {
        return getPrimitiveFieldType(schema);
    }
    else if (isRefType(schema)) {
        return refToTypeName(schema.$ref);
    }
    else if (isArrayType(schema)) {
        let tpe = generateFieldType(schema.items);
        if (isOneOfType(schema.items)) {
            tpe = `(${tpe})`;
        }
        return `${tpe}[]`;
    }
    else if (isOneOfType(schema)) {
        return schema.oneOf.map(generateFieldType).join('|');
    }
}
function generateInterfaceField(name, schema) {
    return `${name}:${generateFieldType(schema)}`;
}
function generateInterface(name, schema) {
    const fields = Object.keys(schema.properties || {})
        .map((name) => generateInterfaceField(name, schema.properties[name]))
        .join('\n');
    return `export type ${name} = {
    ${fields}
  }`;
}
function generateOneOfType(name, schema) {
    return `export type ${name} = ${schema.oneOf.map(generateFieldType).join('|')}`;
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

const defs = JSON.parse(fs.readFileSync(path.join(__dirname, '../schema.json'), 'utf-8')).components.schemas;
fs.writeFileSync(path.join(__dirname, '../output.ts'), generateTypes(defs), 'utf-8');
