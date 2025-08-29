const catchAsync = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); // why: centralize error flow

module.exports = catchAsync;