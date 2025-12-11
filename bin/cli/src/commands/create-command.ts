import * as p from "@clack/prompts";
import { Command, InvalidArgumentError } from "commander";
import { fetchRepo } from "../../utils/fetch-repo";

type Template = "jam-sdk" | "jade" | "jambrains" | "undecided";

const TARGETS: Record<Template, string> = {
  "jam-sdk": "jammin-create/jammin-create-jam-sdk",
  jade: "jammin-create/jammin-create-jade",
  jambrains: "jammin-create/jammin-create-jambrains",
  undecided: "jammin-create/jammin-create-undecided",
};

const TEMPLATES = Object.keys(TARGETS) as Template[];

interface ProjectConfig {
  name: string;
  template: Template;
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

export const createCommand = new Command("create")
  .description("initialize a new jammin project from template")
  .argument("[project-name]", "name of the project to create", validate)
  .addOption(new Command().createOption("--template <template>", "project template to use").choices(TEMPLATES).default(TEMPLATES[0]))
  .addHelpText(
    "after",
    `Examples:
    $ jammin create my-app
    $ jammin create my-app --template ${TEMPLATES[0]}
  `,
  )
  .action(async (projectName, options) => {
    let config: ProjectConfig;

    if (projectName) {
      config = {
        name: projectName,
        template: options.template,
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

      template: () =>
        p.select({
          message: "Which template would you like to use?",
          options: TEMPLATES.map((template) => ({ value: template })),
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

async function createProject(config: ProjectConfig) {
  const s = p.spinner();
  p.log.step(`🎯 Initializing project: ${config.name}`);

  s.start("📝 Creating project...");
  try {
    await fetchRepo(TARGETS[config.template], config.name);
    s.stop(`✅ Created project using SDK: ${config.template}`);
    p.note(`cd ${config.name}`);
  } catch (error) {
    s.stop("❌ Failed to create project");
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  p.outro("✅ Finished!");
}
