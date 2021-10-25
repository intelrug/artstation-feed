/* eslint-disable @typescript-eslint/no-var-requires,prefer-promise-reject-errors,no-console */
/* eslint-disable import/no-extraneous-dependencies */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { outputFile } = require('fs-extra');
const klaw = require('klaw');
const pluralize = require('pluralize');

const rl = readline.createInterface(process.stdin, process.stdout);

// Folder with all modules
const BLOCKS_DIR = path.join(__dirname, '../src/modules');

// Default content for files in new module
const fileSources = {
  '%module-name%.resolver.ts':
    'import { UseFilters } from \'@nestjs/common\';\n'
    + 'import {\n'
    + '  Query,\n'
    + '  Resolver,\n'
    + '} from \'@nestjs/graphql\';\n'
    + '\n'
    + 'import { GraphqlExceptionFilter } from \'~/common/filters/graphql-exception.filter\';\n'
    + '\n'
    + 'import { %ModuleNameSingle% } from \'./entities/%module-name%.entity\';\n'
    + 'import { %ModuleName%Service } from \'./services/%module-name%.service\';\n'
    + '\n'
    + '@UseFilters(GraphqlExceptionFilter)\n'
    + '@Resolver(\'%ModuleName%\')\n'
    + 'export class %ModuleName%Resolver {\n'
    + '  public constructor(\n'
    + '    private readonly %moduleName%Service: %ModuleName%Service,\n'
    + '  ) {}\n'
    + '\n'
    + '  @Query(() => [%ModuleNameSingle%])\n'
    + '  get%ModuleName%(): Promise<%ModuleNameSingle%[]> {\n'
    + '    return this.%moduleName%Service.get%ModuleName%();\n'
    + '  }\n'
    + '}\n',
  repositories: {
    '%module-name%.repository.ts':
      'import {\n'
      + '  EntityRepository,\n'
      + '  Repository,\n'
      + '} from \'typeorm\';\n'
      + '\n'
      + 'import { %ModuleNameSingle% } from \'../entities/%module-name%.entity\';\n'
      + '\n'
      + '@EntityRepository(%ModuleNameSingle%)\n'
      + 'export class %ModuleName%Repository extends Repository<%ModuleNameSingle%> {}\n',
  },
  entities: {
    '%module-name%.entity.ts':
      'import {\n'
      + '  Field,\n'
      + '  Int,\n'
      + '  ObjectType,\n'
      + '} from \'@nestjs/graphql\';\n'
      + 'import {\n'
      + '  Entity,\n'
      + '  PrimaryGeneratedColumn,\n'
      + '} from \'typeorm\';\n'
      + '\n'
      + '@ObjectType()\n'
      + '@Entity({ name: \'%module_name%\' })\n'
      + 'export class %ModuleNameSingle% {\n'
      + '  @Field(() => Int)\n'
      + '  @PrimaryGeneratedColumn()\n'
      + '  public id: number;\n'
      + '}\n',
  },
  services: {
    '%module-name%.service.ts':
      'import { Injectable } from \'@nestjs/common\';\n'
        + 'import { InjectRepository } from \'@nestjs/typeorm\';\n'
        + '\n'
        + 'import { %ModuleNameSingle% } from \'../entities/%module-name%.entity\';\n'
        + 'import { %ModuleName%Repository } from \'../repositories/%module-name%.repository\';\n'
        + '\n'
        + '@Injectable()\n'
        + 'export class %ModuleName%Service {\n'
        + '  public constructor(\n'
        + '    @InjectRepository(%ModuleName%Repository)\n'
        + '    private readonly %moduleName%Repository: %ModuleName%Repository,\n'
        + '  ) {}\n'
        + '\n'
        + '  public async get%ModuleName%(): Promise<%ModuleNameSingle%[]> {\n'
        + '    return this.%moduleName%Repository.find();\n'
        + '  }\n'
        + '}\n',
  },
  '%module-name%.module.ts':
    'import { Module } from \'@nestjs/common\';\n'
    + 'import { TypeOrmModule } from \'@nestjs/typeorm\';\n'
    + '\n'
    + 'import { %ModuleName%Repository } from \'./repositories/%module-name%.repository\';\n'
    + 'import { %ModuleName%Service } from \'./services/%module-name%.service\';\n'
    + 'import { %ModuleName%Resolver } from \'./%module-name%.resolver\';\n'
    + '\n'
    + '@Module({\n'
    + '  imports: [\n'
    + '    TypeOrmModule.forFeature([\n'
    + '      %ModuleName%Repository,\n'
    + '    ]),\n'
    + '  ],\n'
    + '  providers: [\n'
    + '    %ModuleName%Resolver,\n'
    + '    %ModuleName%Service,\n'
    + '  ],\n'
    + '  exports: [],\n'
    + '})\n'
    + 'export class %ModuleName%Module {}\n',
};

