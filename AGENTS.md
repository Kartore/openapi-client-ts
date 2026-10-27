<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# Project: openapi-client-ts

OpenAPI 仕様から TypeScript の型定義と API クライアントを生成するモノレポ。

## Repository Structure

```
packages/generator/   - OpenAPI → TypeScript コードジェネレーター（本体）
apps/hono/         - 使用例（Hono アプリ）
```

## Generator (`tools/generator`)

### 概要

OpenAPI 3.0.x / 3.1.x の仕様を受け取り、以下を生成する：

- `types`: `components.schemas` から TypeScript 型定義
- `client`: `paths` から型付き `apiClient` ファクトリ関数

### ソースファイル構成

| ファイル            | 役割                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `src/index.ts`      | エントリーポイント。`validate()` → `upgrade()` で 3.1 に正規化してから生成                 |
| `src/schema.ts`     | `SchemaLike` 型と `schemaToTypeString()` / `generateTypes()`                               |
| `src/operations.ts` | `OperationLike` 型と `getResponseType()` / `getQueryParameters()` / `getRequestBodyType()` |
| `src/path-tree.ts`  | `PathTreeNode` 構造と `buildPathTree()`                                                    |
| `src/client.ts`     | `generateClient()` でパスツリーから `apiClient` 関数を文字列生成                           |
| `src/cli.ts`        | CLI エントリーポイント                                                                     |

### 重要な設計上の制約

- **バージョンチェックは `valid` チェックより先に行う**: `@scalar/openapi-parser` は未対応バージョンを `valid: false` と判定するため、順序が逆だと誤ってエラーになる
- **`src/index.ts` の `if (!specification)` を消さない**: `specification` は `valid` チェック後も TypeScript 上 `undefined` の可能性が残るため必須
- **サポートバージョン**: OpenAPI 3.0.x / 3.1.x のみ（3.2 は非対応）。内部では `upgrade()` で 3.1 に正規化して処理する
- **`OperationLike` / `ParameterLike`**: テストで plain object を渡せるよう、`@scalar/openapi-types` の厳密な型ではなく互換性のあるゆるい型を `operations.ts` にローカル定義している
- **`SchemaLike`**: `schema.ts` でローカル定義・エクスポートする再帰型。`OpenAPIV3_1.SchemaObject` との直接の型互換がないため、境界でキャストして使う

### 型の方針

- 公開 API (`generateClient`, `generateTypes`, `buildPathTree`) の引数は `@scalar/openapi-types` の型を使用
- 内部処理 (`schemaToTypeString`, `getResponseType` 等) は `SchemaLike` / `OperationLike` 等のローカル型を使用
- `@scalar/openapi-types` は `devDependencies` のみ（型定義は `import type` で使用）

### Working in `tools/generator`

```bash
cd tools/generator
vp check          # フォーマット・lint・型チェック
vp test           # テスト実行（93 件）
vp check --fix    # フォーマット自動修正
```
