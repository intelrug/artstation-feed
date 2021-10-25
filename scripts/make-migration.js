/* eslint-disable @typescript-eslint/no-var-requires,prefer-promise-reject-errors,no-console */
/* eslint-disable import/no-extraneous-dependencies */
const path = require('path');
const readline = require('readline');

const { outputFile } = require('fs-extra');
const { DateTime } = require('luxon');

const rl = readline.createInterface(process.stdin, process.stdout);

// Folder with all migrations
const MIGRATIONS_DIR = path.join(__dirname, '../src/database/migrations');

// Default content for new migration
const TEMPLATE_NAME = '%timestamp%_%migration_name%.ts';
const TEMPLATE_SOURCE = ''
  + 'import {\n'
  + '  MigrationInterface,\n'
  + '  QueryRunner,\n'
  + '} from \'typeorm\';\n'
  + '\n'
  + 'export class %MigrationName% implements MigrationInterface {\n'
  + '  name = \'%migration_name%_%timestamp%\';\n'
  + '\n'
  + '  public async up(queryRunner: QueryRunner): Promise<void> {\n'
  + '\n'
  + '  }\n'
  + '\n'
  + '  public async down(queryRunner: QueryRunner): Promise<void> {\n'
  + '\n'
  + '  }\n'
  + '}\n';

function clearAndUpper(text) {
  return text.replace(/_/, '').toUpperCase();
}

function toCamelCase(text) {
  return text.replace(/_\w/g, clearAndUpper);
}

function toPascalCase(text) {
  return text.replace(/(^\w|_\w)/g, clearAndUpper);
}

function validateMigrationName(moduleName) {
  return new Promise((resolve, reject) => {
    const isValid = /^(\w)+$/.test(moduleName);

    if (isValid) {
      resolve(isValid);
    } else {
      const errorMessage = `ERR>>> An incorrect migration name '${moduleName}'\n`
        + 'ERR>>> A migration name must include letters, numbers & the underscore symbol.';
      reject(errorMessage);
    }
  });
}

function getTimestamp() {
  return DateTime.local().toFormat('yyyy_MM_dd_HHmmss');
}

function createFile(name) {
  return new Promise((resolve, reject) => {
    const timestamp = getTimestamp();
    const fileSource = TEMPLATE_SOURCE
      .replace(/%migration_name%/g, name)
      .replace(/%migrationName%/g, toCamelCase(name))
      .replace(/%MigrationName%/g, toPascalCase(name))
      .replace(/%timestamp%/g, Date.now().toString());
    const fileName = TEMPLATE_NAME
      .replace(/%timestamp%/g, timestamp)
      .replace(/%migration_name%/g, name);
    const filePath = path.join(MIGRATIONS_DIR, fileName);

    outputFile(filePath, fileSource, { encoding: 'utf8' })
      .then(() => resolve(fileName))
      .catch((error) => reject(error));
  });
}

function printErrorMessage(errorText) {
  console.log(errorText);
  rl.close();
}

// //////////////////////////////////////////////////////////////////////////

function initMakeMigration(input) {
  const names = input.trim().split(/\s+/);

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const makeMigration = (name) => validateMigrationName(name)
    .then(() => createFile(name))
    .then((fileName) => {
      const line = '-'.repeat(48 + name.length);
      const relativePath = path.join(MIGRATIONS_DIR, fileName).replace(process.cwd(), '');
      console.log(line);
      console.log(`The migration has just been created in '${relativePath}'`);
      console.log(line);
    });

  if (names.length === 1) {
    return makeMigration(names[0]);
  }

  const promises = names.map((name) => makeMigration(name));
  return Promise.all(promises);
}

// //////////////////////////////////////////////////////////////////////////
//
// Start here
//

// Command line arguments
const moduleNameFromCli = process.argv
  .slice(2)
  // join all arguments to one string (to simplify the capture user input errors)
  .join(' ');

// If the user pass the name of the module in the command-line options
// that create a module. Otherwise - activates interactive mode
if (moduleNameFromCli !== '') {
  initMakeMigration(moduleNameFromCli)
    .then(() => rl.close())
    .catch(printErrorMessage);
} else {
  rl.setPrompt('Migration(s) name: ');
  rl.prompt();
  rl.on('line', (line) => {
    initMakeMigration(line)
      .then(() => rl.close())
      .catch(printErrorMessage);
  });
}
