'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var keys = _interopDefault(require('lodash/keys'));
var isNil = _interopDefault(require('lodash/isNil'));
var entries = _interopDefault(require('lodash/entries'));
var last = _interopDefault(require('lodash/last'));
var values = _interopDefault(require('lodash/values'));
var isNumber = _interopDefault(require('lodash/isNumber'));
var isVarName = _interopDefault(require('is-var-name'));
var prettier = _interopDefault(require('prettier'));
var pascalCase = _interopDefault(require('pascalcase'));
var endsWith = _interopDefault(require('lodash/endsWith'));
var startsWith = _interopDefault(require('lodash/startsWith'));
var fs = require('fs');
var path = require('path');
var flatMap = _interopDefault(require('lodash/flatMap'));
var camelCase = _interopDefault(require('camel-case'));

var PrimitiveType;
(function (PrimitiveType) {
    PrimitiveType["string"] = "string";
    PrimitiveType["number"] = "number";
    PrimitiveType["boolean"] = "boolean";
    PrimitiveType["integer"] = "integer";
    PrimitiveType["int"] = "int";
    PrimitiveType["float"] = "float";
    PrimitiveType["double"] = "double";
    PrimitiveType["null"] = "null";
    PrimitiveType["any"] = "any";
})(PrimitiveType || (PrimitiveType = {}));
function unique(items) {
    const set = new Set(items);
    return Array.from(set);
}
function isObjectType(input) {
    if (!(input instanceof Object)) {
        return false;
    }
    return input.type === 'object' || (isNil(input.type) && Boolean(input.properties));
}
function isMapType(input) {
    return input instanceof Object && input.type === 'object' && Boolean(input.additionalProperties);
}
function isPureMapType(input) {
    return (input instanceof Object &&
        input.type === 'object' &&
        (!Boolean(input.properties) || keys(input.properties).length === 0) &&
        typeof input.additionalProperties === 'object');
}
function isEnumType(input) {
    // We only handle string enums
    return Boolean(input.enum) && (input.type === 'string' || input.enum.every((s) => typeof s === 'string'));
}
function isArrayType(input) {
    return input.type === 'array' || Boolean(input.items);
}
function isSimpleType(input) {
    return input instanceof Object && values(PrimitiveType).indexOf(input.type) >= 0;
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
function isParameter(input) {
    return input instanceof Object && Boolean(input.in);
}
function getDiscriminator(inputSchema, registry) {
    if (!registry.hasSchema(inputSchema)) {
        return null;
    }
    const name = registry.getNameBySchema(inputSchema);
    for (const { name: parentName, schema } of registry.getTypes()) {
        if (!schema.discriminator) {
            continue;
        }
        const { mapping, propertyName } = schema.discriminator;
        const entry = entries(mapping).find(([, ref]) => getRefName(ref) === name);
        if (entry) {
            return { value: entry[0], propertyName, parentName };
        }
    }
    return null;
}
function getDiscriminatorsInternal(inputSchema, registry, discriminators) {
    const discriminator = getDiscriminator(inputSchema, registry);
    if (discriminator === null) {
        return;
    }
    if (discriminators.some((d) => d.parentName === discriminator.parentName)) {
        return;
    }
    discriminators.push(discriminator);
    if (registry.hasSchemaName(discriminator.parentName)) {
        const parentSchema = registry.getSchemaByName(discriminator.parentName);
        getDiscriminatorsInternal(parentSchema, registry, discriminators);
    }
}
function getDiscriminators(inputSchema, registry) {
    const discriminators = [];
    getDiscriminatorsInternal(inputSchema, registry, discriminators);
    return discriminators;
}
function getRefName(ref) {
    return last(ref.split('/'));
}
var AccessorType;
(function (AccessorType) {
    AccessorType["PROPERTY"] = "PROPERTY";
    AccessorType["INDEX"] = "INDEX";
    AccessorType["INDEX_PROPERTY"] = "INDEX_PROPERTY";
})(AccessorType || (AccessorType = {}));
function accessor(root, element, hint = null) {
    if (isNumber(element) || hint === AccessorType.INDEX) {
        return `${root}[${element}]`;
    }
    else if (!isVarName(element) || hint === AccessorType.INDEX_PROPERTY) {
        return `${root}['${element}']`;
    }
    else {
        return `${root}.${element}`;
    }
}

class OperationWrapper {
    constructor(url, method, operation, spec) {
        this.url = url;
        this.method = method;
        this.operation = operation;
        this.spec = spec;
    }
    getParameters() {
        const params = this.operation.parameters || [];
        return params.map((paramOrRef) => {
            if (isParameter(paramOrRef)) {
                return paramOrRef;
            }
            else if (isRefType(paramOrRef)) {
                const name = last(paramOrRef.$ref.split('/'));
                const resolvedParam = this.spec.components.parameters[name];
                if (!resolvedParam) {
                    throw new Error(`Missing param '${name}'!`);
                }
                return resolvedParam;
            }
        });
    }
    getPathParameters() {
        return this.getParametersByLocation('path');
    }
    getQueryParameters() {
        return this.getParametersByLocation('query');
    }
    getHeaderParameters() {
        return this.getParametersByLocation('header');
    }
    getCookieParameters() {
        return this.getParametersByLocation('cookie');
    }
    getParametersByLocation(loc) {
        return this.getParameters().filter((param) => param.in === loc);
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
        const types = new Set();
        for (const [, response] of entries(this.operation.responses || {})) {
            for (const type of this._getResponseTypes(response)) {
                types.add(type);
            }
        }
        return Array.from(types);
    }
    getResolvedResponseTypes() {
        const types = new Set();
        for (const [statusCodeStr, response] of entries(this.operation.responses || {})) {
            const status = statusCodeStr === 'default' ? null : parseInt(statusCodeStr, 10);
            if (status === null || (status >= 200 && status < 300)) {
                for (const type of this._getResponseTypes(response)) {
                    types.add(type);
                }
            }
        }
        return Array.from(types);
    }
    getResponseStatuses() {
        const statuses = [];
        for (const [status] of entries(this.operation.responses || {})) {
            if (status !== 'default') {
                statuses.push(parseInt(status, 10));
            }
        }
        return statuses;
    }
    hasDefaultStatus() {
        return Boolean((this.operation.responses || {}).default);
    }
    _getResponseTypes(res) {
        if (isRefType(res)) {
            return [res];
        }
        if (isResponse(res)) {
            if (!res.content) {
                return [null];
            }
            else {
                const types = new Set();
                for (const [, mediaObj] of entries(res.content)) {
                    if (mediaObj.schema) {
                        types.add(mediaObj.schema);
                    }
                    else {
                        types.add(null);
                    }
                }
                return Array.from(types);
            }
        }
        return [null];
    }
    getDefaultResponseTypes() {
        return this._getResponseTypes((this.operation.responses || {}).default);
    }
    getResponseTypesForStatus(status) {
        return this._getResponseTypes((this.operation.responses || {})[status]);
    }
}

class TypeRegistry {
    constructor(args, spec, nameProvider) {
        this.types = [];
        this.operations = [];
        this.spec = spec;
        this.args = args;
        this.nameProvider = nameProvider;
        this.registerOperations();
        this.registerTypes();
    }
    getArgs() {
        return this.args;
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
    resolveRef(ref) {
        return this.getSchemaByName(last(ref.$ref.split('/')));
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
        if (isAllOfType(schema) && !schema.allOf.every(isRefType)) {
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
                if (schema !== null) {
                    this.registerTypeRecursively(this.nameProvider.getResponseTypeName(op.getId(), op.method), schema, false);
                }
            }
        }
    }
    registerOperation(url, method, operation) {
        this.operations.push(new OperationWrapper(url, method, operation, this.spec));
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
                return this.generateRegisteredType(schema);
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
            else if (isObjectType(schema)) {
                return this.generateAnonymusObjectType(schema);
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
        return this.registry.getNameProvider().addTypeNamespace(name);
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
    generateRegisteredType(schema) {
        return this.registry.getNameProvider().addTypeNamespace(this.registry.getNameBySchema(schema));
    }
    generateAnonymusObjectType(schema) {
        const fields = entries(schema.properties).map(([name, propSchema]) => {
            const fieldName = isVarName(name) ? name : `'${name}'`;
            const colon = schema.required && schema.required.indexOf(name) >= 0 ? ':' : '?:';
            return `${fieldName}${colon}${this.generate(propSchema)}`;
        });
        return `{${fields}}`;
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
        else if (isOneOfType(schema)) {
            return this.generateOneOfType(name);
        }
        else if (isAllOfType(schema)) {
            return this.generateAllOfType(name);
        }
        else if (isAnyOfType(schema)) {
            return this.generateAnyOfType(name);
        }
        else if (isObjectType(schema)) {
            return this.generateTypeDeclaration(name);
        }
        console.error(`${name} is of unknown type, cannot be generated`);
        return null;
    }
    generateConstEnum(name) {
        const schema = this.registry.getSchemaByName(name);
        const np = this.registry.getNameProvider();
        return `export enum ${name} {
      ${schema.enum.map((value) => `${np.getEnumConstantName(value)} = '${value}'`).join(',')}
    }`;
    }
    generateTypeDeclarationField(name, schema, isRequired) {
        const colon = isRequired ? ':' : '?:';
        return `${name}${colon}${this.typeRefGenerator.generate(schema)}`;
    }
    generateTypeDeclarationFields(schema) {
        const discriminators = getDiscriminators(schema, this.registry);
        const fields = entries(schema.properties || {})
            .map(([name, subSchema]) => {
            if (discriminators.some((d) => d.propertyName === name)) {
                return null;
            }
            const isRequired = schema.required && schema.required.indexOf(name) >= 0;
            return this.generateTypeDeclarationField(name, subSchema, isRequired);
        })
            .filter((field) => field !== null);
        const allFields = discriminators.map((d) => `${d.propertyName}: '${d.value}'`).concat(fields);
        return allFields.join(';\n');
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
            .filter((code) => code !== null)
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
            const np = this.registry.getNameProvider();
            const type = np.addTypeNamespace(np.getParametersTypeName(op.getId()));
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
        const resTypes = op.getResolvedResponseTypes();
        const { refGenerator } = this;
        switch (resTypes.length) {
            case 0:
                return 'void';
            default:
                if (resTypes.every((t) => t === null)) {
                    return 'void';
                }
                return unique(resTypes.filter((t) => t !== null).map((t) => refGenerator.generate(t))).join(' | ');
        }
    }
    generate(id) {
        const op = this.registry.getOperation(id);
        const name = this.registry.getNameProvider().getOperatioName(id);
        return `${name}(${this.generateParameters(op)}): ${this.generateReturnType(op)}`;
    }
}

class ResponseHandlerGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.refGenerator = new TypeRefGenerator(this.registry);
    }
    generateReturnValue(types) {
        if (types.length === 0 || (types.length === 1 && types[0] === null)) {
            return '';
        }
        else if (types.every((t) => t !== null)) {
            const tString = types.map((t) => this.refGenerator.generate(t)).join('|');
            return `this.adapter.deserialize<${tString}>(response.body)`;
        }
        else {
            throw new TypeError(`Can't handle multiple content-types!`);
        }
    }
    generateCaseBody(status, op) {
        if (status >= 200 && status < 300) {
            return `Promise.resolve(${this.generateReturnValue(op.getResponseTypesForStatus(status))})`;
        }
        else {
            return `Promise.reject(${this.generateReturnValue(op.getResponseTypesForStatus(status))})`;
        }
    }
    generateSwitchBranches(op) {
        const cases = op.getResponseStatuses().map((status) => {
            return `case ${status}: return ${this.generateCaseBody(status, op)}`;
        });
        if (op.hasDefaultStatus()) {
            const value = this.generateReturnValue(op.getDefaultResponseTypes());
            cases.push(`default: return response.status >= 200 && response.status < 300 ? Promise.resolve(${value}) : Promise.reject(${value})`);
        }
        else {
            cases.push(`default: return Promise.reject('Unexpected status!')`); // TODO
        }
        return cases.join('\n');
    }
    generateSwitch(op) {
        return `switch(response.status) {
      ${this.generateSwitchBranches(op)}
    }`;
    }
    generate(op) {
        const statusesLength = op.getResponseStatuses().length + (op.hasDefaultStatus() ? 1 : 0);
        switch (statusesLength) {
            case 0:
                return `() => Promise.resolve()`;
            default:
                const rawPType = op
                    .getResolvedResponseTypes()
                    .filter((t) => t !== null)
                    .map((t) => this.refGenerator.generate(t))
                    .join('|');
                const pType = rawPType.length > 0 ? rawPType : 'void';
                return `(response: __HttpResponse): Promise<${pType}> => {
          ${this.generateSwitch(op)}
        }`;
        }
    }
}

class UrlGenerator extends BaseGenerator {
    generatePathSegment(param) {
        if (param.style && param.style !== 'simple') {
            throw new TypeError(`Only "simple" path parameters are allowed ("${param.style}" found}!`);
        }
        const value = isVarName(param.name) ? `params.${param.name}` : `params['${param.name}']`;
        if (!param.schema || isSimpleType(param.schema)) {
            return value;
        }
        else if (isArrayType(param.schema)) {
            return `${value}.join(',')`;
        }
        else if (isObjectType(param.schema)) {
            if (param.explode) {
                return `Object.keys(${value}).map((key) => \`\${key}=${value}[\${key}]\`).join(',')`;
            }
            else {
                return `Object.keys(${value}).map((key) => \`\${key},${value}[\${key}]\`).join(',')`;
            }
        }
        else if (isObjectType(param.schema) && !param.explode) ;
        else {
            throw new TypeError(`Can't create serializer for param "${param.name}"`);
        }
    }
    generateQuerySegment(param) {
        if (param.style && param.style !== 'form') {
            throw new TypeError(`Only "form" query parameters are allowed ("${param.style}" found}!`);
        }
        const key = param.name;
        const value = `params.${param.name}`;
        if (!param.schema || isSimpleType(param.schema)) {
            const segment = `\`${key}=\${${value}}\``;
            return param.required ? segment : `${value} === undefined ? null : ${segment}`;
        }
        else if (isArrayType(param.schema)) {
            if (param.explode || param.explode === undefined) {
                const segment = `${value}.map((e) => \`${key}=\${e}\`).join('&')`;
                const withEmptyCheck = `${value}.length === 0 ? null : ${segment}`;
                return param.required ? withEmptyCheck : `${value} === undefined || ${withEmptyCheck}`;
            }
        }
        throw new TypeError(`Can't generate query parameter: "${param.name}"!`);
    }
    generateUrlQuerySegments(op) {
        const items = op
            .getQueryParameters()
            .map((param) => this.generateQuerySegment(param))
            .join(',\n');
        return `[${items}]`;
    }
    generateUrlPath(op) {
        const segments = op.url.split('/').filter((s) => s.length > 0);
        const pathParams = op.getPathParameters();
        const replacedSegments = segments.map((segment) => {
            if (startsWith(segment, '{') && endsWith(segment, '}')) {
                const paramName = segment.substring(1, segment.length - 1);
                const param = pathParams.find(({ name }) => name === paramName);
                if (!param) {
                    throw new TypeError(`"${paramName}" is not a valid parameter in the URL of operation ${op.getId()}`);
                }
                return `\${${this.generatePathSegment(param)}}`;
            }
            return segment;
        });
        return replacedSegments.join('/');
    }
    quotePath(path$$1, hasVars) {
        return hasVars ? `\`${path$$1}\`` : `'${path$$1}'`;
    }
    generateWithoutQuerySegments(op) {
        if (op.getPathParameters().length > 0) {
            return `\`/${this.generateUrlPath(op)}\``;
        }
        return `'/${this.generateUrlPath(op)}'`;
    }
    generateWithQuerySegments(op) {
        const querySegments = this.generateUrlQuerySegments(op);
        return `(() => {
      const querySegments = ${querySegments}
      const queryString = querySegments.filter((segment) => segment !== null).join('&')
      const query = queryString.length === 0 ? '' : \`?\${queryString}\`
      return \`\/${this.generateUrlPath(op)}\${query}\`
    })()`;
    }
    generate(op) {
        if (op.getQueryParameters().length > 0) {
            return this.generateWithQuerySegments(op);
        }
        else {
            return this.generateWithoutQuerySegments(op);
        }
    }
}

class HeadersGenerator extends BaseGenerator {
    generateValueAccess(param) {
        return isVarName(param.name) ? `params.${param.name}` : `params['${param.name}']`;
    }
    generateKey(param) {
        return isVarName(param.name) ? param.name : `'${param.name}'`;
    }
    generateValue(param) {
        if (param.style && param.style !== 'simple') {
            throw new TypeError(`Only "simple" header parameters are allowed ("${param.style}" found}!`);
        }
        const value = this.generateValueAccess(param);
        if (!param.schema || isSimpleType(param.schema)) {
            return `String(${value})`;
        }
        else if (isArrayType(param.schema)) {
            return `${value}.join(',')`;
        }
        else if (isObjectType(param.schema)) {
            if (param.explode) {
                return `Object.keys(${value}).map((key) => \`\${key}=${value}[\${key}]\`).join(',')`;
            }
            else {
                return `Object.keys(${value}).map((key) => \`\${key},${value}[\${key}]\`).join(',')`;
            }
        }
        else {
            throw new TypeError(`Can't create serializer for param "${param.name}"`);
        }
    }
    generateHeaderKeyValuePair(param) {
        const requiredKVPair = `${this.generateKey(param)}: ${this.generateValue(param)}`;
        if (param.required) {
            return requiredKVPair;
        }
        else {
            const value = this.generateValueAccess(param);
            return `...(${value} === undefined ? {} : {${requiredKVPair}})`;
        }
    }
    generate(op) {
        const kvPairs = op
            .getHeaderParameters()
            .map((param) => this.generateHeaderKeyValuePair(param))
            .join(',');
        return `{ ${kvPairs} }`;
    }
}

class OperationGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.signatureGenerator = new OperationSignatureGenerator(this.registry);
        this.handlerGenerator = new ResponseHandlerGenerator(this.registry);
        this.urlGenerator = new UrlGenerator(this.registry);
        this.headersGenerator = new HeadersGenerator(this.registry);
    }
    generateHeadersValue(op) {
        return this.headersGenerator.generate(op);
    }
    generateBody(op) {
        const bodyType = this.signatureGenerator.generateBodyParameter(op);
        if (bodyType === null) {
            return '';
        }
        return 'body: this.adapter.serialize(content),';
    }
    generateOperationBody(op) {
        return `const request: __HttpRequest = {
        url: ${this.urlGenerator.generate(op)},
        method: '${op.method.toUpperCase()}',
        headers: ${this.generateHeadersValue(op)},
        ${this.generateBody(op)}
      }
      return this.adapter.execute(request).then(${this.handlerGenerator.generate(op)})`;
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
        return `export class ${np.getApiImplName()} implements ${np.addApiContractNamespace(np.getApiTypeName())} {
      private readonly adapter: __HttpAdapter 
      constructor(adapter: __HttpAdapter) {
        this.adapter = adapter
      }
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
        if (isRefType(param)) {
            throw new TypeError(`Can't handle this!!!`);
        }
        const colon = param.required || param.in === 'path' ? ':' : '?:';
        const paramName = isVarName(param.name) ? param.name : `'${param.name}'`;
        return `${paramName}${colon} ${this.refGenerator.generate(param.schema)}`;
    }
    generateParamsType(op) {
        const name = this.registry.getNameProvider().getParametersTypeName(op.getId());
        return `export type ${name} = {
      ${op.getParameters().map((param) => this.generateParameterField(param))}
    }`;
    }
    generate(operationId) {
        const op = this.registry.getOperation(operationId);
        if (!op.operation.parameters || op.operation.parameters.length === 0) {
            return null;
        }
        return this.generateParamsType(op);
    }
}

