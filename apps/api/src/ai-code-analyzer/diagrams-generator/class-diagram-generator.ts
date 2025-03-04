import { Project } from 'ts-morph';

export async function generateClassDiagram(
  files: Array<{ originalname: string; path: string; content: string }>,
): Promise<string> {
  try {
    const project = new Project({
      compilerOptions: {
        target: 99, //typescript.ScriptTarget.ES2022,
        experimentalDecorators: true,
        moduleResolution: 2, //typescript.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
      },
    });

    for (const file of files) {
      const filePath = `/virtual/${file.originalname}`; // Virtual path
      project.createSourceFile(filePath, file.content, { overwrite: true });
    }

    let mermaidCode = `classDiagram\n`;
    for (const sourceFile of project.getSourceFiles()) {
      for (const clazz of sourceFile.getClasses()) {
        mermaidCode += `  class ${clazz.getName()} {\n`;
        for (const property of clazz.getProperties()) {
          mermaidCode += `    ${property.getName()}: ${property
            .getType()
            .getText()}\n`;
        }
        for (const method of clazz.getMethods()) {
          mermaidCode += `    ${method.getName()}()\n`;
        }
        mermaidCode += `  }\n`;
      }
    }

    return mermaidCode;
  } catch (error) {
    console.error(
      `Error generating ts-mermaid diagram: ${error.message}`,
      error.stack,
    );
    throw new Error('Failed to generate ts-mermaid diagram');
  }
}
