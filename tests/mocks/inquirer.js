// Mock for inquirer
import { vi } from 'vitest';

const inquirer = {
  prompt: vi.fn(async (questions) => {
    // Simple mock implementation that returns default values
    const answers = {};
    const questionsArray = Array.isArray(questions) ? questions : [questions];
    
    for (const q of questionsArray) {
      if (q.default !== undefined) {
        answers[q.name] = q.default;
      } else if (q.type === 'confirm') {
        answers[q.name] = true;
      } else if (q.type === 'list' || q.type === 'expand') {
        answers[q.name] = q.choices?.[0]?.value || q.choices?.[0] || '';
      } else {
        answers[q.name] = '';
      }
    }
    
    return answers;
  }),
  registerPrompt: vi.fn(),
  createPromptModule: vi.fn(() => inquirer.prompt),
};

export default inquirer;