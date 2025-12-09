# YAML configuration

jammin uses YAML configuration files to define services, SDKs, networks, and deployment settings. This guide covers the complete configuration schema and best practices.

## configuration files

### `jammin.build.yml`

Defines services, build commands, test commands, and deployment configuration.

**location:** Project root (or any parent directory)

### `jammin.networks.yml`

Defines network configurations for local development and deployment.

**location:** Project root (or any parent directory)

---

## `jammin.build.yml` schema

### basic structure

```yaml
services:
  - path: ./services/my-service.ts
    name: myService
    sdk: jam-sdk-0.1.26

sdks:
  custom-sdk:
    image: customorg/sdk-image
    build: bun run build
    test: bun test

deployment:
  spawn: local
  version: "1.0.0"
  deploy_with: bootstrap-service
  upgrade: true
```

### `services` (required)

Array of service definitions. Each service must specify:

**`path`** (string, required)
- Relative or absolute path to service **file**
- Resolved relative to config file location
- Examples: `./services/calculator.ts`, `/absolute/path/service.rs`

**`name`** (string, required)
- Unique identifier for the service
- Used in CLI commands (`jammin build -s serviceName`)
- Must match pattern: `^[a-zA-Z0-9_-]+$`
- Examples: `myService`, `user-auth`, `data_processor`

**`sdk`** (string, required)
- SDK to use for building and testing
- Can be built-in SDK name or custom SDK name
- Examples: `jam-sdk-0.1.26`, `custom-polkajam`

**complete example:**

```yaml
services:
  - path: ./services/calculator.rs
    name: calculator
    sdk: jam-sdk-0.1.26

  - path: ./services/storage.go
    name: storage
    sdk: custom-polkajam

  - path: ../shared/auth-service.ts
    name: auth
    sdk: jam-sdk-0.1.26
```

---

### `sdks` (optional)

Define custom SDKs with specific build/test commands and Docker images.

**structure:**

```yaml
sdks:
  custom-sdk-name:
    image: string      # Docker image name
    build: string      # Build command
    test: string       # Test command
```

**`image`** (string, required)
- Docker image used for building the service
- Format: `organization/image:tag` or `image:tag`
- Examples: `polkajam/sdk:latest`, `customorg/jam-builder:v1.0`

**`build`** (string, required)
- Command to build the service
- Executed in directory containing the service file
- Should produce `.jam` file
- Examples: `bun run build`, `make build`, `./build.sh`

**`test`** (string, required)
- Command to test the service
- Executed in directory containing the service file
- Should exit with code 0 on success
- Examples: `bun test`, `make test`, `./test.sh`

**complete example:**

```yaml
sdks:
  polkajam-custom:
    image: polkajam/sdk:latest
    build: bun run build:polkajam
    test: bun test
  
  jade-custom:
    image: spacejam/jade:v2.0
    build: jade build --release
    test: jade test --all
  
  local-dev:
    image: localhost/dev-sdk:latest
    build: bun run dev:build
    test: bun test --watch=false
```

---

### `deployment` (optional)

Configure deployment behavior.

**structure:**

```yaml
deployment:
  spawn: string                    # Network to spawn
  version: string                  # Service version (semantic versioning)
  deploy_with: string              # Deployment method
  upgrade: boolean                 # Upgrade existing services
```

**`spawn`** (string, required)
- Name of network configuration from `jammin.networks.yml`
- Example: `local`, `testnet`, `mainnet`

**`version`** (string, required)
- Service version following semantic versioning format
- Format: `MAJOR.MINOR.PATCH[-prerelease][+build]`
- Examples:
  - `1.0.0` - Basic version
  - `0.0.1` - Initial development
  - `1.0.0-alpha` - Pre-release version
  - `1.0.0-beta.1` - Pre-release with number
  - `1.0.0+build.123` - Version with build metadata
- Invalid formats: `1.0`, `v1.0.0`, `1`, `1.0.0.0`

**`deploy_with`** (enum, required)
- `"bootstrap-service"` - deploy via bootstrap service API
- `"genesis"` - include in genesis state (no upgrades)

**`upgrade`** (boolean, optional, default: false)
- `true` - upgrade existing service deployment
- `false` - deploy as new services

**complete example:**

