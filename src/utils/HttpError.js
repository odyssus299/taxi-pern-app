class HttpError extends Error {
    constructor(message, code = 500, details) {
      super(message);
      this.code = code;
      this.details = details;
    }
  }
  module.exports = HttpError;