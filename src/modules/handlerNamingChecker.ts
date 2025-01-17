import * as vscode from "vscode";

/**
 * Проверяет, начинается ли название метода с "handle".
 * @param methodName Название метода.
 * @returns true, если название начинается с "handle", иначе false.
 */
function isHandlerMethod(methodName: string): boolean {
    // Приводим название метода к нижнему регистру для проверки
    return methodName.toLowerCase().startsWith("handle");
}

/**
 * Проверяет код на наличие методов, содержащих слово "handle", но не начинающихся с него.
 * @param code Код для анализа.
 * @param document Документ, с которым работает VS Code.
 * @returns Массив диагностических сообщений и диапазонов для декораций.
 */
export function checkHandlerNaming(
    code: string,
    document: vscode.TextDocument
): {
    diagnostics: vscode.Diagnostic[];
    decorationRanges: vscode.Range[];
} {
    const diagnostics: vscode.Diagnostic[] = [];
    const decorationRanges: vscode.Range[] = [];

    // Регулярное выражение для поиска названий методов, содержащих слово "handle"
    const methodRegex =
        /(?:function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*\(|(\w+)\s*:\s*function\s*\(|class\s+\w+\s*{[^}]*\b(\w+)\s*\()/g;

    let match: RegExpExecArray | null;

    while ((match = methodRegex.exec(code)) !== null) {
        // Извлекаем название метода из одной из возможных групп
        const methodName =
            match[1] || match[2] || match[3] || match[4] || match[5];

        // Проверяем, содержит ли название слово "handle" (без учёта регистра)
        if (methodName && methodName.toLowerCase().includes("handle")) {
            // Если название содержит "handle", но не начинается с него, добавляем ошибку
            if (!isHandlerMethod(methodName)) {
                // Находим позицию названия метода в коде
                const methodNameIndex =
                    match.index + match[0].indexOf(methodName);
                const startPos = document.positionAt(methodNameIndex);
                const endPos = document.positionAt(
                    methodNameIndex + methodName.length
                );
                const range = new vscode.Range(startPos, endPos);

                diagnostics.push(
                    new vscode.Diagnostic(
                        range,
                        `Название метода "${methodName}" должно начинаться с "handle".`,
                        vscode.DiagnosticSeverity.Error
                    )
                );
                decorationRanges.push(range);
            }
        }
    }

    return { diagnostics, decorationRanges };
}
