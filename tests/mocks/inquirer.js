// Mock for inquirer
const inquirer = {
  prompt: jest.fn(),
};

module.exports = inquirer;
module.exports.default = inquirer;