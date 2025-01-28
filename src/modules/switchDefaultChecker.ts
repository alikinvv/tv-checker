// src/modules/switchDefaultChecker.ts
import * as vscode from "vscode";
import * as ts from "typescript";

export class SwitchDefaultChecker {
    public checkDocument(document: vscode.TextDocument) {
        const diagnostics: vscode.Diagnostic[] = [];
        const decorationRanges: vscode.Range[] = [];
        const sourceFile = ts.createSourceFile(
            document.fileName,
            document.getText(),
            ts.ScriptTarget.Latest,
            true
        );

        const checkNode = (node: ts.Node) => {
            if (ts.isSwitchStatement(node)) {
                const hasDefault = node.caseBlock.clauses.some(
                    ts.isDefaultClause
                );

                if (!hasDefault) {
                    // Получаем позицию ключевого слова 'switch' через дочерние токены
                    const switchKeyword = node
                        .getChildren()
                        .find(
                            (child) =>
                                child.kind === ts.SyntaxKind.SwitchKeyword
                        );

                    if (switchKeyword) {
                        const start = document.positionAt(
                            switchKeyword.getStart(sourceFile)
                        );
                        const end = document.positionAt(switchKeyword.getEnd());
                        const range = new vscode.Range(start, end);

                        decorationRanges.push(range);
                        diagnostics.push(
                            new vscode.Diagnostic(
                                range,
                                "Switch statement is missing 'default' case",
                                vscode.DiagnosticSeverity.Warning
                            )
                        );
                    }
                }
            }
            ts.forEachChild(node, checkNode);
        };

        ts.forEachChild(sourceFile, checkNode);
        return { diagnostics, decorationRanges };
    }
}
