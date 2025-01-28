import * as vscode from "vscode";
import { errorUtils } from "./libs";
import {
    checkNaming,
    imports,
    ReactMapKeyChecker,
    SwitchDefaultChecker,
    SwitchDuplicateCaseChecker, // 1. Добавляем новый импорт
} from "./modules";

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "TVChecker" is now active!');

    const diagnosticCollection =
        vscode.languages.createDiagnosticCollection("typeChecker");
    context.subscriptions.push(diagnosticCollection);

    const methodDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: "rgba(255, 0, 0, 0.3)",
        border: "1px solid red",
        borderRadius: "2px",
    });

    // 2. Инициализируем новые проверки
    const reactMapKeyChecker = new ReactMapKeyChecker();
    const switchDefaultChecker = new SwitchDefaultChecker();
    const switchDuplicateCaseChecker = new SwitchDuplicateCaseChecker();

    const runChecks = async (document: vscode.TextDocument) => {
        const editor = vscode.window.activeTextEditor;

        diagnosticCollection.clear();
        if (editor) {
            editor.setDecorations(methodDecorationType, []);
        }

        let allDiagnostics: vscode.Diagnostic[] = [];
        let allDecorationRanges: vscode.Range[] = [];

        // Проверка типов для .ts файлов
        if (document.fileName.endsWith(".ts")) {
            const typeErrors = errorUtils.runTypeChecker(
                diagnosticCollection,
                methodDecorationType,
                document
            );

            const typeDiagnostics = typeErrors.map((error) => {
                return new vscode.Diagnostic(
                    error.range,
                    error.message,
                    vscode.DiagnosticSeverity.Warning // Все проверки как Warning
                );
            });

            allDiagnostics = [...allDiagnostics, ...typeDiagnostics];
            allDecorationRanges = [
                ...allDecorationRanges,
                ...typeErrors.map((error) => error.range),
            ];
        }

        // Проверка импортов
        const code = document.getText();
        const {
            diagnostics: importDiagnostics,
            decorationRanges: importDecorationRanges,
            changes,
        } = imports.checkImportPaths(code, document);

        allDiagnostics = [...allDiagnostics, ...importDiagnostics];
        allDecorationRanges = [
            ...allDecorationRanges,
            ...importDecorationRanges,
        ];

        // Проверка именования обработчиков
        const {
            diagnostics: handlerNamingDiagnostics,
            decorationRanges: handlerDecorationRanges,
        } = checkNaming(code, document);

        allDiagnostics = [...allDiagnostics, ...handlerNamingDiagnostics];
        allDecorationRanges = [
            ...allDecorationRanges,
            ...handlerDecorationRanges,
        ];

        // Проверка ключей React-компонентов (.tsx)
        if (document.fileName.endsWith(".tsx")) {
            const mapKeyRanges = reactMapKeyChecker.checkDocument(document);
            allDecorationRanges = [...allDecorationRanges, ...mapKeyRanges];
        }

        // Общие проверки для .ts и .tsx
        if (
            document.fileName.endsWith(".ts") ||
            document.fileName.endsWith(".tsx")
        ) {
            // 3. Проверка дублирующихся case
            const {
                diagnostics: duplicateCaseDiagnostics,
                decorationRanges: duplicateCaseRanges,
            } = switchDuplicateCaseChecker.checkDocument(document);

            allDiagnostics = [...allDiagnostics, ...duplicateCaseDiagnostics];
            allDecorationRanges = [
                ...allDecorationRanges,
                ...duplicateCaseRanges,
            ];

            // Проверка default в switch
            const {
                diagnostics: switchDiagnostics,
                decorationRanges: switchRanges,
            } = switchDefaultChecker.checkDocument(document);

            allDiagnostics = [...allDiagnostics, ...switchDiagnostics];
            allDecorationRanges = [...allDecorationRanges, ...switchRanges];
        }

        diagnosticCollection.set(document.uri, allDiagnostics);

        if (editor && editor.document === document) {
            editor.setDecorations(methodDecorationType, allDecorationRanges);
        }

        // Применение автоматических исправлений
        if (changes.length > 0 && editor) {
            const success = await editor.edit((editBuilder) => {
                changes.forEach((change) => {
                    const startPos = document.positionAt(change.start);
                    const endPos = document.positionAt(change.end);
                    const range = new vscode.Range(startPos, endPos);
                    editBuilder.replace(range, change.newText);
                });
            });

            if (success) {
                await document.save();
                console.log("Файл сохранен после применения изменений.");
            }
        }
    };

    // Обработчики событий
    const saveDisposable = vscode.workspace.onDidSaveTextDocument(
        (document) => {
            if (
                document.languageId === "typescript" ||
                document.languageId === "typescriptreact"
            ) {
                runChecks(document);
            }
        }
    );
    context.subscriptions.push(saveDisposable);

    const changeDisposable = vscode.workspace.onDidChangeTextDocument(
        (event) => {
            const document = event.document;
            if (
                document.languageId === "typescript" ||
                document.languageId === "typescriptreact"
            ) {
                runChecks(document);
            }
        }
    );
    context.subscriptions.push(changeDisposable);
}

export function deactivate() {}
