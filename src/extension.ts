// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

interface MatchedObj {
  type: number,
  match: string,
  startLine: number,
  endLine: number,
  startPos: number,
  endPos: number,
  charPosStart: number,
  charPosEnd: number
};

const readFileContents = () => {
  let stack: MatchedObj[] = [];
  const parse = (text: string) => {
    // Reason for this is so we can keep track of the char position in the given file
    // when we start shifting the chars out
    let textToShift = [...text];
    let textToChars = [...text];

    // The current char position in the given file
    let textPos = 0;

    let startLine = 0;

    // Number of lines iterated over since the starting line
    let lineNum = 0;

    // const getSymbol = () => {
    //   while (textToChars.length > 0 && textToChars[0] === " ") {
    //     textToChars.shift();
    //   }

    //   return textToChars[0] || "";
    // };

    const nextSymbol = () => {
      textToShift.shift();
      return ++textPos;
    };

    const newLineCheck = () => {
      if (textToChars[textPos] === "\n") {
        return true;
      }

      return false;
    };

    const findSyntax = (charOpen: string, charClose: string, end: number) => {
      let builder = "";
      let startPos = end;
      let endPos = end;
      let startPosChar = textPos;
      let endPosChar = textPos;
      lineNum = 0;

      // Skip every char until an opening [
      while (textToChars[textPos] !== charOpen && textPos < textToChars.length) {
        // Increase line number so we can track position & not add to syntax
        if (newLineCheck()) {
          startLine++;
          startPos = 0;
        } else {
          startPos++;
        }
        nextSymbol();
      }

      startPosChar = textPos;

      endPos = startPos;

      while (textToChars[textPos] !== charClose && textPos < textToChars.length) {
        // Increase line number so we can track position & not add to syntax
        if (newLineCheck()) {
          lineNum++;
          endPos = 0;
        } else {
          endPos++;
          if (textToChars[textPos] !== "\r") {
            builder += textToChars[textPos];
          }
        }
        nextSymbol();
      }

      // Finishing touches
      if (textToChars[textPos] === charClose) {
        builder += charClose;
        endPosChar = textPos;
      }

      return {
        syntax: builder,
        startLine: startLine,
        startPos: startPos,
        endLine: startLine + lineNum,
        endPos: endPos,
        charPosStart: startPosChar,
        charPosEnd: endPosChar,
      };
    };

    let found = [];
    const syntaxes = [["[", "]"], ["{", "}"]];

    for (const syntax of syntaxes) {
      textToShift = [...text];
      textPos = 0;
      lineNum = 0;
      startLine = 0;

      // Final char position of matched syntax on the last line
      let end = 0;

      while (textToShift.includes(syntax[0]) && textToShift.includes(syntax[1])) {
        const data = findSyntax(syntax[0], syntax[1], end);
        found.push(data);
        end = data.endPos;
        startLine = data.endLine;
      }
    }

    found.sort((a, b) => {
      if (a.startLine === b.startLine) {
        return a.startPos - b.startPos;
      }

      return a.startLine - b.startLine;
    });

    return found;
  };

  const validateMatch = (match: string, pattern: string) => {
    let count = 0;

    for (let i = 0; i < match.length; i++) {
      if (match[i] === pattern) {
        count++;
      }
    }
    return count === 0 || count > 1 ? true : false;
  };

  const validateOperators = (match: string) => {

    for (let i = 0; i < match.length; i++) {
      // Ignore if the check was ok and skip to next char
      if ((match[i] === "=" && (match[i - 1] === "=" || match[i - 1] === "!")) || (match[i] === "|" && match[i - 1] === "|") || (match[i] === "&" && match[i - 1] === "&")) {
        i++;
      }

      if (i + 1 <= match.length) {
        const char = match[i];
        const charNext = match[i + 1];
        if (((char === "=" || char === "!") && charNext !== "=") || (char === "|" && charNext !== "|") || (char === "&" && charNext !== "&")) {
          return 4;
        }
      }
    }

    return 0;
  };

  let order: any = [];

  const editor = vscode.window.activeTextEditor;

  const editorFileName = vscode.window.activeTextEditor?.document.fileName;

  // Only run when the current active file is html
  if (editor && editorFileName?.slice(-5) === ".html") {
    const text = editor.document.getText();
    const tmp = parse(`${text}`);

    for (const match of tmp) {
      // Base case if something isn't getting properly assigned a type
      let type = -1;

      // 1. Catching the opening if blocks
      // 2. Catching the closing if blocks
      // 3. Catching the template literals where they do not have a starting $ before {}
      if (match.syntax.includes("#if") && !match.syntax.includes("/#if")) {

        // Validating that the operators found in the condition are valid
        type = validateOperators(match.syntax);

      } else if (match.syntax.includes("/#if")) {
        type = 1;
      } else if (match.syntax.includes("{") && text[match.charPosStart - 1] !== "$" && !match.syntax.includes("%")) {
        type = 2;
      }

      // Validate if blocks do not have syntax errors e.g. multiple or missing #, / etc
      // 1. If block validated how many #
      // 2. If block closure contains just one /
      // 3. If block is not missing an opening [
      // 4. If block is missing closing ] - Will cause opening block to say no closing block found as well
      if (((type === 0 || type === 1) && validateMatch(match.syntax, "#")) || (match.syntax.includes("/#if") && validateMatch(match.syntax, "/")) || (!match.syntax.includes("[") && match.syntax.includes("]")) || (match.syntax.includes("[") && !match.syntax.includes("]"))) {
        type = 3;
      }

      const toPush: MatchedObj = {
        match: match.syntax,
        type: type,
        startLine: match.startLine,
        endLine: match.endLine,
        startPos: match.startPos,
        endPos: match.endPos,
        charPosStart: match.charPosStart,
        charPosEnd: match.charPosEnd
      };

      order.push(toPush);

      // These types are errors on their own and are not correct
      if (type > 1) {
        stack.push(toPush);
      }
    }
  };

  // Sort the orders by position to validate the statements
  order.sort((a: any, b: any) => {
    if (a.startLine === b.startLine) {
      return a.startPos - b.startPos;
    };

    return a.startLine - b.startLine;
  });

  // Stack operation (currently pushes/pops if blocks)
  for (let i = 0; i < order.length; i++) {
    let currentChar = order[i];

    if (currentChar.type === 0) {
      stack.push(currentChar);
    } else if ((currentChar.type === 1) && stack.length === 0) {
      stack.push(currentChar);
    } else if (currentChar.type === 1 && stack[stack.length - 1].type === 0) {
      stack.pop();
    } else if (currentChar.type === 1) {
      stack.push(currentChar);
    }
  }

  stack.sort((a: any, b: any) => {
    if (a.startLine === b.startLine) {
      return a.startPos - b.startPos;
    };

    return a.startLine - b.startLine;
  });

  return stack;
};

