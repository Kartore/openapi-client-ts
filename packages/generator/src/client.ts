import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import {
  collectOperationRefTypes,
  getResponseType,
  getQueryParameters,
  getRequestBodyType,
} from './operations';
import {
  type PathTreeNode,
  buildPathTree,
  isDynamicSegment,
} from './path-tree';
import { collectRefTypes, schemaToTypeString } from './schema';

export function segmentsToTemplateParts(pathParts: string[]): string[] {
  return pathParts.map((p) =>
    isDynamicSegment(p) ? `\${${p.slice(1, -1)}}` : p
  );
}

export function buildKeyExpression(keyItems: string[]): string {
  return `[${keyItems.join(', ')}] as const`;
}

export function buildPathValue(pathParts: string[]): string {
  const parts = segmentsToTemplateParts(pathParts);
  const pathStr = parts.join('/');
  const hasDynamic = parts.some((p) => p.startsWith('${'));
  return hasDynamic ? `\`/${pathStr}\`` : `'/${pathStr}' as const`;
}

export function buildUrlExpression(pathParts: string[]): string {
  return `\`\${baseUrl}/${segmentsToTemplateParts(pathParts).join('/')}\``;
}

function segmentToPropKey(segment: string): string {
  const key = segment.replace(/-(.)/g, (_, c: string) => c.toUpperCase());
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
}

const CLIENT_INIT_TYPE =
  "Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }";

const CLIENT_OPTIONS_TYPE = `clientOptions?: { init?: ${CLIENT_INIT_TYPE}; fetch?: typeof globalThis.fetch }`;

const API_ERROR_PREAMBLE = `\
export class HTTPError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly response: Response;
  constructor(response: Response) {
    super(\`HTTP Error: \${response.status} \${response.statusText}\`);
    this.name = 'HTTPError';
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
  }
}

function _checkOk(response: Response): Response {
  if (!response.ok) throw new HTTPError(response);
  return response;
}
`;

function renderNodeEntry(
  node: PathTreeNode,
  keyItems: string[],
  pathParts: string[],
  indent: string,
  lines: string[],
  collector: Set<string>,
  throwOnHttpError: boolean
): void {
  const contentIndent = indent + '  ';
  if (node.isDynamic) {
    const paramName = node.paramName!;
    if (node.paramSchema) collectRefTypes(node.paramSchema, collector);
    const paramType = node.paramSchema
      ? schemaToTypeString(node.paramSchema, true)
      : 'string';
    lines.push(`${indent}${paramName}: (${paramName}: ${paramType}) => ({`);
    lines.push(
      ...generateNodeLines(
        node,
        keyItems,
        pathParts,
        contentIndent,
        collector,
        throwOnHttpError
      )
    );
    lines.push(`${indent}}),`);
  } else {
    const segment = node.segment;
    lines.push(`${indent}${segmentToPropKey(segment)}: {`);
    lines.push(
      ...generateNodeLines(
        node,
        keyItems,
        pathParts,
        contentIndent,
        collector,
        throwOnHttpError
      )
    );
    lines.push(`${indent}},`);
  }
}

