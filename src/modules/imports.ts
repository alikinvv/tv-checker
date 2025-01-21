import * as ts from "typescript";
import * as vscode from "vscode";

export class Imports {
    /**
     * Проверяет, что импорты указывают на папки, а не на файлы.
     * @param code Исходный код.
     * @param document Документ VS Code (для получения позиций).
     * @returns Массив ошибок, если импорты указывают на файлы.
     */
    public checkImportPaths(
        code: string,
        document: vscode.TextDocument
    ): {
        diagnostics: vscode.Diagnostic[];
        decorationRanges: vscode.Range[];
        changes: { start: number; end: number; newText: string }[]; // Добавляем массив изменений
    } {
        const sourceFile = this.createSourceFile(code);
        const diagnostics: vscode.Diagnostic[] = [];
        const decorationRanges: vscode.Range[] = [];
        const changes: { start: number; end: number; newText: string }[] = []; // Инициализируем массив изменений

        // Рекурсивно обходим AST
        const visit = (node: ts.Node) => {
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    const importPath = moduleSpecifier.text;

                    // Исключаем .scss файлы из проверки
                    if (importPath.endsWith(".scss")) {
                        return; // Пропускаем этот импорт
                    }

                    // Проверяем, что путь не заканчивается на конкретный файл (например, .ts, .js, .tsx)
                    if (/\.[a-zA-Z]+$/.test(importPath)) {
                        const start = moduleSpecifier.getStart(sourceFile);
                        const end = moduleSpecifier.getEnd();

                        if (
                            (importPath.startsWith("./") ||
                                importPath.startsWith("../")) &&
                            !importPath.includes("/components/") &&
                            importPath.split("/").length > 2
                        ) {
                            // Находим позицию названия файла в строке импорта
                            const fileName = importPath.split("/").pop() || ""; // Получаем название файла
                            const fileNameStart =
                                importPath.lastIndexOf("/") + 1; // Позиция начала названия файла
                            const fileNameEnd = fileNameStart + fileName.length; // Позиция конца названия файла

                            // Получаем диапазон для ошибки (увеличиваем конечную позицию на 1)
                            const range = new vscode.Range(
                                document.positionAt(start + fileNameStart),
                                document.positionAt(start + fileNameEnd + 1) // +1 для включения последнего символа
                            );

                            // Добавляем диагностику
                            const diagnostic = new vscode.Diagnostic(
                                range,
                                `Импорт должен указывать на папку, а не на файл: ${importPath}`,
                                vscode.DiagnosticSeverity.Error
                            );
                            diagnostics.push(diagnostic);

                            // Добавляем диапазон для декорации
                            decorationRanges.push(range);
                        }
                    }

                    // Проверяем, начинается ли путь с "../" и заменяем его на "./"
                    if (importPath.startsWith("../")) {
                        const newPath = `./${importPath}`;
                        changes.push({
                            start: moduleSpecifier.getStart(sourceFile) + 1, // +1 чтобы пропустить кавычку
                            end: moduleSpecifier.getEnd() - 1, // -1 чтобы пропустить кавычку
                            newText: newPath,
                        });
                    }
                }
            }

            ts.forEachChild(node, visit);
        };

        visit(sourceFile);
        return { diagnostics, decorationRanges, changes }; // Возвращаем изменения
    }

    /**
     * Создает SourceFile из кода.
     * @param code Исходный код.
     * @returns Объект SourceFile.
     */
    private createSourceFile(code: string): ts.SourceFile {
        return ts.createSourceFile(
            "temp.ts", // Имя файла (не важно, так как мы не сохраняем его)
            code,
            ts.ScriptTarget.Latest,
            true
        );
    }
}

export const imports = new Imports();
