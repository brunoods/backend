// Este wrapper envolve as funções assíncronas e passa os erros para o middleware automaticamente
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;