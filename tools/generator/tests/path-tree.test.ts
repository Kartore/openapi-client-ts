import { describe, expect, test } from 'vitest';

import { buildPathTree } from '../src/path-tree';

const emptyOp = { responses: {} };

describe('buildPathTree', () => {
  test('empty paths returns empty tree', () => {
    expect(buildPathTree({}).size).toBe(0);
  });

  describe('static segments', () => {
    test('single static path creates root node', () => {
      const tree = buildPathTree({ '/users': { get: emptyOp } });
      expect(tree.size).toBe(1);
      const node = tree.get('users')!;
      expect(node.segment).toBe('users');
      expect(node.isDynamic).toBe(false);
      expect(node.paramName).toBeNull();
      expect(node.paramSchema).toBeNull();
      expect(node.children.size).toBe(0);
      expect(Object.keys(node.operations)).toContain('get');
    });

    test('nested static path', () => {
      const tree = buildPathTree({ '/users/me': { get: emptyOp } });
      const usersNode = tree.get('users')!;
      const meNode = usersNode.children.get('me')!;
      expect(meNode.segment).toBe('me');
      expect(meNode.isDynamic).toBe(false);
      expect(Object.keys(meNode.operations)).toContain('get');
    });
  });

  describe('dynamic segments', () => {
    test('dynamic segment is marked as dynamic', () => {
      const tree = buildPathTree({ '/users/{id}': { get: emptyOp } });
      const idNode = tree.get('users')!.children.get('{id}')!;
      expect(idNode.isDynamic).toBe(true);
      expect(idNode.paramName).toBe('id');
    });

    test('operations are attached only to leaf nodes', () => {
      const tree = buildPathTree({ '/users/{id}': { get: emptyOp } });
      const usersNode = tree.get('users')!;
      expect(Object.keys(usersNode.operations)).toHaveLength(0);
      const idNode = usersNode.children.get('{id}')!;
      expect(Object.keys(idNode.operations)).toContain('get');
    });

    test('extracts path param schema from operation parameters', () => {
      const tree = buildPathTree({
        '/users/{id}': {
          get: {
            parameters: [
              {
                in: 'path',
                name: 'id',
                schema: { type: 'string', minLength: 3 },
              },
            ],
            responses: {},
          },
        },
      });
      const idNode = tree.get('users')!.children.get('{id}')!;
      expect(idNode.paramSchema).toEqual({ type: 'string', minLength: 3 });
    });

    test('param schema defaults to null when not present in parameters', () => {
      const tree = buildPathTree({ '/users/{id}': { get: emptyOp } });
      const idNode = tree.get('users')!.children.get('{id}')!;
      expect(idNode.paramSchema).toBeNull();
    });
  });

  describe('multiple paths', () => {
    test('paths with shared prefix merge at the common node', () => {
      const tree = buildPathTree({
        '/users': { get: emptyOp },
        '/users/{id}': { get: emptyOp },
      });
      expect(tree.size).toBe(1);
      const usersNode = tree.get('users')!;
      expect(Object.keys(usersNode.operations)).toContain('get');
      expect(usersNode.children.size).toBe(1);
    });

    test('sibling paths create separate root nodes', () => {
      const tree = buildPathTree({
        '/users': { get: emptyOp },
        '/posts': { get: emptyOp },
      });
      expect(tree.size).toBe(2);
      expect(tree.has('users')).toBe(true);
      expect(tree.has('posts')).toBe(true);
    });

    test('multiple HTTP methods on the same path', () => {
      const tree = buildPathTree({
        '/users': { get: emptyOp, post: emptyOp },
      });
      const node = tree.get('users')!;
      expect(Object.keys(node.operations)).toContain('get');
      expect(Object.keys(node.operations)).toContain('post');
    });
  });

  describe('deep nesting', () => {
    test('three-level path', () => {
      const tree = buildPathTree({ '/a/{b}/c': { get: emptyOp } });
      const aNode = tree.get('a')!;
      const bNode = aNode.children.get('{b}')!;
      const cNode = bNode.children.get('c')!;
      expect(cNode.segment).toBe('c');
      expect(Object.keys(cNode.operations)).toContain('get');
    });
  });
});
