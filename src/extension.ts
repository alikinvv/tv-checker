import * as vscode from "vscode";
import { errorUtils } from "./libs";
import {
    checkNaming,
    imports,
    ReactMapKeyChecker,
    SwitchDefaultChecker,
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

    const reactMapKeyChecker = new ReactMapKeyChecker();
    const switchDefaultChecker = new SwitchDefaultChecker();

    const runChecks = async (document: vscode.TextDocument) => {
        const editor = vscode.window.activeTextEditor;

        diagnosticCollection.clear();
        if (editor) {
            editor.setDecorations(methodDecorationType, []);
        }

        let allDiagnostics: vscode.Diagnostic[] = [];
        let allDecorationRanges: vscode.Range[] = [];

        // Проверка типов для всех .ts файлов
        if (document.fileName.endsWith(".ts")) {
            console.log("Running type checker...");
            const typeErrors = errorUtils.runTypeChecker(
                diagnosticCollection,
                methodDecorationType,
                document
            );

            const typeDiagnostics = typeErrors.map((error) => {
                return new vscode.Diagnostic(
                    error.range,
                    error.message,
                    vscode.DiagnosticSeverity.Warning
                );
            });

            allDiagnostics = [...allDiagnostics, ...typeDiagnostics];
            allDecorationRanges = [
                ...allDecorationRanges,
                ...typeErrors.map((error) => error.range),
            ];
        }

        // Проверка путей импортов
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

        // Проверка наименования функций-обработчиков
        const {
            diagnostics: handlerNamingDiagnostics,
            decorationRanges: handlerDecorationRanges,
        } = checkNaming(code, document);

        allDiagnostics = [...allDiagnostics, ...handlerNamingDiagnostics];
        allDecorationRanges = [
            ...allDecorationRanges,
            ...handlerDecorationRanges,
        ];

        // Проверка ключей в map для React-компонентов (только для .tsx)
        if (document.fileName.endsWith(".tsx")) {
            const mapKeyRanges = reactMapKeyChecker.checkDocument(document);
            allDecorationRanges = [...allDecorationRanges, ...mapKeyRanges];
        }

        // Проверка default в switch (для всех .ts и .tsx)
        if (
            document.fileName.endsWith(".ts") ||
            document.fileName.endsWith(".tsx")
        ) {
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

        // Применение изменений к документу
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

    const saveDisposable = vscode.workspace.onDidSaveTextDocument(
        (document) => {
            console.log(`File saved: ${document.fileName}`);
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
            console.log(`File changed: ${document.fileName}`);
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
