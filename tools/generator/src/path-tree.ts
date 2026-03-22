import type { AnyObject } from '@scalar/openapi-parser';

export interface PathTreeNode {
  segment: string;
  isDynamic: boolean;
  paramName: string | null;
  paramSchema: AnyObject | null;
  operations: Record<string, AnyObject>;
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
  paths: Record<string, AnyObject>
): Map<string, PathTreeNode> {
  const root = new Map<string, PathTreeNode>();

  for (const [pathPattern, pathItem] of Object.entries(paths)) {
    const pathItemObj = pathItem as AnyObject;
    const segments = pathPattern.split('/').filter(Boolean);

    const pathParamSchemas = new Map<string, AnyObject>();
    const methodOps = new Map<string, AnyObject>();

    for (const method of HTTP_METHODS) {
      const op = pathItemObj[method] as AnyObject | undefined;
      if (!op) continue;
      methodOps.set(method, op);
      if (op.parameters) {
        for (const param of op.parameters as AnyObject[]) {
          if (param.in === 'path' && param.name && param.schema) {
            pathParamSchemas.set(String(param.name), param.schema as AnyObject);
          }
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
