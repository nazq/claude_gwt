// Mock for ora
class Ora {
  constructor(options) {
    this.text = options?.text || '';
    this.isSpinning = false;
  }
  
  start(text) {
    if (text) this.text = text;
    this.isSpinning = true;
    return this;
  }
  
  stop() {
    this.isSpinning = false;
    return this;
  }
  
  succeed(text) {
    this.text = text || this.text;
    this.isSpinning = false;
    return this;
  }
  
  fail(text) {
    this.text = text || this.text;
    this.isSpinning = false;
    return this;
  }
  
  warn(text) {
    this.text = text || this.text;
    this.isSpinning = false;
    return this;
  }
  
  info(text) {
    this.text = text || this.text;
    this.isSpinning = false;
    return this;
  }
}

module.exports = (options) => new Ora(options);
module.exports.default = module.exports;