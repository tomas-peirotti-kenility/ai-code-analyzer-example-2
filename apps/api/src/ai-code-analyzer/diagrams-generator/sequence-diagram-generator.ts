import { Project, SourceFile, Node } from 'ts-morph';

export async function generateSequenceDiagram(
  files: Array<{ originalname: string; path: string; content: string }>,
): Promise<string> {
  const project = new Project({
    compilerOptions: {
      target: 99, //typescript.ScriptTarget.ES2022,
      experimentalDecorators: true,
      moduleResolution: 2, //typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
    },
  });

  files.forEach((file) => {
    const filePath = `/virtual/${file.originalname}`; // Virtual path
    project.createSourceFile(filePath, file.content, { overwrite: true });
  });

  let mermaidCode = `sequenceDiagram\n`;

  project.getSourceFiles().forEach((sourceFile) => {
    mermaidCode += generateSequenceDiagramFromSourceFile(sourceFile);
  });

  return mermaidCode;
}

function generateSequenceDiagramFromSourceFile(sourceFile: SourceFile): string {
  let mermaidCode = '';
  sourceFile.getFunctions().forEach((func) => {
    const functionName = func.getName();
    func.getDescendants().forEach((descendant) => {
      if (descendant.getKindName() === 'CallExpression') {
        const callExpression = Node.isCallExpression(descendant)
          ? descendant
          : undefined;
        if (callExpression) {
          // Narrow down the type to CallExpression
          const expression = callExpression.getExpression();

          // Check if the expression has a getLastChild method
          if (Node.hasName(expression)) {
            const identifier = expression.getLastChild()?.getText();

            if (identifier) {
              mermaidCode += `  ${functionName}->>${identifier}: Call ${identifier}\n`;
            }
          }
        }
      }
    });
  });
  return mermaidCode;
}
