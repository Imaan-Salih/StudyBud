export const preprocessLaTeX = (text: string): string => {
  if (!text) return text;
  
  // 1. Unescape escaped dollar signs: \$ -> $
  let processed = text.replace(/\\\$/g, '$');
  
  // 2. Convert standard LaTeX block delimiters \[ ... \] to $$ ... $$
  // Use a regex that matches across newlines
  processed = processed.replace(/\\\[(.*?)\\\]/gs, (_, math) => `$$${math}$$`);
  
  // 3. Convert standard LaTeX inline delimiters \( ... \) to $ ... $
  processed = processed.replace(/\\\((.*?)\\\)/g, (_, math) => `$${math}$`);

  return processed;
};
