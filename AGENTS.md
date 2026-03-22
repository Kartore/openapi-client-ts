<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

# Project: openapi-client-ts

OpenAPI 仕様から TypeScript の型定義と API クライアントを生成するモノレポ。

## Repository Structure

```
tools/generator/   - OpenAPI → TypeScript コードジェネレーター（本体）
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