```yaml
deployment:
  spawn: local
  version: "1.0.0"
  deploy_with: bootstrap-service
  upgrade: true
```

---

## `jammin.networks.yml` schema

Define network configurations for development and testing.

### basic structure

```yaml
networks:
  local:
    - image: typeberry-0.4.1
      args: dev
      instances: 2
    - image: polkajam
      instances: 1
  
  staging:
    compose: ./docker-compose.staging.yml
```

### `networks` (required)

Object mapping network names to their configurations.

---

### container-based networks

Define networks using individual container specifications.

**structure:**

```yaml
networks:
  network-name:
    - image: string       # Container image
      args: string        # Optional arguments
      instances: number   # Number of instances
```

**`image`** (string, required)
- Docker image for the node
- Examples: `typeberry-0.4.1`, `polkajam`, `custom/node:latest`

**`args`** (string, optional)
- Command-line arguments for the container
- Examples: `dev`, `--rpc-port=9933`, `validator`

**`instances`** (number, optional, default: 1)
- Number of container instances to spawn
- Used for multi-node networks
- Examples: `1`, `2`, `5`

**complete example:**

```yaml
networks:
  local-dev:
    - image: typeberry-0.4.1
      args: dev --unsafe-rpc-external
      instances: 2
    
    - image: polkajam
      args: validator
      instances: 1
  
  test-network:
    - image: typeberry-0.4.1
      instances: 3
```

---

### compose-based networks

Reference existing docker-compose files.

**structure:**

```yaml
networks:
  network-name:
    compose: string     # Path to docker-compose.yml
```

**`compose`** (string, required)
- Relative or absolute path to docker-compose file
- Resolved relative to config file location
- Examples: `./docker-compose.yml`, `../networks/testnet.yml`

**complete example:**

```yaml
networks:
  staging:
    compose: ./docker-compose.staging.yml
  
  production:
    compose: /etc/jammin/production-network.yml
```

---

## complete example

### minimal configuration

```yaml
# jammin.build.yml
services:
  - path: ./services/calculator.ts
    name: calculator
    sdk: jam-sdk-0.1.26
```

### full-featured configuration

```yaml
# jammin.build.yml
services:
  # Core services
  - path: ./services/auth.ts
    name: auth
    sdk: polkajam-custom

  - path: ./services/storage.ts
    name: storage
    sdk: polkajam-custom

  # Third-party service
  - path: ./services/oracle.ts
    name: oracle
    sdk: jade-custom

# Custom SDK definitions
sdks:
  polkajam-custom:
    image: polkajam/sdk:v1.2.0
    build: bun run build:prod
    test: bun test --coverage
  
  jade-custom:
    image: spacejam/jade:v2.1
    build: jade build --optimize
    test: jade test --parallel

# Deployment configuration
deployment:
  spawn: local
  version: "1.0.0"
  deploy_with: bootstrap-service
  upgrade: true
```

```yaml
# jammin.networks.yml
networks:
  # Local development with typeberry
  local:
    - image: typeberry-0.4.1
      args: dev --unsafe-rpc-external
      instances: 2
  
  # Testnet using docker-compose
  testnet:
    compose: ./docker-compose.testnet.yml
  
  # Multi-client network
  multi:
    - image: typeberry-0.4.1
      args: validator
      instances: 2
    - image: polkajam
      args: validator --name polkajam-node
      instances: 1
```

---

## built-in SDKs

jammin includes these built-in SDKs:

### `jam-sdk-0.1.26`

**build command:** `bun run build`  
**test command:** `bun test`

Use for standard JAM services built with the official SDK.

---

## best practices

### organize by environment

Create separate configs for different environments:

```
├── jammin.build.yml           # Default/development
├── jammin.staging.yml         # Staging environment
├── jammin.production.yml      # Production environment
└── jammin.networks.yml
```

Use with `--config` flag:

```bash
jammin build --config jammin.staging.yml
```

### use relative paths

Prefer relative paths for portability:

```yaml
# Good - relative path to file
services:
  - path: ./services/my-service.ts

# Avoid - absolute paths are less portable
services:
  - path: /home/user/project/services/my-service.ts
```

### descriptive service names

Use clear, descriptive names:

```yaml
# Good
services:
  - name: user-authentication
  - name: data-storage
  - name: oracle-price-feed

# Avoid
services:
  - name: svc1
  - name: s2
  - name: thing
```

