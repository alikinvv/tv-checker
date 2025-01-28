// src/modules/switchDuplicateCaseChecker.ts
import * as vscode from "vscode";
import * as ts from "typescript";

export class SwitchDuplicateCaseChecker {
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
                const cases = new Map<string, ts.CaseClause[]>();

                node.caseBlock.clauses.forEach((clause) => {
                    if (ts.isCaseClause(clause)) {
                        const conditionText =
                            clause.expression.getText(sourceFile);
                        const existing = cases.get(conditionText) || [];
                        existing.push(clause);
                        cases.set(conditionText, existing);
                    }
                });

                cases.forEach((clauses, condition) => {
                    if (clauses.length > 1) {
                        clauses.forEach((clause) => {
                            // Изменяем диапазон: берем только выражение условия
                            const expression = clause.expression;
                            const start = document.positionAt(
                                expression.getStart(sourceFile)
                            );
                            const end = document.positionAt(
                                expression.getEnd()
                            );
                            const range = new vscode.Range(start, end);

                            diagnostics.push(
                                new vscode.Diagnostic(
                                    range,
                                    `Дублирующееся условие case: '${condition}'`,
                                    vscode.DiagnosticSeverity.Warning
                                )
                            );
                            decorationRanges.push(range);
                        });
                    }
                });
            }
            ts.forEachChild(node, checkNode);
        };

        ts.forEachChild(sourceFile, checkNode);
        return { diagnostics, decorationRanges };
    }
}
