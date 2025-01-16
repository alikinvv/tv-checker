import * as vscode from "vscode";
import ts from "typescript";
import { utils } from "../modules";

export class ErrorUtils {
    private methodErrorRanges: vscode.Range[] = [];
    private methodErrorMessages = new Map<vscode.Range, string>();

    /**
     * Запускает проверку типов для активного редактора.
     */
    public runTypeChecker(
        diagnosticCollection: vscode.DiagnosticCollection,
        methodDecorationType: vscode.TextEditorDecorationType,
        document: vscode.TextDocument
    ): { range: vscode.Range; message: string }[] {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }

        const filePath = document.fileName;
        const sourceCode = document.getText();

        console.log(`Running type checker for: ${filePath}`);

        // Очищаем предыдущие диагностики, декорации и хранилище ошибок
        diagnosticCollection.clear();
        editor.setDecorations(methodDecorationType, []);
        this.methodErrorRanges = [];
        this.methodErrorMessages.clear();

        // Создаем SourceFile и проверяем типы
        const sourceFile = utils.createSourceFile(sourceCode, filePath);
        const errors = [
            ...this.checkForAnyType(sourceFile, document), // Проверка на `any`
            ...this.checkForMissingReturnType(sourceFile, document), // Проверка на отсутствие возвращаемого типа
            ...this.checkForAnyReturnType(sourceFile, document), // Проверка на возвращаемый тип `any`
        ];

        console.log(`Found ${errors.length} errors`);

        // Преобразуем ошибки в диагностики и декорации
        const diagnostics: vscode.Diagnostic[] = [];
        const vscodeErrors: { range: vscode.Range; message: string }[] = [];

        errors.forEach((error) => {
            const range = this.createRange(error.range, document);
            const diagnostic = new vscode.Diagnostic(
                range,
                error.message,
                vscode.DiagnosticSeverity.Error
            );
            diagnostics.push(diagnostic);

            // Сохраняем диапазон и сообщение для декорации
            this.methodErrorRanges.push(range);
            this.methodErrorMessages.set(range, error.message);

            // Сохраняем ошибку в формате, совместимом с VS Code
            vscodeErrors.push({ range, message: error.message });
        });

        // Добавляем диагностики в коллекцию
        diagnosticCollection.set(document.uri, diagnostics);

        // Применяем декорации к названиям методов с ошибками
        editor.setDecorations(methodDecorationType, this.methodErrorRanges);

        // Возвращаем ошибки типизации
        return vscodeErrors;
    }

    /**
     * Проверяет, используется ли тип `any` в параметрах функций или переменных.
     */
    private checkForAnyType(
        sourceFile: ts.SourceFile,
        document: vscode.TextDocument
    ): { range: ts.TextRange; message: string }[] {
        const errors: { range: ts.TextRange; message: string }[] = [];

        const visit = (node: ts.Node) => {
            // Проверяем параметры функций
            if (ts.isParameter(node) && node.type) {
                const typeText = node.type.getText(sourceFile);
                if (typeText === "any") {
                    // Получаем диапазон для всего параметра (включая имя)
                    const parameterStart = node.getStart(sourceFile);
                    const parameterEnd = node.getEnd();
                    errors.push({
                        range: { pos: parameterStart, end: parameterEnd },
                        message: "Использование типа 'any' запрещено.",
                    });
                }
            }

            // Проверяем объявления переменных
            if (ts.isVariableDeclaration(node) && node.type) {
                const typeText = node.type.getText(sourceFile);
                if (typeText === "any") {
                    errors.push({
                        range: { pos: node.type.pos, end: node.type.end },
                        message: "Использование типа 'any' запрещено.",
                    });
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return errors;
    }

    /**
     * Проверяет, есть ли у методов явный возвращаемый тип.
     */
    private checkForMissingReturnType(
        sourceFile: ts.SourceFile,
        document: vscode.TextDocument
    ): { range: ts.TextRange; message: string }[] {
        const errors: { range: ts.TextRange; message: string }[] = [];

        const visit = (node: ts.Node) => {
            // Проверяем методы и функции
            if (
                ts.isMethodDeclaration(node) ||
                ts.isFunctionDeclaration(node)
            ) {
                // Если у метода/функции нет возвращаемого типа, но есть return
                if (!node.type && this.containsReturnStatement(node)) {
                    // Получаем диапазон имени метода/функции
                    const name = node.name;
                    if (name) {
                        const nameStart = name.getStart(sourceFile);
                        const nameEnd = name.getEnd();
                        errors.push({
                            range: { pos: nameStart, end: nameEnd },
                            message:
                                "Метод/функция должен иметь явный возвращаемый тип.",
                        });
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return errors;
    }

    /**
     * Проверяет, возвращает ли метод/функция тип `any`.
     */
    private checkForAnyReturnType(
        sourceFile: ts.SourceFile,
        document: vscode.TextDocument
    ): { range: ts.TextRange; message: string }[] {
        const errors: { range: ts.TextRange; message: string }[] = [];

        const visit = (node: ts.Node) => {
            // Проверяем методы и функции
            if (
                ts.isMethodDeclaration(node) ||
                ts.isFunctionDeclaration(node)
            ) {
                // Если у метода/функции есть возвращаемый тип `any`
                if (node.type && node.type.getText(sourceFile) === "any") {
                    // Получаем диапазон имени метода/функции
                    const name = node.name;
                    if (name) {
                        const nameStart = name.getStart(sourceFile);
                        const nameEnd = name.getEnd();
                        errors.push({
                            range: { pos: nameStart, end: nameEnd },
                            message:
                                "Метод/функция возвращает тип 'any'. Это запрещено.",
                        });
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return errors;
    }

    /**
     * Проверяет, содержит ли узел оператор return.
     */
    private containsReturnStatement(node: ts.Node): boolean {
        let hasReturn = false;

        const visit = (child: ts.Node) => {
            if (ts.isReturnStatement(child)) {
                hasReturn = true;
            }
            ts.forEachChild(child, visit);
        };

        ts.forEachChild(node, visit);
        return hasReturn;
    }

    /**
     * Преобразует TextRange в vscode.Range.
     */
    private createRange(
        range: ts.TextRange,
        document: vscode.TextDocument
    ): vscode.Range {
        const start = document.positionAt(range.pos);
        const end = document.positionAt(range.end);
        return new vscode.Range(start, end);
    }

    /**
     * Возвращает сообщение об ошибке для указанной позиции.
     */
    public getErrorMessage(position: vscode.Position): string | undefined {
        const methodRange = this.methodErrorRanges.find((range) =>
            range.contains(position)
        );
        if (methodRange) {
            return this.methodErrorMessages.get(methodRange);
        }
        return undefined;
    }
}

export const errorUtils = new ErrorUtils();
