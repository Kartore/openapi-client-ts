import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import {
  getResponseType,
  getQueryParameters,
  getRequestBodyType,
} from './operations';
import {
  type PathTreeNode,
  buildPathTree,
  isDynamicSegment,
} from './path-tree';
import { schemaToTypeString } from './schema';

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

function quotePropKey(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : `'${name}'`;
}

const CLIENT_INIT_TYPE =
  "Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }";

const CLIENT_OPTIONS_TYPE = `clientOptions?: { init?: ${CLIENT_INIT_TYPE}; fetch?: typeof globalThis.fetch }`;

function renderNodeEntry(
  node: PathTreeNode,
  keyItems: string[],
  pathParts: string[],
  indent: string,
  lines: string[]
): void {
  const contentIndent = indent + '  ';
  if (node.isDynamic) {
    const paramName = node.paramName!;
    const paramType = node.paramSchema
      ? schemaToTypeString(node.paramSchema, true)
      : 'string';
    lines.push(`${indent}${paramName}: (${paramName}: ${paramType}) => ({`);
    lines.push(...generateNodeLines(node, keyItems, pathParts, contentIndent));
    lines.push(`${indent}}),`);
  } else {
    const segment = node.segment;
    lines.push(`${indent}${quotePropKey(segment)}: {`);
    lines.push(...generateNodeLines(node, keyItems, pathParts, contentIndent));
    lines.push(`${indent}},`);
  }
}

function generateNodeLines(
  node: PathTreeNode,
  keyItems: string[],
  pathParts: string[],
  indent: string
): string[] {
  const lines: string[] = [];
  const bodyIndent = indent + '  ';
  const urlExpr = buildUrlExpression(pathParts);

  lines.push(`${indent}key: ${buildKeyExpression(keyItems)},`);
  lines.push(`${indent}path: ${buildPathValue(pathParts)},`);

  for (const [method, operation] of Object.entries(node.operations)) {
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
          `${bodyIndent}if (params.${qp.name} !== undefined) searchParams.set('${qp.name}', String(params.${qp.name}));`
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

    if (returnType === 'void') {
      lines.push(
        `${bodyIndent}return _fetch(url, ${fetchInit}).then(() => undefined);`
      );
    } else {
      lines.push(
        `${bodyIndent}return _fetch(url, ${fetchInit}).then((r) => r.json()) as Promise<${returnType}>;`
      );
    }

    lines.push(`${indent}},`);
  }

  for (const [, child] of node.children) {
    const childPathParts = [...pathParts, child.segment];
    const childKeyItems = child.isDynamic
      ? [...keyItems, child.paramName!]
      : [...keyItems, `'${child.segment}'`];
    renderNodeEntry(child, childKeyItems, childPathParts, indent, lines);
  }

  return lines;
}

export function generateClient(paths: OpenAPIV3_1.PathsObject): string {
  const tree = buildPathTree(paths);

  if (tree.size === 0) {
    return `export function apiClient(baseUrl: string, ${CLIENT_OPTIONS_TYPE}) {\n  return {};\n}`;
  }

  const bodyLines: string[] = [];

  for (const [, node] of tree) {
    const nodeKeyItems = node.isDynamic
      ? [node.paramName!]
      : [`'${node.segment}'`];
    renderNodeEntry(node, nodeKeyItems, [node.segment], '    ', bodyLines);
  }

  return [
    `export function apiClient(baseUrl: string, ${CLIENT_OPTIONS_TYPE}) {`,
    `  const _fetch = clientOptions?.fetch ?? globalThis.fetch;`,
    `  const _baseInit = clientOptions?.init;`,
    `  return {`,
    ...bodyLines,
    `  };`,
    `}`,
  ].join('\n');
}
