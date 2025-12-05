# AI Collaboration Guidelines

Automated assistants working in this repository should follow the conventions below before generating or editing content.

## Project Overview

jammin (always lowercase) is JAM development tooling for creating, building, deploying, and testing multi-service projects. The project is part of the larger jammin suite which includes:
- **jammin cli**: Command-line tool for JAM development (this repository's primary focus)
- **jammin studio**: Future Electron app/VS Code extension for GUI-based development
- **jammin inspect**: Future web app for inspecting deployed JAM services and networks

## Naming Rules

- Always spell `jammin` in lowercase, even at sentence starts, headings, or product names such as `jammin cli`, `jammin studio`, and `jammin inspect`.
- Preserve existing casing for other product names (e.g., `typeberry`, `Polkajam`, `JAMNP`).

## Style Expectations

- Prefer concise, task-focused prose with short paragraphs.
- Align terminology with the documentation set in `docs/src`; when in doubt, reference `docs/src/jammin-suite.md` for the canonical wording of suite components.
- Update `docs/src/SUMMARY.md` whenever new pages are added so the mdBook navigation stays accurate.
- Use direct, plain language that reads like an experienced (non-native) open source developer explaining the work. Avoid marketing fluff or overly formal sentences; keep the tone practical and grounded.

## Architecture

This is a **monorepo using Bun workspaces**:
- Root package `@fluffylabs/jammin` serves as the main package and build coordinator
- `bin/cli/` contains the CLI implementation (`@fluffylabs/jammin-cli`)
- Commands are organized in `bin/cli/src/commands/` using Commander.js
- CLI uses `@clack/prompts` for interactive user experiences

### CLI Command Structure

The CLI entry point is `bin/cli/index.ts` which registers commands:
- `new`: Initialize new jammin projects with SDK selection (polkajam, jade, jambrains)
- `build`: Build multi-service projects (supports `-s, --service` flag for specific services)
- `test`: Run tests with optional pattern matching and watch mode
- `deploy`: Deploy multi-service projects

Each command is in a separate file (`bin/cli/src/commands/*-command.ts`) and exports a Commander `Command` object. Commands should support both interactive mode (using clack prompts) and non-interactive mode (using command-line arguments).

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
bun test                       # Run all tests (uses Bun's built-in test runner)
bun test bin/cli/src/commands/new-command.test.ts  # Run specific test file
```

## Code Style & Conventions

### Linting & Formatting
- Use Biome (configured in `biome.json`)
- Line width: 120 characters
- Indent: 2 spaces
- Line ending: LF

### TypeScript
- Strict mode enabled with modern ESNext features
- Module system: Preserve (bundler mode)
- Use `.ts` file extensions in imports

### Editor Configuration
EditorConfig settings are enforced (`.editorconfig`):
- 2 space indentation
- LF line endings
- UTF-8 encoding
- Max line length 120

## Important Implementation Notes

### Command Implementation Pattern
When adding new commands:
1. Create `bin/cli/src/commands/your-command.ts`
2. Export a Commander `Command` object
3. Support both interactive and non-interactive modes
4. Use `@clack/prompts` for spinners, progress, and user input
5. Register command in `bin/cli/index.ts`
6. Add tests in `bin/cli/src/commands/your-command.test.ts` using Bun's test runner

### Project Structure Expectations
- CLI commands are currently stubs/dummies marked with `TODO: ` comments
- The build process outputs to `dist/` directory
- The main binary is `dist/index.js`
- Package is published as `@fluffylabs/jammin` to npm

### Future Architecture Plans
See `docs/src/jammin-suite.md` for detailed feature plans:
- Multi-service deployment with genesis state preparation
- Docker images for JAM-SDK builds
- Integration testing SDK for service interactions
- Support for multiple node implementations (typeberry is priority)
- YAML configuration files for project setup

## Documentation

Documentation is in `docs/` using mdBook:
```bash
mdbook serve docs --open       # Preview documentation locally (requires mdbook installation)
```

When adding new documentation pages, update `docs/src/SUMMARY.md` for navigation.

## Publishing

The package is published automatically via GitHub Actions using npm with OIDC trusted publishers. The version in `package.json` is the source of truth.

## Related Documentation

- `docs/src/jammin-suite.md`: Comprehensive feature roadmap
- `docs/src/development.md`: Sprint planning and task breakdown

Consult this file at the start of every AI-assisted session to ensure the repository stays stylistically consistent.
