# jammin CLI

JAM development tooling CLI for building, testing, and deploying multi-service projects.

## Installation

### From source (development)

```bash
cd cli
bun install
bun start --help
```

## Commands

### `create`

Initialize a new jammin project from a template.

**Usage:**
```bash
jammin create [project-name] [options]
```

**Arguments:**
- `[project-name]` - Name of the project to create. Must start with an alphanumeric character and can only contain letters, numbers, hyphens, and underscores.

**Options:**
- `--template <template>` - Project template to use. Available templates:
  - `jam-sdk` (default)
  - `jade`
  - `jambrains`
  - `undecided`

**Examples:**
```bash
# Interactive mode (prompts for project name and template)
jammin create

# Create a project with a specific name
jammin create my-app

# Create a project with a specific name and template
jammin create my-app --template jade
```

**Notes:**
- If no project name is provided, the command will run in interactive mode and prompt for both the project name and template.
- The project name must be valid: start with alphanumeric and contain only letters, numbers, hyphens, and underscores.

### `build`

Build your entire project or a specific service using Docker.

**Usage:**
```bash
jammin build [service] [options]
```

**Arguments:**
- `[service]` - Optional service name to build. If omitted, builds all services in the project.

**Options:**
- `-c, --config <path>` - Path to build config file (defaults to standard config location).

**Examples:**
```bash
# Build all services in the project
jammin build

# Build a specific service
jammin build auth-service

# Build with a custom config file
jammin build --config ./custom.build.yml

# Build a specific service with custom config
jammin build auth-service --config ./custom.build.yml
```

**Notes:**
- Build logs are automatically saved to a `logs/` directory in your project root.
- The command uses Docker to build services based on their SDK configuration.
- Output `.jam` files are detected and listed after each successful build.
- If any service fails to build, the command will exit with an error code.

### `test`

Run tests for your entire project or a specific service using Docker.

**Usage:**
```bash
jammin test [service] [options]
```

**Arguments:**
- `[service]` - Optional service name to test. If omitted, tests all services in the project.

**Options:**
- `-c, --config <path>` - Path to build config file (defaults to standard config location).

**Examples:**
```bash
# Test all services in the project
jammin test

# Test a specific service
jammin test auth-service

# Test with a custom config file
jammin test --config ./custom.build.yml

# Test a specific service with custom config
jammin test auth-service --config ./custom.build.yml
```

**Notes:**
- Test logs are automatically saved to a `logs/` directory in your project root.
- The command uses Docker to run tests based on each service's SDK configuration.
- If any service's tests fail, the command will exit with an error code.
- All test output is captured and saved for debugging purposes.
