import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import {
  getQueryParameters,
  getRequestBodyType,
  type OperationLike,
} from './operations';
import { type PathTreeNode, buildPathTree } from './path-tree';
import { schemaToTypeString } from './schema';

const CLIENT_INIT_TYPE =
  "Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }";

const QUERY_METHODS = new Set(['get', 'head']);

function quotePropKey(name: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : `'${name}'`;
}

function accessProp(chain: string, prop: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop)
    ? `${chain}.${prop}`
    : `${chain}['${prop}']`;
}

function generateQueryNodeLines(
  node: PathTreeNode,
  pathParts: string[],
  clientChain: string,
  indent: string
): string[] {
  const lines: string[] = [];
  const bodyIndent = indent + '  ';

  if (Object.keys(node.operations).length > 0) {
    lines.push(`${indent}key: ${clientChain}.key,`);
    lines.push(`${indent}path: ${clientChain}.path,`);
  }

  for (const [method, operation] of Object.entries(node.operations)) {
    const queryParams = getQueryParameters(operation as OperationLike);
    const bodyType = getRequestBodyType(operation as OperationLike);
    const isQuery = QUERY_METHODS.has(method);

    lines.push(`${indent}/**`);
    lines.push(`${indent} * @method ${method.toUpperCase()}`);
    lines.push(`${indent} * @path /${pathParts.join('/')}`);
    if ((operation as OperationLike).summary) {
      lines.push(`${indent} * ${(operation as OperationLike).summary}`);
    }
    lines.push(`${indent} */`);

    if (isQuery) {
      const paramFields: string[] = [];
      for (const qp of queryParams) {
        const qpType = qp.schema
          ? schemaToTypeString(qp.schema, true)
          : 'string';
        const optional = qp.required ? '' : '?';
        paramFields.push(`${bodyIndent}  ${qp.name}${optional}: ${qpType};`);
      }
      paramFields.push(`${bodyIndent}  init?: ${CLIENT_INIT_TYPE};`);

      const hasRequiredQuery = queryParams.some((qp) => qp.required);
      const paramsOptional = hasRequiredQuery ? '' : '?';
      const paramArg = `params${paramsOptional}: {\n${paramFields.join('\n')}\n${bodyIndent}}`;

      // Include query params in the key for correct cache separation
      let queryKey: string;
      if (queryParams.length > 0) {
        const qpEntries = queryParams
          .map((qp) => `${qp.name}: params?.${qp.name}`)
          .join(', ');
        queryKey = `[...${clientChain}.key, { ${qpEntries} }] as const`;
      } else {
        queryKey = `${clientChain}.key`;
      }

      lines.push(`${indent}${method}: (${paramArg}) => ({`);
      lines.push(`${bodyIndent}queryKey: ${queryKey},`);
      lines.push(
        `${bodyIndent}queryFn: () => ${clientChain}.${method}(params),`
      );
      lines.push(`${indent}}),`);
    } else {
      // Mutation: path params are already in the closure via the chain,
      // so mutationFn receives only the request-specific params (body, init).
      const paramFields: string[] = [];
      if (bodyType) {
        paramFields.push(`${bodyIndent}  body: ${bodyType};`);
      }
      paramFields.push(`${bodyIndent}  init?: ${CLIENT_INIT_TYPE};`);

      const hasRequired = !!bodyType;
      const paramsOptional = hasRequired ? '' : '?';
      const mutationParamArg = `params${paramsOptional}: {\n${paramFields.join('\n')}\n${bodyIndent}}`;

      lines.push(`${indent}${method}: () => ({`);
      lines.push(
        `${bodyIndent}mutationFn: (${mutationParamArg}) => ${clientChain}.${method}(params),`
      );
      lines.push(`${indent}}),`);
    }
  }

  for (const [, child] of node.children) {
    const childPathParts = [...pathParts, child.segment];
    renderQueryNodeEntry(child, childPathParts, clientChain, indent, lines);
  }

  return lines;
}

function renderQueryNodeEntry(
  node: PathTreeNode,
  pathParts: string[],
  parentChain: string,
  indent: string,
  lines: string[]
): void {
  const contentIndent = indent + '  ';

  if (node.isDynamic) {
    const paramName = node.paramName!;
    const paramType = node.paramSchema
      ? schemaToTypeString(node.paramSchema, true)
      : 'string';
    const childChain = `${parentChain}.${paramName}(${paramName})`;
    lines.push(`${indent}${paramName}: (${paramName}: ${paramType}) => ({`);
    lines.push(
      ...generateQueryNodeLines(node, pathParts, childChain, contentIndent)
    );
    lines.push(`${indent}}),`);
  } else {
    const segment = node.segment;
    const childChain = accessProp(parentChain, segment);
    lines.push(`${indent}${quotePropKey(segment)}: {`);
    lines.push(
      ...generateQueryNodeLines(node, pathParts, childChain, contentIndent)
    );
    lines.push(`${indent}},`);
  }
}

export function generateQuery(paths: OpenAPIV3_1.PathsObject): string {
  const tree = buildPathTree(paths);

  if (tree.size === 0) {
    return [
      `import type { apiClient } from './client';`,
      ``,
      `type ApiClient = ReturnType<typeof apiClient>;`,
      ``,
      `export function queryClient(client: ApiClient) {`,
      `  return {};`,
      `}`,
    ].join('\n');
  }

  const bodyLines: string[] = [];

  for (const [, node] of tree) {
    renderQueryNodeEntry(node, [node.segment], 'client', '    ', bodyLines);
  }

  return [
    `import type { apiClient } from './client';`,
    ``,
    `type ApiClient = ReturnType<typeof apiClient>;`,
    ``,
    `export function queryClient(client: ApiClient) {`,
    `  return {`,
    ...bodyLines,
    `  };`,
    `}`,
  ].join('\n');
}
