# AI Collaboration Guidelines

Automated assistants working in this repository should follow the conventions below before generating or editing content.

## Project Overview

jammin (always lowercase) is JAM development tooling for creating, building, deploying, and testing multi-service projects. The project is part of the larger jammin suite which includes:
- **jammin cli**: Command-line tool for JAM development (this repository's primary focus)
- **jammin studio**: Future Electron app/VS Code extension for GUI-based development
- **jammin inspect**: Future web app for inspecting deployed JAM services and networks

## Naming Conventions

### Product Names
- Always spell `jammin` in lowercase, even at sentence starts, headings, or product names such as `jammin cli`, `jammin studio`, and `jammin inspect`.
- Preserve existing casing for other product names (e.g., `typeberry`, `Polkajam`, `JAMNP`).

### Code Naming
- **Files**: kebab-case (enforced by Biome: `build-command.ts`, `get-service-configs.ts`)
- **Types/Interfaces**: PascalCase (`ServiceConfig`, `DockerError`, `ProjectConfig`)
- **Functions/Variables**: camelCase (`buildService`, `getJamFiles`, `projectRoot`)
- **Constants**: SCREAMING_SNAKE_CASE for config objects (`SDK_CONFIGS`, `TARGETS`)
- **Classes**: PascalCase, prefer static methods over instances when appropriate

## Writing Style

- Prefer concise, task-focused prose with short paragraphs.
- Align terminology with the documentation set in `docs/src`; when in doubt, reference `docs/src/bootstrap/jammin-suite.md` for the canonical wording of suite components.
- Update `docs/src/SUMMARY.md` whenever new pages are added so the mdBook navigation stays accurate.
- Use direct, plain language that reads like an experienced (non-native) open source developer explaining the work. Avoid marketing fluff or overly formal sentences; keep the tone practical and grounded.

## Architecture

This is a **monorepo using Bun workspaces**:
- Root package `@fluffylabs/jammin` serves as the main package and build coordinator.
- `bin/cli/` contains the CLI implementation (`@fluffylabs/jammin-cli`)
- Commands are organized in `bin/cli/src/commands/` using Commander.js
- CLI uses `@clack/prompts` for interactive user experiences

## Development Commands

### Build & Run
```bash
bun install                    # Install all dependencies
bun run build                  # Build all workspace packages
bun run cli                    # Run CLI locally during development
bun run bin/cli/index.ts       # Alternative way to run CLI
```

### Code Quality
```bash
bun run qa                     # Run all quality checks (CI mode - fails on issues)
bun run qa-fix                 # Fix quality issues automatically
bun run format                 # Format code with Biome
bun run lint                   # Lint and fix with Biome
```

### Testing
```bash
bun test                                            # Run all tests (uses Bun's built-in test runner)
bun test bin/cli/src/commands/create-command.test.ts  # Run specific test file
bun test --watch                                    # Run tests in watch mode
```

## Code Style & Conventions

### Linting & Formatting (Biome)
- **Line width**: 120 characters
- **Indent**: 2 spaces
- **Line ending**: LF
- **Quote style**: Double quotes (`"string"`)
- **Array types**: Shorthand syntax (`string[]` not `Array<string>`)
- **Block statements**: Always use blocks (no single-line if statements)
- **Unused imports**: Auto-removed (configured in Biome)
- **File naming**: kebab-case only (enforced)

Run `bun run qa` before committing to catch all issues.

### TypeScript
- **Strict mode**: Enabled with all strict flags
- **Module system**: Preserve (bundler mode) with `.ts` extensions in imports
- **Target**: ESNext with ESNext libs
- **Type safety**: Avoid `any`, prefer explicit types or `unknown`
- **Unused vars**: Linted by Biome (errors on unused locals/params/imports)
- **Type imports**: Use `import type { ... }` for type-only imports when possible

### Import Organization
```typescript
// 1. Node built-ins (node: prefix)
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

// 2. External dependencies
import * as p from "@clack/prompts";
import { Command } from "commander";

// 3. Internal imports (types first, then code)
import type { ServiceConfig } from "../../types/config";
import { getServiceConfigs } from "../../utils/get-service-configs";
import { SDK_CONFIGS } from "../../utils/sdk-configs";
```

Biome will auto-organize imports when you run `bun run format`.

### Error Handling
```typescript
// Custom errors should extend Error with additional context
export class DockerError extends Error {
  constructor(
    message: string,
    public output: string,  // Additional context
  ) {
    super(message);
  }
}

// Throw errors with descriptive messages
if (exitCode !== 0) {
  throw new DockerError(
    `Build failed for service '${service.name}' with exit code ${exitCode}`,
    combinedOutput
  );
}

// Use type guards for validation
export function validate(name: string) {
  if (!name || name.trim().length === 0) {
    return new InvalidArgumentError("Project name is required");
  }
  // ... more validation
  return trimmed;
}
```

### Comments & Documentation
```typescript
// Use JSDoc for public APIs
/**
 * Build a single service using Docker
 */
export async function buildService(service: ServiceConfig, projectRoot: string): Promise<string>

// Use inline TODO comments with author tag
// TODO: [AuthorName] Description of what needs to be done

// Keep inline comments concise and explain "why" not "what"
const dockerArgs = ["run", "--rm", "-v", `${servicePath}:/app`, sdk.image, ...sdk.build.split(" ")];
```

## Important Implementation Notes

### Command Implementation Pattern
Each command is in a separate file (`bin/cli/src/commands/*-command.ts`) and exports a Commander `Command` object. Commands should support both interactive mode (using clack prompts) and non-interactive mode (using command-line arguments).
When adding new commands:
1. Create `bin/cli/src/commands/your-command.ts`
2. Export a Commander `Command` object
3. Support both interactive and non-interactive modes
4. Use `@clack/prompts` for spinners, progress, and user input
5. Register command in `bin/cli/index.ts`
6. Add tests in `bin/cli/src/commands/your-command.test.ts` using Bun's test runner

## Documentation

Documentation is in `docs/` using mdBook. When adding new pages, update `docs/src/SUMMARY.md` for navigation. See `docs/src/bootstrap/jammin-suite.md` for the feature roadmap.

## Bun-Native Development

This project uses **Bun** as the primary runtime and toolchain. Always prefer Bun-native APIs over Node.js or third-party alternatives.

### Prefer Bun over Node.js
- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Bun automatically loads .env, so don't use dotenv

### Bun-Native APIs
- `Bun.file` for file operations instead of `node:fs` readFile/writeFile when possible
- `Bun.spawn()` for running shell commands instead of `child_process`
- `bun:sqlite` for SQLite instead of `better-sqlite3`
- Built-in `WebSocket` instead of `ws` package

### Testing Pattern
```typescript
import { test, expect } from "bun:test";

test("description", () => {
  expect(value).toBe(expected);
});
```

---

Consult this file at the start of every AI-assisted session to ensure the repository stays stylistically consistent.
