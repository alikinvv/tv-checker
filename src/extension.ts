import * as vscode from "vscode";
import { errorUtils } from "./libs";
import { imports } from "./modules";

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

    const runChecks = (document: vscode.TextDocument) => {
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
                    vscode.DiagnosticSeverity.Error
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
        const { diagnostics: importDiagnostics, decorationRanges } =
            imports.checkImportPaths(code, document);

        allDiagnostics = [...allDiagnostics, ...importDiagnostics];
        allDecorationRanges = [...allDecorationRanges, ...decorationRanges];

        diagnosticCollection.set(document.uri, allDiagnostics);

        if (editor && editor.document === document) {
            editor.setDecorations(methodDecorationType, allDecorationRanges);
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
