import * as vscode from 'vscode';

/**
 * Extracts a CSS selector from the current editor context (cursor position).
 * 
 * This function looks at the line containing the cursor and a few lines around it
 * to find HTML/JSX attributes that can be used to identify elements in the preview.
 * 
 * Priority order:
 * 1. data-code-id attribute (best for explicit mapping)
 * 2. id attribute (unique identifier)
 * 3. class/className attribute (first class only)
 * 
 * This uses simple regex parsing - no heavy AST analysis needed.
 * 
 * @param document The text document
 * @param position The cursor position
 * @returns A CSS selector string or undefined if no suitable selector found
 */
export function selectorFromContext(
  document: vscode.TextDocument,
  position: vscode.Position
): string | undefined {
  const lineNumber = position.line;
  const startLine = Math.max(0, lineNumber - 2);
  const endLine = Math.min(document.lineCount - 1, lineNumber + 2);

  let contextText = '';
  for (let i = startLine; i <= endLine; i++) {
    contextText += document.lineAt(i).text + '\n';
  }

  const currentLineText = document.lineAt(lineNumber).text;

  // Priority 1: Look for data-code-id attribute
  const dataCodeIdMatch = 
    currentLineText.match(/data-code-id=["']([^"']+)["']/) ||
    currentLineText.match(/data-code-id=\{["']([^"']+)["']\}/);
  
  if (dataCodeIdMatch) {
    return `[data-code-id="${dataCodeIdMatch[1]}"]`;
  }

  // Priority 2: Look for id attribute
  const idMatch = 
    currentLineText.match(/\bid=["']([^"']+)["']/) ||
    currentLineText.match(/\bid=\{["']([^"']+)["']\}/);
  
  if (idMatch) {
    return `#${idMatch[1]}`;
  }

  // Priority 3: Look for class or className attribute
  const classMatch = 
    currentLineText.match(/\bclass(?:Name)?=["']([^"']+)["']/) ||
    currentLineText.match(/\bclass(?:Name)?=\{["']([^"']+)["']\}/);
  
  if (classMatch) {
    const classes = classMatch[1].trim().split(/\s+/);
    if (classes.length > 0 && classes[0]) {
      return `.${classes[0]}`;
    }
  }

  return undefined;
}

/**
 * Searches the document for a code location matching the given attribute.
 * Used for reverse mapping from preview clicks back to code.
 * 
 * @param document The text document to search
 * @param attributeType Type of attribute: 'data-code-id', 'id', or 'class'
 * @param value The attribute value to search for
 * @returns The range of the match or undefined
 */
export function findCodeLocation(
  document: vscode.TextDocument,
  attributeType: string,
  value: string
): vscode.Range | undefined {
  const text = document.getText();
  let searchPattern: RegExp;

  switch (attributeType) {
    case 'data-code-id':
      searchPattern = new RegExp(`data-code-id=["'\{]*["']?${escapeRegex(value)}["']?["\}]*`, 'i');
      break;
    case 'id':
      searchPattern = new RegExp(`\\bid=["'\{]*["']?${escapeRegex(value)}["']?["\}]*`, 'i');
      break;
    case 'class':
      searchPattern = new RegExp(`\\bclass(?:Name)?=["'\{]*["']?[^"']*\\b${escapeRegex(value)}\\b[^"']*["']?["\}]*`, 'i');
      break;
    default:
      return undefined;
  }

  const match = text.match(searchPattern);
  if (match && match.index !== undefined) {
    const startPos = document.positionAt(match.index);
    const endPos = document.positionAt(match.index + match[0].length);
    return new vscode.Range(startPos, endPos);
  }

  return undefined;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
