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
  // Use unified streaming parser to find the nearest containing tag
  const nearestTagContent = findNearestTagStreamingParser(document, position);
  
  if (nearestTagContent) {
    const selector = extractSelectorFromText(nearestTagContent);
    if (selector) {
      return selector;
    }
  }
  
  return undefined;
}

/**
 * Unified streaming tag parser that finds the nearest containing tag by scanning forward
 * from a lookback window to the cursor position.
 * 
 * This parser handles all edge cases in a single forward pass:
 * - Same-line sibling elements (e.g., <div>foo</div><span>bar|</span>)
 * - Same-line nested elements (e.g., <div><span>text|</span></div>)
 * - Multiline tags with attributes spanning multiple lines
 * - Cursor on any line of a multiline tag
 * 
 * Algorithm:
 * 1. Start from a lookback window (current line - 10)
 * 2. Iterate line-by-line FORWARD from lookback start to cursor line
 * 3. Maintain a stack of open elements
 * 4. For each line:
 *    - Find all tag tokens (opening and closing)
 *    - For opening tags, use extractCompleteTag to handle multiline tags
 *    - Push opening tags onto stack with metadata (line, column, tag content)
 *    - Pop closing tags from stack
 *    - On cursor line: stop processing at cursor column
 * 5. Return the top of the stack (innermost containing element)
 * 
 * @param document The text document
 * @param position The cursor position (includes both line and column)
 * @returns The complete tag content (including multiline attributes) or undefined
 */
function findNearestTagStreamingParser(
  document: vscode.TextDocument,
  position: vscode.Position
): string | undefined {
  interface StackEntry {
    tagName: string;
    line: number;
    column: number;
    tagContent: string;
  }
  
  const stack: StackEntry[] = [];
  const maxLookback = 10;
  const startLine = Math.max(0, position.line - maxLookback);
  const cursorLine = position.line;
  const cursorColumn = position.character;
  
  // Iterate forward from lookback start to cursor line
  for (let lineNum = startLine; lineNum <= cursorLine; lineNum++) {
    const line = document.lineAt(lineNum).text;
    
    // On cursor line, only process tags before the cursor column
    const effectiveLineText = lineNum === cursorLine ? line.substring(0, cursorColumn) : line;
    
    // Find all tag tokens on this line
    const tagPattern = /<\/?(\w+)(?:\s[^>]*)?>/g;
    const tags: Array<{ 
      type: 'open' | 'close' | 'self-closing'; 
      tagName: string; 
      index: number;
      fullMatch: string;
    }> = [];
    
    let match;
    while ((match = tagPattern.exec(effectiveLineText)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];
      const index = match.index;
      
      if (fullTag.startsWith('</')) {
        tags.push({ type: 'close', tagName, index, fullMatch: fullTag });
      } else if (fullTag.endsWith('/>')) {
        tags.push({ type: 'self-closing', tagName, index, fullMatch: fullTag });
      } else {
        tags.push({ type: 'open', tagName, index, fullMatch: fullTag });
      }
    }
    
    // Process tags in forward (left-to-right) order
    for (const tag of tags) {
      if (tag.type === 'open') {
        // Extract complete tag content (handles multiline tags)
        const completeTag = extractCompleteTag(document, lineNum, tag.tagName, tag.index);
        
        if (completeTag) {
          // Push opening tag onto stack
          stack.push({
            tagName: tag.tagName,
            line: lineNum,
            column: tag.index,
            tagContent: completeTag
          });
        }
      } else if (tag.type === 'close') {
        // Pop matching opening tag from stack
        // Use simple pop without tag name matching for robustness (handles malformed HTML)
        if (stack.length > 0) {
          stack.pop();
        }
      }
      // self-closing tags don't affect the stack
    }
    
    // Special handling for cursor line: check for incomplete opening tags
    // (tags that have started but haven't reached their closing '>' yet before cursor)
    if (lineNum === cursorLine) {
      // Find the last '<' that starts a tag name before the cursor
      // Look for pattern: < followed by word characters (tag name)
      const incompleteTagPattern = /<(\w+)/g;
      let lastIncompleteTag: { tagName: string; index: number } | null = null;
      
      let incompleteMatch;
      while ((incompleteMatch = incompleteTagPattern.exec(effectiveLineText)) !== null) {
        const tagName = incompleteMatch[1];
        const tagStartIndex = incompleteMatch.index;
        
        // Check if this tag has a closing '>' before the cursor
        const textAfterTag = effectiveLineText.substring(tagStartIndex);
        const hasClosingBracket = textAfterTag.includes('>');
        
        // If no closing '>', this is an incomplete tag
        if (!hasClosingBracket) {
          lastIncompleteTag = { tagName, index: tagStartIndex };
        }
      }
      
      // If we found an incomplete opening tag, extract it and push to stack
      if (lastIncompleteTag) {
        const completeTag = extractCompleteTag(
          document, 
          lineNum, 
          lastIncompleteTag.tagName, 
          lastIncompleteTag.index
        );
        
        if (completeTag) {
          // Push this incomplete tag onto the stack
          stack.push({
            tagName: lastIncompleteTag.tagName,
            line: lineNum,
            column: lastIncompleteTag.index,
            tagContent: completeTag
          });
        }
      }
    }
  }
  
  // The top of the stack is the innermost element containing the cursor
  if (stack.length > 0) {
    const topElement = stack[stack.length - 1];
    return topElement.tagContent;
  }
  
  return undefined;
}

