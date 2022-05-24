# fmlint README

FMLint is a static analysis tool for freemarker templating engine code in HTML files.

## Features

Checks if statement clauses are properly opened/closed and that they are correctly written e.g. [#if condition] not [if condition] (missing #).

Validates template literals are correct e.g. {first_name} -> ${first_name}

Checks for correctness of operators e.g. missing & for && or is like & & etc

## Known Issues
Not all problems are shown, in-process of building them all in!

## Release Notes

### 0.0.24
Now only runs when active editor is a html file

### 0.0.21
Now using AST to build the tokens through parsing (originally used simple regex to bootstrap).

### 0.0.1

Initial testing release of fmlink
