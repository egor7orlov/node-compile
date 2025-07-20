import fsAsync from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { exec } from 'child_process';
import { promisify } from 'node:util';
import { Command } from 'commander';

const execAsync = promisify(exec);

const PROGRAM_NAME = 'node-compile';
const program = new Command()
  .name(PROGRAM_NAME)
  .description(
    'Literally just an execution of commands from Node.js docs on SEA',
  )
  .version('1.0.0')
  .argument('<in>')
  .argument('[out]');
const SEA_CFG_FILENAME = 'sea-config.json';
const BLOB_FILENAME = 'a.blob';

const IS_MACOS = process.platform === 'darwin';

async function main() {
  try {
    program.parse();

    const nodePath = (await execAsync('command -v node')).stdout.trim();
    const inputJsPath = program.args[0];
    const outExecPath =
      program.args[1] || path.basename(inputJsPath, path.extname(inputJsPath));

    console.log(
      `Node.js binary path: ${path.resolve(nodePath)}
Input JavaScript file: ${path.resolve(inputJsPath)}
Output executable: ${path.resolve(outExecPath)}`,
    );

    const tempDirPath = await fsAsync.mkdtemp(
      path.join(tmpdir(), `${PROGRAM_NAME}-`),
    );

    console.log('Temp frolder: ', tempDirPath);

    const seaCfgPath = path.join(tempDirPath, SEA_CFG_FILENAME);
    const blobPath = path.join(tempDirPath, BLOB_FILENAME);
    const seaCfg = {
      main: inputJsPath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: true,
    };

    await fsAsync.writeFile(seaCfgPath, JSON.stringify(seaCfg));

    await execAsync(`node --experimental-sea-config ${seaCfgPath}`);
    await execAsync(`cp ${nodePath} ${outExecPath}`);

    if (IS_MACOS) {
      await execAsync(`codesign --remove-signature ${outExecPath}`);
    }

    let postjectCmdStr = `npx postject ${outExecPath} NODE_SEA_BLOB ${blobPath} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;
    if (IS_MACOS) {
      postjectCmdStr += ' --macho-segment-name NODE_SEA';
    }
    await execAsync(postjectCmdStr);

    if (IS_MACOS) {
      await execAsync(`codesign --sign - ${outExecPath}`);
    }
  } catch (err: any) {
    console.error(err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