let results: MatchedObj[] = readFileContents();

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Freemarker static analysis activated');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand("fmlint.helloWorld", () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage(`Freemarker static analysis activated!`);


  });

  context.subscriptions.push(disposable);

  let disp = vscode.languages.registerHoverProvider('html', {
    provideHover(document, position, token) {

      // const range = document.getWordRangeAtPosition(position);
      // const word = document.getText(range);

      const line = position.line;

      for (const match of results) {
        if ((match.startLine > line || line <= match.endLine) && match.type === 0) {
          return new vscode.Hover({
            language: "html",
            value: "Missing closing [#/if] tag.",
          });
        } else if ((match.startLine > line || line <= match.endLine) && match.type === 1) {
          return new vscode.Hover({
            language: "html",
            value: "Missing opening [#if] tag.",
          });
        } else if ((match.startLine > line || line <= match.endLine) && match.type === 2) {
          return new vscode.Hover({
            language: "html",
            value: "Missing $ for variable ${variable_name}.",
          });
        } else if ((match.startLine > line || line <= match.endLine) && match.type === 3) {
          return new vscode.Hover({
            language: "html",
            value: "Syntax error. block scope is missing, or is incomplete or incorrect statement.",
          });
        } else if ((match.startLine > line || line <= match.endLine) && match.type === 4) {
          return new vscode.Hover({
            language: "html",
            value: "Incomplete operators found. Check for '==', '!=', '&&', or '||'.",
          });
        }
      }
    }
  });
  context.subscriptions.push(disp);
}

// this method is called when your extension is deactivated
export function deactivate() { }

const getDecorationTypeFromConfig = (type: number = -1) => {

  const defaultType = {
    isWholeLine: false,
    border: `2px`,
    borderStyle: `dotted`,
    borderColor: 'red'
  };

  const decorationType = vscode.window.createTextEditorDecorationType(defaultType);

  if (type === 2) {
    const incorrectVariable = {
      isWholeLine: false,
      border: `2px`,
      borderStyle: `dotted`,
      borderColor: 'green'
    };
    const decorationType = vscode.window.createTextEditorDecorationType(incorrectVariable);
    return decorationType;
  }

  return decorationType;
};

let decorationType = getDecorationTypeFromConfig();

/**
     * This is required. When we create a new tab in our editor, we want
     * to update the activeEditor.
     */
vscode.window.onDidChangeActiveTextEditor(() => {
  try {
    results = readFileContents();
    updateDecorations(decorationType);
  } catch (error) {
    console.error("window.ondidChangeActiveTextEditor: ", error);
  }
});

/**
* Any time we move anywhere around our editor, we want to trigger
* a decoration.
*/
vscode.window.onDidChangeTextEditorSelection(() => {
  results = readFileContents();
  updateDecorations(decorationType);
});

const updateDecorations = (decorationType: any, updateAllVisibleEditors = false) => {
  try {
    if (updateAllVisibleEditors) {
      vscode.window.visibleTextEditors.forEach((editor) => {
        const currentPosition = editor.selection.active;
        const newDecoration = { range: new vscode.Range(currentPosition, currentPosition) };
        editor.setDecorations(decorationType, [newDecoration]);
      });
    }

    // edit only currently active editor
    else {
      vscode.window.visibleTextEditors.forEach((editor) => {
        if (editor !== vscode.window.activeTextEditor) {
          return 0;
        };

        // Start highlighting the lines
        const matches = results;
        let linesToDecorate = [];
        // let currentLine = 0;

        for (const match of matches) {
          const newDecoration = { range: new vscode.Range(new vscode.Position(match.startLine, match.startPos), new vscode.Position(match.endLine, match.endPos + 1)) };
          linesToDecorate.push(newDecoration);
        }

        editor.setDecorations(decorationType, linesToDecorate);
      });
    }
  }
  catch (error) {
    console.error("updateDecorations: ", error);
  }
}

vscode.workspace.onDidChangeConfiguration(() => {
  //clear all decorations
  decorationType.dispose();
  decorationType = getDecorationTypeFromConfig();
  updateDecorations(decorationType, true);
});