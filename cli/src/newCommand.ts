import { Command } from "commander";

export const newCommand = new Command("new")
  .description("initialize a new jammin project")
  .argument("<project-name>", "name of the project to create")
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
  .action(createProject);

async function createProject(projectName: string, options: any) {
  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    console.error('❌ Project name can only contain letters, numbers, hyphens, and underscores');
    process.exit(1);
  }

  console.log(`🎯 Initializing project: ${projectName}`);
  console.log(`SDK: ${options.sdk}`);
}