class ParameterTypesGenerator extends BaseGenerator {
    generate() {
        if (this.registry.getOperations().some((op) => op.getCookieParameters().length > 0)) {
            throw new Error(`Can't use Cookie parameters at the moment!`);
        }
        const generator = new ParameterTypeGenerator(this.registry);
        return this.registry
            .getOperationIds()
            .map((id) => generator.generate(id))
            .filter((source) => source !== null)
            .join('\n');
    }
}

var GeneratorIds;
(function (GeneratorIds) {
    GeneratorIds["Types"] = "types";
    GeneratorIds["TypeGuards"] = "typeguards";
    GeneratorIds["ApiContract"] = "api-contract";
    GeneratorIds["Api"] = "api";
    GeneratorIds["Validators"] = "validators";
})(GeneratorIds || (GeneratorIds = {}));

const apiTypes = fs.readFileSync(path.join(__dirname, '../', 'ApiStaticTypes.ts'), 'utf-8');
const validatorTypes = fs.readFileSync(path.join(__dirname, '../', 'ValidatorStaticTypes.ts'), 'utf-8');
class StaticTypesGenerator {
    constructor(id) {
        this.id = id;
    }
    generate() {
        switch (this.id) {
            case GeneratorIds.Api:
                return apiTypes.trim();
            case GeneratorIds.Validators:
                return validatorTypes.trim();
        }
        return '';
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

class TypeGuardsGenerator extends BaseGenerator {
    generate() {
        const types = this.registry.getTypes().filter((type) => this.needsTypeGuard(type.schema));
        return flatMap(types, (type) => {
            return entries(type.schema.discriminator.mapping).map(([propertyValue, ref]) => {
                const baseTypeName = type.name;
                const checkedTypeName = getRefName(ref);
                const propertyName = type.schema.discriminator.propertyName;
                return this.generateTypeGuard(baseTypeName, checkedTypeName, propertyName, propertyValue);
            });
        }).join('\n');
    }
    generateTypeGuard(baseTypeName, checkedTypeName, propertyName, propertyValue) {
        const np = this.registry.getNameProvider();
        const tgName = np.getTypeGuardName(checkedTypeName);
        return `export function ${tgName}(input: ${np.addTypeNamespace(baseTypeName)}): input is ${np.addTypeNamespace(checkedTypeName)} {
      return input && input.${propertyName} === '${propertyValue}'
    }`;
    }
    needsTypeGuard(type) {
        return (isOneOfType(type) &&
            isObjectType(type) &&
            Boolean(type.discriminator) &&
            Boolean(type.discriminator.mapping) &&
            Boolean(type.discriminator.propertyName));
    }
}

function isPresent(varName) {
    return `${varName} !== null && ${varName} !== undefined`;
}
function isAbsent(varName) {
    return `${varName} === null || ${varName} === undefined`;
}
function isNotTypeOf(varName, type) {
    return `typeof ${varName} !== '${type}'`;
}
function isObject(varName) {
    return `(${varName} instanceof Object && !Array.isArray(${varName}))`;
}
function isNotObject(varName) {
    return `(!(${varName} instanceof Object) || Array.isArray(${varName}))`;
}
function isArray(varName) {
    return `Array.isArray(${varName})`;
}
function isNotArray(varName) {
    return `!Array.isArray(${varName})`;
}
function isNotEqualString(varName, value) {
    return `${varName} !== '${value}'`;
}
function forLoopCounter(arrayName, index = 'i') {
    return `let ${index} = 0, len = ${arrayName}.length; ${index} < len; ${index} += 1`;
}
function resultObject(path$$1, message, pathInterpolated) {
    if (pathInterpolated) {
        return `{ path: \`${path$$1}\`, message: '${message}' }`;
    }
    else {
        if (path$$1 === 'path') {
            return `{ path, message: '${message}' }`;
        }
        return `{ path: ${path$$1}, message: '${message}' }`;
    }
}

class ValidatorGenerator extends BaseGenerator {
    constructor(registry) {
        super(registry);
        this.stringMinLengthChecker = this.minLengthChecker((l) => `Should be at least ${l} charater(s)!`);
        this.arrayMinLengthChecker = this.minLengthChecker((l) => `Should have at least ${l} element(s)!`);
        this.stringMaxLengthChecker = this.maxLengthChecker((l) => `Should not be longer than ${l} charater(s)!`);
        this.arrayMaxLengthChecker = this.maxLengthChecker((l) => `Should not have more than ${l} element(s)!`);
        this.stringPropertyValidator = this.basicTypeCheckerValidator('string');
        this.boolPropertyValidator = this.basicTypeCheckerValidator('boolean');
        this.numberPropertyValidator = this.basicTypeCheckerValidator('number');
    }
    generate(name) {
        const np = this.registry.getNameProvider();
        const fnName = np.getValidatorName(name);
        const typeName = np.getTypeName(name);
        return `export function ${fnName}(input: ${np.addTypeNamespace(typeName)}, path: string = '$'): __ValidationResult[] {
      const results: __ValidationResult[] = []
      ${this.schemaValidators(this.registry.getSchemaByName(name))}
      return results
    }`;
    }
    schemaValidators(schema) {
        if (isOneOfType(schema)) {
            if (schema.discriminator) {
                return this.oneOfValidator('${path}', schema);
            }
            if (schema.oneOf.length === 1) {
                const oneOf = schema.oneOf[0];
                const name = isRefType(oneOf) ? getRefName(oneOf.$ref) : this.registry.getNameBySchema(oneOf);
                const validatorName = this.registry.getNameProvider().getValidatorName(name);
                return `results.push(...${validatorName}(input, path))`;
            }
        }
        else if (isObjectType(schema)) {
            return this.objectValidator(schema);
        }
        else if (isEnumType(schema)) {
            return this.enumValidator(schema);
        }
        else if (isArrayType(schema)) {
            return this.arrayValidator(schema);
        }
        return '';
    }
    arrayValidator(schema) {
        return `if(${isAbsent('input')} || ${isNotArray('input')}) {
      results.push(${resultObject('path', 'Should be an array!', false)})
    }
    ${this.arrayPropValidator('path', 'input', schema)}`;
    }
    objectValidator(schema) {
        const validators = [];
        const discriminators = getDiscriminators(schema, this.registry);
        if (discriminators && discriminators.length > 0) {
            discriminators.forEach(({ propertyName, value }) => validators.push(this.discriminatorValidator(`\${path}.${propertyName}`, accessor('input', propertyName), value)));
        }
        if (isMapType(schema)) {
            validators.push(this.additionalPropsValidator('path', 'input', schema));
        }
        else {
            entries(schema.properties || {})
                .filter(([name]) => name !== 'traversableAgain' && name !== 'empty') // TODO scala collection bullshit
                .map(([name, propSchema]) => this.propertyValidator(name, propSchema, schema.required && schema.required.indexOf(name) >= 0))
                .filter((str) => str !== null && str.length > 0)
                .forEach((v) => validators.push(v));
            validators.push(this.excessPropChecker('path', 'input', schema));
        }
        return `if(${isAbsent('input')} || ${isNotObject('input')}) {
      results.push(${resultObject('path', 'Should be an object!', false)})
    } else {
      ${validators.join('\n')}
    }`;
    }
    enumValidator(schema) {
        const stringCheck = `if(${isNotTypeOf('input', 'string')}) {
      results.push(${resultObject('path', 'Should be represented as a string!', false)})
    }`;
        const enumName = this.registry.getNameBySchema(schema);
        const valuesConstName = `${camelCase(enumName)}Values`;
        const values$$1 = `${schema.enum.map((v) => `"${v}"`).join(', ')}`;
        const enumValueCheck = `const ${valuesConstName}: string[] = [${values$$1}]
    if(${valuesConstName}.indexOf(input) < 0) {
      results.push({ path, message: \`Should be one of \${${valuesConstName}.map((v) => \`"\${v}"\`).join(", ")}!\`})
    }`;
        return [stringCheck, enumValueCheck].join('\n');
    }
    oneOfValidator(path$$1, schema) {
        const { mapping, propertyName } = schema.discriminator;
        const discPath = `${path$$1}.${propertyName}`;
        return `if(${isAbsent('input')} || ${isNotObject('input')}) {
      results.push(${resultObject('path', 'Should be an object!', false)})
    } else {
      switch(input.${propertyName}) {
        ${entries(mapping)
            .map(([value, ref]) => this.oneOfDispatcher(value, ref))
            .join('\n')}
        default: results.push(${resultObject(discPath, 'Unexpected discriminator!', true)})
      }
    }`;
    }
    oneOfDispatcher(value, ref) {
        const validatorName = this.registry.getNameProvider().getValidatorName(getRefName(ref));
        return `case '${value}': return ${validatorName}(input, path)`;
    }
    propertyValidator(prop, propSchema, required) {
        const validators = [];
        const path$$1 = `\${path}.${prop}`;
        if (required) {
            validators.push(this.requiredPropertyValidator(path$$1, accessor('input', prop)));
        }
        const schema = isRefType(propSchema) ? this.registry.resolveRef(propSchema) : propSchema;
        validators.push(this.propValidator(path$$1, accessor('input', prop), schema));
        return validators.join('\n');
    }
    discriminatorValidator(path$$1, varName, value) {
        return `if(${isNotEqualString(varName, value)}) {
      results.push(${resultObject(path$$1, `Should be "${value}"!`, true)})
    }`;
    }
    propValidator(path$$1, varName, schema) {
        const validators = [];
        if (schema) {
            if (isObjectType(schema) || isEnumType(schema)) {
                validators.push(this.referenceValidator(path$$1, varName, schema));
            }
            else if (isSimpleType(schema)) {
                switch (schema.type) {
                    case PrimitiveType.string: {
                        validators.push(this.stringPropertyValidator(path$$1, varName));
                        if (!isNil(schema.minLength)) {
                            validators.push(this.stringMinLengthChecker(path$$1, varName, schema.minLength));
                        }
                        if (!isNil(schema.maxLength)) {
                            validators.push(this.stringMaxLengthChecker(path$$1, varName, schema.maxLength));
                        }
                        break;
                    }
                    case PrimitiveType.boolean: {
                        validators.push(this.boolPropertyValidator(path$$1, varName));
                        break;
                    }
                    case PrimitiveType.number:
                    case PrimitiveType.int:
                    case PrimitiveType.integer:
                    case PrimitiveType.double:
                    case PrimitiveType.float: {
                        validators.push(this.numberPropertyValidator(path$$1, varName));
                        break;
                    }
                }
            }
            else if (isArrayType(schema)) {
                validators.push(this.arrayPropTypeValidator(path$$1, varName));
                validators.push(this.arrayPropValidator(path$$1, varName, schema));
                if (!isNil(schema.minLength)) {
                    validators.push(this.arrayMinLengthChecker(path$$1, varName, schema.minLength));
                }
                if (!isNil(schema.maxLength)) {
                    validators.push(this.arrayMaxLengthChecker(path$$1, varName, schema.maxLength));
                }
            }
        }
        return validators.join('\n');
    }
    excessPropChecker(path$$1, varName, schema) {
        const discs = getDiscriminators(schema, this.registry).map(({ propertyName }) => propertyName);
        const ownKeys = Object.keys(schema.properties || {});
        const keysStr = discs
            .concat(ownKeys)
            .map((key) => `'${key}'`)
            .join(', ');
        return `if(${isPresent(varName)} && ${isObject(varName)}) {
      const allowedKeys: string[] = [${keysStr}]
      const keys = Object.keys(${varName})
      for (${forLoopCounter('keys')}) {
        const key = keys[i]
        if (allowedKeys.indexOf(key) < 0) {
          results.push(${resultObject('${path}["${key}"]', 'Unexpected property!', true)})
        }
      }
    }`;
    }
    arrayPropTypeValidator(path$$1, varName) {
        return `if(${isPresent(varName)} && ${isNotArray(varName)}) {
      results.push(${resultObject(path$$1, 'Should be an array!', true)})
    }`;
    }
    arrayPropValidator(path$$1, varName, schema) {
        if (!schema.items) {
            return null;
        }
        const itemsSchema = isRefType(schema.items) ? this.registry.resolveRef(schema.items) : schema.items;
        const itemPath = `${path$$1}[\${i}]`;
        const itemVar = 'item';
        return `if(${isArray(varName)}) {
      for (${forLoopCounter(varName)}) {
        const ${itemVar} = ${varName}[i]
        ${this.requiredPropertyValidator(itemPath, itemVar)}
        ${this.propValidator(itemPath, itemVar, itemsSchema)}
      }
    }`;
    }
    additionalPropsValidator(path$$1, varName, schema) {
        const additionalProps = schema.additionalProperties;
        if (typeof additionalProps === 'boolean') {
            return '';
        }
        const propSchema = isRefType(additionalProps) ? this.registry.resolveRef(additionalProps) : additionalProps;
        const validator = this.propValidator(`\${path}["\${key}"]`, 'value', propSchema);
        if (validator) {
            return `const keys = Object.keys(${varName})
        for(${forLoopCounter('keys')}) {
          const key = keys[i]
          const value = ${varName}[key]
          ${validator}
        }`;
        }
        return null;
    }
    referenceValidator(path$$1, varName, schema) {
        if (!this.registry.hasSchema(schema)) {
            return null;
        }
        const np = this.registry.getNameProvider();
        const name = this.registry.getNameBySchema(schema);
        return `if(${isPresent(varName)}) {
      results.push(...${np.getValidatorName(name)}(${varName}, \`${path$$1}\`))
    }`;
    }
    requiredPropertyValidator(path$$1, varName) {
        return `if(${isAbsent(varName)}) {
      results.push(${resultObject(path$$1, 'Should not be empty!', true)})
    }`;
    }
    minLengthChecker(message) {
        return (path$$1, varName, minLength) => {
            return `if(${isPresent(varName)} && ${varName}.length < ${minLength}) {
        results.push(${resultObject(path$$1, message(minLength), true)})
      }`;
        };
    }
    maxLengthChecker(message) {
        return (path$$1, varName, maxLength) => {
            return `if(${isPresent(varName)} && ${varName}.length > ${maxLength}) {
        results.push(${resultObject(path$$1, message(maxLength), true)})
      }`;
        };
    }
    basicTypeCheckerValidator(type) {
        return (path$$1, varName) => {
            return `if(${isPresent(varName)} && ${isNotTypeOf(varName, type)}) {
        results.push(${resultObject(path$$1, `Should be a ${type}!`, true)})
      }`;
        };
    }
}

class ValidatorsGenerator extends BaseGenerator {
    generate() {
        const generator = new ValidatorGenerator(this.registry);
        return this.registry
            .getTypes()
            .map((type) => generator.generate(type.name))
            .join('\n');
    }
}

class ImportsGenerator extends BaseGenerator {
    generate() {
        const { registry } = this;
        const { apiContractPath, typesPath, targets } = registry.getArgs();
        const np = registry.getNameProvider();
        const imports = [];
        if (apiContractPath && targets.indexOf(GeneratorIds.ApiContract) < 0) {
            imports.push(`import * as ${np.getApiContractImport()} from '${apiContractPath}'`);
        }
        if (typesPath && targets.indexOf(GeneratorIds.Types) < 0) {
            imports.push(`import * as ${np.getTypesImport()} from '${typesPath}'`);
        }
        if (imports.length > 0) {
            imports.push('');
        }
        return imports.join('\n');
    }
}

class RootGenerator extends BaseGenerator {
    generate() {
        const { targets } = this.registry.getArgs();
        const results = [];
        if (targets.indexOf(GeneratorIds.Types) >= 0) {
            results.push(this.generateTypes());
        }
        if (targets.indexOf(GeneratorIds.ApiContract) >= 0) {
            results.push(this.generateApiContract());
        }
        if (targets.indexOf(GeneratorIds.TypeGuards) >= 0) {
            results.push(this.generateTypeGuards());
        }
        if (targets.indexOf(GeneratorIds.Api) >= 0) {
            results.push(this.generateApi());
        }
        if (targets.indexOf(GeneratorIds.Validators) >= 0) {
            results.push(this.generateValidators());
        }
        return this.format(results.join('\n'));
    }
    generateTypes() {
        return [new TypesGenerator(this.registry), new ParameterTypesGenerator(this.registry)]
            .map((generator) => generator.generate())
            .join('\n');
    }
    generateApiContract() {
        return [new ImportsGenerator(this.registry), new ApiTypeGenerator(this.registry)]
            .map((generator) => generator.generate())
            .join('\n');
    }
    generateTypeGuards() {
        return [new ImportsGenerator(this.registry), new TypeGuardsGenerator(this.registry)]
            .map((generator) => generator.generate())
            .join('\n');
    }
    generateApi() {
        return [
            new ImportsGenerator(this.registry),
            new StaticTypesGenerator(GeneratorIds.Api),
            new ApiGenerator(this.registry),
        ]
            .map((generator) => generator.generate())
            .join('\n');
    }
    generateValidators() {
        return [
            new ImportsGenerator(this.registry),
            new StaticTypesGenerator(GeneratorIds.Validators),
            new ValidatorsGenerator(this.registry),
        ]
            .map((generator) => generator.generate())
            .join('\n');
    }
}

exports.TypeRegistry = TypeRegistry;
exports.RootGenerator = RootGenerator;
