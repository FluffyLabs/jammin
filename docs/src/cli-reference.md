# jammin CLI reference

The jammin command-line interface (CLI) provides tools for building, testing, and deploying multi-service JAM projects.

## installation

Install jammin globally or as a project dependency:

```bash
bun install @fluffylabs/jammin
```

Or use directly with `bunx`:

```bash
bunx @fluffylabs/jammin build
```

## global options

All commands support these options:

- `-h, --help` - display help for command
- `-V, --version` - display version number

## commands

### `jammin new`

Initialize a new jammin project with interactive setup.

```bash
jammin new [project-name] [options]
```

**arguments:**
- `[project-name]` - name of the project (optional, will prompt if not provided)

**options:**
- `--sdk <sdk>` - target SDK (choices: "polkajam", "jade", "jambrains", default: "polkajam")

**examples:**
```bash
# Interactive setup
jammin new

# Create project with specific SDK
jammin new my-app --sdk polkajam

# Non-interactive
jammin new my-app --sdk jade
```

**validation rules:**
- Project names must start with alphanumeric characters
- Only letters, numbers, hyphens, and underscores allowed
- Whitespace is automatically trimmed

---

### `jammin build`

Build services defined in your `jammin.build.yml` configuration.

```bash
jammin build [options]
```

**options:**
- `-s, --service <name>` - build specific service only
- `-c, --config <path>` - path to custom config file (default: `jammin.build.yml`)
- `-p, --parallel` - build services in parallel (default: sequential)
- `-v, --verbose` - show detailed build output

**examples:**
```bash
# Build all services
jammin build

# Build specific service
jammin build -s my-service

# Build all services in parallel
jammin build --parallel

# Use custom config file
jammin build --config ./custom-build.yml

# Build with verbose output
jammin build -s my-service --verbose
```

**exit codes:**
- `0` - all builds succeeded
- `1` - one or more builds failed

**output:**
- Displays per-service build results with duration
- Shows summary of successful/failed builds
- Errors are displayed with service name and error message

---

### `jammin test`

Run tests for services defined in your `jammin.build.yml` configuration.

```bash
jammin test [options]
```

**options:**
- `-s, --service <name>` - test specific service only
- `-c, --config <path>` - path to custom config file (default: `jammin.build.yml`)
- `-p, --parallel` - run tests in parallel (default: sequential)
- `-v, --verbose` - show detailed test output
- `--fail-fast` - stop on first test failure

**examples:**
```bash
# Test all services
jammin test

# Test specific service
jammin test -s my-service

# Test all services in parallel
jammin test --parallel

# Stop on first failure
jammin test --fail-fast

# Verbose output for debugging
jammin test -s my-service --verbose
```

**exit codes:**
- `0` - all tests passed
- `1` - one or more tests failed

**output:**
- Displays per-service test results with duration
- Shows summary of passed/failed tests
- Test errors are displayed with service name and error message

---

### `jammin deploy`

Deploy services to a target environment (coming soon).

```bash
jammin deploy [options]
```

**options:**
- `-e, --env <environment>` - target environment (required)
- `-s, --service <name>` - deploy specific service only
- `--skip-build` - skip building before deploy

**examples:**
```bash
# Deploy to staging
jammin deploy --env staging

# Deploy specific service to production
jammin deploy --env production -s my-service

# Deploy without rebuilding
jammin deploy --env staging --skip-build
```

---

## configuration discovery

jammin automatically searches for configuration files in the current directory and parent directories (similar to git). This allows you to run commands from any subdirectory of your project.

**search order:**
1. Current working directory
2. Parent directories up to filesystem root
3. Custom path via `--config` option

**config files:**
- `jammin.build.yml` - service definitions, SDKs, and build configuration
- `jammin.networks.yml` - network definitions for deployment

---

## execution modes

### sequential execution (default)

Services are built/tested one after another. If a service fails and `--fail-fast` is not set, remaining services will still be processed.

**advantages:**
- Easier to debug output
- Avoids resource contention
- Predictable ordering

**use cases:**
- Development builds
- Debugging failures
- Services with dependencies

### parallel execution (`--parallel`)

All services are built/tested simultaneously using `Promise.all()`.

**advantages:**
- Faster execution
- Better resource utilization
- Ideal for CI/CD

**use cases:**
- CI/CD pipelines
- Independent services
- Production builds

---

## error handling

jammin provides detailed error messages for common issues:

### configuration errors

```
Configuration Error: Config file 'jammin.build.yml' not found
```
**solution:** Create a `jammin.build.yml` file or use `--config` to specify path

### validation errors

```
Configuration Validation Failed:
  - services.0.name: Service name must contain only letters, numbers, hyphens, and underscores
```
**solution:** Fix the validation errors in your config file

### service execution errors

```
serviceA: Build failed
  Error: Command failed with exit code 1: bun run build
```
**solution:** Check service build logs and fix build errors

### SDK resolution errors

```
Unknown SDK: custom-sdk. Not found in built-in or custom SDKs.
```
**solution:** Define the SDK in the `sdks` section of your config

---

## environment variables

jammin respects standard environment variables:

- `NODE_ENV` - environment mode (development, production, etc.)
- `CI` - detects CI environment
- Any variables referenced in YAML configs

bun automatically loads `.env` files, so no additional configuration needed.

---

## tips and best practices

### use verbose mode for debugging

When builds or tests fail, use `-v` to see full output:

```bash
jammin build -s failing-service -v
```

### parallel builds for CI

Speed up CI/CD pipelines with parallel execution:

```bash
jammin build --parallel
jammin test --parallel
```

### fail-fast in development

Stop on first failure to quickly identify issues:

```bash
jammin test --fail-fast
```

### organize configs by environment

Use custom config files for different environments:

```bash
jammin build --config jammin.staging.yml
jammin build --config jammin.production.yml
```

### check config before deploy

Validate your configuration by running a build first:

```bash
jammin build && jammin deploy --env production
```
