// Mock for chalk
const mockStyle = (text) => text;

const chalk = {
  hex: () => mockStyle,
  green: mockStyle,
  red: mockStyle,
  yellow: mockStyle,
  blue: mockStyle,
  gray: mockStyle,
  bold: mockStyle,
  dim: mockStyle,
};

export default chalk;
