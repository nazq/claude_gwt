/**
 * Wrapper for boxen to handle ESM compatibility issues
 * This allows us to support both Node 18 (which has ESM issues) and newer versions
 */

export interface BoxenOptions {
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number };
  borderStyle?: string;
  borderColor?: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Creates a box around text. Falls back to simple formatting if boxen is not available.
 */
export async function createBox(text: string, options?: BoxenOptions): Promise<string> {
  try {
    // Try to dynamically import boxen (ESM module)
    const boxenModule = await import('boxen');
    const boxen = boxenModule.default;
    return boxen(text, options as any);
  } catch (error) {
    // Fallback for environments where boxen doesn't work (e.g., Node 18 with CommonJS)
    return createSimpleBox(text, options);
  }
}

/**
 * Simple fallback box implementation
 */
function createSimpleBox(text: string, options?: BoxenOptions): string {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map((line) => line.length));
  const padding = typeof options?.padding === 'number' ? options.padding : 1;
  // Note: borderColor is not implemented in the simple fallback

  // Create top border
  const horizontalLine = '─'.repeat(maxLength + padding * 2 + 2);
  const topBorder = `┌${horizontalLine}┐`;
  const bottomBorder = `└${horizontalLine}┘`;

  // Create padded lines
  const paddedLines: string[] = [];

  // Add top padding
  for (let i = 0; i < padding; i++) {
    paddedLines.push(`│${' '.repeat(maxLength + padding * 2 + 2)}│`);
  }

  // Add content lines
  for (const line of lines) {
    const paddingSpace = ' '.repeat(padding);
    const rightPadding = ' '.repeat(maxLength - line.length);
    paddedLines.push(`│${paddingSpace}${line}${rightPadding}${paddingSpace}│`);
  }

  // Add bottom padding
  for (let i = 0; i < padding; i++) {
    paddedLines.push(`│${' '.repeat(maxLength + padding * 2 + 2)}│`);
  }

  // Combine all parts
  const result = [topBorder, ...paddedLines, bottomBorder].join('\n');

  // Add margin if specified
  const margin = typeof options?.margin === 'number' ? options.margin : 0;
  if (margin > 0) {
    const emptyLine = '\n'.repeat(margin);
    return emptyLine + result + emptyLine;
  }

  return result;
}