/**
 * Extracts the complete tag content starting from a given position,
 * handling multiline attributes.
 * 
 * @param document The text document
 * @param startLine The line where the tag starts
 * @param tagName The tag name
 * @param startColumn The column where the tag starts
 * @returns The complete opening tag string or undefined
 */
function extractCompleteTag(
  document: vscode.TextDocument,
  startLine: number,
  tagName: string,
  startColumn: number
): string | undefined {
  let tagContent = '';
  let foundClosing = false;
  
  // Collect tag content from startLine until we find the closing '>'
  for (let i = startLine; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    
    if (i === startLine) {
      // First line: start from the tag's start column
      tagContent += line.substring(startColumn);
    } else {
      // Subsequent lines: include entire line
      tagContent += ' ' + line; // Add space to preserve attribute spacing
    }
    
    // Check if we've found the closing '>'
    if (tagContent.includes('>')) {
      foundClosing = true;
      break;
    }
    
    // Safety limit: don't scan more than 10 lines for a single tag
    if (i - startLine > 10) {
      break;
    }
  }
  
  if (!foundClosing) {
    return undefined;
  }
  
  // Extract just the opening tag (from '<tagName' to first '>')
  const tagMatch = tagContent.match(new RegExp(`<${tagName}[^>]*>`));
  if (tagMatch) {
    return tagMatch[0];
  }
  
  return undefined;
}

/**
 * Helper function to extract a selector from a text snippet.
 * Checks for data-code-id, id, and class attributes in priority order.
 */
function extractSelectorFromText(text: string): string | undefined {
  // Priority 1: data-code-id attribute
  const dataCodeIdMatch = 
    text.match(/data-code-id\s*=\s*["']([^"']+)["']/) ||
    text.match(/data-code-id\s*=\s*\{\s*["']([^"']+)["']\s*\}/);
  
  if (dataCodeIdMatch) {
    return `[data-code-id="${dataCodeIdMatch[1]}"]`;
  }

  // Priority 2: id attribute
  const idMatch = 
    text.match(/\bid\s*=\s*["']([^"']+)["']/) ||
    text.match(/\bid\s*=\s*\{\s*["']([^"']+)["']\s*\}/);
  
  if (idMatch) {
    return `#${idMatch[1]}`;
  }

  // Priority 3: class or className attribute
  const classMatch = 
    text.match(/\bclass(?:Name)?\s*=\s*["']([^"']+)["']/) ||
    text.match(/\bclass(?:Name)?\s*=\s*\{\s*["']([^"']+)["']\s*\}/);
  
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
