import type { OpenAPIV3_1 } from '@scalar/openapi-types';

import type { OperationLike, ParameterLike } from './operations';
import type { SchemaLike } from './schema';

export interface PathTreeNode {
  segment: string;
  isDynamic: boolean;
  paramName: string | null;
  paramSchema: SchemaLike | null;
  operations: Record<string, OperationLike>;
  children: Map<string, PathTreeNode>;
}

export const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const;

export function isDynamicSegment(segment: string): boolean {
  return segment.startsWith('{') && segment.endsWith('}');
}

export function buildPathTree(
  paths: OpenAPIV3_1.PathsObject
): Map<string, PathTreeNode> {
  const root = new Map<string, PathTreeNode>();

  for (const [pathPattern, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const segments = pathPattern.split('/').filter(Boolean);

    const pathParamSchemas = new Map<string, SchemaLike>();
    const methodOps = new Map<string, OperationLike>();

    for (const method of HTTP_METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      methodOps.set(method, op as OperationLike);
      for (const param of op.parameters ?? []) {
        if ('$ref' in param) continue;
        const p = param as OpenAPIV3_1.ParameterObject;
        if (p.in === 'path' && p.name && p.schema && !('$ref' in p.schema)) {
          pathParamSchemas.set(p.name, p.schema as SchemaLike);
        }
      }
    }

    let currentLevel = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const dynamic = isDynamicSegment(segment);
      const paramName = dynamic ? segment.slice(1, -1) : null;

      if (!currentLevel.has(segment)) {
        currentLevel.set(segment, {
          segment,
          isDynamic: dynamic,
          paramName,
          paramSchema: paramName
            ? (pathParamSchemas.get(paramName) ?? null)
            : null,
          operations: {},
          children: new Map(),
        });
      }

      const node = currentLevel.get(segment)!;

      if (i === segments.length - 1) {
        for (const [method, op] of methodOps) {
          node.operations[method] = op;
        }
      }

      currentLevel = node.children;
    }
  }

  return root;
}

export type { ParameterLike };