function clearAndUpper(text) {
  return text.replace(/-/, '').toUpperCase();
}

function toCamelCase(text) {
  return text.replace(/-\w/g, clearAndUpper);
}

function toPascalCase(text) {
  return text.replace(/(^\w|-\w)/g, clearAndUpper);
}

function toUnderscoreCase(text) {
  return text.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function validateBlockName(moduleName) {
  return new Promise((resolve, reject) => {
    const isValid = /^([\w-])+$/.test(moduleName);

    if (isValid) {
      resolve(isValid);
    } else {
      const errorMessage = `ERR>>> An incorrect module name '${moduleName}'\n`
        + 'ERR>>> A module name must include letters, numbers & the minus symbol.';
      reject(errorMessage);
    }
  });
}

function directoryExist(modulePath, moduleName) {
  return new Promise((resolve, reject) => {
    fs.stat(modulePath, (notExist) => {
      if (notExist) {
        resolve();
      } else {
        reject(`ERR>>> The module '${moduleName}' already exists.`);
      }
    });
  });
}

function createDirectory(directoryPath) {
  return new Promise((resolve, reject) => {
    fs.mkdir(directoryPath, (error) => {
      if (error) {
        reject(`ERR>>> Failed to create a folder '${directoryPath}'`);
      } else {
        resolve();
      }
    });
  });
}

function createFiles(modulesPath, moduleName) {
  const promises = [];

  Object.keys(fileSources).forEach((directory) => {
    const directoryPath = path.join(modulesPath, directory);

    function processFile(p, sources) {
      const fileSource = sources
        .replace(/%module-name%/g, moduleName)
        .replace(/%module_name%/g, toUnderscoreCase(moduleName))
        .replace(/%moduleName%/g, toCamelCase(moduleName))
        .replace(/%ModuleName%/g, toPascalCase(moduleName))
        .replace(/%ModuleNameSingle%/g, pluralize.singular(toPascalCase(moduleName)));
      const filePath = path.join(p).replace(/%module-name%/g, moduleName);

      promises.push(outputFile(filePath, fileSource, { encoding: 'utf8' }));
    }

    if (/\./.test(directory)) {
      processFile(directoryPath, fileSources[directory]);
    } else {
      Object.keys(fileSources[directory]).forEach((file) => {
        processFile(path.join(directoryPath, file), fileSources[directory][file]);
      });
    }
  });

  return Promise.all(promises);
}

function getFiles(modulePath) {
  return new Promise((resolve) => {
    const items = [];
    klaw(modulePath)
      .on('data', (item) => {
        if (item.stats.isFile()) {
          items.push(item.path.replace(modulePath, ''));
        }
      })
      .on('end', () => resolve(items));
  });
}

function printErrorMessage(errorText) {
  console.log(errorText);
  rl.close();
}

// //////////////////////////////////////////////////////////////////////////

function initMakeBlock(candidateModuleName) {
  const moduleNames = candidateModuleName.trim().split(/\s+/);

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const makeBlock = (moduleName) => {
    const modulePath = path.join(BLOCKS_DIR, moduleName);

    return validateBlockName(moduleName)
      .then(() => directoryExist(modulePath, moduleName))
      .then(() => createDirectory(modulePath))
      .then(() => createFiles(modulePath, moduleName))
      .then(() => getFiles(modulePath))
      .then((files) => {
        const line = '-'.repeat(48 + moduleName.length);
        console.log(line);
        console.log(`The module has just been created in 'src/modules/${moduleName}'`);
        console.log(line);

        // Displays a list of files created
        files.forEach((file) => console.log(file));
      });
  };

  if (moduleNames.length === 1) {
    return makeBlock(moduleNames[0]);
  }

  const promises = moduleNames.map((name) => makeBlock(name));
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
  initMakeBlock(moduleNameFromCli)
    .then(() => rl.close())
    .catch(printErrorMessage);
} else {
  rl.setPrompt('Module(s) name: ');
  rl.prompt();
  rl.on('line', (line) => {
    initMakeBlock(line)
      .then(() => rl.close())
      .catch(printErrorMessage);
  });
}