### comment complex configurations

Add comments for clarity:

```yaml
services:
  # Core authentication service - handles JWT tokens
  - path: ./services/auth.ts
    name: auth
    sdk: jam-sdk-0.1.26

  # Oracle service - fetches external price data
  # Requires ORACLE_API_KEY environment variable
  - path: ./services/oracle.ts
    name: oracle
    sdk: custom-oracle-sdk
```

### validate before committing

Always test config changes:

```bash
# Test loading config
jammin build --config new-config.yml

# Validate all services build
jammin build --parallel
```

---

## validation rules

jammin validates YAML configs with these rules:

### service names

- Can contain: letters, numbers, hyphens (`-`), underscores (`_`)
- Cannot contain: spaces, special characters, slashes

### version format

- Must follow semantic versioning: `MAJOR.MINOR.PATCH`
- Optional pre-release: `-alpha`, `-beta.1`, `-rc.2`
- Optional build metadata: `+build.123`, `+sha.5114f85`
- Pattern: `^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$`
- Examples:
  - ✅ Valid: `1.0.0`, `0.0.1`, `2.1.3-alpha`, `1.0.0+build`
  - ❌ Invalid: `1.0`, `v1.0.0`, `1`, `1.0.0.0`, `1.0.x`

### paths

- Must point to service **files**
- Cannot end with `/` (directory indicator)
- Service files must exist at the specified path
- Resolved relative to config file location
- Examples of valid paths:
  - ✅ `./services/calculator.ts`
  - ✅ `./services/auth.rs`
  - ✅ `../shared/service.go`
  - ❌ `./services/calculator` (no extension)
  - ❌ `./services/calculator/` (directory path)

### SDK names

- Must reference built-in SDK or be defined in `sdks` section
- Case-sensitive matching

### required fields

All required fields must be present and non-empty:

```yaml
# Valid
services:
  - path: ./service.ts
    name: myService
    sdk: jam-sdk-0.1.26

# Invalid - missing name
services:
  - path: ./service.ts
    sdk: jam-sdk-0.1.26

# Valid deployment with version
deployment:
  spawn: local
  version: "1.0.0"
  deploy_with: bootstrap-service

# Invalid - missing version
deployment:
  spawn: local
  deploy_with: bootstrap-service
```

---

## troubleshooting

### config file not found

**error:** `Config file 'jammin.build.yml' not found`

**solutions:**
- Create config file in project root
- Run command from project directory
- Use `--config` to specify path
- Check file name spelling

### invalid service path

**error:** `Path must point to a file, not a directory`

**solutions:**
- Add file extension to the path: use `./services/auth.ts` not `./services/auth`
- Remove trailing slash: use `./service.ts` not `./service.ts/`
- Point to the actual service file

### service path does not exist

**error:** `Service file does not exist: ./services/missing.ts`

**solutions:**
- Verify the file path is correct
- Ensure the path points to a **file**
- Check path is **relative to config file location**
- Verify the service file exists at that location
- Don't use directory paths - must point to the actual service file

### unknown SDK

**error:** `Unknown SDK: my-sdk. Not found in built-in or custom SDKs.`

**solutions:**
- Define SDK in `sdks` section
- Check SDK name spelling
- Use one of available built-in SDK name

### invalid service name

**error:** `Service name must contain only letters, numbers, hyphens, and underscores`

**solutions:**
- Remove invalid characters
- Replace spaces with hyphens or underscores
- Start name with a letter

### invalid version format

**error:** `Version must follow semantic versioning format (e.g., 1.0.0, 1.0.0-alpha, 1.0.0+build)`

**solutions:**
- Use semantic versioning format: `MAJOR.MINOR.PATCH`
- Remove `v` prefix: use `1.0.0` not `v1.0.0`
- Include all three version parts: use `1.0.0` not `1.0`
- Use hyphens for pre-release: `1.0.0-alpha` not `1.0.0_alpha`
- Quote version in YAML to prevent type conversion: `version: "1.0.0"`

**valid examples:**
```yaml
version: "1.0.0"        # Basic version
version: "0.0.1"        # Initial development
version: "1.0.0-alpha"  # Pre-release
version: "2.1.3-rc.1"   # Release candidate
version: "1.0.0+build"  # With build metadata
```
