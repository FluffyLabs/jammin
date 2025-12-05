import * as p from "@clack/prompts";
import { Command, InvalidArgumentError } from "commander";

interface ProjectConfig {
  name: string;
  sdk: string;
}

// TODO: [MaSo] Should employ zod for validation
export function validate(name: string) {
  if (!name || name.trim().length === 0) {
    return new InvalidArgumentError("Project name is required");
  }

  const trimmed = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*$/.test(trimmed)) {
    return new InvalidArgumentError(
      "Invalid project name. Project name must start with alpha-numeric value, and can only contains letters, numbers, hyphens, and underscores",
    );
  }

  return trimmed;
}

// TODO: [MaSo] dummy command
export const newCommand = new Command("new")
  .description("initialize a new jammin project")
  .argument("[project-name]", "name of the project to create", validate)
  .addOption(
    new Command()
      .createOption("--sdk <sdk>", "target sdk")
      .choices(["polkajam", "jade", "jambrains"])
      .default("polkajam"),
  )
  .addHelpText(
    "after",
    `
  SDKs: 
    polkajam      by Parity
    jade          by SpaceJam
    jambrains     by JamBrains

  Examples:
    $ jammin new my-app
    $ jammin new my-app --sdk polkajam
  `,
  )
  .action(async (projectName, options) => {
    let config: ProjectConfig;

    if (projectName) {
      config = {
        name: projectName,
        sdk: options.sdk,
      };
    } else {
      config = await runInteractiveSetup();
    }

    createProject(config);
  });

async function runInteractiveSetup(): Promise<ProjectConfig> {
  p.intro("🎯 Create a new JAM Service");

  const config = await p.group(
    {
      name: () =>
        p.text({
          message: "What is your project name?",
          placeholder: "my-service",
          validate: (name) => {
            if (!name) {
              return "Project name is required";
            }
            const result = validate(name);
            if (result instanceof InvalidArgumentError) {
              return result.message.replace("Error: ", "");
            }
          },
        }),

      sdk: () =>
        p.select({
          message: "Which template would you like to use?",
          options: [{ value: "polkajam" }, { value: "jade" }, { value: "jambrains" }],
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled");
        process.exit(1);
      },
    },
  );

  return config as ProjectConfig;
}

// TODO: [MaSo] Dummy create project
async function createProject(config: ProjectConfig) {
  const s = p.spinner();
  p.log.step(`🎯 Initializing project: ${config.name}`);
  s.start("📝 Creating project...");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  s.stop(`✅ Created project using SDK: ${config.sdk}`);
  s.start("📚 Creating config files...");
  await new Promise((resolve) => setTimeout(resolve, 2500));
  s.stop("✅ Created configs!");

  p.outro("✅ Finished!");
}