function generateNodeLines(
  node: PathTreeNode,
  keyItems: string[],
  pathParts: string[],
  indent: string,
  collector: Set<string>,
  throwOnHttpError: boolean
): string[] {
  const lines: string[] = [];
  const bodyIndent = indent + '  ';
  const urlExpr = buildUrlExpression(pathParts);

  if (Object.keys(node.operations).length > 0) {
    lines.push(`${indent}key: ${buildKeyExpression(keyItems)},`);
    lines.push(`${indent}path: ${buildPathValue(pathParts)},`);
  }

  for (const [method, operation] of Object.entries(node.operations)) {
    collectOperationRefTypes(operation, collector);
    const returnType = getResponseType(operation);
    const queryParams = getQueryParameters(operation);
    const bodyType = getRequestBodyType(operation);

    lines.push(`${indent}/**`);
    lines.push(`${indent} * @method ${method.toUpperCase()}`);
    lines.push(`${indent} * @path /${pathParts.join('/')}`);
    if (operation.summary) lines.push(`${indent} * ${operation.summary}`);
    lines.push(`${indent} */`);

    const paramFields: string[] = [];
    for (const qp of queryParams) {
      const qpType = qp.schema ? schemaToTypeString(qp.schema, true) : 'string';
      const optional = qp.required ? '' : '?';
      paramFields.push(`${bodyIndent}  ${qp.name}${optional}: ${qpType};`);
    }
    if (bodyType) {
      paramFields.push(`${bodyIndent}  body: ${bodyType};`);
    }
    paramFields.push(`${bodyIndent}  init?: ${CLIENT_INIT_TYPE};`);

    const hasRequiredFields =
      queryParams.some((qp) => qp.required) || !!bodyType;
    const paramsOptional = hasRequiredFields ? '' : '?';
    const paramArg = `params${paramsOptional}: {\n${paramFields.join('\n')}\n${bodyIndent}}`;

    lines.push(
      `${indent}${method}: (${paramArg}): Promise<${returnType}> => {`
    );

    if (queryParams.length > 0) {
      lines.push(`${bodyIndent}const searchParams = new URLSearchParams();`);
      for (const qp of queryParams) {
        lines.push(
          `${bodyIndent}if (params?.${qp.name} !== undefined) searchParams.set('${qp.name}', String(params.${qp.name}));`
        );
      }
      lines.push(`${bodyIndent}const qs = searchParams.toString();`);
      lines.push(
        `${bodyIndent}const url = ${urlExpr} + (qs ? \`?\${qs}\` : '');`
      );
    } else {
      lines.push(`${bodyIndent}const url = ${urlExpr};`);
    }

    const mergedHeaders = bodyType
      ? `{ 'Content-Type': 'application/json', ..._baseInit?.headers, ...params?.init?.headers }`
      : `{ ..._baseInit?.headers, ...params?.init?.headers }`;
    const bodyPart = bodyType ? `, body: JSON.stringify(params.body)` : '';
    const fetchInit = `{ ..._baseInit, ...params?.init, headers: ${mergedHeaders}, method: '${method.toUpperCase()}'${bodyPart} }`;

    const checkOkChain = throwOnHttpError ? `.then(_checkOk)` : '';
    if (returnType === 'void') {
      lines.push(
        `${bodyIndent}return _fetch(url, ${fetchInit})${checkOkChain}.then(() => undefined);`
      );
    } else {
      lines.push(
        `${bodyIndent}return _fetch(url, ${fetchInit})${checkOkChain}.then((r) => r.json()) as Promise<${returnType}>;`
      );
    }

    lines.push(`${indent}},`);
  }

  for (const [, child] of node.children) {
    const childPathParts = [...pathParts, child.segment];
    const childKeyItems = child.isDynamic
      ? [...keyItems, child.paramName!]
      : [...keyItems, `'${child.segment}'`];
    renderNodeEntry(
      child,
      childKeyItems,
      childPathParts,
      indent,
      lines,
      collector,
      throwOnHttpError
    );
  }

  return lines;
}

export function generateClient(
  paths: OpenAPIV3_1.PathsObject,
  options?: { typesImportPath?: string; throwOnHttpError?: boolean }
): string {
  const tree = buildPathTree(paths);
  const throwOnHttpError = options?.throwOnHttpError ?? true;

  const preamble = throwOnHttpError ? `${API_ERROR_PREAMBLE}\n` : '';

  if (tree.size === 0) {
    return `/* eslint-disable */\n${preamble}export function apiClient(baseUrl: string, ${CLIENT_OPTIONS_TYPE}) {\n  return {};\n}`;
  }

  const referencedTypes = new Set<string>();
  const bodyLines: string[] = [];

  for (const [, node] of tree) {
    const nodeKeyItems = node.isDynamic
      ? [node.paramName!]
      : [`'${node.segment}'`];
    renderNodeEntry(
      node,
      nodeKeyItems,
      [node.segment],
      '    ',
      bodyLines,
      referencedTypes,
      throwOnHttpError
    );
  }

  const typesImportPath = options?.typesImportPath ?? './types';
  const importLine =
    referencedTypes.size > 0
      ? `import type { ${[...referencedTypes].sort().join(', ')} } from '${typesImportPath}';\n\n`
      : '';

  return (
    `/* eslint-disable */\n` +
    importLine +
    preamble +
    [
      `export function apiClient(baseUrl: string, ${CLIENT_OPTIONS_TYPE}) {`,
      `  const _fetch = clientOptions?.fetch ?? globalThis.fetch;`,
      `  const _baseInit = clientOptions?.init;`,
      `  return {`,
      ...bodyLines,
      `  };`,
      `}`,
    ].join('\n')
  );
}
