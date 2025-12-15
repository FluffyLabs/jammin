# Getting Started

This guide walks you through creating your first jammin project and understanding the basic workflow.

## Prerequisites

Before you start, make sure you have the required tools installed. See the [Requirements](requirements.md) page for detailed installation instructions.

Quick checklist:

- Bun
- Docker
- Git

### Install pre-releases, canary, or main-branch builds (for dev)

```bash
bun add -g @fluffylabs/jammin@next
```

or

### Install latest release

```bash
bun add -g @fluffylabs/jammin@latest
```

## Creating a new project

jammin CLI provides a `create` command to bootstrap new projects from templates. You can run it interactively or with command-line arguments.

### Interactive mode

Simply run the create command without arguments to start the interactive setup:

```bash
jammin create
```

The interactive wizard will ask you:

1. **Project name** - Must start with an alphanumeric character and can only contain letters, numbers, hyphens, and underscores
2. **Template** - Choose from available templates:
   - `jam-sdk` - JAM SDK template for building JAM services
   - `jade` - JADE SDK template
   - `jambrains` - JamBrains SDK template
   - `undecided` - Starter template for exploring options with all of the above

### Command-line mode

If you prefer to skip the interactive wizard, provide the project name and template directly:

```bash
jammin create my-app
```

Or specify a specific template:

```bash
jammin create my-app --template jade
```

After creation completes, navigate to your project:

```bash
cd my-app
```

## Next steps

Once you've created a project, you can use the following jammin commands:

- `jammin build` - Build your services
- `jammin test` - Run unit tests
- `jammin deploy` - Deploy to a network

Refer to the [jammin suite](bootstrap/jammin-suite.md) documentation for detailed information about each command.
