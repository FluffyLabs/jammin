import { Command } from "commander";
import { group, intro, select, spinner, text } from "@clack/prompts";

interface ProjectConfig {
  name: string;
  sdk: string;
}

export const newCommand = new Command("new")
  .description("initialize a new jammin project")
  .argument("[project-name]", "name of the project to create")
  .addOption(
    new Command().createOption("--sdk <sdk>", "target sdk")
      .choices(["polkajam", "jade", "jambrains"])
      .default("polkajam")
  )
  .addHelpText("after", `
  SDKs: 
    polkajam      by Parity
    jade          by SpaceJam
    jambrains     by JamBrains

  Examples:
    $ jammin new my-app
    $ jammin new my-app --sdk polkajam
  `)
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
  intro('🎯 Create a new JAM Service');

  const config = await group({
    name: () => text({
      message: 'What is your project name?',
      placeholder: 'my-service',
    }),

    sdk: () => select({
      message: 'Which template would you like to use?',
      options: [
        { value: "polkajam" },
        { value: "jade" },
        { value: "jambrains" },
      ]
    }),
  });

  return config as ProjectConfig;
}

async function createProject(config: ProjectConfig) {
  const s = spinner();
  s.start(`🎯 Initializing project: ${config.name}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  s.stop("✅ Created!");
}
