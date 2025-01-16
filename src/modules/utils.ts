import * as ts from "typescript";

export class Utils {
    private checkedMethods: Set<string> = new Set();

    /**
     * Проверяет типы в узле AST и возвращает сообщения об ошибках.
     */
    public checkNode(
        node: ts.Node
    ): { range: ts.TextRange; message: string }[] {
        const errors: { range: ts.TextRange; message: string }[] = [];

        this.checkNodeRecursive(node, errors);
        return errors;
    }

    /**
     * Рекурсивно проверяет узлы AST и собирает ошибки.
     */
    private checkNodeRecursive(
        node: ts.Node,
        errors: { range: ts.TextRange; message: string }[]
    ) {
        if (ts.isMethodDeclaration(node)) {
            this.checkMethodDeclaration(node, errors);
        }

        if (ts.isCallExpression(node)) {
            this.checkCallExpression(node, errors);
        }

        // Рекурсивно проверяем дочерние узлы
        ts.forEachChild(node, (child) =>
            this.checkNodeRecursive(child, errors)
        );
    }

    /**
     * Проверяет объявление метода.
     */
    private checkMethodDeclaration(
        node: ts.MethodDeclaration,
        errors: { range: ts.TextRange; message: string }[]
    ) {
        const methodName = node.name.getText();

        // Проверяем, был ли метод уже проверен
        if (!this.checkedMethods.has(methodName)) {
            this.checkedMethods.add(methodName);

            // Проверяем, есть ли в методе оператор return
            const hasReturnStatement = this.hasReturn(node.body);

            if (hasReturnStatement) {
                const returnType = node.type ? node.type.getText() : "void";

                // Проверка возвращаемого типа
                if (returnType === "void" || returnType === "any") {
                    errors.push({
                        range: {
                            pos: node.name.getStart(),
                            end: node.name.getEnd(),
                        },
                        message: `Method "${methodName}" has no return type or it is "any".`,
                    });
                }
            }

            // Проверка параметров
            node.parameters.forEach((param) => {
                const paramName = param.name.getText();
                const paramType = param.type ? param.type.getText() : "any";

                // Если тип параметра "any", подсвечиваем его
                if (paramType === "any") {
                    errors.push({
                        range: {
                            pos: param.getStart(),
                            end: param.getEnd(),
                        },
                        message: `Parameter "${paramName}" has type "any". Avoid using "any" for better type safety.`,
                    });
                }
            });
        }
    }

    /**
     * Проверяет вызовы метода map.
     */
    private checkCallExpression(
        node: ts.CallExpression,
        errors: { range: ts.TextRange; message: string }[]
    ) {
        const expression = node.expression;
        if (
            ts.isPropertyAccessExpression(expression) &&
            expression.name.text === "map"
        ) {
            const callback = node.arguments[0];
            if (
                ts.isArrowFunction(callback) ||
                ts.isFunctionExpression(callback)
            ) {
                // Проверка типов параметров функции-колбэка
                callback.parameters.forEach((param) => {
                    const paramName = param.name.getText();
                    const paramType = param.type ? param.type.getText() : "any";

                    // Если тип параметра "any", подсвечиваем его
                    if (paramType === "any") {
                        errors.push({
                            range: {
                                pos: param.getStart(),
                                end: param.getEnd(),
                            },
                            message: `Parameter "${paramName}" in map callback has type "any". Avoid using "any" for better type safety.`,
                        });
                    }
                });

                // Проверка возвращаемого типа функции-колбэка
                const returnType = callback.type
                    ? callback.type.getText()
                    : "void";
                if (returnType === "void") {
                    errors.push({
                        range: {
                            pos: expression.name.getStart(),
                            end: expression.name.getEnd(),
                        },
                        message: `The map callback has no return type (void). Consider returning a value.`,
                    });
                }
            }
        }
    }

    /**
     * Проверяет, есть ли в теле метода оператор return.
     */
    private hasReturn(node: ts.Node | undefined): boolean {
        if (!node) return false;

        if (ts.isReturnStatement(node)) {
            return true;
        }

        let hasReturnStatement = false;
        ts.forEachChild(node, (child) => {
            if (this.hasReturn(child)) {
                hasReturnStatement = true;
            }
        });

        return hasReturnStatement;
    }

    /**
     * Создает SourceFile из кода.
     */
    public createSourceFile(code: string, filePath: string): ts.SourceFile {
        return ts.createSourceFile(
            filePath,
            code,
            ts.ScriptTarget.Latest,
            true
        );
    }
}

export const utils = new Utils();
