import * as ts from "typescript";
import * as vscode from "vscode";

export class ReactMapKeyChecker {
    public checkDocument(document: vscode.TextDocument): vscode.Range[] {
        const decorationRanges: vscode.Range[] = [];
        const text = document.getText();

        // Используем TypeScript для парсинга AST
        const sourceFile = ts.createSourceFile(
            document.fileName,
            text,
            ts.ScriptTarget.Latest,
            true
        );

        this.checkNode(sourceFile, decorationRanges, document);

        return decorationRanges;
    }

    private checkNode(
        node: ts.Node,
        decorationRanges: vscode.Range[],
        document: vscode.TextDocument
    ) {
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression)
        ) {
            const methodName = node.expression.name.getText();
            if (methodName === "map") {
                const hasKeyProp = node.arguments.some((arg) => {
                    if (
                        ts.isArrowFunction(arg) ||
                        ts.isFunctionExpression(arg)
                    ) {
                        const returnStatement = arg.body;
                        if (ts.isBlock(returnStatement)) {
                            const lastStatement =
                                returnStatement.statements[
                                    returnStatement.statements.length - 1
                                ];
                            if (
                                ts.isReturnStatement(lastStatement) &&
                                lastStatement.expression
                            ) {
                                const jsxElement = lastStatement.expression;

                                // Обрабатываем JsxSelfClosingElement
                                if (ts.isJsxSelfClosingElement(jsxElement)) {
                                    return jsxElement.attributes.properties.some(
                                        (prop) => {
                                            return (
                                                ts.isJsxAttribute(prop) &&
                                                prop.name.getText() === "key"
                                            );
                                        }
                                    );
                                }

                                // Обрабатываем JsxElement
                                if (ts.isJsxElement(jsxElement)) {
                                    return jsxElement.openingElement.attributes.properties.some(
                                        (prop) => {
                                            return (
                                                ts.isJsxAttribute(prop) &&
                                                prop.name.getText() === "key"
                                            );
                                        }
                                    );
                                }
                            }
                        }
                    }
                    return false;
                });

                if (!hasKeyProp) {
                    // Определяем позицию ".map"
                    const mapStart = node.expression.name.getStart();
                    const mapEnd = node.expression.name.getEnd();

                    // Создаем диапазон только для ".map"
                    const start = document.positionAt(mapStart);
                    const end = document.positionAt(mapEnd);
                    const range = new vscode.Range(start, end);
                    decorationRanges.push(range);
                }
            }
        }

        ts.forEachChild(node, (childNode) =>
            this.checkNode(childNode, decorationRanges, document)
        );
    }
}
