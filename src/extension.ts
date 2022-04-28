// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

type MatchedObj = {
  type: number,
  match: string,
  // To be fixed up later
  line: any,
  startPos: number,
  endPos: number
};

const readFileContents = () => {
  // Gets an if opener
  const getIfOpener = new RegExp('\\[#if(.*?)]', "gs");

  // Gets an if closer
  const getIfCloser = new RegExp('\\[\\/#if]', "gs");

  const checkIfs = [getIfOpener, getIfCloser];
  let order: any = [];

  const editor = vscode.window.activeTextEditor;

  if (editor) {

    // Push the matches of openers and closures to results
    // Add all matches to order
    checkIfs.map((k, i) => {
      for (let j = 0; j < editor.document.lineCount; j++) {
        const line = editor.document.lineAt(j);
        const matches: any = [...line.text.matchAll(k)];
        for (let k = 0; k < matches.length; k++) {
          const tmp: MatchedObj = {
            type: i,
            match: matches[k][0],
            line: j,
            startPos: matches[k].index,
            endPos: matches[k].index + matches[k][0].length
          };
          order.push(tmp);
        }
      }
    });
  }

  // Sort the orders by position to validate the statements
  order.sort((a: any, b: any) => a.line - b.line);

  let stack: MatchedObj[] = [];

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

  // Gets an incomplete variable e.g. {first_name} which should be ${first_name}
  const getIncompleteVariable = new RegExp('(?<!\\$){[^%](.*?)[^%]}', "gs");

  if (editor) {
    for (let j = 0; j < editor.document.lineCount; j++) {
      const line = editor.document.lineAt(j);
      const matches: any = [...line.text.matchAll(getIncompleteVariable)];
      for (let k = 0; k < matches.length; k++) {
        const tmp: MatchedObj = {
          type: 2,
          match: matches[k][0],
          line: j,
          startPos: matches[k].index,
          endPos: matches[k].index + matches[k][0].length
        };
        stack.push(tmp);
      }
    }
    stack.sort((a: any, b: any) => a.line - b.line);
  }

  // Gets an incomplete/incorrect statement e.g. [##if], [#if#], [/if]
  const getIncompleteStatement = new RegExp('((\\[\\/(((?!#).)[^\\]]*]))|(\\[(#[#].[^\\]]*]))|(\\[((?!\\/)(?!#).*[#][^\\]]*]))|(\\[((?!\\/)(?!#)[^\\]]*]))|((\\[#(([^\\]]*?)#)[^\\]]*])))', "gs");

  if (editor) {
    for (let j = 0; j < editor.document.lineCount; j++) {
      const line = editor.document.lineAt(j);
      const matches: any = [...line.text.matchAll(getIncompleteStatement)];
      for (let k = 0; k < matches.length; k++) {
        const tmp: MatchedObj = {
          type: 3,
          match: matches[k][0],
          line: j,
          startPos: matches[k].index,
          endPos: matches[k].index + matches[k][0].length
        };
        stack.push(tmp);
      }
    }
    stack.sort((a: any, b: any) => a.line - b.line);
  }

  // Gets an incomplete/incorrect operator e.g. [#if first_name = 'something'] or
  // [#if first_name == 'something' && surname == 'something' | company_name == 'something'] or
  // [#if first_name == 'something' & surname == 'something' || company_name == 'something'] or
  const getIncompleteOperator = new RegExp('\\[#if((.*?)(?<!=)=(?!=)(.*?)|((.*?)(?<!\\|)\\|(?!\\|)(.*?))|((.*?)(?<!\\&)\\&(?!\\&)(.*?)))]', "gs");

  if (editor) {
    for (let j = 0; j < editor.document.lineCount; j++) {
      const line = editor.document.lineAt(j);
      const matches: any = [...line.text.matchAll(getIncompleteOperator)];
      for (let k = 0; k < matches.length; k++) {
        const tmp: MatchedObj = {
          type: 4,
          match: matches[k][0],
          line: j,
          startPos: matches[k].index,
          endPos: matches[k].index + matches[k][0].length
        };
        stack.push(tmp);
      }
    }
    stack.sort((a: any, b: any) => a.line - b.line);
  }

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
        if (match.line === line && match.type === 0) {
          return new vscode.Hover({
            language: "Freemarker",
            value: "Missing closing [#/if] tag",
          });
        } else if (match.line === line && match.type === 1) {
          return new vscode.Hover({
            language: "Freemarker",
            value: "Missing opening [#if] tag",
          });
        } else if (match.line === line && match.type === 2) {
          return new vscode.Hover({
            language: "Freemarker",
            value: "Missing $ for variable ${variable_name}",
          });
        } else if (match.line === line && match.type === 3) {
          return new vscode.Hover({
            language: "Freemarker",
            value: "Incomplete or incorrect statement e.g. missing # or more than one #",
          });
        } else if (match.line === line && match.type === 4) {
          return new vscode.Hover({
            language: "Freemarker",
            value: "Incomplete operators found. Check for '==' & '&&' & '||'.",
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
        let currentLine = 0;

        for (const match of matches) {
          for (let i = currentLine; i < editor.document.lineCount; i++) {
            const line = editor.document.lineAt(i);
            if (line.text.includes(match.match) && i === match.line) {
              currentLine = i + 1;
              // const newDecoration = { range: new vscode.Range(line.range.start, line.range.end) };
              const newDecoration = { range: new vscode.Range(new vscode.Position(match.line, match.startPos), new vscode.Position(match.line, match.endPos)) };
              linesToDecorate.push(newDecoration);
              // vscode.window.showErrorMessage(`Line: ${match.line + 1} missing IF opener/closure`);
              break;
            }
          }
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